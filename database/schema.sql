-- =============================================================================
-- Database Schema for AI-Powered WhatsApp Retail Order Management Platform
-- Version: 1.0 (PostgreSQL compatible)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users (Shopkeepers, Staff, Admins)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    role VARCHAR(50) DEFAULT 'shopkeeper' NOT NULL, -- shopkeeper, staff, admin
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Business Categories (Kirana, Medical, Dairy, Bakery, etc.)
CREATE TABLE IF NOT EXISTS business_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    configuration JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Stores (Tenants)
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES business_categories(id),
    store_name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(30) NOT NULL,
    whatsapp_business_account_id VARCHAR(100),
    whatsapp_phone_number_id VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'active' NOT NULL, -- pending, active, suspended
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Store Users / Staff membership (Multi-user per store)
CREATE TABLE IF NOT EXISTS store_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'owner' NOT NULL, -- owner, manager, packer
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(store_id, user_id)
);

-- 5. Customers (Scoped per store)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    phone VARCHAR(30) NOT NULL,
    name VARCHAR(255),
    whatsapp_consent BOOLEAN DEFAULT TRUE NOT NULL,
    call_consent BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_customer_store_phone UNIQUE (store_id, phone)
);

-- 6. Products & Catalogue
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    category_id UUID REFERENCES business_categories(id),
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    variant VARCHAR(100),
    aliases JSONB DEFAULT '[]'::jsonb, -- e.g. ["aata", "gehun ka atta", "flour"]
    unit VARCHAR(50) NOT NULL, -- kg, litre, packet, piece, gram, etc.
    current_price NUMERIC(12, 2) NOT NULL,
    stock_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    availability BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 7. Price History
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    previous_price NUMERIC(12, 2) NOT NULL,
    new_price NUMERIC(12, 2) NOT NULL,
    source VARCHAR(50) NOT NULL, -- manual_override, store_defined, external_reference
    updated_by UUID REFERENCES users(id),
    effective_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 8. Orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    original_message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'NEW' NOT NULL,
    -- Status lifecycle: NEW, AI_PROCESSING, NEEDS_CLARIFICATION, SHOPKEEPER_REVIEW,
    -- CUSTOMER_CONFIRMATION, CONFIRMED, PACKING, PARTIALLY_PACKED, READY_FOR_PICKUP,
    -- COLLECTED, REJECTED, CANCELLED, EXPIRED
    subtotal NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    discount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    tax NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    grand_total NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    clarification_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 9. Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name_snapshot VARCHAR(255) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    packing_status VARCHAR(50) DEFAULT 'UNPACKED' NOT NULL, -- UNPACKED, PACKED, NOT_AVAILABLE
    packed_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    packed_by UUID REFERENCES users(id),
    packed_at TIMESTAMPTZ
);

-- 10. Order Event / Audit Trail
CREATE TABLE IF NOT EXISTS order_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    reason TEXT,
    actor_id UUID REFERENCES users(id),
    actor_type VARCHAR(50) DEFAULT 'system' NOT NULL, -- system, shopkeeper, customer
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 11. Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    subtotal NUMERIC(12, 2) NOT NULL,
    discount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    tax NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'PENDING' NOT NULL, -- PENDING, PAID_AT_PICKUP, ONLINE_PAID
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 12. QR Tokens
CREATE TABLE IF NOT EXISTS qr_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    redeemed_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL, -- ACTIVE, REDEEMED, EXPIRED, REVOKED
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 13. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    channel VARCHAR(50) DEFAULT 'whatsapp' NOT NULL,
    message_type VARCHAR(100) NOT NULL,
    recipient_phone VARCHAR(30) NOT NULL,
    payload TEXT,
    provider_message_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'PENDING' NOT NULL, -- PENDING, SENT, DELIVERED, READ, FAILED
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 14. Message Events (Webhook Deduplication & Raw Storage)
CREATE TABLE IF NOT EXISTS message_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    whatsapp_message_id VARCHAR(150) NOT NULL UNIQUE,
    message_type VARCHAR(50) NOT NULL,
    sender_phone VARCHAR(30) NOT NULL,
    message_content TEXT NOT NULL,
    processing_status VARCHAR(50) DEFAULT 'RECEIVED' NOT NULL, -- RECEIVED, PROCESSED, FAILED, IGNORED
    error_details TEXT,
    received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 15. Call Logs (Telephony - Phase 2)
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    provider_call_id VARCHAR(100),
    scheduled_at TIMESTAMPTZ NOT NULL,
    called_at TIMESTAMPTZ,
    call_status VARCHAR(50) DEFAULT 'SCHEDULED' NOT NULL, -- SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, FAILED
    attempt_number INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =============================================================================
-- Indexes for performance & multitenancy
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_wa_number ON stores(whatsapp_phone_number_id);
CREATE INDEX IF NOT EXISTS idx_customers_store_phone ON customers(store_id, phone);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_hash ON qr_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_message_events_wa_id ON message_events(whatsapp_message_id);
