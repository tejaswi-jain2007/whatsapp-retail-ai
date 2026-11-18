from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class QrGenerateResponse(BaseModel):
    order_id: str
    order_number: str
    token: str
    qr_data_url: str
    expires_at: datetime


class QrVerifyRequest(BaseModel):
    token: str
    store_id: str


class QrVerifyResponse(BaseModel):
    success: bool
    message: str
    order_id: Optional[str] = None
    order_number: Optional[str] = None
    customer_phone: Optional[str] = None
    grand_total: Optional[str] = None
    status: Optional[str] = None

