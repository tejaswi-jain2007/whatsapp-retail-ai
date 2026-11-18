from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    APP_NAME: str = "KiranaAI WhatsApp Retail Platform"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Security
    SECRET_KEY: str = "super-secret-development-key-change-in-production-1234567890"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Database: Supports SQLite (for zero-setup dev/test) and PostgreSQL
    DATABASE_URL: str = "sqlite:///./retail_platform.db"

    # WhatsApp Cloud API
    WHATSAPP_API_VERSION: str = "v21.0"
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_BUSINESS_ACCOUNT_ID: Optional[str] = None
    WHATSAPP_ACCESS_TOKEN: Optional[str] = None
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: str = "retail_verify_token_secure_2026"
    WHATSAPP_APP_SECRET: Optional[str] = None

    # AI Order Parsing
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL_NAME: str = "gemini-1.5-flash"

    # Telephony (Optional / Phase 2)
    EXOTEL_SID: Optional[str] = None
    EXOTEL_TOKEN: Optional[str] = None
    EXOTEL_SUB_DOMAIN: Optional[str] = None
    EXOTEL_CALLER_ID: Optional[str] = None

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

