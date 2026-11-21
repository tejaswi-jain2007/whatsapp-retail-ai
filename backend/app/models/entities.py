import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Numeric,
    DateTime,
    ForeignKey,
    Text,
    Integer,
    UniqueConstraint,
    JSON,
)
from sqlalchemy.orm import relationship
from app.database.session import Base


def generate_uuid():
    return str(uuid.uuid4())


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    phone = Column(String(30), nullable=True)
    role = Column(String(50), default="shopkeeper", nullable=False)  # shopkeeper, staff, admin
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    stores = relationship("Store", back_populates="owner")


class BusinessCategory(Base):
    __tablename__ = "business_categories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    configuration = Column(JSON, default=dict, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class Store(Base):
    __tablename__ = "stores"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(String(36), ForeignKey("business_categories.id"), nullable=True)
    store_name = Column(String(255), nullable=False)
    address = Column(Text, nullable=True)
    phone = Column(String(30), nullable=False)
    whatsapp_business_account_id = Column(String(100), nullable=True)
    whatsapp_phone_number_id = Column(String(100), unique=True, nullable=True, index=True)
    status = Column(String(50), default="active", nullable=False)  # active, paused, suspended
    subscription_status = Column(String(50), default="trial", nullable=False)  # trial, active, expired, cancelled
    trial_starts_at = Column(DateTime(timezone=True), default=utc_now, nullable=True)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    subscription_plan = Column(String(50), default="monthly_299", nullable=False)
    subscription_price = Column(Numeric(10, 2), default=299.00, nullable=False)
    subscription_valid_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    owner = relationship("User", back_populates="stores")
    category = relationship("BusinessCategory")
    products = relationship("Product", back_populates="store", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="store", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="store", cascade="all, delete-orphan")


class StoreUser(Base):
    __tablename__ = "store_users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), default="owner", nullable=False)  # owner, manager, packer
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (UniqueConstraint("store_id", "user_id", name="uq_store_user"),)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    phone = Column(String(30), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    whatsapp_consent = Column(Boolean, default=True, nullable=False)
    call_consent = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    store = relationship("Store", back_populates="customers")
    orders = relationship("Order", back_populates="customer")

    __table_args__ = (UniqueConstraint("store_id", "phone", name="uq_customer_store_phone"),)


class Product(Base):
    __tablename__ = "products"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(String(36), ForeignKey("business_categories.id"), nullable=True)
    name = Column(String(255), nullable=False)
    brand = Column(String(100), nullable=True)
    variant = Column(String(100), nullable=True)
    aliases = Column(JSON, default=list, nullable=True)  # List of string synonyms
    unit = Column(String(50), nullable=False)  # kg, litre, packet, piece, etc.
    current_price = Column(Numeric(12, 2), nullable=False)
    stock_quantity = Column(Numeric(12, 3), default=0.000, nullable=False)
    availability = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    store = relationship("Store", back_populates="products")
    price_history = relationship("PriceHistory", back_populates="product", cascade="all, delete-orphan")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    product_id = Column(String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    previous_price = Column(Numeric(12, 2), nullable=False)
    new_price = Column(Numeric(12, 2), nullable=False)
    source = Column(String(50), nullable=False)  # manual_override, store_defined, external_reference
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    effective_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    product = relationship("Product", back_populates="price_history")


class Order(Base):
    __tablename__ = "orders"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=False, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    original_message = Column(Text, nullable=False)
    status = Column(String(50), default="NEW", nullable=False, index=True)
    # Lifecycle: NEW, AI_PROCESSING, NEEDS_CLARIFICATION, SHOPKEEPER_REVIEW,
    # CUSTOMER_CONFIRMATION, CONFIRMED, PACKING, PARTIALLY_PACKED, READY_FOR_PICKUP,
    # COLLECTED, REJECTED, CANCELLED, EXPIRED
    subtotal = Column(Numeric(12, 2), default=0.00, nullable=False)
    discount = Column(Numeric(12, 2), default=0.00, nullable=False)
    tax = Column(Numeric(12, 2), default=0.00, nullable=False)
    grand_total = Column(Numeric(12, 2), default=0.00, nullable=False)
    clarification_notes = Column(Text, nullable=True)
    pickup_reminders_count = Column(Integer, default=0, nullable=True)
    last_reminder_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    store = relationship("Store", back_populates="orders")
    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    events = relationship("OrderEvent", back_populates="order", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="order", cascade="all, delete-orphan")
    qr_tokens = relationship("QrToken", back_populates="order", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    product_name_snapshot = Column(String(255), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False)
    unit = Column(String(50), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)
    packing_status = Column(String(50), default="UNPACKED", nullable=False)  # UNPACKED, PACKED, NOT_AVAILABLE
    packed_quantity = Column(Numeric(12, 3), default=0.000, nullable=False)
    packed_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    packed_at = Column(DateTime(timezone=True), nullable=True)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")


class OrderEvent(Base):
    __tablename__ = "order_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    actor_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    actor_type = Column(String(50), default="system", nullable=False)  # system, shopkeeper, customer
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    order = relationship("Order", back_populates="events")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("orders.id"), nullable=False, index=True)
    invoice_number = Column(String(100), unique=True, nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(12, 2), default=0.00, nullable=False)
    tax = Column(Numeric(12, 2), default=0.00, nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    payment_status = Column(String(50), default="PENDING", nullable=False)  # PENDING, PAID_AT_PICKUP, ONLINE_PAID
    pdf_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    order = relationship("Order", back_populates="invoices")


class QrToken(Base):
    __tablename__ = "qr_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    redeemed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="ACTIVE", nullable=False)  # ACTIVE, REDEEMED, EXPIRED, REVOKED
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    order = relationship("Order", back_populates="qr_tokens")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    channel = Column(String(50), default="whatsapp", nullable=False)
    message_type = Column(String(100), nullable=False)
    recipient_phone = Column(String(30), nullable=False)
    payload = Column(Text, nullable=True)
    provider_message_id = Column(String(100), nullable=True)
    status = Column(String(50), default="PENDING", nullable=False)  # PENDING, SENT, DELIVERED, READ, FAILED
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    order = relationship("Order", back_populates="notifications")


class MessageEvent(Base):
    __tablename__ = "message_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=True)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    whatsapp_message_id = Column(String(150), unique=True, nullable=False, index=True)
    message_type = Column(String(50), nullable=False)
    sender_phone = Column(String(30), nullable=False)
    message_content = Column(Text, nullable=False)
    processing_status = Column(String(50), default="RECEIVED", nullable=False)  # RECEIVED, PROCESSED, FAILED, IGNORED
    error_details = Column(Text, nullable=True)
    received_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class CallLog(Base):
    __tablename__ = "call_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    provider_call_id = Column(String(100), nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    called_at = Column(DateTime(timezone=True), nullable=True)
    call_status = Column(String(50), default="SCHEDULED", nullable=False)  # SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, FAILED
    attempt_number = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

