# Backend API Reference — Frontend Integration Guide

> **Lastgen · Wema Hackaholics 7.0 · Team Ryzen**
> **Audience:** Frontend Engineers & AI Coding Agents
> **Last updated:** August 2026

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Architecture Overview](#2-architecture-overview)
3. [Authentication Flow](#3-authentication-flow)
4. [API Client Usage](#4-api-client-usage)
5. [Endpoint Reference](#5-endpoint-reference)
6. [Data Flow by Page](#6-data-flow-by-page)
7. [Error Handling](#7-error-handling)
8. [Demo vs Live Mode](#8-demo-vs-live-mode)
9. [Environment Variables](#9-environment-variables)
10. [Common Patterns](#10-common-patterns)

---

## 1. Quick Start

### Running locally (mock mode — no backend needed)

```bash
cd frontend
cp .env.example .env.local   # VITE_API_MODE=mock (default)
pnpm install
pnpm dev
# Open http://localhost:5173 — MSW intercepts all /api/* calls
```

### Running locally (live mode — backend required)

**Terminal 1: Backend**
```bash
cd backend
cp .env.example .env         # DEMO_MODE=true
pnpm install
pnpm dev
# API listening on http://localhost:8080
# Verify: curl http://localhost:8080/health → {"ok":true}
```

**Terminal 2: Frontend**
```bash
cd frontend
# Edit .env.local:
#   VITE_API_MODE=live
#   VITE_API_URL=http://localhost:8080
pnpm dev
# Vite proxies /api/* → localhost:8080
# Open http://localhost:5173
```

### Verification

1. Visit `/login` → click "I'm a business owner" (demo mode)
2. Dashboard loads with seeded demo business
3. Navigate to `/burn` — burn counter is ticking
4. Navigate to `/wallet` — wallet shows ₦50,000 balance
5. Navigate to `/loan/:id` — amortization schedule loads

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                      │
│  Vite · TypeScript · Tailwind · Zustand · shadcn/ui      │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Owner   │  │   Bank   │  │   Demo   │  │  Auth   │ │
│  │  Views   │  │  Views   │  │ Control  │  │  Flow   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │              │              │              │      │
│       └──────────────┴──────────────┴──────────────┘      │
│                          │                                │
│                  ┌───────┴───────┐                        │
│                  │  lib/api.ts   │  ← Single API client   │
│                  └───────┬───────┘                        │
└──────────────────────────┼────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              │ Mock Mode  │            │ Live Mode
              │ (MSW)      │            │ (Proxy)
              ▼            │            ▼
     ┌────────────┐        │   ┌────────────────┐
     │  handlers  │        │   │  Express API   │
     │  .ts       │        │   │  localhost:8080│
     └────────────┘        │   └───────┬────────┘
                           │           │
                           │   ┌───────┴────────┐
                           │   │   Repository    │
                           │   │  (InMemory /    │
                           │   │   Supabase)     │
                           │   └────────────────┘
```

### Key Files

| File | Purpose |
|---|---|
| `frontend/src/lib/api.ts` | Single API client — all backend calls go through here |
| `frontend/src/types/api.ts` | TypeScript types matching backend contract exactly |
| `frontend/src/store/session.ts` | Auth state, business resolution, demo IDs |
| `frontend/src/main.tsx` | App bootstrap — MSW init, auth state listener |
| `frontend/src/mocks/handlers.ts` | MSW request handlers (mock mode) |
| `frontend/src/mocks/seed.ts` | Deterministic demo data |
| `frontend/vite.config.ts` | Vite config with `/api` proxy to backend |

---

## 3. Authentication Flow

### Mock Mode (default)

```
User clicks "I'm a business owner"
  → useSession.signIn('owner')
  → Sets demoBusinessId, demoAssetId, demoLoanId, demoQuoteId from DEMO_IDS
  → All API calls use MSW handlers → returns seeded data
```

### Live Mode (Supabase)

```
User submits login form
  → supabase.auth.signInWithPassword({ email, password })
  → setAuthToken(session.access_token)
  → useSession.resolveSession()
  → GET /me/session (with Bearer token)
  → Backend resolves user → business via businessForOwner()
  → Returns { role, businessId, name }
  → Session store sets businessId, demoBusinessId, etc.
```

### OAuth (Google/Apple)

```
User clicks "Sign in with Google"
  → supabase.auth.signInWithOAuth({ provider: 'google' })
  → Redirect to Google → callback to Supabase → redirect to app
  → onAuthStateChange fires with INITIAL_SESSION event
  → setAuthToken(session.access_token)
  → useSession.resolveSession()
  → GET /me/session → resolves business
```

### Session Resolution

The critical bridge between auth and data is `GET /me/session`:

```typescript
// After any auth event, call:
const { useSession } = await import('./store/session');
await useSession.getState().resolveSession();
```

This calls `api.auth.session()` → `GET /me/session` which returns:
```json
{
  "role": "owner",
  "businessId": "biz_00001",
  "name": "Adaeze Okafor"
}
```

---

## 4. API Client Usage

All API calls go through `frontend/src/lib/api.ts`. Never use `fetch()` directly.

```typescript
import { api } from '@/lib/api';

// Businesses
const business = await api.businesses.get(businessId);
const burn = await api.businesses.burn(businessId);
const fuelLog = await api.businesses.addFuelLog(businessId, {
  litres: 20,
  amountKobo: 2_300_000,
  pricePerLitreKobo: 115_000,
  loggedAt: new Date().toISOString(),
});

// Quotes
const systems = await api.systems.list({ minKw: 5 });
const quote = await api.businesses.quote(businessId, {
  systemId: 'sys_001',
  tenorMonths: 24,
});

// Credit (bank)
const apps = await api.credit.applications({ status: 'PENDING' });
const file = await api.credit.application(creditFileId);
await api.credit.approve(creditFileId);

// Payments
const payResult = await api.loans.pay(loanId, { source: 'wallet' });
const status = await api.payments.status(payResult.paymentId);

// Wallet
const wallet = await api.wallets.balance();
const stmt = await api.wallets.statement({ limit: 20 });
await api.wallets.fund(10_000_000); // Fund ₦100,000

// Fuel Logs
const logs = await api.fuelLogs.list(businessId, 10, 0);

// Auth
const session = await api.auth.session();
// Returns { role, businessId, name }

// Demo controls
await api.demo.reset();
await api.demo.advanceTime({ days: 30 });
await api.demo.missPayment({ loanId });
```

---

## 5. Endpoint Reference

### Authentication

| Method | Endpoint | Request | Response | Notes |
|---|---|---|---|---|
| `POST` | `/auth/login` | `{ email, password }` | `{ user, role, businessId, accessToken }` | Demo only |
| `POST` | `/auth/register` | `{ email, password, fullName, phone }` | `{ user, role, businessId, accessToken }` | Demo only |
| `POST` | `/auth/verify-nin` | `{ nin }` | `{ verified, owner }` | Simulates KYC |
| `GET` | `/me/session` | — | `{ role, businessId, name }` | Resolves user→business |

### Businesses

| Method | Endpoint | Request | Response |
|---|---|---|---|
| `POST` | `/businesses` | `{ name, type, city, generatorKva?, hoursPerDay? }` | `Business` |
| `GET` | `/businesses/:id` | — | `Business` |
| `POST` | `/businesses/:id/receipts` | `multipart: file` | `FuelLog` |
| `POST` | `/businesses/:id/fuel-logs` | `{ litres, amountKobo, pricePerLitreKobo, loggedAt }` | `FuelLog` |
| `GET` | `/businesses/:id/fuel-logs` | `?limit&offset` | `{ items: FuelLog[], total }` |
| `GET` | `/businesses/:id/burn` | — | `BurnProfile` |

### Fuel Logs

| Method | Endpoint | Request | Response |
|---|---|---|---|
| `GET` | `/businesses/:id/fuel-logs` | `?limit&offset` | `{ items: FuelLog[], total }` |

### Systems & Quotes

| Method | Endpoint | Request | Response |
|---|---|---|---|
| `GET` | `/systems` | `?minKw&maxPriceKobo` | `{ items: SolarSystem[] }` |
| `POST` | `/businesses/:id/quote` | `{ systemId, tenorMonths, depositKobo? }` | `Quote` |
| `GET` | `/quotes/:id` | — | `Quote` |

### Credit (Bank)

| Method | Endpoint | Request | Response |
|---|---|---|---|
| `GET` | `/credit/applications` | `?status` | `{ items: CreditFile[] }` |
| `GET` | `/credit/applications/:id` | — | `CreditFileDetail` |
| `POST` | `/credit/applications/:id/approve` | — | `{ loan, asset }` |
| `POST` | `/credit/applications/:id/decline` | `{ reason }` | `CreditFile` |

### Assets

| Method | Endpoint | Request | Response |
|---|---|---|---|
| `GET` | `/assets/:id` | — | `Asset` |
| `GET` | `/assets/:id/meter` | `?from&to` | `{ items: MeterReading[] }` |
| `POST` | `/assets/:id/suspend` | `{ reason }` | `Asset` |
| `POST` | `/assets/:id/restore` | — | `Asset` |

### Loans & Payments

| Method | Endpoint | Request | Response |
|---|---|---|---|
| `GET` | `/loans/:id` | — | `Loan` |
| `GET` | `/loans/:id/schedule` | — | `{ items: Installment[] }` |
| `POST` | `/loans/:id/pay` | `{ source: 'wallet' \| 'bank_account', amountKobo? }` | `{ paymentId, platformTransactionReference, status }` |
| `GET` | `/payments/:ref/status` | — | `{ status, payment }` |

### Wallets

| Method | Endpoint | Request | Response |
|---|---|---|---|
| `POST` | `/wallets/create` | `{ businessId, nin, firstName, lastName, phone }` | `Wallet` |
| `POST` | `/wallets/fund` | `{ amountKobo }` | `Wallet` |
| `GET` | `/wallets/balance` | — | `Wallet` |
| `GET` | `/wallets/statement` | `?limit&before` | `{ items: WalletTransaction[] }` |

### Portfolio

| Method | Endpoint | Request | Response |
|---|---|---|---|
| `GET` | `/portfolio/stats` | — | `PortfolioStats` |
| `GET` | `/portfolio/assets` | `?status&city&page` | `{ items: Asset[], total }` |
| `POST` | `/portfolio/export` | — | `{ url, generatedAt }` |

### Impact

| Method | Endpoint | Request | Response |
|---|---|---|---|
| `GET` | `/businesses/:id/impact` | `?period=month\|year\|all` | `ImpactSummary` |
| `GET` | `/businesses/:id/wrapped` | `?year` | `WrappedPayload` |

### Demo Control

| Method | Endpoint | Request | Response |
|---|---|---|---|
| `POST` | `/demo/reset` | — | `{ ok }` |
| `POST` | `/demo/advance-time` | `{ days }` | `{ ok }` |
| `POST` | `/demo/miss-payment` | `{ loanId }` | `{ loan, asset }` |

### Health & Exports

| Method | Endpoint | Request | Response |
|---|---|---|---|
| `GET` | `/health` | — | `{ ok: true }` |
| `GET` | `/exports/:filename` | — | CSV file |

---

## 6. Data Flow by Page

### Owner: Dashboard (`/app`)

```
useEffect → {
  api.businesses.get(businessId)           → setBusiness
  api.businesses.burn(businessId)          → setBurn
  api.fuelLogs.list(businessId, 5)         → setFuelLogs
  api.wallets.balance()                    → setWallet
  api.assets.get(assetId)                  → setAsset       (if exists)
  api.loans.get(loanId)                    → setLoan        (if exists)
  api.quotes.get(quoteId)                  → setQuote       (if exists)
}
```

### Owner: Burn (`/burn`)

```
useEffect → {
  api.businesses.get(businessId)           → setBusiness
  api.businesses.burn(businessId)          → setBurn
  api.quotes.get(quoteId)                  → setQuote       (if exists)
}

// After adding fuel log:
api.businesses.addFuelLog(businessId, body)
api.businesses.burn(businessId)            → refresh burn profile
```

### Owner: Quote (`/quote/:id`)

```
useEffect → {
  api.quotes.get(id)                       → setQuote
  // Schedule computed client-side from quote data
}
```

### Owner: Asset (`/asset/:id`)

```
useEffect → {
  api.assets.get(id)                       → setAsset
  api.loans.get(loanId)                    → setLoan        (if exists)
  api.loans.schedule(loanId)               → setSchedule    (if exists)
  api.quotes.get(quoteId)                  → setQuote       (if exists)
  api.assets.meter(id)                     → setMeterReadings
}

// Payment flow:
api.loans.pay(loanId, { source: 'wallet' })
// or
api.loans.pay(loanId, { source: 'bank_account' })
  → poll api.payments.status(paymentId) every 2s
  → on SUCCESS: re-fetch loan + asset
```

### Owner: Loan (`/loan/:id`)

```
useEffect → {
  api.loans.get(id)                        → setLoan
  api.loans.schedule(id)                   → setSchedule
  api.assets.get(assetId)                  → setAsset       (if exists)
  api.quotes.get(quoteId)                  → setQuote       (if exists)
  api.wallets.balance()                    → setWallet      (for balance check)
}

// Pay next installment:
api.loans.pay(id, { source: 'wallet' })

// Pay extra:
api.loans.pay(id, { source: 'wallet', amountKobo: customAmount })
```

### Owner: Wallet (`/wallet`)

```
useEffect → {
  api.wallets.balance()                    → setWallet
  api.wallets.statement({ limit: 20 })     → setTransactions
}

// Fund wallet:
api.wallets.fund(amountKobo)               → refresh wallet + statement
```

### Owner: Wrapped (`/wrapped/:id`)

```
useEffect → {
  api.businesses.get(businessId)           → setBusiness
  api.businesses.wrapped(businessId)       → setWrapped
}
```

### Bank: Applications (`/bank`)

```
useEffect([filter]) → {
  api.credit.applications({ status: filter }) → setFiles
}
```

### Bank: Credit File (`/bank/file/:id`)

```
useEffect → {
  api.credit.application(id)               → setFile
  // If approved, also fetch linked asset
  api.portfolio.assets({})                 → find linked asset
}

// Approve:
api.credit.approve(id)                     → refresh file

// Decline:
api.credit.decline(id, { reason })         → refresh file
```

### Bank: Portfolio (`/bank/portfolio`)

```
useEffect → {
  api.portfolio.stats()                    → setStats
}

useEffect([filter, page]) → {
  api.portfolio.assets({ status, page })   → setAssets
}

// Export:
api.portfolio.exportCsv()                  → opens URL
```

### Demo Control (`/demo`)

```
// Reset:
api.demo.reset()

// Advance time:
api.demo.advanceTime({ days: 30 })

// Miss payment:
api.demo.missPayment({ loanId })
```

---

## 7. Error Handling

All API errors follow the envelope pattern:

```json
{
  "ok": false,
  "error": {
    "code": "PAYMENT_REQUIRED",
    "message": "Insufficient wallet balance"
  }
}
```

The API client throws `ApiRequestError` with `code`, `message`, and `status`:

```typescript
import { api, ApiRequestError } from '@/lib/api';

try {
  await api.loans.pay(loanId, { source: 'wallet', amountKobo: 50_000_000 });
} catch (err) {
  if (err instanceof ApiRequestError) {
    if (err.status === 402) {
      // Insufficient wallet balance
    } else if (err.status === 409) {
      // Invalid transition (e.g., paying a closed loan)
    }
  }
}
```

### Error Codes

| Code | HTTP | When |
|---|---|---|
| `VALIDATION` | 400 | Bad parameters, missing fields |
| `UNAUTHORIZED` | 401 | No bearer token (live mode) |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `PAYMENT_REQUIRED` | 402 | Insufficient wallet balance |
| `INVALID_TRANSITION` | 409 | Operation on wrong state |
| `QUOTE_NOT_VIABLE` | 422 | Solar costs more than fuel burn |
| `UNAVAILABLE` | 503 | ALAT gateway unreachable |
| `MEDICAL_FLAG` | 409 | Suspension blocked (medical load) |

---

## 8. Demo vs Live Mode

| Feature | Mock Mode (`VITE_API_MODE=mock`) | Live Mode (`VITE_API_MODE=live`) |
|---|---|---|
| API calls intercepted by | MSW service worker | Vite proxy → backend |
| Auth | Demo buttons / MSW handlers | Supabase (email, Google, Apple) |
| Data source | `frontend/src/mocks/seed.ts` | `backend/src/data/inMemoryRepository.ts` or Supabase |
| Business resolution | Hardcoded `DEMO_IDS` | `GET /me/session` → `businessForOwner()` |
| Payments | Simulated (3s auto-settle) | Simulated or real ALAT |
| Realtime | Not available | Supabase Realtime (when wired) |
| Wallet pre-funding | ₦50,000 on create | ₦0 (fund externally) |

### Mode Detection

```typescript
import { API_MODE } from '@/lib/api';

if (API_MODE === 'mock') {
  // MSW is handling requests
} else {
  // Backend is handling requests via Vite proxy
}
```

---

## 9. Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_MODE` | `mock` | `mock` = MSW, `live` = backend |
| `VITE_API_URL` | `http://localhost:8080` | Backend URL (live mode only) |
| `VITE_SUPABASE_URL` | — | Supabase project URL (live mode) |
| `VITE_SUPABASE_ANON_KEY` | — | Supabase anon key (live mode) |

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server port |
| `DEMO_MODE` | `false` | `true` = in-memory, unauthenticated |
| `PAYMENT_ADAPTER` | `simulated` | `simulated` or `alat` |
| `SETTLE_AFTER_MS` | `0` | Simulated adapter delay (demo: 3000) |
| `SUPABASE_URL` | — | Required for live mode |
| `SUPABASE_SERVICE_KEY` | — | Required for live mode |
| `GEMINI_API_KEY` | — | Receipt OCR (optional) |

---

## 10. Common Patterns

### Fetching data with loading state

```typescript
const [data, setData] = useState<Type | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  if (!id) return;
  let cancelled = false;
  async function load() {
    try {
      const result = await api.someEndpoint(id);
      if (!cancelled) setData(result);
    } catch {
      // Handle error
    } finally {
      if (!cancelled) setLoading(false);
    }
  }
  load();
  return () => { cancelled = true; };
}, [id]);
```

### Parallel fetching

```typescript
const [a, setA] = useState(null);
const [b, setB] = useState(null);

useEffect(() => {
  let cancelled = false;
  async function load() {
    const fetches: Promise<void>[] = [];
    fetches.push(api.a.get(id).then((r) => { if (!cancelled) setA(r); }).catch(() => {}));
    fetches.push(api.b.get(id).then((r) => { if (!cancelled) setB(r); }).catch(() => {}));
    await Promise.all(fetches);
    if (!cancelled) setLoading(false);
  }
  load();
  return () => { cancelled = true; };
}, [id]);
```

### Payment polling

```typescript
async function handlePay() {
  const result = await api.loans.pay(loanId, { source: 'bank_account' });

  if (result.status === 'pending_authorisation') {
    // Poll every 2s
    const poll = setInterval(async () => {
      const status = await api.payments.status(result.paymentId);
      if (status.status === 'SUCCESS') {
        clearInterval(poll);
        // Refresh loan + asset
        const freshLoan = await api.loans.get(loanId);
        setLoan(freshLoan);
      }
    }, 2000);

    // Timeout after 15s
    setTimeout(() => clearInterval(poll), 15_000);
  }
}
```

### Wallet balance check before payment

```typescript
const wallet = await api.wallets.balance();
const loan = await api.loans.get(loanId);

if (wallet.balanceKobo >= loan.monthlyPaymentKobo) {
  // Show wallet payment option
} else {
  // Show "fund wallet" link
}
```

### Money display

```typescript
import { Money } from '@/components/lastgen';

// Always pass kobo (integer). The component handles formatting.
<Money kobo={5_000_000} size="lg" />           // ₦50,000
<Money kobo={loan.balanceKobo} size="md" />
```
