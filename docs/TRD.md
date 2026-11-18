# Technical Requirements Document (TRD)

## AI-Powered WhatsApp Retail Order Management Platform

**Version:** 1.0\
**Date:** 18 November 2026\
**Architecture:** Multi-tenant modular monolith\
**Backend:** Python FastAPI\
**Frontend:** Next.js\
**Database:** PostgreSQL

------------------------------------------------------------------------

## 1. Technical Overview

The platform uses WhatsApp as the only customer-facing ordering channel
and a web dashboard for shopkeepers.

Incoming WhatsApp messages are delivered to a verified backend webhook.
The backend identifies the store and customer, stores the message, and
queues it for AI parsing. Parsed items are matched against the store
catalogue. The order, pricing, billing, confirmation, packing,
notification, and pickup workflows are managed by backend services.

The first implementation should be a modular monolith rather than
microservices. External integrations should be behind provider adapters
so they can be replaced without rewriting core business logic.

## 2. Recommended Technology Stack

  -----------------------------------------------------------------------
  Layer                               Technology
  ----------------------------------- -----------------------------------
  Frontend                            Next.js

  Styling                             Tailwind CSS

  Backend                             Python FastAPI

  Data validation                     Pydantic

  Database                            PostgreSQL

  Database platform                   Supabase

  Shopkeeper authentication           Supabase Auth

  AI parsing                          Gemini API or an open-source model

  WhatsApp                            Meta WhatsApp Business Platform
                                      Cloud API

  PDF invoices                        ReportLab

  QR generation                       Python `qrcode`

  QR scanning                         Browser camera-based scanner

  Initial scheduling                  APScheduler with persistent job
                                      storage or database-backed jobs

  Production background queue         Redis-backed queue or equivalent

  Calling (later)                     Exotel Voice API

  Frontend hosting                    Vercel or equivalent

  Backend hosting                     Python-compatible hosting

  Version control                     GitHub
  -----------------------------------------------------------------------

Free tiers and quotas can change. Production WhatsApp messaging, hosting
beyond quotas, AI usage, pricing feeds, and telephony may incur charges.

## 3. High-Level Architecture

### 3.1 Inbound Ordering

Customer WhatsApp\
→ Meta WhatsApp Cloud API\
→ Verified FastAPI webhook\
→ Store identification\
→ Customer lookup/create\
→ Message persistence and deduplication\
→ Background AI parsing\
→ Product catalogue matching\
→ Order creation\
→ PostgreSQL\
→ Shopkeeper dashboard.

### 3.2 Order Fulfilment

Shopkeeper dashboard\
→ Order review and correction\
→ Pricing engine\
→ Billing engine\
→ Customer confirmation message\
→ Customer confirmation response\
→ Packing checklist\
→ Ready-for-pickup event\
→ QR generation\
→ WhatsApp notification\
→ QR scan and verification\
→ Collected status.

### 3.3 Reminders

Ready-for-pickup event\
→ Reminder scheduler\
→ Consent and status check\
→ Telephony provider\
→ Customer call\
→ Provider status webhook.

Pending calls must be cancelled when the order becomes collected or
cancelled.

## 4. Multi-Tenant Design

Each store is a tenant. All store-owned data must be scoped by
`store_id`.

Core rules: - A shopkeeper can access only authorized stores. -
Customers are identified by `(store_id, normalized_phone)`. - A customer
may order from multiple stores using the same WhatsApp number. -
WhatsApp business phone-number ID maps inbound messages to a store. -
Backend authorization and PostgreSQL Row-Level Security (RLS) must
enforce tenant boundaries. - Never trust a client-supplied `store_id`
without checking the authenticated user's access.

## 5. Authentication and Store Onboarding

Shopkeeper authentication: - Signup. - Login. - Email/mobile
verification. - Session management. - Password recovery. - Role-based
authorization.

Suggested endpoints: - `POST /api/v1/auth/signup` -
`POST /api/v1/auth/login` - `POST /api/v1/auth/verify-otp` -
`POST /api/v1/auth/logout`

Store endpoints: - `POST /api/v1/stores` -
`GET /api/v1/stores/{store_id}` - `PUT /api/v1/stores/{store_id}` -
`GET /api/v1/categories`

Onboarding fields: - Store name. - Owner details. - Contact
information. - Address. - Business category. - WhatsApp connection
state. - Store configuration.

## 6. WhatsApp Integration

### 6.1 Official Integration

Use Meta WhatsApp Business Platform Cloud API. Do not use unofficial
WhatsApp Web scraping, browser automation, or personal-account
automation.

The platform needs: - Meta developer/business setup. - WhatsApp Business
Account (WABA) access. - Connected phone-number ID. - Access token
stored securely. - Webhook subscription and verification. - Approved
templates where required. - Message status callback handling.

Eligible stores may be onboarded through Meta Embedded Signup. Existing
WhatsApp Business App coexistence may be possible for eligible accounts;
confirm current eligibility and onboarding requirements.

### 6.2 Webhook Endpoints

-   `GET /api/v1/webhooks/whatsapp` --- Meta webhook verification
    challenge.
-   `POST /api/v1/webhooks/whatsapp` --- inbound messages and status
    events.

Webhook processing: 1. Verify the request signature using the configured
Meta app secret and raw request body. 2. Parse the event payload. 3.
Identify the connected store using the business phone-number ID. 4.
Normalize the sender phone number. 5. Deduplicate using the WhatsApp
message ID. 6. Persist the inbound event. 7. Return a successful
response promptly. 8. Queue longer AI/order processing asynchronously.

Do not run long AI calls before acknowledging the webhook.

### 6.3 First-Time Customer Handling

Customer registration is automatic and must not block ordering.

Pseudo-flow:

``` python
store = find_store_by_whatsapp_phone_number_id(phone_number_id)
customer = find_customer(store.id, normalized_sender_phone)

if customer is None:
    customer = create_customer(
        store_id=store.id,
        phone=normalized_sender_phone
    )

save_inbound_message(store, customer, message)
enqueue_message_processing(message.id)
```

Customer name can remain null until supplied. Store ID and normalized
phone should have a unique constraint.

### 6.4 WhatsApp Messaging Rules

-   Track message IDs and delivery statuses.
-   Use approved templates for business-initiated messages where
    required.
-   Respect the 24-hour customer service window and current Meta policy.
-   Store consent and opt-out state where applicable.
-   Handle rate limits, failed sends, and retryable errors.
-   Keep tokens and secrets out of frontend code.

## 7. AI Order Parsing Service

### 7.1 Input

-   Store ID.
-   Customer ID.
-   Original WhatsApp message.
-   Optional language/context metadata.

### 7.2 Structured Output

``` json
{
  "items": [
    {
      "product_name": "Atta",
      "brand": null,
      "variant": null,
      "quantity": 2,
      "unit": "kg"
    },
    {
      "product_name": "Oil",
      "brand": "Fortune",
      "variant": null,
      "quantity": 1,
      "unit": "litre"
    }
  ],
  "requires_clarification": false,
  "clarification_reason": null
}
```

### 7.3 Validation and Matching

-   Validate model output using a strict Pydantic schema.
-   Normalize units and common spelling variations.
-   Match products only against the relevant store catalogue.
-   Support aliases and local-language product names.
-   Flag multiple possible matches.
-   Flag unavailable products.
-   Never let the AI invent product prices or stock.
-   Send ambiguous items to shopkeeper review or customer clarification.

Suggested endpoint: - `POST /api/v1/orders/parse`

The parsing endpoint may be internal rather than publicly exposed.

## 8. Product Catalogue Service

Product fields: - `id` - `store_id` - `category_id` - `name` - `brand` -
`variant` - `aliases` - `unit` - `current_price` - `stock_quantity` -
`availability` - `created_at` - `updated_at`

Endpoints: - `POST /api/v1/products` - `GET /api/v1/products` -
`GET /api/v1/products/{product_id}` -
`PUT /api/v1/products/{product_id}` -
`DELETE /api/v1/products/{product_id}`

Product deletion should preferably be soft deletion/deactivation if
historical orders reference the product.

## 9. Dynamic Pricing Engine

### 9.1 Pricing Modes

-   `FIXED_PRICE`
-   `STORE_DEFINED_PRICE`
-   `EXTERNAL_REFERENCE_PRICE`
-   `MANUAL_OVERRIDE`

### 9.2 Provider Adapter

Do not hard-code one external market data provider into the pricing
engine.

Example interface:

``` python
class PricingProvider:
    def get_reference_price(self, product, region):
        raise NotImplementedError

    def get_last_updated(self, product, region):
        raise NotImplementedError
```

Provider selection must consider: - Product coverage. - Geographic
coverage. - Update frequency. - Data licensing. - API reliability. -
Cost.

A universal global API for all Kirana retail selling prices must not be
assumed.

### 9.3 Pricing Rules

For a product with a reference rate: 1. Fetch and store the reference
rate. 2. Record provider and timestamp. 3. Calculate a suggested retail
price using store-configured rules, if enabled. 4. Allow the shopkeeper
to override it. 5. Save the final price snapshot on the order
item/invoice.

Reference or commodity rates are not automatically the shop's retail
price. Store margins, brand, pack size, taxes, and other costs may
differ.

### 9.4 Price History

Store: - Product ID. - Previous price. - New price. - Source. - Updated
by. - Effective timestamp.

Endpoints: - `GET /api/v1/products/{product_id}/price-history` -
`POST /api/v1/products/{product_id}/price`

## 10. Billing Service

Use decimal arithmetic for all money calculations.

Calculations: - `line_total = quantity × unit_price` -
`subtotal = sum(line_total)` -
`grand_total = subtotal - discount + applicable_tax`

Invoice data: - Invoice number. - Store/customer details. - Order ID. -
Product snapshots. - Quantity and unit. - Unit price. - Line total. -
Discount. - Applicable tax. - Grand total. - Payment status. - Created
timestamp.

Endpoints: - `POST /api/v1/billing/{order_id}/generate` -
`GET /api/v1/billing/{invoice_id}` -
`GET /api/v1/billing/{invoice_id}/pdf`

Historical invoices must not change when catalogue prices are updated
later. Tax treatment and invoice format must be configurable and
reviewed for the applicable business.

## 11. Order Management Service

Suggested endpoints: - `POST /api/v1/orders` - `GET /api/v1/orders` -
`GET /api/v1/orders/{order_id}` -
`PATCH /api/v1/orders/{order_id}/status` -
`POST /api/v1/orders/{order_id}/confirm` -
`POST /api/v1/orders/{order_id}/cancel`

Order statuses: - `NEW` - `AI_PROCESSING` - `NEEDS_CLARIFICATION` -
`SHOPKEEPER_REVIEW` - `CUSTOMER_CONFIRMATION` - `CONFIRMED` -
`PACKING` - `PARTIALLY_PACKED` - `READY_FOR_PICKUP` - `COLLECTED` -
`REJECTED` - `CANCELLED` - `EXPIRED`

Every status transition must be validated server-side and written to an
order event/audit table.

Important invariants: - An order cannot be collected before it is
ready. - An order cannot be ready while required items remain
unresolved. - A cancelled order cannot be collected. - Duplicate
confirmation messages must not create duplicate invoices or orders. -
Collection must be an atomic operation.

## 12. Customer Confirmation

After shopkeeper review: 1. Generate final order summary. 2. Send it
through WhatsApp. 3. Include confirm/reject/change options using
interactive messages where supported. 4. Accept a controlled plain-text
fallback. 5. Validate the sender and order association. 6. Update order
status and record the response.

Endpoints may include: - `POST /api/v1/orders/{order_id}/send-summary` -
`POST /api/v1/orders/{order_id}/customer-response`

## 13. Packing Service

Each order item has its own packing state.

Suggested fields: - `order_item_id` - `packing_status` -
`packed_quantity` - `packed_by` - `packed_at`

The order becomes `READY_FOR_PICKUP` only when all required items are
packed or an authorized shopkeeper resolves an exception.

## 14. QR Pickup Service

### 14.1 Generation

Endpoint: - `POST /api/v1/qr/{order_id}/generate`

Generate a cryptographically secure, unguessable token. Store a hash of
the token rather than the raw token where practical.

### 14.2 Verification

Endpoint: - `POST /api/v1/qr/verify`

Verification checks: - Token validity. - Store association. - Order
status. - Expiration. - Previous redemption.

Use a transaction/atomic update so two simultaneous scans cannot collect
the same order twice.

After successful verification: - Mark token redeemed. - Mark order
collected. - Record timestamp and verifying user. - Cancel pending
reminders.

## 15. Notification Service

Supported events: - `ORDER_RECEIVED` - `NEEDS_CLARIFICATION` -
`CUSTOMER_CONFIRMATION_REQUIRED` - `ORDER_CONFIRMED` -
`BILL_GENERATED` - `ORDER_READY` - `ORDER_COLLECTED` - `ORDER_CANCELLED`

Endpoints: - `POST /api/v1/notifications/send` -
`POST /api/v1/webhooks/whatsapp/status`

Use an outbox/queue pattern for reliable notifications. Track provider
message IDs, delivery status, failures, and retry attempts. Apply Meta's
current template and customer-service-window rules.

## 16. Automated Calling Service (Later Phase)

Provider: Exotel or another compliant Indian telephony provider.

Endpoints: - `POST /api/v1/calls/schedule` -
`POST /api/v1/calls/cancel` - `POST /api/v1/webhooks/calls/status`

Requirements: - Schedule only for ready, uncollected orders. - Check
call consent, opt-out, permitted calling hours, and frequency limits
before each call. - Store provider call ID. - Process call status
callbacks. - Cancel all pending jobs when order is collected or
cancelled. - Retain call logs for support and audit.

This module is optional for MVP and will incur telephony charges.

## 17. Database Schema

### 17.1 `users`

-   `id UUID PRIMARY KEY`
-   `name VARCHAR`
-   `email VARCHAR`
-   `phone VARCHAR`
-   `role VARCHAR`
-   `created_at TIMESTAMPTZ`

### 17.2 `stores`

-   `id UUID PRIMARY KEY`
-   `owner_id UUID REFERENCES users(id)`
-   `category_id UUID`
-   `store_name VARCHAR`
-   `address TEXT`
-   `phone VARCHAR`
-   `whatsapp_business_account_id VARCHAR`
-   `whatsapp_phone_number_id VARCHAR UNIQUE`
-   `status VARCHAR`
-   `created_at TIMESTAMPTZ`

### 17.3 `business_categories`

-   `id UUID PRIMARY KEY`
-   `name VARCHAR`
-   `configuration JSONB`
-   `is_active BOOLEAN`

### 17.4 `customers`

-   `id UUID PRIMARY KEY`
-   `store_id UUID REFERENCES stores(id)`
-   `phone VARCHAR`
-   `name VARCHAR NULL`
-   `whatsapp_consent BOOLEAN`
-   `call_consent BOOLEAN`
-   `created_at TIMESTAMPTZ`

Unique constraint: `(store_id, phone)`.

### 17.5 `products`

-   `id UUID PRIMARY KEY`
-   `store_id UUID REFERENCES stores(id)`
-   `category_id UUID`
-   `name VARCHAR`
-   `brand VARCHAR`
-   `variant VARCHAR`
-   `aliases JSONB`
-   `unit VARCHAR`
-   `current_price NUMERIC(12,2)`
-   `stock_quantity NUMERIC(12,3)`
-   `availability BOOLEAN`
-   `created_at TIMESTAMPTZ`
-   `updated_at TIMESTAMPTZ`

### 17.6 `price_history`

-   `id UUID PRIMARY KEY`
-   `product_id UUID REFERENCES products(id)`
-   `previous_price NUMERIC(12,2)`
-   `new_price NUMERIC(12,2)`
-   `source VARCHAR`
-   `updated_by UUID`
-   `effective_at TIMESTAMPTZ`

### 17.7 `orders`

-   `id UUID PRIMARY KEY`
-   `store_id UUID REFERENCES stores(id)`
-   `customer_id UUID REFERENCES customers(id)`
-   `order_number VARCHAR`
-   `original_message TEXT`
-   `status VARCHAR`
-   `subtotal NUMERIC(12,2)`
-   `discount NUMERIC(12,2)`
-   `tax NUMERIC(12,2)`
-   `grand_total NUMERIC(12,2)`
-   `created_at TIMESTAMPTZ`
-   `updated_at TIMESTAMPTZ`

### 17.8 `order_items`

-   `id UUID PRIMARY KEY`
-   `order_id UUID REFERENCES orders(id)`
-   `product_id UUID NULL`
-   `product_name_snapshot VARCHAR`
-   `quantity NUMERIC(12,3)`
-   `unit VARCHAR`
-   `unit_price NUMERIC(12,2)`
-   `total_price NUMERIC(12,2)`
-   `packing_status VARCHAR`

### 17.9 `invoices`

-   `id UUID PRIMARY KEY`
-   `order_id UUID REFERENCES orders(id)`
-   `invoice_number VARCHAR`
-   `total_amount NUMERIC(12,2)`
-   `payment_status VARCHAR`
-   `pdf_url TEXT`
-   `created_at TIMESTAMPTZ`

### 17.10 `qr_tokens`

-   `id UUID PRIMARY KEY`
-   `order_id UUID REFERENCES orders(id)`
-   `token_hash VARCHAR UNIQUE`
-   `expires_at TIMESTAMPTZ`
-   `redeemed_at TIMESTAMPTZ NULL`
-   `status VARCHAR`

### 17.11 `notifications`

-   `id UUID PRIMARY KEY`
-   `order_id UUID REFERENCES orders(id)`
-   `channel VARCHAR`
-   `message_type VARCHAR`
-   `provider_message_id VARCHAR`
-   `status VARCHAR`
-   `created_at TIMESTAMPTZ`

### 17.12 `call_logs`

-   `id UUID PRIMARY KEY`
-   `order_id UUID REFERENCES orders(id)`
-   `customer_id UUID REFERENCES customers(id)`
-   `provider_call_id VARCHAR`
-   `scheduled_at TIMESTAMPTZ`
-   `call_status VARCHAR`
-   `attempt_number INTEGER`

### 17.13 `message_events`

-   `id UUID PRIMARY KEY`
-   `store_id UUID REFERENCES stores(id)`
-   `customer_id UUID REFERENCES customers(id)`
-   `whatsapp_message_id VARCHAR UNIQUE`
-   `message_type VARCHAR`
-   `message_content TEXT`
-   `processing_status VARCHAR`
-   `received_at TIMESTAMPTZ`

### 17.14 Recommended Additional Tables

-   `order_events` --- order status and audit history.
-   `store_users` --- multiple shopkeeper/staff memberships.
-   `store_integrations` --- encrypted provider configuration
    references.
-   `customer_consents` --- channel, purpose, source, timestamp, and
    withdrawal.
-   `scheduled_jobs` --- durable reminder/job state.
-   `webhook_events` --- webhook idempotency and processing state.

## 18. Security Requirements

-   HTTPS only.
-   Secrets stored in backend environment/secret manager.
-   Never expose Meta access tokens in frontend code.
-   Verify webhook signatures.
-   Validate all input with Pydantic.
-   Enforce role-based access control.
-   Enforce store-level authorization and database RLS.
-   Rate-limit sensitive endpoints.
-   Hash QR tokens.
-   Keep audit logs.
-   Store only required customer data.
-   Record and respect consent and opt-out.
-   Protect invoice and file URLs with appropriate access controls.

## 19. Reliability and Error Handling

Handle: - Duplicate webhooks. - Invalid webhook signatures. - Unknown
store numbers. - Unknown products. - Ambiguous quantities and units. -
AI provider timeout or invalid output. - External pricing API failure. -
Database outage. - WhatsApp send failures. - QR replay. - Duplicate
customer confirmation. - Telephony callback failure. - Server restart
with pending reminders.

Use: - Idempotency keys. - Exponential backoff for retryable errors. -
Dead-letter handling for repeated failures. - Durable job storage. -
Structured logs. - Monitoring and alerts.

## 20. Project Folder Structure

``` text
retail-platform/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── dashboard/
│   ├── auth/
│   ├── stores/
│   ├── products/
│   ├── orders/
│   ├── billing/
│   └── analytics/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config/
│   │   ├── database/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── api/
│   │   ├── services/
│   │   │   ├── whatsapp/
│   │   │   ├── ai/
│   │   │   ├── pricing/
│   │   │   ├── billing/
│   │   │   ├── orders/
│   │   │   ├── notifications/
│   │   │   ├── qr/
│   │   │   └── calling/
│   │   ├── workers/
│   │   └── utils/
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── database/
│   ├── migrations/
│   ├── schema.sql
│   └── seed.sql
├── docs/
│   ├── PRODUCT_OVERVIEW.md
│   ├── PRD.md
│   ├── TRD.md
│   └── API.md
├── .env.example
├── .gitignore
└── README.md
```

## 21. Testing Strategy

### Unit Tests

-   AI schema validation.
-   Product matching.
-   Unit normalization.
-   Pricing calculations.
-   Billing calculations.
-   Order state transitions.
-   QR token validation.
-   Reminder cancellation.

### Integration Tests

-   Meta webhook verification and payload parsing.
-   WhatsApp outbound messages.
-   AI provider integration.
-   PostgreSQL persistence.
-   Pricing-provider adapter.
-   PDF invoice generation.
-   QR scanning and verification.
-   Telephony callbacks when implemented.

### End-to-End Tests

-   First-time WhatsApp customer.
-   Returning WhatsApp customer.
-   Order creation.
-   Shopkeeper review.
-   Customer confirmation.
-   Billing.
-   Packing.
-   Ready notification.
-   QR pickup.
-   Reminder cancellation.

### Security Tests

-   Cross-store data access.
-   Invalid sessions.
-   Invalid webhook signatures.
-   Duplicate webhook events.
-   QR token replay.
-   Unauthorized order modification.

## 22. Deployment Plan

MVP: - Next.js frontend on Vercel or equivalent. - FastAPI backend on a
Python-compatible host. - Supabase PostgreSQL. - Meta WhatsApp Cloud
API. - Hosted AI free quota or local open-source model. - GitHub
repository.

Production: - Persistent background workers. - Durable scheduling. -
Database backups. - Secret management. - Centralized logging and
monitoring. - Usage and cost monitoring.

## 23. Implementation Roadmap

  Phase   Target        Deliverable
  ------- ------------- -----------------------------------------
  1       Days 1--3     Authentication and store onboarding
  2       Days 4--6     Product catalogue and pricing
  3       Days 7--9     WhatsApp webhook and AI parsing
  4       Days 10--12   Order management and billing
  5       Days 13--14   Customer confirmation and notifications
  6       Days 15--17   Packing and QR pickup
  7       Days 18--20   Testing and pilot deployment
  Later   Phase 2       External pricing and automated calling

Timeline is an estimate and depends on developer capacity, WhatsApp
onboarding approval, and third-party service availability.

## 24. Technical Acceptance Criteria

The system must: 1. Receive messages from a connected store's WhatsApp
number. 2. Identify the store from the connected business phone-number
ID. 3. Automatically create first-time customer records. 4. Avoid
duplicate processing of the same WhatsApp message. 5. Extract and
validate order items. 6. Match products against the correct store
catalogue. 7. Apply approved store pricing rules. 8. Generate bills with
immutable price snapshots. 9. Support customer confirmation. 10. Track
packing and pickup. 11. Verify QR codes securely. 12. Isolate data
between stores. 13. Preserve scheduled tasks across backend restarts.
14. Cancel pending reminders when an order is collected or cancelled.

**End of TRD.**
