from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from app.schemas.customer import CustomerResponse


class OrderItemCreate(BaseModel):
    product_id: Optional[str] = None
    product_name_snapshot: str
    quantity: Decimal
    unit: str
    unit_price: Decimal
    total_price: Optional[Decimal] = None
    packing_status: str = "UNPACKED"


class OrderItemUpdate(BaseModel):
    id: Optional[str] = None
    product_id: Optional[str] = None
    product_name_snapshot: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = None
    packing_status: Optional[str] = None
    packed_quantity: Optional[Decimal] = None


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    product_id: Optional[str]
    product_name_snapshot: str
    quantity: Decimal
    unit: str
    unit_price: Decimal
    total_price: Decimal
    packing_status: str
    packed_quantity: Decimal
    packed_at: Optional[datetime]


class OrderCreate(BaseModel):
    store_id: str
    customer_id: str
    original_message: str
    items: List[OrderItemCreate] = Field(default_factory=list)
    discount: Decimal = Decimal("0.00")
    tax: Decimal = Decimal("0.00")


class OrderReviewUpdate(BaseModel):
    items: List[OrderItemUpdate]
    discount: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    clarification_notes: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


class OrderCustomerConfirm(BaseModel):
    action: str = "CONFIRM"  # CONFIRM, REJECT, MODIFY
    comment: Optional[str] = None


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    store_id: str
    customer_id: str
    order_number: str
    original_message: str
    status: str
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    grand_total: Decimal
    clarification_notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    customer: Optional[CustomerResponse] = None
    items: List[OrderItemResponse] = Field(default_factory=list)
