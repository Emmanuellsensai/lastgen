# Lastgen Backend API & Domain Engines

> **Wema Hackaholics 7.0 · Hackathon Track · Team Ryzen**  
> **Architecture:** Express + TypeScript · Strict Envelope API · Dual-Seam Persistence (In-Memory Seed & Supabase) · Wema ALAT Rails  
> **Status:** 166/166 Tests Passing (21 test files) · 0 Type Errors · 0 Lint Warnings  

---

## 1. Overview

The **Lastgen Backend** is a high-performance, contract-frozen backend service providing financial underwriting, PAYG asset lifecycle management, IoT solar telemetry simulation, virtual cash wallets (035 Wema Bank), and ALAT payment integration for small business solar leasing across Nigeria.

It is built with an **async `Repository` seam** enabling it to run in two distinct modes:
1. **Demo Mode (`DEMO_MODE=true`):** Completely self-contained with zero external cloud dependencies. Operates against a byte-accurate, deterministic in-memory seed fixture with simulated payment consent and automated loan arrears progression.
2. **Live Mode (`DEMO_MODE=false`):** Connects to a live **Supabase PostgreSQL database** using the `SupabaseRepository`, enforces Supabase JWT bearer token authentication, and connects to real Wema ALAT payment gateway rails.

---

## 2. Documentation Index & Sitemap

For quick navigation across the Lastgen documentation suite, use the directory below:

| Document | Location | Purpose & Audience |
| :--- | :--- | :--- |
| **Frontend Integration Masterplan** | [`docs/FRONTEND_INTEGRATION_MASTERPLAN.md`](../docs/FRONTEND_INTEGRATION_MASTERPLAN.md) | **Essential for Frontend Devs & AI Agents.** Screen-by-screen linking blueprint, UI data bindings, and copy-paste AI agent prompt. |
| **Base API Contract** | [`docs/CONTRACT.md`](../docs/CONTRACT.md) | The frozen baseline specification: standard constants, base REST routes, and entity data shapes. |
| **Payment & Wallet Extension** | [`docs/PAYMENT_EXTENSION.md`](../docs/PAYMENT_EXTENSION.md) | The authoritative specification for 035 Wema virtual cash wallets, two-channel repayment lifecycle, and ALAT consent polling. |
| **Screen Linking Guide** | [`GUIDE.md`](../GUIDE.md) | Visual guide and screen-by-screen route checklist for the frontend UI. |
| **Backend Implementation Audit** | [`backend/AUDIT.md`](AUDIT.md) | Exhaustive test coverage audit, security analysis, domain invariant checks, and architectural review. |
| **Backend Progression Log** | [`backend/BACKEND_PROGRESS.md`](BACKEND_PROGRESS.md) | Complete engineering journal detailing Phases 0 through 5, refactorings, and milestone deliverables. |
| **Backend Roadmap** | [`backend/ROADMAP.md`](ROADMAP.md) | Post-hackathon production hardening, real webhook retries, and high-frequency IoT streaming. |
| **SQL Migrations** | [`backend/migrations/`](migrations/) | Idempotent PostgreSQL migrations: `audit.sql`, `payments-v2.sql`, and `payments-v3-atomic.sql`. |

---

## 3. Quickstart & Local Development

### Prerequisites
- Node.js >= 20.x
- `pnpm` >= 9.x

### Booting the Server

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Copy the sample environment file (demo defaults work immediately)
cp .env.example .env

# 3. Install dependencies from repo root
pnpm install

# 4. Start the development server with hot-reload (runs on http://localhost:8080)
pnpm dev
```

### Health Check Verification
```bash
curl -s http://localhost:8080/health
# Response: {"ok":true}
```

---

## 4. Configuration & Environment Variables

All environment variables are validated and strongly typed at startup in `src/config/env.ts`.

| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | `number` | `8080` | HTTP port the Express server listens on. |
| `DEMO_MODE` | `boolean` | `true` | When `true`, skips auth, uses in-memory seed fixture, and auto-funds demo wallets with ₦50,000. |
| `PAYMENT_ADAPTER` | `string` | `simulated` | `simulated` (in-process timer consent) or `alat` (live Wema HTTPS client). |
| `SETTLE_AFTER_MS` | `number` | `3000` | Delay before simulated ALAT consent flips to `SUCCESS`. Set to `0` in tests for instant settlement. |
| `SUPABASE_URL` | `string` | `""` | Supabase project URL (required when `DEMO_MODE=false`). |
| `SUPABASE_SERVICE_KEY` | `string` | `""` | Supabase service-role key for backend database access. |
| `ALAT_BASE_URL` | `string` | `""` | Base URL for Wema ALAT sandbox or production API. |
| `ALAT_CHANNEL_ID` | `string` | `""` | Channel identifier for Wema API authentication. |
| `ALAT_API_KEY` | `string` | `""` | Subscription key (`Ocp-Apim-Subscription-Key`) for ALAT gateway. |
| `ALAT_SOURCE_ACCOUNT` | `string` | `""` | Master merchant settlement account debited for transfers. |
| `ALAT_WEBHOOK_SECRET` | `string` | `""` | HMAC-SHA512 secret for validating ALAT transaction notifications. |
| `GEMINI_API_KEY` | `string` | `""` | Google Gemini Vision API key for fuel pump receipt OCR. |

---

## 5. API Surface & Endpoint Specification

Every endpoint (except `/health`) is mounted under the `/api` prefix and adheres to the **Standard Response Envelope**:

### Success Envelope
```json
{
  "ok": true,
  "data": { ... }
}
```

### Error Envelope
```json
{
  "ok": false,
  "error": {
    "code": "PAYMENT_REQUIRED",
    "message": "Wallet balance insufficient for repayment."
  }
}
```

### Standard Error Codes
- `VALIDATION` (400): Missing or invalid request parameters.
- `UNAUTHORIZED` (401): Missing or expired Supabase JWT token in live mode.
- `PAYMENT_REQUIRED` (402): Wallet balance is less than required repayment amount.
- `FORBIDDEN` (403): User does not own the requested business resource.
- `NOT_FOUND` (404): Resource (loan, quote, asset, wallet) does not exist.
- `INVALID_TRANSITION` (409): State machine conflict (e.g. paying an already closed loan).
- `MEDICAL_FLAG` (409): Hardware power suspension blocked due to life-safety medical protection.
- `UNAVAILABLE` (503): External payment gateway (ALAT) unreachable.

---

### Endpoint Reference Table

| Domain | Method & Path | Auth | Request Body / Query | Description |
| :--- | :--- | :---: | :--- | :--- |
| **Health** | `GET /health` | None | None | Service liveness probe (`{"ok":true}`). |
| **Business** | `POST /api/businesses` | Bearer | `{ name, type, city, generatorKva?, hoursPerDay? }` | Register new business entity. |
| | `GET /api/businesses/:id` | Bearer | None | Fetch business profile and medical safety flag. |
| | `GET /api/businesses/:id/burn` | Bearer | None | Calculate verified daily, monthly, and annual burn in kobo. |
| **Fuel Intake** | `POST /api/businesses/:id/receipts` | Bearer | `multipart/form-data` (`file`) | Gemini Vision OCR extraction of fuel litres and cost. |
| | `POST /api/businesses/:id/fuel-logs` | Bearer | `{ litres, amountKobo, pricePerLitreKobo, loggedAt }` | Record manual fuel purchase log. |
| **Solar Quotes** | `GET /api/systems` | Bearer | `?minKw&maxPriceKobo` | List available solar hardware tiers. |
| | `POST /api/businesses/:id/quote` | Bearer | `{ systemId, tenorMonths, depositKobo? }` | Size and price solar lease with amortisation. |
| | `GET /api/quotes/:id` | Bearer | None | Fetch existing quote and savings calculations. |
| **Credit Desk** | `GET /api/credit/applications` | Bearer | `?status=PENDING\|APPROVED\|DECLINED` | List applications waiting for underwriting. |
| | `GET /api/credit/applications/:id` | Bearer | None | Detail projection: affordability score + fuel log evidence. |
| | `POST /api/credit/applications/:id/approve` | Bearer | None | Underwrite application: activates Loan and provisions Asset. |
| | `POST /api/credit/applications/:id/decline` | Bearer | `{ reason }` | Decline application with recorded reason. |
| **Assets & IoT** | `GET /api/assets/:id` | Bearer | None | Asset status (`ACTIVE`, `GRACE`, `SUSPENDED`, `OWNED`). |
| | `GET /api/assets/:id/meter` | Bearer | `?from&to` | 90-day solar generation & consumption curve. |
| | `POST /api/assets/:id/suspend` | Bearer | `{ reason }` | Clamp hardware power (Blocked for medical loads). |
| | `POST /api/assets/:id/restore` | Bearer | None | Restore suspended asset back to `ACTIVE`. |
| **Loans** | `GET /api/loans/:id` | Bearer | None | Balance, tenor, status (`ACTIVE`, `DELINQUENT`, `CLOSED`). |
| | `GET /api/loans/:id/schedule` | Bearer | None | Full installment schedule (principal & interest split). |
| **Payments** | `POST /api/loans/:id/pay` | Bearer | `{ source: 'wallet'\|'bank_account', amountKobo? }` | Settle installment via Wallet or initiate ALAT consent. |
| | `GET /api/payments/:reference/status` | Bearer | None (accepts reference or `paymentId`) | Poll payment lifecycle status with provider reconciliation. |
| **Wallets** | `POST /api/wallets/create` | Bearer | `{ businessId, nin, firstName, lastName, phone }` | Create virtual 035 Wema account (Demo pre-funds ₦50k). |
| | `GET /api/wallets/balance` | Bearer | None | Fetch virtual account details and available balance. |
| | `GET /api/wallets/statement` | Bearer | `?limit&before` | Paginated wallet transaction ledger. |
| **Portfolio** | `GET /api/portfolio/stats` | Bearer | None | Aggregate KPIs across 523 financed solar assets. |
| | `GET /api/portfolio/assets` | Bearer | `?status&city&page` | Paginated asset ledger for credit desk. |
| | `POST /api/portfolio/export` | Bearer | None | Generate securitisation CSV export download URL. |
| **Impact** | `GET /api/businesses/:id/impact` | Bearer | `?period=month\|year\|all` | Litres displaced, CO₂ avoided, and naira saved. |
| | `GET /api/businesses/:id/wrapped` | Bearer | `?year` | Spotify-Wrapped style year-in-review metrics. |
| **Webhooks** | `POST /api/webhooks/alat` | None | ALAT notification payload (HMAC signed) | Replay-safe webhook handler settling loans atomically. |
| **Demo Control** | `POST /api/demo/reset` | None | None | Reset database to initial deterministic seed state. |
| | `POST /api/demo/advance-time` | None | `{ days }` | Advance clock and trigger automated arrears sweeps. |
| | `POST /api/demo/miss-payment` | None | `{ loanId }` | Force loan delinquency and advance asset into grace. |

---

## 6. Core Domain Engines & Invariants

```
   ┌───────────────────────┐         ┌─────────────────────────┐
   │                       │         │                         │
   │  Asset State Machine  │         │   Payment & Settlement  │
   │  ───────────────────  │         │   ───────────────────   │
   │  • ACTIVE             │         │   • Instant Wallet Pay  │
   │  • GRACE (72h window) │ ◄───────┤   • ALAT Consent Dance  │
   │  • SUSPENDED (40W)    │         │   • Atomic Loan Credit  │
   │  • OWNED (0 balance)  │         │   • Replay Idempotency  │
   │  [Medical Guard]      │         │                         │
   └───────────────────────┘         └─────────────────────────┘
               ▲                                  ▲
               │                                  │
   ┌───────────┴───────────┐         ┌────────────┴────────────┐
   │                       │         │                         │
   │      Lease Engine     │         │   Telemetry Simulator   │
   │      ────────────     │         │   ───────────────────   │
   │  • Fractional Math    │         │   • 90-Day Solar Curve  │
   │  • Savings Validation │         │   • Wh Gen vs Shop Draw │
   │  • Amortisation BPS   │         │   • Battery SoC Feed    │
   │                       │         │                         │
   └───────────────────────┘         └─────────────────────────┘
```

### 1. Asset & Loan State Machine
- **Lifecycle:** `ACTIVE` → `GRACE` (overdue payment) → `SUSPENDED` (grace expired) → `ACTIVE` (settled) → `OWNED` (loan balance = 0).
- **Medical Load Guard:** If `business.medicalFlag === true`, suspension is **strictly prohibited** in all code paths to safeguard critical medical cold-chain refrigeration.
- **Hardware Throttling:** When `SUSPENDED`, power delivery is clamped to `40W` to preserve baseline lighting circuits while shutting down commercial equipment.

### 2. Lease & Financial Math
- Money is strictly handled in **integer KOBO**.
- Standard amortization formula:
  $$\text{Monthly Rate } (r) = \frac{\text{aprBps}}{10000 \times 12}$$
  $$\text{Payment } (P) = \text{Principal} \times \frac{r}{1 - (1 + r)^{-n}}$$
- **Viability Invariant:** A quote is only approved if $\text{Monthly Savings} = \text{Monthly Fuel Burn} - \text{Monthly Payment} > 0$.

### 3. Payment & Settlement Lifecycle
- **Channel 1 (Virtual Wallet):** Atomic balance verification. If `balanceKobo < amountKobo`, raises `402 PAYMENT_REQUIRED`. On success, debits wallet and updates loan/asset in the same transaction.
- **Channel 2 (ALAT Bank Transfer):** Books payment as `pending_authorisation`. Returns slim pay result. Settles via webhook notification or reconciliation polling against `GET /api/payments/:reference/status`.

---

## 7. Backend Directory Structure

```
backend/
├── migrations/                # Additive, idempotent SQL migrations
│   ├── audit.sql              # Audit logging tables and trigger functions
│   ├── payments-v2.sql        # Wallets, wallet_transactions, payment status
│   └── payments-v3-atomic.sql # Atomic PostgreSQL RPC settlement functions
├── src/
│   ├── adapters/              # External payment gateway abstractions
│   │   ├── paymentAdapter.ts          # Core PaymentAdapter interface
│   │   ├── simulatedPaymentAdapter.ts # In-process adapter with auto-settle delay
│   │   └── alatPaymentAdapter.ts      # Real HTTPS client for Wema ALAT APIs
│   ├── config/                # Centralized configuration & frozen constants
│   │   ├── constants.ts       # Domain constants (CO2 conversion rates, grace hours)
│   │   └── env.ts             # Strongly typed environment schema
│   ├── data/                  # Persistence layer (Async Repository pattern)
│   │   ├── repository.ts          # Generic Repository interface
│   │   ├── inMemoryRepository.ts  # In-memory fixture repository (Demo mode)
│   │   ├── supabaseRepository.ts  # Full Supabase PostgreSQL repository (Live mode)
│   │   └── seed.ts                # Deterministic seed data generator (MSW byte-parity)
│   ├── lib/                   # Utility helpers
│   │   ├── envelope.ts        # API response envelope formatters (ok, fail)
│   │   └── supabase.ts        # Lazy-initialized Supabase service client
│   ├── middleware/            # Express middlewares
│   │   ├── auth.ts            # Supabase bearer token verification (Demo bypass)
│   │   └── errorHandler.ts    # Centralized ApiError and exception handler
│   ├── routes/                # Domain routers mounted under /api
│   │   ├── assetRoutes.ts     # Asset queries, meter feed, and suspension controls
│   │   ├── businessRoutes.ts  # Business onboarding and burn computation
│   │   ├── creditRoutes.ts    # Underwriting applications, approve/decline actions
│   │   ├── demoRoutes.ts      # Unauthenticated demo controls (reset, advance-time)
│   │   ├── impactRoutes.ts    # ESG impact metrics and Spotify-Wrapped story
│   │   ├── loanRoutes.ts      # Loan balances and installment schedules
│   │   ├── paymentRoutes.ts   # Payment initiation and status polling
│   │   ├── portfolioRoutes.ts # Portfolio aggregate stats and CSV export
│   │   ├── quoteRoutes.ts     # Solar lease quotes and amortization
│   │   ├── systemRoutes.ts    # Solar hardware catalog
│   │   ├── walletRoutes.ts    # Virtual cash wallet balance and statement
│   │   └── webhookRoutes.ts   # ALAT HMAC-signed transaction webhooks
│   ├── services/              # Domain calculation engines (pure TypeScript)
│   │   ├── assetStateMachine.ts # Asset transition rules and medical flag guard
│   │   ├── loanStateMachine.ts  # Loan delinquency and closure rules
│   │   ├── leaseEngine.ts       # Amortization, quote sizing, and savings math
│   │   ├── impactEngine.ts      # Fuel displacement and carbon avoidance math
│   │   ├── meterSimulator.ts    # 90-day time-series solar generation curve
│   │   └── visionService.ts     # Google Gemini Vision receipt OCR parser
│   ├── types/                 # Backend API and entity type definitions
│   │   └── api.ts             # Backend-owned mirror of CONTRACT.md & extension
│   ├── app.ts                 # Express application factory with middleware stack
│   └── index.ts               # HTTP server bootstrap and graceful shutdown
└── test/                      # Comprehensive test suites (Vitest + Supertest)
    ├── contract/              # Domain REST contract compliance tests (14 files)
    ├── correctness/           # Invariant parity, webhook idempotency, lease math
    ├── data/                  # Supabase repository stub and mapping tests
    └── e2e/                   # Multi-stage end-to-end user journey workflows
```

---

## 8. Testing & Quality Assurance

The backend repository includes **166 unit, contract, correctness, and E2E tests** passing at 100%.

```bash
# Run the complete backend test suite
pnpm --filter @lastgen/backend test

# Run TypeScript strict typecheck on src/
pnpm --filter @lastgen/backend typecheck

# Run TypeScript strict typecheck on test files
pnpm --filter @lastgen/backend typecheck:test

# Run ESLint validation
pnpm lint

# Run all workspace test suites
pnpm test:all
```

---

## 9. Production Deployment

The backend is configured for instant deployment as a Node.js web service on **Render** using the root [`render.yaml`](../render.yaml):

```yaml
services:
  - type: web
    name: lastgen-backend
    env: node
    rootDir: backend
    buildCommand: pnpm install && pnpm build
    startCommand: pnpm start
    healthCheckPath: /health
    envVars:
      - key: DEMO_MODE
        value: "false"
      - key: PAYMENT_ADAPTER
        value: "alat"
```
