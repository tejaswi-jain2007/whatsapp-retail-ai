import pytest
import asyncio
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.session import Base
from app.models.entities import User, Store, Customer, Order, Product, BusinessCategory
from app.services.whatsapp.service import whatsapp_webhook_service
from app.services.orders.lifecycle import order_lifecycle_service
from app.services.billing.generator import billing_service
from app.services.qr.service import qr_service


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Seed User & Store
    user = User(id="u1", name="Ramesh Gupta", email="ramesh@gupta.com", password_hash="hash")
    session.add(user)

    store = Store(
        id="s1",
        owner_id="u1",
        store_name="Gupta Kirana Store",
        phone="+919876543210",
        whatsapp_phone_number_id="WA_PHONE_ID_1001",
        status="active",
    )
    session.add(store)

    # Seed Catalogue Products
    p1 = Product(
        id="p1",
        store_id="s1",
        name="Aashirvaad Shudh Chakki Atta",
        aliases=["atta", "aata"],
        unit="kg",
        current_price=Decimal("45.00"),
        availability=True,
    )
    p2 = Product(
        id="p2",
        store_id="s1",
        name="Fortune Sunflower Oil",
        aliases=["oil", "tel"],
        unit="litre",
        current_price=Decimal("135.00"),
        availability=True,
    )
    session.add_all([p1, p2])
    session.commit()

    yield session
    session.close()


def test_full_whatsapp_order_lifecycle(db_session):
    asyncio.run(_async_test_full_whatsapp_order_lifecycle(db_session))


async def _async_test_full_whatsapp_order_lifecycle(db_session):
    # Step 1: Simulate incoming WhatsApp message from first-time customer
    msg_id = "wamid.test.001"
    customer_phone = "+919811122233"
    message_text = "2 kg atta aur 1 litre oil pack kar dena"

    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "WABA_TEST",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "phone_number_id": "WA_PHONE_ID_1001",
                            },
                            "contacts": [{"profile": {"name": "Pooja Verma"}, "wa_id": "919811122233"}],
                            "messages": [
                                {
                                    "id": msg_id,
                                    "from": customer_phone,
                                    "timestamp": "1731950000",
                                    "type": "text",
                                    "text": {"body": message_text},
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }

    # Process webhook
    result = await whatsapp_webhook_service.process_incoming_webhook(db_session, payload)
    assert result["processed_messages"] == 1

    # Step 2: Verify automatic customer creation
    customer = (
        db_session.query(Customer)
        .filter(Customer.store_id == "s1", Customer.phone == customer_phone)
        .first()
    )
    assert customer is not None
    assert customer.name == "Pooja Verma"

    # Step 3: Verify order was created in SHOPKEEPER_REVIEW
    order = (
        db_session.query(Order)
        .filter(Order.store_id == "s1", Order.customer_id == customer.id)
        .first()
    )
    assert order is not None
    assert order.status == "SHOPKEEPER_REVIEW"
    assert len(order.items) == 2
    # 2kg atta @ 45 = 90; 1l oil @ 135 = 135; Subtotal = 225
    assert order.subtotal == Decimal("225.00")
    assert order.grand_total == Decimal("225.00")

    # Step 4: Deduplication test - resending same message ID should be ignored
    result_dup = await whatsapp_webhook_service.process_incoming_webhook(db_session, payload)
    orders_count = db_session.query(Order).count()
    assert orders_count == 1  # No duplicate order created

    # Step 5: Shopkeeper sends summary for customer confirmation
    await order_lifecycle_service.send_summary_for_customer_confirmation(db_session, order, actor_id="u1")
    assert order.status == "CUSTOMER_CONFIRMATION"

    # Step 6: Customer confirms order via WhatsApp button reply
    confirm_payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "WABA_TEST",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"phone_number_id": "WA_PHONE_ID_1001"},
                            "contacts": [{"profile": {"name": "Pooja Verma"}, "wa_id": "919811122233"}],
                            "messages": [
                                {
                                    "id": "wamid.test.confirm",
                                    "from": customer_phone,
                                    "timestamp": "1731950050",
                                    "type": "interactive",
                                    "interactive": {
                                        "type": "button_reply",
                                        "button_reply": {"id": f"CONFIRM_{order.id}", "title": "✅ Confirm Order"},
                                    },
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }
    await whatsapp_webhook_service.process_incoming_webhook(db_session, confirm_payload)
    db_session.refresh(order)
    assert order.status == "CONFIRMED"

    # Step 7: Shopkeeper packs items
    item1 = order.items[0]
    item2 = order.items[1]

    # Pack item 1 -> status transitions to PACKING
    order, _ = await order_lifecycle_service.update_item_packing_status(
        db_session, order, item1.id, "PACKED", packed_by="u1"
    )
    assert order.status == "PACKING"

    # Pack item 2 -> All items packed -> status automatically transitions to READY_FOR_PICKUP
    order, _ = await order_lifecycle_service.update_item_packing_status(
        db_session, order, item2.id, "PACKED", packed_by="u1"
    )
    assert order.status == "READY_FOR_PICKUP"
    assert len(order.qr_tokens) == 1
    qr_token = order.qr_tokens[0]
    assert qr_token.status == "ACTIVE"

    # Step 8: Generate Invoice & PDF
    invoice = billing_service.generate_invoice(db_session, order)
    assert invoice.total_amount == Decimal("225.00")
    assert invoice.invoice_number.startswith("INV-")

    # Step 9: Customer comes to store; Shopkeeper scans QR code to collect
    # We can retrieve the raw token from the active qr_tokens by hash or generate a test verification
    raw_token, _, _ = qr_service.generate_pickup_token(db_session, order)
    success, msg, collected_order = qr_service.verify_and_collect_order(
        db_session, raw_token=raw_token, store_id="s1", verified_by_user_id="u1"
    )
    assert success is True
    assert collected_order.status == "COLLECTED"

    # Step 10: Replay attack prevention - second scan of same token fails
    success_replay, msg_replay, _ = qr_service.verify_and_collect_order(
        db_session, raw_token=raw_token, store_id="s1", verified_by_user_id="u1"
    )
    assert success_replay is False
    assert "already redeemed" in msg_replay.lower()
