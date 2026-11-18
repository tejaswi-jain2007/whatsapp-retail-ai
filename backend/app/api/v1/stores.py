from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.entities import Store, BusinessCategory, User
from app.schemas.store import StoreCreate, StoreUpdate, StoreResponse, BusinessCategoryResponse
from app.api.deps import get_current_user

router = APIRouter(tags=["Stores & Categories"])


@router.get("/categories", response_model=List[BusinessCategoryResponse])
def list_business_categories(db: Session = Depends(get_db)):
    return db.query(BusinessCategory).filter(BusinessCategory.is_active == True).all()


@router.get("/stores", response_model=List[StoreResponse])
def list_user_stores(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if current_user.role == "admin":
        return db.query(Store).all()
    return db.query(Store).filter(Store.owner_id == current_user.id).all()


@router.post("/stores", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
def create_store(
    data: StoreCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = Store(
        owner_id=current_user.id,
        category_id=data.category_id,
        store_name=data.store_name,
        address=data.address,
        phone=data.phone,
        whatsapp_business_account_id=data.whatsapp_business_account_id,
        whatsapp_phone_number_id=data.whatsapp_phone_number_id,
        status="active",
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


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
    return store


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
    return store
