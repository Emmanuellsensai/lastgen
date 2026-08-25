# Frontend Integration Masterplan

> **Lastgen · Wema Hackaholics 7.0 · Team Ryzen**
> **Status:** ✅ All integrations complete
> **Last updated:** August 2026

---

## Executive Summary

The Lastgen backend and frontend are **fully integrated**. Every page fetches live data from the backend through the typed API client (`frontend/src/lib/api.ts`). The system supports two modes:

- **Mock mode** (`VITE_API_MODE=mock`): MSW intercepts all `/api/*` calls. No backend needed.
- **Live mode** (`VITE_API_MODE=live`): Vite proxies to `localhost:8080`. Full backend with Supabase auth.

---

## Integration Status

| Domain | Backend | Frontend | Status |
|---|---|---|---|
| **Auth** | `/auth/login`, `/auth/register`, `/auth/verify-nin`, `/me/session` | Session store, login/register pages, OAuth | ✅ Complete |
| **Businesses** | CRUD, fuel logs, burn profile, receipts | BusinessSetup, Dashboard, Burn | ✅ Complete |
| **Systems** | List catalogue | Quote flow (backend powers sizing) | ✅ Complete |
| **Quotes** | Create, get | Quote page (schedule computed client-side) | ✅ Complete |
| **Credit** | List, detail, approve, decline | Applications, CreditFile | ✅ Complete |
| **Assets** | Get, meter, suspend, restore | Asset page, portfolio actions | ✅ Complete |
| **Loans** | Get, schedule | Loan page, Dashboard loan card | ✅ Complete |
| **Payments** | Pay (wallet + ALAT), status poll | PaymentSheet, Loan payment flow | ✅ Complete |
| **Wallets** | Create, balance, statement, fund | Wallet page, Dashboard wallet card | ✅ Complete |
| **Portfolio** | Stats, assets, export | Portfolio page | ✅ Complete |
| **Impact** | Per-business, wrapped | Burn page, Wrapped page | ✅ Complete |
| **Demo** | Reset, advance-time, miss-payment | DemoControl, Orchestrate | ✅ Complete |

---

## Key Architecture Decisions

### 1. Single API Client

All backend calls go through `frontend/src/lib/api.ts`. This module:
- Handles the `{ ok, data, error }` envelope
- Adds `Authorization: Bearer` header when authenticated
- Throws `ApiRequestError` on failures
- Works identically in mock and live mode

### 2. Session Resolution

After authentication, the frontend resolves the user's business via `GET /me/session`:

```
Supabase auth → setAuthToken → resolveSession() → GET /me/session → businessId
```

This bridges Supabase (which knows the user) to the backend (which knows the business).

### 3. Vite Proxy

In live mode, `vite.config.ts` proxies `/api/*` to `http://localhost:8080`. This means:
- Frontend always calls `/api/...` (same origin)
- In mock mode, MSW intercepts
- In live mode, Vite proxies to the backend

### 4. Money is Always Kobo

All money values on the wire are integers in kobo. The `<Money />` component handles formatting. Never divide by 100 before passing to `<Money />`.

---

## Page-by-Page Integration Details

### BusinessSetup (`/setup`)

**Flow:** Business → Fuel → KYC → Done

| Step | API Calls | Notes |
|---|---|---|
| 1. Business | `POST /businesses` | Stores ownerId for session resolution |
| 2. Fuel | `POST /businesses/:id/fuel-logs` | First fuel log |
| 3. KYC | `POST /wallets/create` | Creates Wema virtual account |
| 4. Done | — | Shows account number, navigates to dashboard |

### Dashboard (`/app`)

**Fetches:** Business, burn, fuel logs, wallet, asset, loan, quote (all parallel with `.catch(() => {})`)

**New user flow:** If no `effectiveBusinessId`, shows welcome card → `/setup`

### Burn (`/burn`)

**Fetches:** Business, burn profile, quote (if exists)

**Live calculations:**
- `ratePerSecondKobo = Math.round(burn.dailyKobo / 86400)`
- Annual/monthly/daily burn from `burn.annualKobo`, `burn.monthlyKobo`, `burn.dailyKobo`

**Fuel logging:** `POST /businesses/:id/fuel-logs` → refresh burn profile

### Quote (`/quote/:id`)

**Fetches:** Quote by ID

**Schedule:** Computed client-side from quote data (principal, APR, tenor)

### Asset (`/asset/:id`)

**Fetches:** Asset, loan, schedule, quote, meter readings (all parallel)

**Payment flow:**
1. Click "Pay now" → opens PaymentSheet
2. Select wallet or bank transfer
3. Wallet: `POST /loans/:id/pay { source: 'wallet' }` → instant success
4. Bank: `POST /loans/:id/pay { source: 'bank_account' }` → poll `GET /payments/:ref/status`

### Loan (`/loan/:id`)

**Fetches:** Loan, schedule, asset, quote, wallet balance (all parallel)

**Payment options:**
- "Pay next installment" → scheduled amount
- "Pay extra" → custom amount with presets (1 month, 3 months, full payoff)

### Wallet (`/wallet`)

**Fetches:** Wallet balance, statement

**Fund flow:** Click "Fund" → enter amount or select preset → `POST /wallets/fund { amountKobo }` → refresh balance + statement

### Applications (`/bank`)

**Fetches:** `api.credit.applications({ status: filter })`

**Tab switching:** PENDING / APPROVED / DECLINED

### Credit File (`/bank/file/:id`)

**Fetches:** `api.credit.application(id)` → `CreditFileDetail` with fuel logs + schedule preview

**Actions:** Approve (`POST /credit/applications/:id/approve`), Decline (`POST /credit/applications/:id/decline`)

### Portfolio (`/bank/portfolio`)

**Fetches:** `api.portfolio.stats()`, `api.portfolio.assets({ status, page })`

**Actions:** Suspend/Restore assets, Export CSV

### Wrapped (`/wrapped/:id`)

**Fetches:** `api.businesses.get(businessId)`, `api.businesses.wrapped(businessId)`

**Live data:** All panels use live `WrappedPayload` from the API

### Demo Control (`/demo`)

**Actions:** Reset (`POST /demo/reset`), Advance time (`POST /demo/advance-time`), Miss payment (`POST /demo/miss-payment`)

---

## State Management

### Session Store (`frontend/src/store/session.ts`)

```typescript
interface SessionState {
  role: 'owner' | 'bank' | 'guest';
  businessId: string | null;        // Real business ID from backend
  demoBusinessId: string | null;    // Fallback to DEMO_IDS
  demoAssetId: string | null;
  demoLoanId: string | null;
  demoQuoteId: string | null;
  isSignedIn: boolean;
  isAdmin: boolean;
  // ... other fields
}
```

**Key pattern:** Use `effectiveBusinessId = businessId ?? demoBusinessId` to support both live and demo modes.

### Demo Store (`frontend/src/store/demo.ts`)

Tracks demo clock state (days advanced, last action). Synced with `POST /demo/*` endpoints.

---

## Testing

### Backend Tests

```bash
cd backend
pnpm test          # 22 test files, 189 tests
```

### Frontend Typecheck

```bash
cd frontend
npx tsc --noEmit    # Should exit 0 with no errors
```

### Manual Verification

1. Boot backend in demo mode
2. Boot frontend in mock mode
3. Login as owner → Dashboard loads
4. Navigate all owner pages → data loads from MSW
5. Login as bank → Applications loads
6. Approve an application → asset + loan created
7. Navigate to asset → make payment → wallet debited
8. Demo control → advance time → asset status changes

---

## File Reference

### Backend

| File | Purpose |
|---|---|
| `backend/src/routes/*.ts` | Express route handlers |
| `backend/src/data/inMemoryRepository.ts` | In-memory data store (demo mode) |
| `backend/src/data/supabaseRepository.ts` | Supabase data store (live mode) |
| `backend/src/services/leaseEngine.ts` | Amortisation math |
| `backend/src/services/assetStateMachine.ts` | Asset state transitions |
| `backend/src/services/impactEngine.ts` | CO₂, litres displaced, naira saved |
| `backend/src/config/constants.ts` | Shared constants |
| `backend/src/types/api.ts` | Backend API types |

### Frontend

| File | Purpose |
|---|---|
| `frontend/src/lib/api.ts` | API client (all backend calls) |
| `frontend/src/types/api.ts` | Frontend API types (mirrors backend) |
| `frontend/src/store/session.ts` | Auth + business resolution |
| `frontend/src/main.tsx` | Bootstrap (MSW, auth listener) |
| `frontend/src/mocks/handlers.ts` | MSW request handlers |
| `frontend/src/mocks/seed.ts` | Deterministic demo data |
| `frontend/src/routes/owner/*.tsx` | Owner-facing pages |
| `frontend/src/routes/bank/*.tsx` | Bank-facing pages |
| `frontend/src/routes/demo/*.tsx` | Demo control pages |
| `frontend/vite.config.ts` | Vite config + API proxy |

### Documentation

| File | Purpose |
|---|---|
| `docs/CONTRACT.md` | Frozen API contract |
| `docs/BACKEND_API_REFERENCE.md` | Comprehensive API reference |
| `docs/FRONTEND_INTEGRATION_MASTERPLAN.md` | This document |
| `docs/PAYMENT_EXTENSION.md` | Payment lifecycle spec |
| `docs/DECISIONS.md` | Decision log |
| `docs/DEMO_SCRIPT.md` | Demo runbook |
