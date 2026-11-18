import sys
import time
import asyncio
sys.path.insert(0, 'backend')
from app.database.session import SessionLocal
from app.models.entities import Order, Customer, Store
from app.services.whatsapp.service import whatsapp_webhook_service

async def test():
    with SessionLocal() as db:
        store = db.query(Store).first()
        customer = db.query(Customer).filter(Customer.name.like('%Manisha%')).first()
        if not customer:
            print("Customer not found")
            return

        # Put ORD-261119-1753 into CUSTOMER_CONFIRMATION to test
        order = db.query(Order).filter(Order.order_number == 'ORD-261119-1753').first()
        order.status = "CUSTOMER_CONFIRMATION"
        db.commit()

        print(f"Testing customer '{customer.name}' replying '1' to confirm order {order.order_number}...")

        unique_id = f"wamid.test.confirm.{time.time()}"
        payload = {
            "entry": [{
                "changes": [{
                    "value": {
                        "messages": [{
                            "from": customer.phone.replace("+", ""),
                            "id": unique_id,
                            "type": "text",
                            "text": {"body": "1"}
                        }],
                        "contacts": [{
                            "profile": {"name": customer.name},
                            "wa_id": customer.phone.replace("+", "")
                        }],
                        "metadata": {
                            "phone_number_id": "WA_PHONE_ID_1001",
                            "display_phone_number": "+919479550330"
                        }
                    }
                }]
            }]
        }

        await whatsapp_webhook_service.process_incoming_webhook(db, payload)
        db.refresh(order)
        print(f"Order {order.order_number} status after replying '1': {order.status}")

asyncio.run(test())
