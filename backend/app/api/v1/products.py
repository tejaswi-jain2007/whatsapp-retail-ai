from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.entities import Product, User, PriceHistory
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    PriceUpdateRequest,
    PriceHistoryResponse,
)
from app.api.deps import get_current_user, verify_store_access
from app.services.pricing.engine import pricing_engine

router = APIRouter(tags=["Products & Catalogue"])


@router.get("/stores/{store_id}/products", response_model=List[ProductResponse])
def list_store_products(
    store_id: str,
    db: Session = Depends(get_db),
    _store=Depends(verify_store_access),
):
    return db.query(Product).filter(Product.store_id == store_id).all()


@router.post("/stores/{store_id}/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    store_id: str,
    data: ProductCreate,
    db: Session = Depends(get_db),
    _store=Depends(verify_store_access),
):
    product = Product(
        store_id=store_id,
        category_id=data.category_id,
        name=data.name,
        brand=data.brand,
        variant=data.variant,
        aliases=data.aliases,
        unit=data.unit,
        current_price=data.current_price,
        stock_quantity=data.stock_quantity,
        availability=data.availability,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: str,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    verify_store_access(product.store_id, current_user, db)

    for field, val in data.model_dump(exclude_unset=True).items():
        if field == "current_price" and val is not None and val != product.current_price:
            pricing_engine.update_product_price(
                db, product, val, source="manual_override", updated_by=current_user.id
            )
        else:
            setattr(product, field, val)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    verify_store_access(product.store_id, current_user, db)

    # Soft delete / set unavailable to preserve order item history
    product.availability = False
    db.commit()
    return


@router.post("/products/{product_id}/price", response_model=ProductResponse)
def update_product_price(
    product_id: str,
    data: PriceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    verify_store_access(product.store_id, current_user, db)

    updated = pricing_engine.update_product_price(
        db, product, data.new_price, source=data.source, updated_by=current_user.id
    )
    return updated


@router.get("/products/{product_id}/price-history", response_model=List[PriceHistoryResponse])
def get_product_price_history(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    verify_store_access(product.store_id, current_user, db)

    return (
        db.query(PriceHistory)
        .filter(PriceHistory.product_id == product_id)
        .order_by(PriceHistory.effective_at.desc())
        .all()
    )
