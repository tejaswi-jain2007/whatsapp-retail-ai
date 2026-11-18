import pytest
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from app.database.session import Base
from app.models.entities import User, Store, Customer, Order, OrderItem, QrToken
from app.services.orders.lifecycle import order_lifecycle_service
from app.services.qr.service import qr_service
from app.services.billing.generator import billing_service


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Create dummy user, store, customer
    user = User(id="u1", name="Ramesh", email="ramesh@test.com", password_hash="hash")
    session.add(user)
    store = Store(id="s1", owner_id="u1", store_name="Gupta Store", phone="+919876543210")
    session.add(store)
    customer = Customer(id="c1", store_id="s1", phone="+919999988888", name="Amit Kumar")
    session.add(customer)
    session.commit()

    yield session
    session.close()


def test_order_lifecycle_transitions(test_db):
    order = Order(
        id="ord1",
        store_id="s1",
        customer_id="c1",
        order_number="ORD-TEST-01",
        original_message="2 kg sugar",
        status="SHOPKEEPER_REVIEW",
    )
    test_db.add(order)
    test_db.commit()

    # Allowed transition: SHOPKEEPER_REVIEW -> CONFIRMED
    updated = order_lifecycle_service.transition_status(test_db, order, "CONFIRMED")
    assert updated.status == "CONFIRMED"

    # Disallowed transition: CONFIRMED cannot jump directly to COLLECTED
    with pytest.raises(HTTPException):
        order_lifecycle_service.transition_status(test_db, order, "COLLECTED")


def test_qr_generation_and_atomic_verification(test_db):
    order = Order(
        id="ord2",
        store_id="s1",
        customer_id="c1",
        order_number="ORD-TEST-02",
        original_message="1 kg atta",
        status="READY_FOR_PICKUP",
        subtotal=Decimal("45.00"),
        grand_total=Decimal("45.00"),
    )
    test_db.add(order)
    test_db.commit()

    raw_token, qr_url, qr_entry = qr_service.generate_pickup_token(test_db, order)
    assert raw_token.startswith("PKUP-")
    assert qr_url.startswith("data:image/png;base64,")
    assert qr_entry.status == "ACTIVE"

    # Verify and collect
    success, msg, collected_order = qr_service.verify_and_collect_order(
        test_db, raw_token=raw_token, store_id="s1", verified_by_user_id="u1"
    )
    assert success is True
    assert collected_order.status == "COLLECTED"

    # Replay protection: Try to verify the same token again
    success2, msg2, _ = qr_service.verify_and_collect_order(
        test_db, raw_token=raw_token, store_id="s1", verified_by_user_id="u1"
    )
    assert success2 is False
    assert "already redeemed" in msg2.lower()


def test_billing_and_pdf_generation(test_db):
    order = Order(
        id="ord3",
        store_id="s1",
        customer_id="c1",
        order_number="ORD-TEST-03",
        original_message="1 litre oil",
        status="CONFIRMED",
        subtotal=Decimal("135.00"),
        discount=Decimal("5.00"),
        tax=Decimal("0.00"),
        grand_total=Decimal("130.00"),
    )
    test_db.add(order)
    item = OrderItem(
        id="it1",
        order_id="ord3",
        product_name_snapshot="Refined Oil",
        quantity=Decimal("1.0"),
        unit="litre",
        unit_price=Decimal("135.00"),
        total_price=Decimal("135.00"),
    )
    test_db.add(item)
    test_db.commit()

    invoice = billing_service.generate_invoice(test_db, order, discount=Decimal("5.00"))
    assert invoice.total_amount == Decimal("130.00")
    assert invoice.invoice_number.startswith("INV-")
    assert invoice.pdf_url is not None

