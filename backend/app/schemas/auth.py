from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime


class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    role: Optional[str] = "shopkeeper"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    name: str
    role: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime


class StoreRegisterRequest(BaseModel):
    store_name: str
    owner_name: str
    phone: str
    email: Optional[str] = None
    password: Optional[str] = "kirana123"
    address: Optional[str] = ""


class StoreRegisterResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    name: str
    role: str
    store_id: str
    store_name: str
    subscription_status: str
    trial_starts_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    days_left: int = 14
    seeded_products_count: int = 0

