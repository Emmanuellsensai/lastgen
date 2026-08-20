# PR: feat(backend) — Lastgen backend API + payment/wallet extension

> **Base:** `main` ← **Head:** `feat/backend`
> **Suggested title:** `feat(backend): implement Lastgen backend API with payment lifecycle, business wallets and Supabase`

---

## Summary

The complete backend for Lastgen: an Express + TypeScript API implementing the
frozen `docs/CONTRACT.md` surface plus the payment/wallet extension specified in
`docs/PAYMENT_EXTENSION.md`. Built phase-by-phase on `feat/backend`, it delivers
the domain engines, deterministic seed, full route surface, ALAT payment
lifecycle, business cash wallets, a Supabase-backed repository, and the demo /
live split. The contract and the frontend remain untouched.

### What this PR delivers

| Area | Deliverable |
| --- | --- |
| Types | `backend/src/types/api.ts` — backend-owned mirror of `docs/CONTRACT.md` plus the extension types (`Wallet`, `WalletTransaction`, `PaymentStatus`, slim `PayResult`). |
| Config | `backend/src/config/env.ts` (typed, centralized env incl. `ALAT_SOURCE_ACCOUNT`, `SETTLE_AFTER_MS`) and `backend/src/config/constants.ts` (frozen constants + wallet defaults). |
| Infrastructure | Lazy Supabase service-role client, envelope helpers, centralized `ApiError` handling, Supabase bearer-token `requireAuth` (demo-skip). |
| Engines | `assetStateMachine` (medical-flag guard in every suspension path), `loanStateMachine`, `leaseEngine`, `impactEngine`, `meterSimulator`, `visionService` (Gemini + mock fallback). |
| Data | `Repository` seam (async) + deterministic in-memory seed (`data/seed.ts`, MSW byte-parity) + **full `SupabaseRepository`** (`data/supabaseRepository.ts`), selected by `repositoryFor(env)`. |
| Routes | All contract domains under `/api` + demo controls (demo mode only) + `POST /webhooks/alat` (HMAC-SHA512, replay-safe). |
| Payments | `POST /loans/:id/pay` (slim `{ paymentId, platformTransactionReference, status }`) and `GET /payments/:reference/status` (reference or id, reconciles stale pendings). Lifecycle: `pending_authorisation` → `SUCCESS`/`FAILED`/`EXPIRED`. |
| ALAT adapter | Real HTTPS client — `transfer-fund-request` + `CheckTransactionStatus` polling with `Ocp-Apim-Subscription-Key`; simulated in-process adapter for demos/tests. |
| Wallets | `POST /wallets/create` (KYC'd 035/NGN virtual account, idempotent, demo pre-funded NGN 50,000), `GET /wallets/balance`, `GET /wallets/statement`; 402-guarded wallet pay settling loan + asset in one transaction. |
| Migrations | `backend/migrations/audit.sql` + `backend/migrations/payments-v2.sql` — additive, idempotent (audit trail, payment status, wallets + wallet_transactions, realtime publication). |
| Tests | **156 backend tests across 20 files** (contract + correctness + Supabase stub) plus shared correctness 33/33. |
| Docs | `backend/README.md`, `backend/BACKEND_PROGRESS.md`, `backend/AUDIT.md`, and `docs/PAYMENT_EXTENSION.md` (frontend handoff). |

### Not in this PR (by design)

- No changes to `/frontend`, `/supabase/schema.sql`, or `docs/CONTRACT.md` — the
  payment/wallet extension lives in the separate `docs/PAYMENT_EXTENSION.md`.
- Live Supabase + real ALAT deployments are not exercised (no credentials) —
  the Supabase repository is stub-tested and the ALAT wire contract is pinned
  with an injected fetch; `payments-v2.sql` is applied in order after
  `schema.sql` and `audit.sql`.

---

## Commit breakdown (since `main` at `67a8a87`)

| Commit | Scope |
| --- | --- |
| Phases 0–5 + remediation (see `backend/BACKEND_PROGRESS.md` §9) | foundation, engines, seed, routes, payments, portfolio/impact, remediation |
| `db380b1` Merge `origin/main` | lockfile only (`@phosphor-icons/react` in; `zod`/`pino-pretty`/`lucide-react` out) |
| `30399e0` Payment lifecycle + status endpoint | `PaymentStatus`, `collect()` seam, simulated auto-settle, slim pay/status |
| `30246fe` Business wallets with demo pre-funding | wallet state + routes, 402-guarded wallet pay, `nextId` serial fix |
| `0f613d8` Real ALAT HTTPS client with status reconciliation | `transfer-fund-request` + `CheckTransactionStatus`, status mapping |
| `e839a5e` Supabase: payments-v2 migration + async repository seam | full `SupabaseRepository`, `repositoryFor(env)`, `.env` loading |
| `a94b703` Payment/wallet handoff spec and doc refresh | `docs/PAYMENT_EXTENSION.md`, README/env/audit/progress |

---

## How to review

### 1. Static checks

```bash
pnpm install
pnpm --filter @lastgen/backend typecheck
pnpm --filter @lastgen/backend typecheck:test
pnpm lint                              # 0 errors (2 pre-existing frontend warnings)
pnpm format:check:backend
pnpm test:all                          # shared correctness 33/33 + backend 156/156
```

### 2. Boot the demo backend

```bash
cd backend && cp .env.example .env && pnpm dev   # or: DEMO_MODE=true pnpm dev
curl -s http://localhost:8080/health            # {"ok":true}
```

### 3. Exercise the extension

```bash
# wallet onboarding (demo pre-funds NGN 50,000)
curl -X POST localhost:8080/api/wallets/create -H 'content-type: application/json' \
  -d '{"businessId":"biz_adaeze_frozen","nin":"12345678901","firstName":"Adaeze","lastName":"Okonkwo","phone":"+2348012345678"}'

# bank payment -> pending_authorisation (auto-settles after SETTLE_AFTER_MS=3000)
curl -X POST localhost:8080/api/loans/loan_biz_adaeze_frozen/pay -H 'content-type: application/json' \
  -d '{"source":"bank_account","amountKobo":5000000}'

# poll status by paymentId, wallet pay, balance, statement
curl localhost:8080/api/payments/pay_00003/status
curl -X POST localhost:8080/api/loans/loan_biz_adaeze_frozen/pay -H 'content-type: application/json' \
  -d '{"source":"wallet","amountKobo":2000000}'
curl localhost:8080/api/wallets/balance
curl 'localhost:8080/api/wallets/statement?limit=10'
```

### 4. What to focus the review on

- **Lifecycle correctness** — a payment books `pending_authorisation`, settles
  exactly once (webhook, poll, or wallet debit) and updates loan + asset in the
  same transaction; `settlePayment` is idempotent under the simulated-consent
  race.
- **Wallet invariants** — `/wallets/*` resolves the business from `req.user`;
  `source='wallet'` returns `402` when the balance is short.
- **Async seam honesty** — the `Repository` interface is Promise-returning so
  the in-memory and Supabase implementations share one truthful interface (no
  `as unknown` casts).
- **ALAT wire contract** — the correctness suite pins the exact request/status
  mapping via an injected `fetchFn`; a live smoke needs real credentials.
- **Migration safety** — `audit.sql` + `payments-v2.sql` are additive and
  idempotent; `supabase/schema.sql` is byte-for-byte unchanged.

---

## Decisions recorded

| Decision | Choice | Rationale |
| --- | --- | --- |
| Money arithmetic | Float intermediates + single `Math.round` at kobo | Contract formula uses a fractional rate; guarantees mock/live parity to the kobo |
| Payment response | Slim `{ paymentId, platformTransactionReference, status }` | Frontend renders the consent sheet without loan internals |
| Payment lifecycle | Book pending → settle via webhook/poll/wallet, one transaction | Same atomic `applySettlement` primitive for every entry path |
| Wallet | Business cash wallet (035/NGN), demo pre-funded NGN 50k on create | Demo needs a funded wallet; live starts at 0, funded externally |
| Wallet ownership | `/wallets/*` resolves business from `req.user` | Authz invariant: no cross-user access, never trust the body |
| ALAT integration | Real HTTPS adapter, mock-tested | No sandbox credentials; `fetchFn` keeps the wire contract pinned |
| Supabase correctness | Full `SupabaseRepository` on an async seam | supabase-js is async; converting the seam (not casting) keeps the interface honest |
| Demo realtime | No Realtime in demo → frontend polls status then re-fetches the loan | Documented in the handoff; `payment.status_changed` only on Supabase |

Full detail: `backend/BACKEND_PROGRESS.md`.