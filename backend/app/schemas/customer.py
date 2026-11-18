from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class CustomerCreate(BaseModel):
    store_id: str
    phone: str
    name: Optional[str] = None
    whatsapp_consent: bool = True
    call_consent: bool = False


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    whatsapp_consent: Optional[bool] = None
    call_consent: Optional[bool] = None


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    store_id: str
    phone: str
    name: Optional[str]
    whatsapp_consent: bool
    call_consent: bool
    created_at: datetime
