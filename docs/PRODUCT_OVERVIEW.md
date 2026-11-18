# Product Overview

## What We Are Building --- AI-Powered WhatsApp Retail Order Management Platform

**Version:** 1.0\
**Date:** 18 November 2026\
**Product type:** RetailTech SaaS\
**Initial market:** Local Kirana and retail stores in India

------------------------------------------------------------------------

## 1. In One Sentence

We are building a platform that lets customers order from local shops by
simply messaging the shopkeeper on WhatsApp, while AI automatically
converts those messages into manageable orders for the shopkeeper
through a web dashboard.

## 2. The Core Idea

Today, customers often send shopping lists to their local Kirana shop
through WhatsApp.

For example:

> "Bhaiya, 2 kg atta, 1 litre oil, 1 kg sugar aur 2 packet Maggi rakh
> dena."

The shopkeeper has to read the message, understand the products, check
availability, calculate prices, prepare the bill, pack the items, and
inform the customer.

Our platform automates and organizes this workflow.

The customer continues using WhatsApp exactly as usual. The shopkeeper
gets a dedicated dashboard to manage the entire order.

## 3. What Makes This Product Different?

**Customers do not need another application.**

There is: - No customer app. - No customer website. - No customer
signup. - No customer login. - No separate customer account creation.

The customer only needs WhatsApp.

The shopkeeper, however, uses our web dashboard.

This is a WhatsApp-first retail operating system, not a consumer
shopping marketplace or delivery app.

## 4. How the Product Works

### Step 1 --- Customer Opens the Store's WhatsApp

The customer scans the shop's WhatsApp QR code or opens its WhatsApp
link.

They send a message to the shopkeeper's connected WhatsApp Business
number.

### Step 2 --- System Receives the Message

The official Meta WhatsApp Business Cloud API sends the incoming message
to our backend through a webhook.

The system: - Identifies the store. - Reads the customer's WhatsApp
number. - Checks whether the customer has ordered from that store
before. - Automatically creates a customer record for a first-time
customer.

No signup or login is needed.

### Step 3 --- AI Understands the Shopping List

AI extracts: - Product names. - Quantities. - Units. - Brands. - Product
variants. - Additional instructions.

Example:

  Customer Message   AI Output
  ------------------ ---------------------
  2 kg atta          Atta --- 2 kg
  1 litre oil        Oil --- 1 litre
  1 kg sugar         Sugar --- 1 kg
  2 packet Maggi     Maggi --- 2 packets

The AI matches the extracted items against the relevant store's product
catalogue.

If the message is unclear, the system asks for clarification or flags it
for shopkeeper review.

### Step 4 --- Order Appears on the Shopkeeper Dashboard

The shopkeeper receives a new order on the dashboard.

The dashboard displays: - Customer details. - Original WhatsApp
message. - AI-extracted products. - Quantities and units. - Product
availability. - Suggested/current prices. - Order status.

The shopkeeper can correct the order before confirming it.

### Step 5 --- Pricing and Billing

The platform calculates the bill using the store's product prices.

For Kirana products whose prices fluctuate, such as edible oil, the
platform can support external reference rates where suitable data is
available.

Important: - External reference rates are not automatically the shop's
retail selling price. - The shopkeeper controls the final selling
price. - Manual price overrides are supported. - Price changes are
recorded. - The final order stores price snapshots so old bills do not
change.

Different business categories can use different pricing rules.

### Step 6 --- Shopkeeper Confirms the Order

The shopkeeper checks: - Products. - Quantities. - Availability. -
Prices. - Final bill.

The system sends the final summary to the customer on WhatsApp.

The customer can confirm, reject, or request a modification.

### Step 7 --- Packing Management

After confirmation, the shopkeeper starts preparing the order.

The dashboard provides a checklist for every product.

For example:

-   Atta --- Packed.
-   Oil --- Unpacked.
-   Sugar --- Packed.
-   Maggi --- Unpacked.

Once all required items are packed, the order status automatically
changes to Ready for Pickup.

### Step 8 --- Customer Gets a WhatsApp Notification

The customer receives a message:

> "Your order is packed and ready for pickup. Please visit the store to
> collect it."

The system can also send the order's pickup QR information.

### Step 9 --- QR-Based Pickup

The customer visits the store and presents the QR code.

The shopkeeper scans it through the dashboard.

The system validates the QR and order status, then marks the order as
Collected.

The QR cannot be reused after successful redemption.

### Step 10 --- Automated Reminders (Optional Later Feature)

If an order is ready but not collected, the system can schedule WhatsApp
reminders and, in a later phase, automated phone calls.

Example: - First reminder. - Second reminder. - Third reminder.

If the shopkeeper marks the order collected, all pending reminders are
cancelled.

Automated phone calls require a paid telephony provider and appropriate
customer consent.

## 5. Two Main Interfaces

### A. Customer Interface --- WhatsApp Only

Customers can: - Send shopping lists. - Receive automatic replies. -
Clarify products. - Confirm orders. - Receive bills. - Receive order
updates. - Receive pickup notifications. - Receive optional reminders.

Customers never need to use our web dashboard.

### B. Shopkeeper Interface --- Web Dashboard

Shopkeepers can access: - Login and signup. - Store onboarding. -
Business category selection. - WhatsApp connection. - Product
catalogue. - Pricing management. - Inventory management. - New orders. -
Order review. - Billing. - Packing checklist. - QR pickup
verification. - Customer history. - Analytics.

## 6. Who Can Use This Platform?

Initial target businesses:

1.  Kirana and grocery stores.
2.  Medical stores.
3.  Vegetable and fruit shops.
4.  Bakeries.
5.  Dairy stores.
6.  Hardware shops.
7.  Other local retailers.

The first pilot should focus on Kirana stores. The platform architecture
should support additional business categories through configurable
catalogues and pricing rules.

## 7. Why Dynamic Pricing Matters

Some products have prices that change frequently.

For example, edible oil prices may fluctuate over time.

The platform should therefore support: - Store-defined prices. -
External reference rates where available. - Suggested retail pricing. -
Manual price overrides. - Price history. - Effective dates and source
timestamps.

The shopkeeper must retain control over the final retail price.

There is no assumption that one universal global API provides accurate
live retail prices for every product.

## 8. What We Are Not Building

To avoid confusion, the product is not:

-   A grocery delivery marketplace.
-   A Blinkit or Zepto competitor.
-   A customer shopping application.
-   A consumer e-commerce website.
-   A platform that requires customer registration.
-   A replacement for WhatsApp.

We are building a management and automation layer for existing local
retailers.

## 9. Business Model

The proposed model is SaaS.

Potential revenue sources: - Monthly store subscriptions. - Premium AI
order processing. - Advanced analytics. - Inventory features. - Optional
automated calling packages. - Multi-user store plans.

Pricing will be finalized after validating the product with pilot
retailers.

## 10. MVP --- What We Build First

The first working version should include:

1.  Shopkeeper signup/login.
2.  Store onboarding.
3.  Business category selection.
4.  WhatsApp Cloud API connection.
5.  Automatic first-time customer identification.
6.  AI text-message parsing.
7.  Product catalogue.
8.  Store-defined pricing and manual overrides.
9.  Order dashboard.
10. Shopkeeper review and customer confirmation.
11. Basic bill generation.
12. Packing checklist.
13. WhatsApp ready-for-pickup notification.
14. QR-based pickup verification.

Voice calls, advanced inventory automation, and external price feeds can
be implemented after the core flow works.

## 11. The Complete Product Flow

``` text
CUSTOMER
   |
   | Sends WhatsApp message
   v
META WHATSAPP CLOUD API
   |
   | Webhook
   v
BACKEND
   |
   +--> Identify Store
   |
   +--> Identify/Create Customer
   |
   +--> AI Order Parsing
   |
   +--> Product Catalogue Matching
   |
   +--> Pricing Engine
   |
   v
SHOPKEEPER DASHBOARD
   |
   +--> Review Order
   |
   +--> Confirm Products & Prices
   |
   +--> Generate Bill
   |
   +--> Customer Confirmation
   |
   +--> Packing Checklist
   |
   +--> Mark Ready for Pickup
   |
   v
CUSTOMER WHATSAPP NOTIFICATION
   |
   v
QR PICKUP VERIFICATION
   |
   v
ORDER COLLECTED
   |
   +--> Cancel Pending Reminders
```

## 12. Final Product Definition

We are building a multi-tenant, AI-powered, WhatsApp-first Retail
Management SaaS platform.

It allows customers to order from local shops through ordinary WhatsApp
messages while giving shopkeepers a centralized dashboard to manage
orders, products, pricing, billing, packing, notifications, and pickup.

**The central principle is simple: Customers use WhatsApp. Shopkeepers
use our dashboard. AI connects the two.**

------------------------------------------------------------------------

**End of Product Overview.**
