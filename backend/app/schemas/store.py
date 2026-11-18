from pydantic import BaseModel, ConfigDict
from typing import Optional, Any, Dict
from datetime import datetime


class BusinessCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: str
    configuration: Dict[str, Any]
    is_active: bool


class StoreCreate(BaseModel):
    store_name: str
    category_id: Optional[str] = None
    address: Optional[str] = None
    phone: str
    whatsapp_business_account_id: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None


class StoreUpdate(BaseModel):
    store_name: Optional[str] = None
    category_id: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_business_account_id: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    status: Optional[str] = None


class StoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    category_id: Optional[str]
    store_name: str
    address: Optional[str]
    phone: str
    whatsapp_business_account_id: Optional[str]
    whatsapp_phone_number_id: Optional[str]
    status: str
    created_at: datetime
    category: Optional[BusinessCategoryResponse] = None
