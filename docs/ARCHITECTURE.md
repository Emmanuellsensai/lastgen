# System Architecture

> **Lastgen · Wema Hackaholics 7.0 · Team Ryzen**
> **Last updated:** August 2026

---

## Overview

Lastgen is a two-tier application: a React SPA frontend and an Express API backend. The system supports two operating modes — mock (MSW) and live (backend + optional Supabase).

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         User's Browser                            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    React SPA (Vite)                          │ │
│  │                                                              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │ │
│  │  │  Owner   │ │   Bank   │ │   Demo   │ │     Auth      │  │ │
│  │  │  Views   │ │  Views   │ │ Control  │ │  (Supabase)   │  │ │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬────────┘  │ │
│  │       └─────────────┴────────────┴──────────────┘            │ │
│  │                          │                                   │ │
│  │                  ┌───────┴───────┐                           │ │
│  │                  │  lib/api.ts   │                           │ │
│  │                  └───────┬───────┘                           │ │
│  │                          │                                   │ │
│  │              ┌───────────┴───────────┐                       │ │
│  │              │  MSW Service Worker   │  (mock mode)          │ │
│  │              │  handlers.ts          │                       │ │
│  │              └───────────────────────┘                       │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                 ┌────────────┼────────────┐
                 │ Mock Mode  │            │ Live Mode
                 │            │            │
                 │ (MSW       │            │ Vite Proxy
                 │  handles   │            │ /api/* → :8080
                 │  locally)  │            │
                 │            │            ▼
                 │            │   ┌────────────────┐
                 │            │   │  Express API   │
                 │            │   │  Port 8080     │
                 │            │   └───────┬────────┘
                 │            │           │
                 │            │   ┌───────┴────────────┐
                 │            │   │     Repository      │
                 │            │   │  ┌──────────────┐  │
                 │            │   │  │ InMemoryRepo │  │ ← Demo mode
                 │            │   │  └──────────────┘  │
                 │            │   │  ┌──────────────┐  │
                 │            │   │  │ SupabaseRepo │  │ ← Live mode
                 │            │   │  └──────────────┘  │
                 │            │   └────────────────────┘
                 │            │           │
                 │            │   ┌───────┴────────┐
                 │            │   │    Supabase     │
                 │            │   │  (Postgres +    │
                 │            │   │   Auth + RT)    │
                 │            │   └────────────────┘
```

---

## Data Flow

### Authentication

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Login   │────>│ Supabase │────>│ Session  │────>│ /me/     │
│  Form    │     │ Auth     │     │ Store    │     │ session  │
└─────────┘     └──────────┘     └──────────┘     └──────────┘
                                         │                │
                                         │          ┌─────┴─────┐
                                         │          │ Backend    │
                                         │          │ resolves   │
                                         │          │ user → biz │
                                         │          └───────────┘
                                         ▼
                                    ┌─────────┐
                                    │ business │
                                    │   Id     │
                                    └─────────┘
```

### Payment Flow (Wallet)

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Pay     │────>│ api.ts   │────>│ POST     │────>│ Wallet   │
│  Button  │     │          │     │ /loans/  │     │ Debit +  │
│          │     │          │     │ :id/pay  │     │ Loan     │
│          │     │          │     │          │     │ Settle   │
└─────────┘     └──────────┘     └──────────┘     └──────────┘
                                         │
                                    ┌────┴────┐
                                    │  402    │ if balance
                                    │  Error  │ insufficient
                                    └─────────┘
```

### Payment Flow (ALAT Bank Transfer)

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Pay     │────>│ POST     │────>│ pending_ │     │ ALAT     │
│  Button  │     │ /loans/  │     │ author.  │     │ Approve  │
│          │     │ :id/pay  │     │ response │     │ (phone)  │
└─────────┘     └──────────┘     └──────────┘     └──────────┘
                                         │                │
                                         ▼                │
                                    ┌──────────┐          │
                                    │  Poll    │<─────────┘
                                    │  /pay-   │  ALAT webhook
                                    │  ments/  │  settles
                                    │  :ref/   │
                                    │  status  │
                                    └──────────┘
                                         │
                                    ┌────┴────┐
                                    │ SUCCESS │
                                    └─────────┘
```

---

## State Machines

### Asset State Machine

```
                    ┌──────────┐
          ┌────────>│  ACTIVE  │<────────┐
          │         └────┬─────┘         │
          │              │               │
          │         payment overdue      │ payment received
          │              │               │
          │         ┌────▼─────┐         │
          │         │  GRACE   │─────────┘
          │         └────┬─────┘
          │              │
          │         grace expires
          │              │
          │         ┌────▼──────┐
          │         │ SUSPENDED │
          │         └────┬──────┘
          │              │
          │         payment received
          │              │
          │         ┌────▼─────┐
          └─────────│  ACTIVE  │
                    └──────────┘

    OWNED: ACTIVE → (loan balance = 0) → OWNED

    Medical Guard: Suspension NEVER applies if business.medicalFlag = true
```

### Loan State Machine

```
    ACTIVE → DELINQUENT → ACTIVE (payment received)
    ACTIVE → DELINQUENT → CLOSED (loan paid off)
```

---

## Repository Pattern

The backend uses a repository pattern to swap data stores:

```typescript
interface Repository {
  // Businesses
  createBusiness(input, ownerId?): Promise<Business>;
  getBusiness(id): Promise<Business | undefined>;
  businessForOwner(ownerId): Promise<Business | undefined>;

  // Fuel & Burn
  addFuelLog(businessId, input): Promise<FuelLog>;
  burnProfileFor(businessId): Promise<BurnProfile | undefined>;

  // Loans & Payments
  payLoan(loanId, amount, source, reference): Promise<PaySettlement>;
  payFromWallet(loanId, amount): Promise<PaySettlement>;

  // Wallets
  createWallet(businessId, input): Promise<Wallet>;
  creditWallet(walletId, amount, desc, ref, cat): Promise<Wallet>;
  // ... more methods
}
```

**Implementations:**
- `InMemoryRepository` — demo mode, deterministic seed data
- `SupabaseRepository` — live mode, real Postgres + Auth

---

## Frontend State Management

### Session Store (Zustand + persist)

```
┌─────────────────────────────────────┐
│           SessionStore               │
│                                      │
│  role: 'owner' | 'bank' | 'guest'   │
│  businessId: string | null           │
│  demoBusinessId: string | null       │
│  isSignedIn: boolean                 │
│  isAdmin: boolean                    │
│                                      │
│  signIn(role)                        │
│  signInWithEmail(email, password)    │
│  resolveSession()  ← calls /me/     │
│  signOut()                           │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│        localStorage                 │
│  key: 'lastgen.session'             │
└─────────────────────────────────────┘
```

### Key Pattern: Effective IDs

```typescript
const { businessId, demoBusinessId } = useSession();
const effectiveBusinessId = businessId ?? demoBusinessId;
```

This supports both live mode (real `businessId` from `/me/session`) and demo mode (fallback to `DEMO_IDS`).

---

## API Envelope

Every API response follows:

```json
{
  "ok": true,
  "data": { ... }
}
```

or on error:

```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Business not found"
  }
}
```

The API client (`api.ts`) unwraps this automatically. Components receive the `data` directly.

---

## Environment Modes

| | Mock Mode | Live Mode |
|---|---|---|
| **Frontend** | MSW intercepts `/api/*` | Vite proxies to backend |
| **Backend** | Not needed | Express on port 8080 |
| **Data** | `mocks/seed.ts` | `InMemoryRepository` or `SupabaseRepository` |
| **Auth** | Demo buttons | Supabase (email, Google, Apple) |
| **Payments** | Simulated (3s) | Simulated or real ALAT |
| **Realtime** | Not available | Supabase Realtime |

---

## Backend Services

### Asset State Machine (`assetStateMachine.ts`)

Encapsulates all asset status transitions. Single entry point: `transition(asset, loan, business, action, ctx)`. Actions: `PAY`, `SUSPEND`, `RESTORE`, `MISS_PAYMENT`, `OVERDUE`. Returns `{ asset, loan, from, to, reason }`.

### Loan State Machine (`loanStateMachine.ts`)

Simple three-state machine: `ACTIVE → DELINQUENT → ACTIVE | CLOSED`. Called by the asset state machine on payment/delinquency events.

### Lease Engine (`leaseEngine.ts`)

Standard amortisation math. Key functions:
- `monthlyPaymentKobo(principal, aprBps, tenorMonths)` — monthly payment
- `buildSchedule(principal, aprBps, tenorMonths, startDate)` — full amortisation schedule
- `totalPayableFromSchedule(schedule, depositKobo)` — total cost from schedule sum
- `breakEvenMonth(depositKobo, monthlySavings)` — months until deposit is recovered

### Impact Engine (`impactEngine.ts`)

Computes climate and savings figures from burn profile and meter readings:
- `computeImpact({ litresPerDay, balanceKobo, ... })` — period-based impact
- `computeWrapped({ year, impact, now })` — annual wrapped payload
- `monthsToOwnership(balanceKobo, monthlyPayment)` — months to payoff

### Vision Service (`visionService.ts`)

Receipt OCR using Gemini Vision API. Extracts `{ litres, pricePerLitreKobo, confidence }` from petrol receipt images. Falls back to deterministic mock if Gemini is unavailable.

### Meter Simulator (`meterSimulator.ts`)

Deterministic PRNG (mulberry32) for generating meter readings. Ensures demo data is reproducible across runs.

### Payment Adapters (`adapters/`)

Provider abstraction for payment collection:
- `SimulatedAdapter` — in-process consent, auto-settles after `SETTLE_AFTER_MS`
- `AlatAdapter` — real ALAT gateway, HMAC-SHA512 webhook verification

Selected at runtime via `PAYMENT_ADAPTER` env var.

### Auth Middleware (`middleware/auth.ts`)

- Demo mode: injects `demo-user` automatically
- Live mode: validates Supabase JWT, attaches `req.user`

### Error Handler (`middleware/errorHandler.ts`)

Catches `ApiError` and Express errors, returns contract-compliant `{ ok: false, error: { code, message } }`.

---

## Audit Trail

Every asset status change is recorded in `assetStatusHistory`:

```typescript
interface AssetStatusHistory {
  id: string;
  assetId: string;
  fromStatus: AssetStatus;
  toStatus: AssetStatus;
  reason?: string;
  changedAt: string;
  changedBy: string; // 'bank', 'alat', 'demo', etc.
}
```

Accessible via `repo.statusHistory(assetId?)`.

---

## Key Invariants

1. **Money is always kobo** on the wire. `<Money kobo={...} />` handles display.
2. **Medical flag** prevents suspension. Checked in `assetStateMachine.ts`.
3. **Quote viability** requires `monthlySavingsKobo > 0`. Enforced on both sides.
4. **Wallet payments** return `402` when balance is insufficient.
5. **Payment settlement** is atomic: loan + asset + installment + audit in one transaction.
6. **Webhook idempotency** on `transactionReference`. Replays are accepted and ignored.
7. **Wallet business resolution** is server-side from `req.user`, never from request body.
8. **Deterministic seed** — same seed produces same data everywhere (mulberry32 PRNG).
