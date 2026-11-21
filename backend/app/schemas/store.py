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


class StoreRegisterRequest(BaseModel):
    store_name: str
    owner_name: str
    phone: str
    email: str
    password: str
    address: Optional[str] = ""
    category_id: Optional[str] = None


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
    subscription_status: Optional[str] = None


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
    subscription_status: Optional[str] = "trial"
    trial_starts_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    subscription_plan: Optional[str] = "monthly_299"
    subscription_price: Optional[float] = 299.00
    subscription_valid_until: Optional[datetime] = None
    days_left_in_trial: Optional[int] = None
    is_paused: bool = False
    is_subscription_required: bool = False
    created_at: datetime
    category: Optional[BusinessCategoryResponse] = None


class SubscriptionStatusResponse(BaseModel):
    store_id: str
    store_name: str
    status: str
    subscription_status: str
    subscription_plan: str
    subscription_price: float
    trial_starts_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    subscription_valid_until: Optional[datetime] = None
    days_left: int
    is_paused: bool
    is_subscription_required: bool
    message: str

