import sys
import time
import asyncio
sys.path.insert(0, 'backend')
from app.database.session import SessionLocal
from app.models.entities import Order, Customer, Store
from app.services.whatsapp.service import whatsapp_webhook_service

with SessionLocal() as db:
    order = db.query(Order).filter(Order.order_number == 'ORD-261119-1753').first()
    print('Order store_id:', order.store_id)
    cust = db.query(Customer).filter(Customer.id == order.customer_id).first()
    print('Customer:', cust.id, cust.name, cust.phone, cust.store_id)

    related_customer_ids = [cust.id]
    if cust.name:
        for c in db.query(Customer).filter(Customer.store_id == order.store_id, Customer.name == cust.name).all():
            if c.id not in related_customer_ids:
                related_customer_ids.append(c.id)
    print('Related customer IDs:', related_customer_ids)

    pending_order = (
        db.query(Order)
        .filter(
            Order.store_id == order.store_id,
            Order.customer_id.in_(related_customer_ids),
            Order.status.in_(['CUSTOMER_CONFIRMATION', 'SHOPKEEPER_REVIEW', 'NEW', 'NEEDS_CLARIFICATION']),
        )
        .order_by(Order.created_at.desc())
        .first()
    )
    print('Found pending_order:', pending_order.order_number if pending_order else None)
    print('is_confirmation_reply("1"):', whatsapp_webhook_service._is_confirmation_reply('1'))

