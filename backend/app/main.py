import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.database.session import Base, engine, SessionLocal
from app.api.v1 import api_v1_router
from app.models.entities import User, BusinessCategory, Store, Product
from app.utils.security import hash_password
from decimal import Decimal


def seed_initial_demo_data(db: Session):
    """
    Populates default Kirana store, categories, and inventory for quick local startup.
    """
    if db.query(BusinessCategory).count() == 0:
        cat_kirana = BusinessCategory(
            id="c0000001-0000-0000-0000-000000000001",
            name="Kirana & Grocery",
            code="kirana",
            configuration={"allows_commodity_pricing": True},
            is_active=True,
        )
        cat_medical = BusinessCategory(
            id="c0000002-0000-0000-0000-000000000002",
            name="Medical Store",
            code="medical",
            configuration={"requires_prescription": True},
            is_active=True,
        )
        db.add_all([cat_kirana, cat_medical])
        db.commit()

    if db.query(User).count() == 0:
        demo_user = User(
            id="u0000001-0000-0000-0000-000000000001",
            name="Ramesh Gupta",
            email="ramesh@guptastores.com",
            password_hash=hash_password("kirana123"),
            phone="+919479550330",
            role="shopkeeper",
            is_active=True,
        )
        db.add(demo_user)
        db.commit()

    if db.query(Store).count() == 0:
        user = db.query(User).first()
        cat = db.query(BusinessCategory).filter(BusinessCategory.code == "kirana").first()
        demo_store = Store(
            id="s0000001-0000-0000-0000-000000000001",
            owner_id=user.id,
            category_id=cat.id if cat else None,
            store_name="Gupta Kirana & General Store",
            address="Shop No 14, Main Bazaar, Sector 12, New Delhi",
            phone="+919479550330",
            whatsapp_phone_number_id="WA_PHONE_ID_1001",
            status="active",
        )
        db.add(demo_store)
        db.commit()

        # Seed Kirana Products
        products = [
            Product(
                id="p0000001-0000-0000-0000-000000000001",
                store_id=demo_store.id,
                category_id=cat.id if cat else None,
                name="Aashirvaad Shudh Chakki Atta",
                brand="Aashirvaad",
                variant="Whole Wheat",
                aliases=["atta", "aata", "gehun atta", "wheat flour"],
                unit="kg",
                current_price=Decimal("45.00"),
                stock_quantity=Decimal("150.000"),
                availability=True,
            ),
            Product(
                id="p0000002-0000-0000-0000-000000000002",
                store_id=demo_store.id,
                category_id=cat.id if cat else None,
                name="Fortune Sunlite Refined Sunflower Oil",
                brand="Fortune",
                variant="Refined Sunflower",
                aliases=["oil", "tel", "sunflower oil", "refined oil"],
                unit="litre",
                current_price=Decimal("135.00"),
                stock_quantity=Decimal("80.000"),
                availability=True,
            ),
            Product(
                id="p0000003-0000-0000-0000-000000000003",
                store_id=demo_store.id,
                category_id=cat.id if cat else None,
                name="Madhur Pure & Hygienic Sugar",
                brand="Madhur",
                variant="Crystal",
                aliases=["sugar", "cheeni", "chini", "shakkar"],
                unit="kg",
                current_price=Decimal("48.00"),
                stock_quantity=Decimal("200.000"),
                availability=True,
            ),
            Product(
                id="p0000004-0000-0000-0000-000000000004",
                store_id=demo_store.id,
                category_id=cat.id if cat else None,
                name="Maggi 2-Minute Masala Instant Noodles",
                brand="Maggi",
                variant="70g Single Pack",
                aliases=["maggi", "noodles", "maggie"],
                unit="packet",
                current_price=Decimal("14.00"),
                stock_quantity=Decimal("300.000"),
                availability=True,
            ),
            Product(
                id="p0000005-0000-0000-0000-000000000005",
                store_id=demo_store.id,
                category_id=cat.id if cat else None,
                name="Tata Salt Vacuum Evaporated Iodised Salt",
                brand="Tata",
                variant="1kg pack",
                aliases=["salt", "namak", "tata salt"],
                unit="packet",
                current_price=Decimal("28.00"),
                stock_quantity=Decimal("100.000"),
                availability=True,
            ),
        ]
        db.add_all(products)
        db.commit()


async def periodic_pickup_reminder_worker():
    """
    Checks orders in READY_FOR_PICKUP status.
    Automatically sends pickup reminder up to 4 times a day if customer has not collected.
    """
    while True:
        try:
            await asyncio.sleep(60 * 10)  # Check every 10 minutes
            with SessionLocal() as db:
                from app.models.entities import Order
                from app.services.orders.lifecycle import order_lifecycle_service
                from datetime import datetime, timezone, timedelta

                now = datetime.now(timezone.utc)
                orders = db.query(Order).filter(Order.status == "READY_FOR_PICKUP").all()
                for o in orders:
                    count = o.pickup_reminders_count or 0
                    if count >= 4:
                        continue
                    last = o.last_reminder_at
                    # Send next reminder if at least 3 hours passed or next day
                    if not last or (now - last) >= timedelta(hours=3):
                        await order_lifecycle_service.send_pickup_reminder(db, o, actor_id="SYSTEM_AUTO_REMINDER")
                        print(f"[AutoReminder] Sent pickup reminder {count+1}/4 for order {o.order_number}")
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[AutoReminder] Periodic reminder error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema is created
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_initial_demo_data(db)
    reminder_task = asyncio.create_task(periodic_pickup_reminder_worker())
    yield
    reminder_task.cancel()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multi-tenant, AI-powered WhatsApp Retail Order Management Platform for Kirana & Retail Stores.",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev & dashboard access
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router)


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
        "docs_url": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}

