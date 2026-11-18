from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.stores import router as stores_router
from app.api.v1.products import router as products_router
from app.api.v1.orders import router as orders_router
from app.api.v1.billing import router as billing_router
from app.api.v1.qr import router as qr_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.analytics import router as analytics_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(auth_router)
api_v1_router.include_router(stores_router)
api_v1_router.include_router(products_router)
api_v1_router.include_router(orders_router)
api_v1_router.include_router(billing_router)
api_v1_router.include_router(qr_router)
api_v1_router.include_router(webhooks_router)
api_v1_router.include_router(analytics_router)

__all__ = ["api_v1_router"]

