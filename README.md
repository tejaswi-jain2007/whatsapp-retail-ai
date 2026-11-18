# AI-Powered WhatsApp Retail Order Management Platform

A multi-tenant, AI-powered, WhatsApp-first Retail Management SaaS platform for local Kirana and retail stores.

> **Central Principle:** Customers use WhatsApp. Shopkeepers use our web dashboard. AI connects the two.

---

## 🚀 Key Features

1. **Zero-App Customer Ordering:** Customers place orders via regular WhatsApp messages to the store's WhatsApp Business number. No app download, registration, or login required for customers.
2. **Instant First-Time Customer Onboarding:** Automatically recognizes phone numbers per store and creates customer profiles without blocking the ordering flow.
3. **AI Order Parsing:** Automatically extracts items, quantities, units, and variants from unstructured Hinglish/English shopping lists.
4. **Catalogue Matching & Dynamic Pricing:** Matches parsed items against store inventory, supports store-defined pricing, commodity reference rates, and manual shopkeeper overrides.
5. **Shopkeeper Review & Live Dashboard:** Shopkeepers verify quantities, item availability, and prices in real-time.
6. **Customer Confirmation Flow:** Generates and sends WhatsApp order summaries with interactive confirmation/change prompts.
7. **Packing Checklist:** Item-level packing status tracking; updates order to `READY_FOR_PICKUP` when packing completes.
8. **Cryptographic QR Pickup Verification:** Generates single-use pickup tokens delivered via WhatsApp. Shopkeepers verify the QR code on collection, atomically marking orders as `COLLECTED` and preventing replay.
9. **Automated Billing & PDF Invoices:** Accurate decimal-precision invoice generation with ReportLab PDF export.
10. **Store Analytics:** Key metrics including sales, orders by status, average order value, and top-selling products.

---

## 🛠 Tech Stack

- **Backend:** Python FastAPI, Pydantic v2, SQLAlchemy 2.0
- **AI Engine:** Google Gemini API / Fallback NLP parser
- **WhatsApp Channel:** Meta WhatsApp Cloud API (Webhooks & Cloud Messages)
- **Database:** PostgreSQL (with SQLite compatibility for fast local dev & tests)
- **PDF Generation:** ReportLab
- **QR Engine:** Python `qrcode` + SHA-256 secure hash token validation
- **Frontend:** Next.js, React, Tailwind CSS, Lucide icons

---

## 📂 Project Structure

```text
├── docs/                     # PRD, TRD, Product Overview documentation
├── database/                 # SQL schemas, migrations, seed data
│   ├── schema.sql
│   └── seed.sql
├── backend/                  # FastAPI Modular Monolith
│   ├── app/
│   │   ├── api/              # Routers (auth, stores, products, orders, billing, qr, webhooks, etc.)
│   │   ├── config/           # App settings and environment validation
│   │   ├── database/         # Database connection and session management
│   │   ├── models/           # SQLAlchemy 2.0 database entities
│   │   ├── schemas/          # Pydantic schemas for requests and responses
│   │   ├── services/         # Business logic (whatsapp, ai, pricing, billing, orders, qr, notifications)
│   │   └── utils/            # Cryptography, auth tokens, phone sanitization
│   ├── tests/                # Comprehensive unit and integration test suite
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                 # Next.js Shopkeeper Dashboard
└── README.md
```

---

## 🚦 Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
cp ../.env.example .env
uvicorn app.main:app --reload --port 8000
```

Backend interactive API documentation will be available at: `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Dashboard will be accessible at: `http://localhost:3000`

---

## 🧪 Running Tests

```bash
cd backend
pytest
```

