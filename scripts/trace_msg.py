import sys
import asyncio
sys.path.insert(0, 'backend')
from app.database.session import SessionLocal
from app.models.entities import Order, Customer, Store
from app.services.whatsapp.service import whatsapp_webhook_service

async def trace():
    with SessionLocal() as db:
        store = db.query(Store).filter(Store.status == 'active').first()
        customer = db.query(Customer).filter(Customer.phone == '+919425194943').first()
        print('Store:', store.id, store.store_name)
        print('Customer:', customer.id, customer.name, customer.phone)

        # Check related customer IDs
        related_customer_ids = [customer.id]
        if customer.name:
            for c in db.query(Customer).filter(Customer.store_id == store.id, Customer.name == customer.name).all():
                if c.id not in related_customer_ids:
                    related_customer_ids.append(c.id)
        print('Related customer IDs:', related_customer_ids)

        # Check pending orders query
        pending_order = (
            db.query(Order)
            .filter(
                Order.store_id == store.id,
                Order.customer_id.in_(related_customer_ids),
                Order.status == 'CUSTOMER_CONFIRMATION',
            )
            .order_by(Order.created_at.desc())
            .first()
        )
        print('Pending order (CUSTOMER_CONFIRMATION):', pending_order.order_number if pending_order else None)

        # Check is confirmation reply
        print("Is confirmation reply '1'?", whatsapp_webhook_service._is_confirmation_reply("1"))
        print("Is confirmation reply 'Haa'?", whatsapp_webhook_service._is_confirmation_reply("Haa"))

asyncio.run(trace())

