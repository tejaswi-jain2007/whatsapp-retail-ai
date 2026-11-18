import sys
import asyncio
import time
sys.path.insert(0, 'backend')
from app.database.session import SessionLocal
from app.models.entities import Order, Customer, Store
from app.services.whatsapp.service import whatsapp_webhook_service

async def run():
    with SessionLocal() as db:
        order = db.query(Order).filter(Order.order_number == 'ORD-261119-1304').first()
        order.status = 'CUSTOMER_CONFIRMATION'
        db.commit()
        print("Reset order status:", order.order_number, order.status)

        print("Testing direct call with '1'...")
        await whatsapp_webhook_service._handle_single_message(
            db=db,
            phone_number_id="WA_PHONE_ID_1001",
            from_raw="195244918354151@lid",
            sender_name="Manisha Jain",
            msg_id=f"test.direct.1.{int(time.time())}",
            msg_type="text",
            text_content="1"
        )
        db.refresh(order)
        print("Final order status:", order.order_number, order.status)

asyncio.run(run())
