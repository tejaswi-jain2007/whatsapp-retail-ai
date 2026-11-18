# Product Requirements Document (PRD)

## AI-Powered WhatsApp Retail Order Management Platform

**Version:** 1.0\
**Date:** 18 November 2026\
**Product type:** Multi-tenant RetailTech SaaS\
**Initial market:** Local retailers in India\
**Customer channel:** WhatsApp only\
**Shopkeeper interface:** Web dashboard

------------------------------------------------------------------------

## 1. Executive Summary

The product is an AI-powered WhatsApp-first order management platform
for local retail stores.

Customers place orders by sending ordinary WhatsApp messages to a
participating shopkeeper's connected WhatsApp Business number. They do
not need to install an app, visit a website, or create an account.

The platform receives messages through the official WhatsApp Business
Platform, identifies the store and customer, uses AI to extract products
and quantities, matches those products against the store catalogue, and
creates an order for shopkeeper review.

The shopkeeper manages the order through a web dashboard: reviews items,
corrects quantities, confirms availability and prices, generates a bill,
confirms the order, packs items, and marks the order ready for pickup.
The customer receives updates on WhatsApp. Pickup can be verified using
a QR code. Automated voice reminders are a planned optional module
requiring a paid telephony provider.

## 2. Product Vision

Help traditional local retailers manage orders digitally without forcing
customers to change their existing behaviour or install another
application.

## 3. Problem Statement

Local retailers commonly receive orders through WhatsApp messages and
phone calls. This can lead to: - Manual interpretation of shopping
lists. - Incorrect product names, quantities, or units. - Inconsistent
or outdated prices. - Manual bill preparation. - Difficulty tracking
multiple orders and packing progress. - Repeated customer calls asking
whether an order is ready. - Limited customer and order history.

## 4. Proposed Solution

A shared platform connecting customers and retailers through WhatsApp
and a shopkeeper dashboard.

Core capabilities: 1. WhatsApp-based ordering. 2. Automatic first-time
customer identification. 3. AI message parsing and catalogue matching.
4. Product and inventory management. 5. Configurable pricing and
reference-price support. 6. Billing and invoice generation. 7.
Shopkeeper order review and confirmation. 8. Packing checklist and
status management. 9. WhatsApp customer notifications. 10. QR-based
pickup verification. 11. Optional automated voice reminders. 12. Store
analytics.

## 5. Users and Roles

### 5.1 Customer

Customers interact exclusively through WhatsApp. - No customer app. - No
customer website. - No customer signup or login. - Customer identity is
based on the WhatsApp phone number, scoped to each store. - Customers
can send orders, clarify items, confirm or reject an order, and receive
bills and status updates.

### 5.2 Shopkeeper

Shopkeepers use the web dashboard. - Register and configure their
store. - Select a business category. - Connect an eligible WhatsApp
Business number. - Manage products, units, prices, and availability. -
Review AI-generated orders. - Correct quantities and prices. - Generate
bills. - Confirm and pack orders. - Generate or verify pickup QR
codes. - View order history and analytics.

### 5.3 Store Staff

Optional staff accounts can be added in a later release to help with
order preparation, packing, and pickup.

### 5.4 Platform Administrator

-   Manage stores and business categories.
-   Monitor integrations and platform health.
-   Manage subscriptions and support.
-   Review operational issues.

## 6. Business Categories

Initial categories: - Kirana / Grocery. - Medical Store. - Vegetable and
Fruit Shop. - Bakery. - Dairy Store. - Hardware Store. - Other Retail
Businesses.

Each category can configure its product catalogue, units, pricing rules,
and workflow options. The first MVP should focus on the Kirana/Grocery
workflow while keeping the data model extensible.

## 7. Customer Journeys

### 7.1 First-Time Customer

1.  Customer scans the shop's WhatsApp QR code or opens its WhatsApp
    link.
2.  Customer sends a first message.
3.  Meta sends the incoming message to the platform webhook.
4.  The platform identifies the store from its connected WhatsApp
    phone-number ID.
5.  The platform looks up the sender's phone number for that store.
6.  If no customer record exists, the platform creates one
    automatically.
7.  The platform sends a welcome/instruction message where permitted.
8.  Customer sends a shopping list.
9.  AI extracts products and quantities.
10. The shopkeeper reviews the order and final pricing.
11. Customer receives the order summary and confirms or requests a
    change.
12. Shopkeeper packs the order.
13. Customer receives a ready-for-pickup notification.
14. Shopkeeper verifies the pickup QR code and marks the order
    collected.

### 7.2 Returning Customer

1.  Customer messages the store again.
2.  Platform identifies the customer using the store ID and normalized
    WhatsApp number.
3.  Existing customer history can be retrieved.
4.  The new message is processed as a new order or an order-related
    reply, as appropriate.

### 7.3 Shopkeeper Journey

1.  Shopkeeper visits the platform website.
2.  Creates an account and verifies contact details.
3.  Registers store details and selects a category.
4.  Connects an eligible WhatsApp Business number using the official
    onboarding flow.
5.  Adds or imports products and prices.
6.  Receives incoming orders on the dashboard.
7.  Reviews AI extraction, availability, quantity, and pricing.
8.  Generates and sends the bill/order summary.
9.  Confirms the order after the required customer confirmation.
10. Packs items and updates item-level packing status.
11. Marks the order ready for pickup.
12. Verifies QR at pickup and completes the order.

## 8. Functional Requirements

### FR-01: Shopkeeper Authentication and Store Onboarding

-   Separate shopkeeper signup and login.
-   Email/mobile verification.
-   Store profile creation.
-   Business category selection.
-   Store address and contact details.
-   WhatsApp Business connection status.
-   Role-based dashboard access.

### FR-02: WhatsApp Integration

-   Use the official Meta WhatsApp Business Platform Cloud API.
-   Receive incoming messages through webhooks.
-   Identify the store from the connected business phone-number ID.
-   Identify the customer from the sender's WhatsApp number.
-   Store incoming message IDs and content.
-   Prevent duplicate processing.
-   Send outgoing WhatsApp messages and approved templates where
    required.
-   Process message delivery/read status callbacks where available.

### FR-03: Automatic Customer Creation

-   Customer registration must not be required.
-   First inbound message can create a customer record automatically.
-   Customer records are scoped to a store.
-   Customer name may be collected conversationally but must not block
    ordering.
-   The same phone number may be associated with multiple stores.

### FR-04: AI Order Parsing

Extract: - Product name. - Quantity. - Unit. - Brand, if specified. -
Variant, if specified. - Additional instructions.

Example message: "2 kg atta, 1 litre oil, 1 kg sugar."

Expected structured items: - Atta --- 2 kg. - Oil --- 1 litre. - Sugar
--- 1 kg.

AI output must be schema-validated and matched against the store
catalogue. Ambiguous or unmatched items must be flagged for
clarification rather than silently accepted.

### FR-05: Product Catalogue and Inventory

-   Add, edit, and deactivate products.
-   Configure category, brand, variant, unit, and price.
-   Configure availability and stock where used.
-   Support product aliases and common local-language names.
-   Support product-level and category-level configuration.

### FR-06: Dynamic Pricing

The pricing engine must support: - Fixed price. - Store-defined price. -
External reference price. - Manual override.

For Kirana products, including fluctuating products such as edible
oil: - External reference rates may be fetched from a configured
provider where suitable data is available. - Reference rates must
include source and timestamp. - The system may calculate a suggested
retail price using store-configured rules. - The shopkeeper must be able
to override the suggested price. - A reference/commodity rate must not
automatically become the retail selling price unless the store
explicitly configures and approves that rule.

For other business categories, pricing rules must be configurable
independently. Do not assume a single global API covers all retail
products.

### FR-07: Billing

Bills should contain: - Store and customer details. - Order and invoice
identifiers. - Product name, quantity, unit, and unit price. - Line
totals. - Discounts. - Applicable taxes. - Grand total. - Payment
status.

Requirements: - Preview and edit before finalization. - PDF
generation. - WhatsApp delivery. - Preserve historical price
snapshots. - Use decimal arithmetic for money.

### FR-08: Order Review and Customer Confirmation

-   Shopkeeper reviews AI-extracted items.
-   Shopkeeper can correct product, quantity, availability, and price.
-   System sends final order summary to customer.
-   Customer can confirm, reject, or request modification.
-   Support WhatsApp interactive buttons where available and plain-text
    fallback.
-   Associate replies with the correct customer and order.

### FR-09: Packing Management

-   Item-level packed/unpacked status.
-   Support partial packing.
-   Show packing progress.
-   Mark order ready only when required items are packed or explicitly
    resolved.
-   Record who packed and when, if staff accounts are enabled.

### FR-10: Customer Notifications

Send relevant WhatsApp updates for: - Order received. - Clarification
required. - Order summary / confirmation requested. - Order confirmed. -
Bill generated. - Order ready for pickup. - Order collected. - Order
cancelled.

Follow WhatsApp customer-service-window and template rules.

### FR-11: QR Pickup Verification

-   Generate a unique QR token for a ready order.
-   Deliver QR information to the customer through WhatsApp.
-   Scan QR using the shopkeeper dashboard.
-   Validate token, store, order status, expiry, and previous
    redemption.
-   Mark order collected atomically.
-   Prevent token reuse.

### FR-12: Automated Voice Reminders (Planned / Optional)

-   Schedule reminders for ready-but-uncollected orders.
-   Configure reminder times and daily limit.
-   Verify customer consent and permitted calling window before each
    call.
-   Use a supported telephony provider such as Exotel.
-   Record provider call IDs and status callbacks.
-   Cancel pending reminders when an order is collected or cancelled.
-   Provide opt-out support.

This feature is not required for the zero-budget MVP because outbound
phone calls require a paid telephony provider and applicable regulatory
compliance.

### FR-13: Analytics

Dashboard metrics: - Total orders. - New and pending orders. - Orders
being packed. - Ready-for-pickup orders. - Collected and cancelled
orders. - Sales/revenue based on recorded transactions. - Average order
value. - Popular products. - Customer order history.

## 9. Order Lifecycle

Primary flow:

`NEW → AI_PROCESSING → SHOPKEEPER_REVIEW → CUSTOMER_CONFIRMATION → CONFIRMED → PACKING → READY_FOR_PICKUP → COLLECTED`

Additional states: - `NEEDS_CLARIFICATION` - `REJECTED` - `CANCELLED` -
`EXPIRED`

The backend must enforce valid state transitions. A collected or
cancelled order must not be reopened through an ordinary status update.

## 10. MVP Scope

### MVP --- Required

-   Shopkeeper signup/login.
-   Store onboarding and category selection.
-   WhatsApp Cloud API integration.
-   Automatic customer identification and creation.
-   Text-based AI order parsing.
-   Product catalogue.
-   Manual/store-defined pricing.
-   Basic reference-price fields and manual override.
-   Shopkeeper order review.
-   Basic bill generation.
-   Customer confirmation through WhatsApp.
-   Packing checklist.
-   Ready-for-pickup notification.
-   QR pickup verification.
-   Basic order analytics.

### Phase 2

-   External pricing-provider integrations.
-   Automated voice reminders.
-   Advanced inventory management.
-   Voice-note order parsing.
-   Advanced customer purchase history.
-   Staff accounts and permissions.
-   Advanced analytics.

### Phase 3

-   Subscription billing.
-   Multi-city expansion.
-   POS integrations.
-   Advanced retail intelligence.
-   Additional category-specific workflows.

## 11. Non-Functional Requirements

-   Responsive dashboard.
-   Secure authentication and authorization.
-   Store-level data isolation.
-   Reliable and idempotent webhook processing.
-   Audit trail for important order and price changes.
-   Secure QR validation.
-   Customer privacy and consent management.
-   Monitoring and error logging.
-   Backup and recovery strategy.
-   Scalable background processing.

## 12. Success Metrics

-   Incoming WhatsApp webhook success rate.
-   AI product/quantity extraction accuracy.
-   Percentage of orders requiring manual correction.
-   Time from message receipt to dashboard order creation.
-   Customer confirmation rate.
-   Order pickup completion rate.
-   Notification delivery rate.
-   Active stores and orders per store.

## 13. Acceptance Criteria

The MVP is acceptable when: 1. A first-time customer can message a store
without signup or login. 2. The system identifies the correct store and
automatically creates the customer record. 3. The AI extracts product
names, quantities, and units from a supported text message. 4. The order
appears on the correct shopkeeper dashboard. 5. The shopkeeper can
correct items and prices. 6. The system generates an accurate bill from
confirmed item data. 7. The customer can confirm or request changes
through WhatsApp. 8. The shopkeeper can update packing status. 9. The
customer receives a ready-for-pickup message. 10. The QR code can be
validated once and the order marked collected. 11. Store data is
isolated from other stores.

## 14. Assumptions and Open Decisions

-   The first MVP focuses on Kirana/Grocery stores.
-   Each participating store must connect an eligible WhatsApp Business
    Platform number.
-   WhatsApp Coexistence may be available for eligible existing WhatsApp
    Business App accounts; eligibility must be checked.
-   Exact external pricing provider and product coverage are not yet
    selected.
-   Tax and invoice configuration must be reviewed for the relevant
    business model.
-   Online payment is not assumed for MVP; payment-at-pickup can be
    recorded.
-   Reminder timing, customer consent language, and calling compliance
    require final decisions.

**End of PRD.**
