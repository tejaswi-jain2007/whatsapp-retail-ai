-- Seed Data for AI-Powered WhatsApp Retail Platform

-- 1. Default Business Categories
INSERT INTO business_categories (id, name, code, configuration, is_active)
VALUES 
    ('c0000001-0000-0000-0000-000000000001', 'Kirana & Grocery', 'kirana', '{"allows_commodity_pricing": true, "default_units": ["kg", "g", "litre", "ml", "packet", "piece"]}'::jsonb, true),
    ('c0000002-0000-0000-0000-000000000002', 'Medical Store', 'medical', '{"requires_prescription": true, "default_units": ["strip", "bottle", "piece"]}'::jsonb, true),
    ('c0000003-0000-0000-0000-000000000003', 'Vegetable & Fruit Shop', 'produce', '{"allows_weight_variation": true, "default_units": ["kg", "g", "dozen"]}'::jsonb, true),
    ('c0000004-0000-0000-0000-000000000004', 'Dairy & Bakery', 'dairy_bakery', '{"perishable": true, "default_units": ["packet", "litre", "piece", "kg"]}'::jsonb, true)
ON CONFLICT (name) DO NOTHING;

-- 2. Initial Demo Shopkeeper User (Password: "kirana123" hashed using bcrypt)
-- bcrypt hash for "kirana123"
INSERT INTO users (id, name, email, password_hash, phone, role)
VALUES (
    'u0000001-0000-0000-0000-000000000001',
    'Ramesh Gupta',
    'ramesh@guptastores.com',
    '$2b$12$0k4zJ/U7w4aV03.W0m3gQOFgN7.s7Zk5l1aC8rKqZzVfA3x6xR6gC',
    '+919876543210',
    'shopkeeper'
) ON CONFLICT (email) DO NOTHING;

-- 3. Initial Demo Store (Gupta Kirana General Store)
INSERT INTO stores (id, owner_id, category_id, store_name, address, phone, whatsapp_phone_number_id, status)
VALUES (
    's0000001-0000-0000-0000-000000000001',
    'u0000001-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000001',
    'Gupta Kirana & General Store',
    'Shop No 14, Main Bazaar, Sector 12, New Delhi',
    '+919876543210',
    'WA_PHONE_ID_1001',
    'active'
) ON CONFLICT (whatsapp_phone_number_id) DO NOTHING;

-- 4. Sample Products for Gupta Kirana
INSERT INTO products (id, store_id, category_id, name, brand, variant, aliases, unit, current_price, stock_quantity, availability)
VALUES
    ('p0000001-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001',
     'Aashirvaad Shudh Chakki Atta', 'Aashirvaad', 'Whole Wheat', '["atta", "aata", "gehun atta", "wheat flour"]'::jsonb, 'kg', 45.00, 150.000, true),

    ('p0000002-0000-0000-0000-000000000002', 's0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001',
     'Fortune Sunlite Refined Sunflower Oil', 'Fortune', 'Refined Sunflower', '["oil", "tel", "sunflower oil", "refined oil"]'::jsonb, 'litre', 135.00, 80.000, true),

    ('p0000003-0000-0000-0000-000000000003', 's0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001',
     'Madhur Pure & Hygienic Sugar', 'Madhur', 'Refined Crystal', '["sugar", "cheeni", "chini", "shakkar"]'::jsonb, 'kg', 48.00, 200.000, true),

    ('p0000004-0000-0000-0000-000000000004', 's0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001',
     'Maggi 2-Minute Masala Instant Noodles', 'Maggi', '70g Single Pack', '["maggi", "noodles", "maggie"]'::jsonb, 'packet', 14.00, 300.000, true),

    ('p0000005-0000-0000-0000-000000000005', 's0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001',
     'Tata Salt Vacuum Evaporated Iodised Salt', 'Tata', 'Iodised 1kg', '["salt", "namak", "tata salt"]'::jsonb, 'packet', 28.00, 100.000, true),

    ('p0000006-0000-0000-0000-000000000006', 's0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001',
     'Amul Taaza Homogenised Toned Milk', 'Amul', '500ml pouch', '["milk", "doodh", "amul milk"]'::jsonb, 'packet', 27.00, 50.000, true),

    ('p0000007-0000-0000-0000-000000000007', 's0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001',
     'India Gate Basmati Rice Daily Oats', 'India Gate', 'Premium Long Grain', '["rice", "chawal", "basmati"]'::jsonb, 'kg', 90.00, 120.000, true)
ON CONFLICT (id) DO NOTHING;
