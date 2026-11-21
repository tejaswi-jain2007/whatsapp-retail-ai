from typing import List
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.entities import Store, BusinessCategory, User
from app.schemas.store import (
    StoreCreate,
    StoreUpdate,
    StoreResponse,
    BusinessCategoryResponse,
    SubscriptionStatusResponse,
)
from app.api.deps import get_current_user

router = APIRouter(tags=["Stores & Categories"])


def enrich_store_subscription(store: Store, db: Session) -> Store:
    now = datetime.now(timezone.utc)
    if store.subscription_status == "trial":
        if store.trial_ends_at:
            trial_end = store.trial_ends_at
            if trial_end.tzinfo is None:
                trial_end = trial_end.replace(tzinfo=timezone.utc)
            delta = trial_end - now
            days_left = max(0, delta.days)
            if now > trial_end:
                store.subscription_status = "expired"
                store.status = "paused"
                db.commit()
                days_left = 0
            store.days_left_in_trial = days_left
        else:
            store.days_left_in_trial = 14
    elif store.subscription_status == "active":
        if store.subscription_valid_until:
            valid_until = store.subscription_valid_until
            if valid_until.tzinfo is None:
                valid_until = valid_until.replace(tzinfo=timezone.utc)
            delta = valid_until - now
            days_left = max(0, delta.days)
            if now > valid_until:
                store.subscription_status = "expired"
                store.status = "paused"
                db.commit()
                days_left = 0
            store.days_left_in_trial = days_left
        else:
            store.days_left_in_trial = 30
    else:
        store.days_left_in_trial = 0

    store.is_paused = store.status == "paused" or store.subscription_status == "expired"
    store.is_subscription_required = store.is_paused
    return store


@router.get("/categories", response_model=List[BusinessCategoryResponse])
def list_business_categories(db: Session = Depends(get_db)):
    return db.query(BusinessCategory).filter(BusinessCategory.is_active == True).all()


@router.get("/stores", response_model=List[StoreResponse])
def list_user_stores(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if current_user.role == "admin":
        stores = db.query(Store).all()
    else:
        stores = db.query(Store).filter(Store.owner_id == current_user.id).all()
    return [enrich_store_subscription(s, db) for s in stores]


@router.post("/stores", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
def create_store(
    data: StoreCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    store = Store(
        owner_id=current_user.id,
        category_id=data.category_id,
        store_name=data.store_name,
        address=data.address,
        phone=data.phone,
        whatsapp_business_account_id=data.whatsapp_business_account_id,
        whatsapp_phone_number_id=data.whatsapp_phone_number_id,
        status="active",
        subscription_status="trial",
        trial_starts_at=now,
        trial_ends_at=now + timedelta(days=14),
        subscription_plan="monthly_299",
        subscription_price=Decimal("299.00"),
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    return enrich_store_subscription(store, db)


@router.get("/stores/{store_id}", response_model=StoreResponse)
def get_store(
    store_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if current_user.role != "admin" and store.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return enrich_store_subscription(store, db)


@router.put("/stores/{store_id}", response_model=StoreResponse)
def update_store(
    store_id: str,
    data: StoreUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if current_user.role != "admin" and store.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(store, field, val)

    db.commit()
    db.refresh(store)
    return enrich_store_subscription(store, db)


@router.get("/stores/{store_id}/subscription", response_model=SubscriptionStatusResponse)
def get_subscription_status(
    store_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if current_user.role != "admin" and store.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    store = enrich_store_subscription(store, db)
    days_left = store.days_left_in_trial or 0

    if store.is_paused:
        msg = f"Trial expired. Store is paused. Pay ₹{store.subscription_price}/month to resume WhatsApp ordering."
    elif store.subscription_status == "active":
        msg = f"Subscription active. {days_left} days remaining."
    else:
        msg = f"14-Day Free Trial active. {days_left} days remaining."

    return SubscriptionStatusResponse(
        store_id=store.id,
        store_name=store.store_name,
        status=store.status,
        subscription_status=store.subscription_status,
        subscription_plan=store.subscription_plan,
        subscription_price=float(store.subscription_price or 299.00),
        trial_starts_at=store.trial_starts_at,
        trial_ends_at=store.trial_ends_at,
        subscription_valid_until=store.subscription_valid_until,
        days_left=days_left,
        is_paused=store.is_paused,
        is_subscription_required=store.is_subscription_required,
        message=msg,
    )


@router.post("/stores/{store_id}/subscribe", response_model=SubscriptionStatusResponse)
def subscribe_store(
    store_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Subscribes the store for 30 days at ₹299/month.
    Unpauses the store and enables WhatsApp ordering.
    """
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if current_user.role != "admin" and store.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    now = datetime.now(timezone.utc)
    store.subscription_status = "active"
    store.status = "active"
    store.subscription_plan = "monthly_299"
    store.subscription_price = Decimal("299.00")
    store.subscription_valid_until = now + timedelta(days=30)
    db.commit()
    db.refresh(store)

    return get_subscription_status(store_id=store_id, current_user=current_user, db=db)


@router.post("/stores/{store_id}/simulate-trial-expiry", response_model=SubscriptionStatusResponse)
def simulate_trial_expiry(
    store_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Testing helper: Instantly expires the 14-day trial and pauses the store.
    """
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if current_user.role != "admin" and store.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    now = datetime.now(timezone.utc)
    store.trial_ends_at = now - timedelta(hours=1)
    store.subscription_status = "expired"
    store.status = "paused"
    store.subscription_valid_until = None
    db.commit()
    db.refresh(store)

    return get_subscription_status(store_id=store_id, current_user=current_user, db=db)


@router.post("/stores/{store_id}/reset-trial", response_model=SubscriptionStatusResponse)
def reset_trial(
    store_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Testing helper: Resets store to fresh 14-day free trial.
    """
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if current_user.role != "admin" and store.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    now = datetime.now(timezone.utc)
    store.trial_starts_at = now
    store.trial_ends_at = now + timedelta(days=14)
    store.subscription_status = "trial"
    store.status = "active"
    store.subscription_valid_until = None
    db.commit()
    db.refresh(store)

    return get_subscription_status(store_id=store_id, current_user=current_user, db=db)


