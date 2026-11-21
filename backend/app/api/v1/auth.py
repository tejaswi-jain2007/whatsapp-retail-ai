from datetime import datetime, timezone, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.entities import User, Store, StoreUser, Product
from app.schemas.auth import (
    UserSignup,
    UserLogin,
    Token,
    UserResponse,
    StoreRegisterRequest,
    StoreRegisterResponse,
)
from app.utils.security import hash_password, verify_password, create_access_token
from app.utils.phone import normalize_phone_number
from app.services.pricing.master_catalogue import STANDARD_KIRANA_CATALOGUE
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register-store", response_model=StoreRegisterResponse, status_code=status.HTTP_201_CREATED)
def register_store(data: StoreRegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new store with a 14-day free trial.
    Auto-creates the shopkeeper user, store entity, 14-day trial period,
    and automatically seeds 50+ essential Indian grocery items into their inventory.
    """
    clean_phone = normalize_phone_number(data.phone)
    email = data.email.strip() if data.email and "@" in data.email else f"store_{clean_phone}@retailai.in"
    password = data.password or "kirana123"

    # Check if user with email already exists
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            name=data.owner_name,
            email=email,
            password_hash=hash_password(password),
            phone=clean_phone,
            role="shopkeeper",
        )
        db.add(user)
        db.flush()

    now = datetime.now(timezone.utc)
    trial_ends = now + timedelta(days=14)

    store = Store(
        owner_id=user.id,
        store_name=data.store_name,
        address=data.address or "",
        phone=clean_phone,
        whatsapp_phone_number_id=clean_phone,
        status="active",
        subscription_status="trial",
        trial_starts_at=now,
        trial_ends_at=trial_ends,
        subscription_plan="monthly_299",
        subscription_price=Decimal("299.00"),
    )
    db.add(store)
    db.flush()

    # Link store user
    existing_link = (
        db.query(StoreUser)
        .filter(StoreUser.store_id == store.id, StoreUser.user_id == user.id)
        .first()
    )
    if not existing_link:
        db.add(StoreUser(store_id=store.id, user_id=user.id, role="owner"))

    # Auto-seed 50+ master kirana products
    seeded_count = 0
    for item in STANDARD_KIRANA_CATALOGUE:
        prod = Product(
            store_id=store.id,
            name=item["name"],
            brand=item.get("brand"),
            variant=item.get("variant"),
            aliases=item.get("aliases", []),
            unit=item["unit"],
            current_price=item["current_price"],
            stock_quantity=item.get("stock_quantity", 100),
            availability=True,
        )
        db.add(prod)
        seeded_count += 1

    db.commit()
    db.refresh(store)

    access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role}
    )

    return StoreRegisterResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        store_id=store.id,
        store_name=store.store_name,
        subscription_status=store.subscription_status,
        trial_starts_at=store.trial_starts_at,
        trial_ends_at=store.trial_ends_at,
        days_left=14,
        seeded_products_count=seeded_count,
    )



@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(data: UserSignup, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        phone=data.phone,
        role=data.role or "shopkeeper",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    access_token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(user: User = Depends(get_current_user)):
    return user

