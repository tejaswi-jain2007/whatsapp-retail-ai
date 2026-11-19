from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class ProductCreate(BaseModel):
    store_id: Optional[str] = None
    category_id: Optional[str] = None
    name: str
    brand: Optional[str] = None
    variant: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)
    unit: str
    current_price: Decimal
    stock_quantity: Decimal = Decimal("0.000")
    availability: bool = True


class ProductUpdate(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    variant: Optional[str] = None
    aliases: Optional[List[str]] = None
    unit: Optional[str] = None
    current_price: Optional[Decimal] = None
    stock_quantity: Optional[Decimal] = None
    availability: Optional[bool] = None


class PriceUpdateRequest(BaseModel):
    new_price: Decimal
    source: str = "manual_override"  # manual_override, store_defined, external_reference


class PriceHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    previous_price: Decimal
    new_price: Decimal
    source: str
    updated_by: Optional[str]
    effective_at: datetime


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    store_id: str
    category_id: Optional[str]
    name: str
    brand: Optional[str]
    variant: Optional[str]
    aliases: Optional[List[str]]
    unit: str
    current_price: Decimal
    stock_quantity: Decimal
    availability: bool
    created_at: datetime
    updated_at: datetime
