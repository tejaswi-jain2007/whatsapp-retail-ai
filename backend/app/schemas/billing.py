from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    invoice_number: str
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total_amount: Decimal
    payment_status: str
    pdf_url: Optional[str]
    created_at: datetime


class GenerateInvoiceRequest(BaseModel):
    payment_status: Optional[str] = "PENDING"  # PENDING, PAID_AT_PICKUP, ONLINE_PAID
    discount: Optional[Decimal] = None
    tax: Optional[Decimal] = None
