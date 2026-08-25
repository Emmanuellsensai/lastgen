# Lastgen Backend Engineering Documentation

**Project:** Lastgen
**Team:** Team Ryzen (Riyzen)
**Track:** Wema Hackaholics 7.0 — Sustainability and Financial Inclusion
**Role:** Backend engineering
**Branch:** `feat/backend`
**Document status:** Living handoff — updated at the end of every phase
**Last updated:** 20 August 2026

## 1. Purpose

Lastgen is an asset-finance platform for Nigerian informal businesses. It turns
generator fuel spending into verifiable cashflow, gives lenders visibility into
financed solar assets, and provides an enforcement mechanism through a
pay-as-you-go controller.

The backend owns the API, business calculations, authentication boundary,
Supabase integration, payment provider abstraction, asset state machine, meter
simulation, impact calculations, demo controls, and deployment support. The API
contract in `docs/CONTRACT.md` is frozen. Field names, casing, routes, status
values, units, and response envelopes must remain aligned with the frontend.

## 2. Scope and constraints

- Backend working directory: `/backend`
- Backend stack: Express, TypeScript (NodeNext ESM), Zod, Supabase JS, Pino,
  CORS, Helmet
- Local TypeScript imports use the `.js` extension (NodeNext convention)
- Money is integer kobo at API and persistence boundaries
- Energy is integer Wh at API and persistence boundaries
- `/frontend` is not modified
- `/supabase/schema.sql` is not modified — additive migrations live in
  `/backend/migrations`
- `docs/CONTRACT.md` is not modified
- Root and frontend config files are not modified
- Demo endpoints are unauthenticated and only active in demo mode

## 3. Source-of-truth hierarchy

When behaviour is ambiguous, decisions are resolved in this order:

1. `docs/CONTRACT.md` — frozen API contract and state machines
2. Backend types and lease math (this repo's `src/types`, `src/config`)
3. `frontend/src/mocks/handlers.ts` — reference behaviour for the API
4. `supabase/schema.sql` — persistence model, RLS, triggers
5. `frontend/src/lib/lease.ts` — financial math the backend must match
6. Tests (`/tests`) — contract and correctness suites
7. The backend assignment brief from the team lead

The MSW handlers are treated as the executable specification. The backend must
reproduce their externally observable behaviour without importing any code from
`/frontend`.

## 4. Status matrix

| Deliverable                       | Status | Notes                                                                                                                                              |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase client                   | ✅     | Lazy-init since Phase 0                                                                                                                            |
| Response envelope helpers         | ✅     | `lib/envelope.ts`                                                                                                                                  |
| Centralized error handling        | ✅     | `middleware/errorHandler.ts`                                                                                                                       |
| Auth middleware (`requireAuth`)   | ✅     | `middleware/auth.ts`                                                                                                                               |
| Validation factories (Zod)        | ✅     | `middleware/validate.ts`                                                                                                                           |
| Typed env config                  | ✅     | `config/env.ts` (Phase 0)                                                                                                                          |
| Frozen constants                  | ✅     | `config/constants.ts` (Phase 0)                                                                                                                    |
| Backend-owned API types           | ✅     | `types/api.ts` (Phase 0)                                                                                                                           |
| App factory (`createApp`)         | ✅     | `app.ts` (Phase 1)                                                                                                                                 |
| `/health` + `/api` mount          | ✅     | `index.ts` → `app.ts`                                                                                                                              |
| burnEngine                        | ✅     | `services/burnEngine.ts`                                                                                                                           |
| leaseEngine                       | ✅     | `services/leaseEngine.ts`                                                                                                                          |
| assetStateMachine                 | ✅     | `services/assetStateMachine.ts` (Phase 1)                                                                                                          |
| loanStateMachine                  | ✅     | `services/loanStateMachine.ts` (Phase 1)                                                                                                           |
| meterSimulator                    | ✅     | `services/meterSimulator.ts` (Phase 1)                                                                                                             |
| impactEngine                      | ✅     | `services/impactEngine.ts` (Phase 1)                                                                                                               |
| visionService                     | ✅     | `services/visionService.ts` (Phase 1)                                                                                                              |
| Payment adapters (simulated/alat) | ✅     | Full seam + HMAC signature verification (Phase 4) + real HTTPS collect/pollStatus client (Phase 6)                                                 |
| ALAT webhook                      | ✅     | `/webhooks/alat` replay-safe on `transactionReference` (Phase 4); settles booked payments by reference (Phase 6)                                   |
| Repository layer                  | ✅     | `repository.ts` + `inMemoryRepository.ts` (Phase 2) + full `SupabaseRepository` on an async seam (Phase 6)                                         |
| Backend seed data                 | ✅     | `data/seed.ts` (Phase 2, byte-for-byte with MSW)                                                                                                   |
| Asset status audit migration      | ✅     | `migrations/audit.sql` (Phase 0; repo writes history + realtime publication Phase 2)                                                               |
| Payments v2 + wallets migration   | ✅     | `migrations/payments-v2.sql` (status, wallets, wallet_transactions, realtime) (Phase 6)                                                            |
| Payment lifecycle                 | ✅     | pending → SUCCESS/FAILED/EXPIRED; slim pay + status endpoints (Phase 6)                                                                            |
| Business wallets                  | ✅     | create (demo pre-fund NGN 50k)/balance/statement; 402-guarded wallet pay (Phase 6)                                                                 |
| Backend test home                 | ✅     | `backend/test/` — vitest config + seed-parity live (Phase 2)                                                                                       |
| API routes (all domains)          | ✅     | Happy-path done Phase 3; payments Phase 4; portfolio/impact Phase 5; demo + payment/wallet Phase 6                                                 |
| Auth boundary                     | ✅     | `makeRequireAuth` demo-skip + Supabase bearer (fail-closed) (Phase 3)                                                                              |
| Demo routes                       | ✅     | `/demo/reset`, `/demo/advance-time`, `/demo/miss-payment` (Phase 6, demo mode only)                                                                |
| Backend README endpoint docs      | ✅     | Full surface incl. payments/wallets + env (Phase 6)                                                                                                |
| Portfolio endpoints               | ✅     | `/portfolio/stats`, `/portfolio/assets`, `/portfolio/export` (Phase 5)                                                                             |
| Impact endpoints                  | ✅     | `/businesses/:id/impact`, `/businesses/:id/wrapped` (Phase 5)                                                                                      |
| Contract tests                    | ✅     | 20 files / 156 assertions (Phase 6)                                                                                                                |
| Correctness tests                 | ✅     | Shared: 3 live. Backend: seed-parity, webhook-idempotency, payment-adapter (incl. ALAT HTTPS client), impact-parity, supabase-repository stub live |
| Supabase repository               | ✅     | Full `Repository` implementation on an async seam + `repositoryFor(env)` (Phase 6)                                                                 |
| Payment/wallet handoff            | ✅     | `docs/PAYMENT_EXTENSION.md` — spec verbatim + demo fallbacks (Phase 6)                                                                             |
| Role model (`makeRequireRole`)    | ✅     | `middleware/auth.ts`; live reads `app_metadata.role`, FORBIDDEN 403 (Phase 8)                                                                      |
| Bank identities                   | ✅     | `/auth/bank/register`+`/login`, Supabase Auth-backed; `bank_users` mirror (Phase 8)                                                                |
| RBAC/KYC migration                | ✅     | `migrations/rbac-kyc.sql`: bank_users, kyc_records, kyc-docs bucket (Phase 8)                                                                      |
| KYC lifecycle                     | ✅     | Business get/submit + NIN provider seam + document storage (Phase 9)                                                                              |
| Admin surface                     | ✅     | Guarded `/admin/*` router: users, KYC review, power control, orders + atomic approve-payment (Phase 10)                                            |
| Render deployment verification    | ⬜     | Needs live Supabase + ALAT credentials                                                                                                            |

## 5. Implemented foundation (Phase 0)

### 5.1 Types and constants

- `src/types/api.ts` — hand-written mirror of `docs/CONTRACT.md`: envelope,
  enums, entities, request bodies, response payloads, query params. Backend
  never imports types from `/frontend`.
- `src/config/constants.ts` — frozen constants plus grounded defaults already
  present in the MSW reference:
  - `CO2_KG_PER_LITRE_PETROL = 2.31`
  - `CO2_KG_PER_LITRE_DIESEL = 2.68`
  - `DEFAULT_GRACE_PERIOD_HOURS = 72`
  - `MIN_LIGHTING_CIRCUIT_W = 40`
  - `DAYS_PER_MONTH = 30`, `DAYS_PER_YEAR = 365`
  - `VERIFIED_BURN_DAYS = 14` (backend assignment threshold)
  - `DEFAULT_APR_BPS = 2800`, `MIN_TENOR_MONTHS = 6`,
    `DEFAULT_DEPOSIT_RATIO = 0.1` (MSW parity)
- `src/config/env.ts` — single typed source for environment values; defaults
  applied in one place; payment adapter name validated at startup.

### 5.2 Supabase client (lazy)

`src/lib/supabase.ts` constructs the service-role client on first use and caches
it. The backend boots in demo mode without credentials; the first module that
talks to the database fails fast with a clear error if the keys are missing. The
service key is server-side only and never exposed to clients.

### 5.3 Entry point

`src/index.ts` reads config through `loadEnv()`, keeps `helmet`, CORS
(comma-separated origins), JSON parsing, pino-http logging, `GET /health`, the
`/api` router mount, and the centralized error handler. Behaviour is unchanged
from the scaffold; the router mount is ready for the domain routers.

### 5.4 Asset status audit migration

`migrations/audit.sql` adds `asset_status_history` (additive, applied after
`schema.sql`): `id`, `asset_id` FK, `from_status`/`to_status` using the existing
`asset_status` enum, `reason`, `changed_at`, `changed_by`, an index on
`(asset_id, changed_at desc)`, and an RLS policy mirroring `assets_owner`. The
asset state machine (Phase 1) writes one row per transition.

### 5.5 Test harness gate

`tests/correctness/lease-math.test.ts` now contains a minimal real assertion
that imports `backend/src/services/leaseEngine.js` through the NodeNext `.js`
convention, proving vitest resolves backend modules before the full suites are
written.

## 6. Domain services completed

### 6.1 Burn engine (`services/burnEngine.ts`)

- `computeBurnProfile(businessId, logs, computedAt?)` — sorts logs, derives the
  observed window from the earliest and latest log, normalizes irregular records
  to a daily rate, projects monthly (30d) and annual (365d) spend in integer
  kobo, and marks the profile verified at 14 observed days.
- `estimateBurnProfile(input)` — three-question generator estimate using
  `0.6 L per kVA-hour`, defaulting to 8 hours per day, always unverified.

### 6.2 Lease engine (`services/leaseEngine.ts`)

- Standard amortisation: `payment = P × r / (1 - (1+r)^-n)` with the zero-rate
  case handled separately; single `Math.round` at the kobo boundary.
- Full installment schedule builder, savings, savings percentage, deposit
  break-even month, and `QUOTE_NOT_VIABLE` (422) rejection when monthly savings
  are not positive. Matches `frontend/src/lib/lease.ts` to the kobo.

### 6.3 Loan state machine (`services/loanStateMachine.ts`)

- `markDelinquent(loan)` — ACTIVE → DELINQUENT, shallow copy.
- `recover(loan)` — DELINQUENT → ACTIVE after a payment restores the asset.
- `close(loan)` — any open loan → CLOSED; throws `INVALID_TRANSITION` (409) when
  the loan is already closed. Returns shallow copies throughout.

### 6.4 Asset state machine (`services/assetStateMachine.ts`)

- `transition(asset, loan, business, action, ctx)` is the single function that
  may change an asset status. Actions: `PAY`, `SUSPEND`, `RESTORE`,
  `MISS_PAYMENT`, `OVERDUE`. Returns `{ asset, loan, from, to, loanFrom, loanTo,
reason }` so the orchestration layer can persist, write the audit trail, and
  broadcast without reading internals.
- Frozen transitions: ACTIVE → GRACE/OWNED; GRACE → SUSPENDED/ACTIVE/OWNED;
  SUSPENDED → ACTIVE (payment). Payments restore GRACE/SUSPENDED assets, clear
  `suspendedAt`/`suspendReason`, and transfer ownership the moment the balance
  reaches zero.
- **Medical-flag guard lives inside the machine.** The bank-facing `SUSPEND`
  path throws `MEDICAL_FLAG` (409). Automated paths (`MISS_PAYMENT` escalation
  and the `OVERDUE` sweep) never suspend a medical-flag business — they keep it
  in GRACE, matching the MSW reference. There is no public suspension helper to
  bypass.

### 6.5 Meter simulator (`services/meterSimulator.ts`)

- Deterministic PRNG: `mulberry32(20260819)` + `hashString(assetId)` so every
  asset gets a stable stream.
- `simulateReadings` generates 6 daily slots ([6, 9, 12, 15, 18, 21]) with the
  curve `[0.18, 0.72, 1.0, 0.81, 0.24, 0.0]` scaling the system's capacity;
  `tick` appends a slot for the current time. Parity with `frontend/src/mocks`.

### 6.6 Impact engine (`services/impactEngine.ts`)

- `computeImpact` — 30/365/730-day windows: litres displaced, CO₂ (2.31 kg/L
  petrol, 2.68 kg/L diesel), naira saved (integer kobo), kWh generated, and
  months-to-ownership from the remaining balance.
- `computeWrapped` — yearly summary; deterministic best month and rank.
- Single source for `/impact` and `/wrapped` in Phase 5.

### 6.7 Vision service (`services/visionService.ts`)

- `extractReceipt` — Gemini `gemini-1.5-flash` call with an 8-second
  AbortController timeout; returns `{ litres, amountKobo, pricePerLitreKobo,
confidence }`.
- Graceful deterministic mock fallback when `GEMINI_API_KEY` is unset so the
  demo and correctness suites never depend on a live model.

### 6.8 Repository seam (`data/repository.ts` + `data/inMemoryRepository.ts`)

- `Repository` is the single way routes and services touch data, expressed in
  contract types. The in-memory implementation (Phase 2) reproduces the MSW
  reference; `SupabaseRepository` lands on the same interface in Phase 6.
- Every state change funnels through the real domain engines. `payLoan` is
  atomic: the pure state machine computes the outcome first (throwing before
  any mutation on invalid input), then loan, asset, next unpaid installment,
  payment ledger and audit history commit together.
- The audit trail is written on every asset status change (`changedBy` = bank,
  demo, or alat), matching `migrations/audit.sql`.
- Portfolio assets have no business row; the medical flag defaults to false
  there, mirroring the MSW `canSuspend` behaviour.

### 6.9 Deterministic seed (`data/seed.ts`)

- Byte-for-byte port of `frontend/src/mocks/seed.ts`: mulberry32(20260819)
  consumed in the reference order, anchored at 2026-08-19T09:00Z. Verified
  against the captured first-build output by the seed-parity suite.
- Unlike the frontend (module-level PRNG advances across resets), the backend
  builds with a fresh PRNG every time, so `reset` is fully deterministic — a
  deliberate, documented improvement over the reference.
- Anchors 8 systems, 6 businesses (medical flag on `biz_gwarinpa_mart`),
  217 fuel logs, 6 quotes/credit files (3 approved/3 pending), 3 installed
  assets (ACTIVE/GRACE/ACTIVE) with 540 readings each, and the 520-asset
  portfolio (ACTIVE 319 / GRACE 43 / OWNED 140 / SUSPENDED 21 after merge).

### 6.10 API surface (Phase 3)

- Routers live in `src/routes/`, one factory per domain, all mounted under
  `/api` by `apiRouter(repo, env)` in `routes/index.ts`. A final handler
  returns the contract 404 (`Route not found`) instead of Express's HTML page.
- `routes/helpers.ts` provides `asyncHandler` (Express 4 does not forward
  rejected promises) and `singleFile` (multer in-memory uploads mapped to
  contract `VALIDATION` errors).
- Happy-path routes delivered:
  - Businesses: `POST /businesses`, `GET /businesses/:id`,
    `POST /businesses/:id/receipts` (multipart `file` field, 5 MB limit,
    Gemini vision with deterministic mock fallback),
    `POST /businesses/:id/fuel-logs`, `GET /businesses/:id/burn`
  - Systems: `GET /systems?minKw&maxPriceKobo`
  - Quotes: `POST /businesses/:id/quote`, `GET /quotes/:id`
  - Credit: `GET /credit/applications?status`, `GET /credit/applications/:id`,
    `POST /credit/applications/:id/approve`, `POST /credit/applications/:id/decline`
  - Assets: `GET /assets/:id`, `GET /assets/:id/meter?from&to`,
    `POST /assets/:id/suspend`, `POST /assets/:id/restore`
  - Loans: `GET /loans/:id`, `GET /loans/:id/schedule`
- Routes stay thin: validation and 404s come from the repository as
  `ApiError` with contract-exact codes/messages; routes only shape the
  `{ ok, data }` envelope and status codes.
- Auth boundary: `makeRequireAuth(env)` returns a pass-through middleware in
  demo mode and the Supabase bearer check otherwise. The live check is wrapped
  so missing/expired credentials fail closed with `UNAUTHORIZED` (401) instead
  of hanging the request.

### 6.11 Payments + ALAT webhook (Phase 4)

- Adapter seam (`src/adapters/`): `PaymentAdapter` interface with
  `makeReference()` and `verifyWebhookSignature()`. `paymentAdapterFor(env)`
  picks the simulated (default) or ALAT adapter; routes depend on the seam,
  never a concrete provider.
- `simulatedAdapter` — `SIM-${Date.now()}` references (MSW parity) and accepts
  every notification. `alatAdapter` — verifies the HMAC-SHA512 signature over
  the raw body using the channel API key with constant-time comparison; with
  no key configured the backend is in demo mode and unsigned notifications pass.
- `POST /loans/:id/pay` — settles through `repo.payLoan` (source SIMULATED,
  adapter reference), returning `{ payment, loan, asset }`; the repository's
  atomic path updates loan, asset, next unpaid installment, payment ledger and
  audit history together.
- `POST /webhooks/alat` — mounted BEFORE the auth boundary (ALAT signs its own
  notifications), parses the ALAT notification, requires `transactionReference`
  (else `VALIDATION` 400), checks the signature, then calls the replay-safe
  `repo.settleAlatWebhook`. A replayed reference is accepted and ignored.
- `express.json({ verify })` preserves `req.rawBody` so the webhook signs the
  exact bytes the provider sent.

### 6.12 Portfolio + impact (Phase 5)

- `Repository.impactFor(businessId, period)` gathers the burn profile, the
  financed asset's loan and meter readings, then runs the single
  `computeImpact` engine — the same pure function that feeds `/impact` and
  `/wrapped`, so the two endpoints can never disagree (impact parity gate).
- `GET /portfolio/stats` — the portfolio projection (assets financed, value,
  repayment/par %, suspended count, displaced litres + CO2 tonnes, by-city).
- `GET /portfolio/assets` — MSW-parity pagination: status/city filters, 25 per
  page, `{ items, total }`.
- `POST /portfolio/export` — envelope promising a dated CSV URL.
- `GET /businesses/:id/impact?period=` — month (30d) / year (365d) / all (730d)
  windows over the deterministic readings.
- `GET /businesses/:id/wrapped?year=` — the yearly report projection with a
  fixed `bestMonth`/`rank` (MSW parity).

### 6.13 RBAC + bank identity (Phase 8)

Driver: the frontend build sprint (`frontend/buildSummary.md`) ships bank
auth pages and an admin dashboard that are fully mocked in
`handlers.ts bankAuthHandlers/adminHandlers/kycHandlers`. Phase 8 introduces
the role model and credit-desk identities they require.

- **Roles.** `UserRole = owner | bank | admin` in `types/api.ts`;
  `makeRequireRole(env, ...allowed)` in `middleware/auth.ts` gates role-scoped
  routers. Demo mode is permissive (consistent with the unauthenticated demo
  surface); live mode reads `app_metadata.role`, which only the server can
  write, so clients cannot self-escalate.
- **New error code.** `FORBIDDEN` (403) for authenticated callers lacking the
  role — additive to the contract error table, flagged for a CONTRACT.md
  amendment (docs owner).
- **Bank identities.** `Repository.registerBank/authenticateBank` behind a
  `BankSession { user, accessToken }` result. Live mode: auth.users with
  synthesized `<bankId>@banks.lastgen.local` email, `app_metadata.role='bank'`,
  descriptive mirror in `bank_users`; tokens minted via `signInWithPassword`.
  Login failures always return one UNAUTHORIZED shape so responses never
  reveal whether bankId or password was wrong.
- **Public routes.** `/auth/bank/register` (201) + `/auth/bank/login` (200)
  mounted before `makeRequireAuth` in `routes/index.ts`, same rationale as
  webhooks; validation messages byte-match the MSW reference.
- **Migration.** `migrations/rbac-kyc.sql`: `bank_users` mirror,
  `kyc_records` table + unique per-business index + owner-select RLS, private
  `kyc-docs` storage bucket. Additive and idempotent; applied after
  schema.sql.
- **Tests.** `backend/test/contract/bank-auth.test.ts` (10): happy paths,
  validation, duplicate/fail-closed credentials, reset hygiene, and a
  mounting-order proof (register answers without a bearer while
  boundary-protected routes fail closed 401 in live mode).

### 6.14 KYC lifecycle (Phase 9)

Driver: the frontend KYC page submits NIN + bank slip + selfie
(multipart) and reads the record back; admin review lands in Phase 10.

- **Endpoints.** `GET /businesses/:id/kyc` returns the stored record or a
  synthesized `unverified` projection (MSW parity); `POST .../kyc/submit`
  accepts multipart `ninNumber` + `bankSlip` + `selfie`, validates document
  types (selfie image, slip image/PDF), verifies the NIN through the provider
  seam, stores documents and parks the record in `pending` (201).
- **Seams.** `NinProvider` (`services/ninVerification.ts`) — simulated
  provider validates the 11-digit format and passes; selecting `nimc` fails
  closed with UNAVAILABLE so a misconfiguration cannot silently approve.
  `KycStorage` (`services/kycStorage.ts`) — demo data URLs, live private-
  bucket signed URLs with the Supabase client resolved lazily per upload
  (composition stays credential-free, matching requireAuth's posture).
- **Repository.** `kycRecordFor/submitKyc`: in-memory keyed off the seed's
  `kycRecords` map; Supabase upserts on the per-business unique index from
  rbac-kyc.sql. Approved records are immutable — resubmission throws
  INVALID_TRANSITION rather than reopening a reviewed identity.
- **Authz.** Live mode requires ownership of the target business (403),
  mirroring the wallet router; demo trusts the demo owner.
- **Env.** `NIN_PROVIDER=simulated|nimc`, `KYC_BUCKET=kyc-docs` parsed in
  config/env.ts (.env.example documented in Phase 11).
- **Tests.** `backend/test/contract/kyc.test.ts` (9): projection parity,
  validation matrix (documents/mime/NIN), resubmission semantics,
  read-after-write consistency.

### 6.15 Admin surface (Phase 10)

Driver: the frontend admin desk renders four tabs — Users, KYC review,
Solar control, Orders — all against `/admin/*` (handlers.ts lines 844–1004).

- **Router.** `src/routes/adminRoutes.ts` mounts every route behind
  `makeRequireRole(env, 'bank', 'admin')`: demo mode stays permissive like
  the rest of the demo surface; live mode demands the server-assigned
  bank/admin role claim.
- **Endpoints.** `GET /admin/users` projects businesses joined with asset →
  loan → kyc state (`kycStatus` defaults to `unverified` before a first
  submission); `GET /admin/kyc?status=` lists submissions with business
  names; `POST /admin/kyc/:id/approve|reject` transition pending records
  only (reject requires a reason, non-pending answers 409); `POST
  /admin/assets/:id/toggle-power` suspends ACTIVE assets and restores
  suspended ones through the state machine; `GET /admin/orders?status=`
  projects non-CLOSED loans fleet-wide; `POST /admin/loans/:id/approve-payment`
  settles one installment atomically.
- **Invariants preserved.** Power control delegates to
  `suspendAsset`/`restoreAsset` so medical-flagged businesses answer 409
  MEDICAL_FLAG and owned assets refuse suspension; approve-payment runs the
  same atomic `payLoan` primitive as wallet pay/webhook settle with
  SIMULATED `ADMIN-<ts>` references; closed loans refuse settlement.
- **Realtime.** Live reviews broadcast best-effort `kyc_reviewed` on the
  notifications channel — same try/catch posture as payment settlement.
- **Repository.** New seam methods `listAdminUsers`, `listKycSubmissions`,
  `reviewKyc`, `listAdminOrders` on both implementations; the in-memory
  orders projection falls back to the seed's denormalised
  `assetBusinessName` map because portfolio rows have no backing business
  record (live mode joins through the businesses FK instead).
- **Tests.** `backend/test/contract/admin.test.ts` (15): projections,
  filters and validation, approve-once/reject-with-reason, medical-flag and
  OWNED guards, exact balance-delta settlement, closure by repeated
  approval. Gate: typecheck ✓, lint 0 errors ✓, 223/223 tests / 25 suites ✓.

## 7. Decision register

| Decision                    | Choice                                                                           | Rationale                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Money arithmetic            | Float intermediates + single `Math.round` at kobo                                | Contract formula uses a fractional rate; this guarantees mock/live parity to the kobo         |
| Asset audit trail           | `backend/migrations/audit.sql`                                                   | schema.sql is off-limits; additive migration satisfies the assignment without contract change |
| Burn verification threshold | 14 days                                                                          | Backend assignment value; MSW mock uses 30 — noted as demo-parity caveat                      |
| PR strategy                 | One branch (`feat/backend`), one PR to `main`                                    | Fastest path to the Friday demo; conventional commits per phase                               |
| Supabase boot behaviour     | Lazy client, fail fast on first DB use                                           | Demo mode boots without keys; production still refuses to run unconfigured                    |
| Demo authentication         | Skip `requireAuth` in demo mode                                                  | Demo never asks for a JWT; production enforces Bearer on every contract route                 |
| Persistence                 | In-memory repository first; Supabase at Phase 6                                  | Fastest path to a live demo without credentials; repository interface isolates the swap       |
| Medical-flag semantics      | Bank `SUSPEND` throws `MEDICAL_FLAG`; automated paths silently stay GRACE        | Matches the MSW reference exactly — the guard is enforced in every suspension path            |
| App composition             | `createApp(env, logger, repository)` factory                                     | `app.ts` builds the Express app; `index.ts` wires the in-memory repo; tests inject their own  |
| Reset determinism           | Fresh PRNG per seed build                                                        | Frontend resets drift (module-level PRNG); backend resets reproduce the first build exactly   |
| Auth failure mode           | Fail closed with `UNAUTHORIZED`                                                  | Express 4 drops rejected promises; wrapping the Supabase lookup prevents hung requests        |
| Webhook signature           | HMAC-SHA512 over the raw body, verified in constant time                         | ALAT signs notifications; the simulated adapter is demo-only and accepts everything           |
| Webhook placement           | Mounted before the auth boundary                                                 | ALAT authenticates via its own signature, never a Lastgen bearer token                        |
| Impact source               | One `computeImpact` engine behind `/impact` and `/wrapped`                       | Guarantees the parity gate: the two endpoints share the same numbers                          |
| Impact windows              | 30 / 365 / 730 days                                                              | Mirrors the MSW `impactFor` `days` switch exactly                                             |
| Payment response            | Slim `{ paymentId, platformTransactionReference, status }`                       | Frontend renders the consent sheet without loan internals (handoff spec)                      |
| Role claim location         | Supabase `app_metadata.role`, read by `makeRequireRole`                          | Server-only metadata; clients cannot self-escalate by editing user_metadata                   |
| Forbidden vs Unauthorized   | New `FORBIDDEN` 403 for role denials                                             | 401 would misstate an authenticated caller; additive code flagged for CONTRACT.md amendment   |
| Bank login identifier       | `bankId` mapped to `<bankId>@banks.lastgen.local` for GoTrue                     | GoTrue authenticates by email; the mapping keeps bankId as the only public credential         |
| Bank login failure shape    | One `UNAUTHORIZED` message for unknown id and wrong password                     | Never reveal which half of the credential pair was wrong                                      |
| Duplicate bankId status     | `VALIDATION` 400 (not a new 409 code)                                            | Stays inside the frozen contract error table; registration is input validation                |
| Bank auth placement         | Mounted before `makeRequireAuth`, like webhooks                                  | A caller cannot present a bearer token it does not have yet                                   |
| NIN verification posture    | Simulated provider passes on format; `nimc` selection fails closed (503)         | A misconfigured deployment must never silently approve identities                             |
| KYC resubmission            | Allowed while pending/rejected; blocked once approved (409)                      | Resubmitting a reviewed identity would silently reopen it                                     |
| KYC storage resolution      | Supabase client resolved lazily per upload                                       | Composition stays credential-free so live-mode test apps boot and fail closed per request     |
| Payment lifecycle           | Book `pending_authorisation`, settle via webhook/poll/wallet in one transaction  | Same atomic `applySettlement` primitive for every entry path                                  |
| Wallet source of truth      | Business cash wallet (`035`/`NGN`), demo pre-funded NGN 50k on create            | Demo needs a funded wallet; live starts at 0, funded externally, no top-up endpoint           |
| Wallet ownership            | `/wallets/*` resolves business from `req.user` via `businessForOwner`            | Authz invariant: no cross-user access, never trust the body                                   |
| ALAT integration            | Real HTTPS adapter (transfer-fund-request + CheckTransactionStatus), mock-tested | No sandbox credentials available; `fetchFn` injectable keeps the wire contract pinned         |
| Supabase correctness        | Full `SupabaseRepository` on an async `Repository` seam                          | supabase-js is async; converting the seam (not casting) keeps the interface honest            |
| Wallet debit atomicity      | Single `UPDATE … WHERE balance_kobo >= amount` (compare-and-swap)                | The 402 guard is race-free in Postgres without a server-side function                         |
| Admin power control         | Routed through `suspendAsset`/`restoreAsset`, OWNED rejected up front            | Reusing the state machine keeps MEDICAL_FLAG and transition invariants intact on every path   |
| Admin payment approval      | Atomic `payLoan(loanId, monthlyPaymentKobo, 'SIMULATED', 'ADMIN-…')`             | One settlement primitive for wallet pay, webhook, consent and the credit desk — no side door  |
| Admin KYC review broadcast  | Best-effort `kyc_reviewed` notification, try/catch swallowed                     | Mirrors settlement broadcasts; a realtime outage must never fail a review                     |
| Orders projection scope     | All non-CLOSED loans incl. portfolio rows without business records               | The credit desk works receivables fleet-wide; names fall back to denormalised seed maps       |
| Demo realtime               | No Supabase Realtime in demo → frontend polls status then re-fetches the loan    | Documented in the handoff; `payment.status_changed` only on a Supabase deployment             |

## 8. Phase log

### Phase 0 — Foundation hardening (complete)

- Added typed env config, frozen constants, backend-owned contract types
- Made the Supabase client lazy for demo-first boot
- Added the asset status audit migration
- Proved vitest resolves backend modules through the NodeNext `.js` convention
- Rewrote this document and refreshed `AUDIT.md`
- Verification: `pnpm typecheck` ✅, `pnpm lint` ✅, `pnpm test` ✅ (smoke green),
  boot without Supabase keys → `GET /health` 200 `{"ok":true}` ✅

### Phase 1 — Domain engines (complete)

- Split app composition: `app.ts` exposes `createApp(env, logger)`, `index.ts`
  owns process startup and imports — the server is now testable without a port.
- Added `loanStateMachine` (delinquent/recover/close), the single-function
  `assetStateMachine.transition` with the medical-flag guard internal to every
  suspension path, `meterSimulator` (deterministic readings), `impactEngine`
  (30/365/730-day windows + wrapped summary), and `visionService` (Gemini
  receipt extraction with a mock fallback).
- Filled the correctness suites: `lease-math` (12), `asset-state-machine` (16),
  `medical-flag-guard` (5) — 33 assertions, all green.
- Fixed a spec divergence found by the tests: automated suspension paths skip
  a medical-flag business silently (stays GRACE) while the bank path throws
  `MEDICAL_FLAG` — matching `frontend/src/mocks/handlers.ts`.
- Verification: `pnpm typecheck` ✅, `pnpm lint` ✅, 3 correctness suites ✅
  (33/33), boot smoke → `GET /health` 200 `{"ok":true}` ✅

### Phase 2 — Data layer + deterministic seed (complete)

- Added `data/repository.ts` (typed `Repository` seam in contract types) and
  `data/inMemoryRepository.ts` (in-memory implementation driving the real state
  machines; atomic `payLoan`; audit history written per transition).
- Added `data/seed.ts` — byte-for-byte port of the MSW fixture with a fresh
  PRNG per build for deterministic resets.
- Extended `migrations/audit.sql` with the `supabase_realtime` assets
  publication (idempotent, additive).
- Added the backend test home: `backend/vitest.config.ts`, `test` script and
  `test/correctness/seed-parity.test.ts` (15 assertions) proving the seed
  reproduces the captured frontend first build and that reset is pristine.
- Verification: `pnpm --filter @lastgen/backend typecheck` ✅, `pnpm lint` ✅,
  shared correctness suites ✅ (33/33), `pnpm --filter @lastgen/backend test`
  ✅ (15/15), boot smoke → `GET /health` 200 `{"ok":true}` ✅

### Phase 3 — Happy-path routes — pending

- Businesses, fuel logs, burn, systems, quotes, credit, assets

### Phase 3 — Happy-path routes (complete)

- Added the auth boundary `makeRequireAuth(env)`: pass-through in demo mode,
  Supabase bearer enforcement in production with a fail-closed wrapper.
- Added the domain routers (businesses, systems, quotes, credit, assets, loans)
  mounted under `/api` by `apiRouter`, plus `asyncHandler` and `singleFile`
  helpers and the contract 404 fallback.
- Wired `createApp(env, logger, repository)`; `index.ts` now constructs the
  in-memory repository.
- Added `multer` (in-memory, 5 MB) for the receipt upload route; vision
  extraction degrades to the deterministic mock without a Gemini key.
- Added the backend test home harness (`test/helpers.ts`) and 7 contract suites
  (47 assertions) exercising every happy-path route through Supertest.
- Hardened live auth: an invalid token now returns the contract 401 instead of
  hanging the request (Express 4 drops rejected promises).
- Verification: `pnpm --filter @lastgen/backend typecheck` ✅, `pnpm lint` ✅,
  shared correctness ✅ (33/33), backend suite ✅ (62/62), demo boot smoke
  (`/health`, `/api/systems`, `/api/credit/applications`, `/api/businesses/:id`,
  `/api/loans/:id/schedule` all 200; unknown route 404 JSON) ✅, live boot smoke
  (no token → 401, invalid token → 401) ✅.

### Phase 4 — Payments and webhook (complete)

- Completed the payment adapter seam: `PaymentAdapter` interface, simulated
  adapter (`SIM-` references, accepts everything), ALAT adapter (HMAC-SHA512
  signature verification over the raw body, constant-time, demo-tolerant) and
  the `paymentAdapterFor(env)` factory.
- Added `POST /loans/:id/pay` (simulated settlement through the atomic
  `payLoan` path) and `POST /webhooks/alat` (mounted before auth, requires
  `transactionReference`, verifies the signature, replay-safe settlement).
- `express.json({ verify })` now captures `req.rawBody` for webhook signing.
- Added 21 assertions: webhook-idempotency (5), payment-adapter (7), webhook
  contract (4), payments contract (5).
- Verification: typecheck ✅, lint ✅, shared correctness ✅ (33/33), backend
  suite ✅ (83/83), demo boot smoke (pay 200; webhook 200, replay 200,
  missing reference 400) ✅.
- **Critical review ping to team lead issued** — review gate #4: adapters,
  atomic pay path, webhook idempotency.

### Phase 5 — Portfolio and impact parity (complete)

- Added `Repository.impactFor` wired through `computeImpact` (burn + asset loan
  - readings), plus portfolio and impact routers mounted after the auth
    boundary.
- Added 17 assertions: impact-parity (6), portfolio contract (5), impact
  contract (6).
- Verification: typecheck ✅, lint ✅, shared correctness ✅ (33/33), backend
  suite ✅ (100/100), demo boot smoke (stats, assets filter, export, impact,
  wrapped, 404) ✅.
- **Impact parity review gate demonstrated.**

### Phase 6 — Payment lifecycle, wallets, Supabase (complete)

Pulled forward as the payment/wallet extension; spec in `docs/PAYMENT_EXTENSION.md`:

- **Payment lifecycle** — `PaymentStatus` + `Payment.status`/
  `platformTransactionReference`; adapter seam `collect()`; simulated adapter
  auto-settles after `SETTLE_AFTER_MS`; repository
  `startPayment`/`settlePayment`/`failPayment`/`expirePayment`/`paymentByRefOrId`.
  Slim `POST /loans/:id/pay` response; `GET /payments/:reference/status`
  (reference or id) reconciles stale pendings against the provider.
- **Real ALAT client** — `collect()` → `transfer-fund-request`
  (Ocp-Apim-Subscription-Key + merchant `sourceAccountNumber`), `pollStatus()` →
  `CheckTransactionStatus`; provider statuses mapped; 4xx → VALIDATION, 5xx/
  network → UNAVAILABLE. Wire contract pinned by the correctness suite via an
  injected `fetchFn`.
- **Wallets** — `POST /wallets/create` (KYC'd, idempotent, demo pre-fund NGN
  50k), `GET /wallets/balance`, `GET /wallets/statement`; `source='wallet'` pays
  via a 402-guarded debit + atomic settlement. Ownership from `req.user`.
  `nextId` serial-increment bug fixed (ids are unique now).
- **Async seam** — `Repository` returns promises; in-memory repo, routes and
  tests await it; `settlePayment` re-checks status after awaits for exactly-once
  settlement under the simulated-consent race.
- **`payments-v2.sql`** — additive migration: `payment_status`, `payments.status`
  - platform reference, `WALLET` source, `wallets`/`wallet_kyc`/
    `wallet_transactions` with RLS, realtime publication for payments/wallets.
- **Full `SupabaseRepository`** — every `Repository` method on supabase-js,
  reusing the pure engines; `repositoryFor(env)` + fail-fast live guard;
  `index.ts` loads `.env`. Stub suite `test/data/supabase-repository.test.ts`.
- **Demo/README** — demo routes completed in the remediation pass; README,
  `.env.example` and this document cover the payment/wallet surface,
  `ALAT_SOURCE_ACCOUNT`/`SETTLE_AFTER_MS`, and the Supabase store.
- Verification: typecheck ✅, typecheck:test ✅, lint ✅ (0 errors), shared
  correctness ✅ (33/33), backend suite ✅ (**156/156, 20 files**),
  format:check:backend ✅, demo boot smoke ✅ (wallet create pre-funded; bank pay
  pending → auto SUCCESS; wallet pay SUCCESS + debit; statement ordering).

### Remediation pass — audit of Phases 0–5 (complete)

Read-only audit (two explorer sweeps + manual verification) → 11 fixes:

- JSON transport errors: `pinoHttp` before `express.json`; body-parser failures
  map to contract JSON (400 malformed / 413 oversized) instead of crashing the
  error handler into an HTML 500.
- Demo routes (`demoRoutes.ts`) mounted pre-auth in demo mode only; completes
  the roadmap's 11 contract suites (`demo.test.ts`, 8 tests).
- Payment source is adapter-accurate (ALAT vs SIMULATED).
- Graceful shutdown (SIGINT/SIGTERM), committed `.npmrc`, `tsconfig.test.json`
  - `typecheck:test`, CI workflow, dead code removed (burnEngine, validate/zod,
    unused meterSimulator exports, pino-pretty), Prettier pass over backend.
- Docs refreshed: `README.md`, `AUDIT.md` §19, `loanRoutes.ts` comment.
- Deferred to Phase 6: Supabase repository (live data is auth-only),
  re-plumb `lib/supabase.ts` through `Env`, receipt image hosting.

### Phase 7 — Integration and PR — pending

- Full happy-path integration suite; finalize docs; single PR to `main`

## 9. PR/commit log

| Commit                                                                              | Scope                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chore(backend): add typed env config and frozen contract constants`                | `config/env.ts`, `config/constants.ts`, burnEngine constants refactor                                                                                                                          |
| `feat(backend): add backend-owned API types mirroring docs/CONTRACT.md`             | `types/api.ts`                                                                                                                                                                                 |
| `refactor(backend): lazy-init supabase client for demo-first boot`                  | `lib/supabase.ts`, `middleware/auth.ts`, `index.ts`                                                                                                                                            |
| `test(backend): prove vitest module resolution with lease-math smoke test`          | `tests/correctness/lease-math.test.ts`                                                                                                                                                         |
| `feat(backend): add asset status audit migration`                                   | `migrations/audit.sql`                                                                                                                                                                         |
| `docs(backend): rewrite BACKEND_PROGRESS.md as living handoff`                      | `backend/BACKEND_PROGRESS.md`                                                                                                                                                                  |
| `docs(backend): refresh AUDIT.md for phase 0 state`                                 | `backend/AUDIT.md`                                                                                                                                                                             |
| `refactor(backend): split app factory from process entry point`                     | `app.ts`, `index.ts`                                                                                                                                                                           |
| `feat(backend): add loan and asset state machines`                                  | `services/loanStateMachine.ts`, `services/assetStateMachine.ts`                                                                                                                                |
| `feat(backend): add deterministic meter simulator and impact engine`                | `services/meterSimulator.ts`, `services/impactEngine.ts`, `config/constants.ts`                                                                                                                |
| `feat(backend): add receipt vision service with mock fallback`                      | `services/visionService.ts`                                                                                                                                                                    |
| `test(backend): fill correctness suites for lease, state machine, medical guard`    | `tests/correctness/lease-math.test.ts`, `tests/correctness/asset-state-machine.test.ts`, `tests/correctness/medical-flag-guard.test.ts`                                                        |
| `docs(backend): document phase 1 engines and verification`                          | `backend/BACKEND_PROGRESS.md`, `backend/AUDIT.md`                                                                                                                                              |
| `docs: add frontend integration guide`                                              | `GUIDE.md`                                                                                                                                                                                     |
| `docs: add backend roadmap`                                                         | `backend/ROADMAP.md`                                                                                                                                                                           |
| `feat(backend): add deterministic in-memory seed`                                   | `data/seed.ts`                                                                                                                                                                                 |
| `feat(backend): add repository interface and in-memory implementation`              | `data/repository.ts`, `data/inMemoryRepository.ts`                                                                                                                                             |
| `feat(backend): add asset realtime publication to audit migration`                  | `migrations/audit.sql`                                                                                                                                                                         |
| `test(backend): add backend test home and seed-parity suite`                        | `backend/package.json`, `backend/vitest.config.ts`, `backend/test/correctness/seed-parity.test.ts`                                                                                             |
| `docs(backend): document phase 2 data layer`                                        | `backend/BACKEND_PROGRESS.md`, `backend/AUDIT.md`                                                                                                                                              |
| `chore(backend): document full env surface and env hygiene`                         | `backend/.env.example`, `.gitignore`                                                                                                                                                           |
| `feat(backend): add auth demo-skip factory`                                         | `middleware/auth.ts`                                                                                                                                                                           |
| `feat(backend): add business and fuel-log routes`                                   | `routes/businessRoutes.ts`, `routes/helpers.ts`                                                                                                                                                |
| `feat(backend): add systems, quotes, credit, asset, loan routes`                    | `routes/systemRoutes.ts`, `routes/quoteRoutes.ts`, `routes/creditRoutes.ts`, `routes/assetRoutes.ts`, `routes/loanRoutes.ts`                                                                   |
| `feat(backend): mount api router with contract 404`                                 | `routes/index.ts`, `app.ts`, `index.ts`, `package.json`                                                                                                                                        |
| `test(backend): add phase 3 contract suites`                                        | `backend/test/helpers.ts`, `backend/test/contract/*`                                                                                                                                           |
| `docs(backend): document phase 3 api surface`                                       | `backend/ROADMAP.md`, `backend/BACKEND_PROGRESS.md`, `backend/AUDIT.md`                                                                                                                        |
| `feat(backend): complete payment adapter seam`                                      | `adapters/paymentAdapter.ts`, `adapters/simulatedAdapter.ts`, `adapters/alatAdapter.ts`, `adapters/factory.ts`                                                                                 |
| `feat(backend): add loan pay and alat webhook routes`                               | `routes/paymentRoutes.ts`, `routes/webhookRoutes.ts`, `routes/index.ts`, `app.ts`, `middleware/auth.ts`                                                                                        |
| `test(backend): add webhook idempotency and payment suites`                         | `backend/test/correctness/webhook-idempotency.test.ts`, `backend/test/correctness/payment-adapter.test.ts`, `backend/test/contract/webhooks.test.ts`, `backend/test/contract/payments.test.ts` |
| `docs(backend): document phase 4 payments`                                          | `backend/ROADMAP.md`, `backend/BACKEND_PROGRESS.md`, `backend/AUDIT.md`                                                                                                                        |
| `feat(backend): add impact projection to repository seam`                           | `src/data/repository.ts`, `src/data/inMemoryRepository.ts`                                                                                                                                     |
| `feat(backend): add portfolio and impact routes`                                    | `src/routes/portfolioRoutes.ts`, `src/routes/impactRoutes.ts`, `src/routes/index.ts`                                                                                                           |
| `test(backend): add impact parity and portfolio suites`                             | `backend/test/correctness/impact-parity.test.ts`, `backend/test/contract/portfolio.test.ts`, `backend/test/contract/impact.test.ts`                                                            |
| `docs(backend): document phase 5 portfolio and impact`                              | `backend/ROADMAP.md`, `backend/BACKEND_PROGRESS.md`, `backend/AUDIT.md`                                                                                                                        |
| `fix(backend): map json transport errors to contract responses`                     | `app.ts`, `middleware/errorHandler.ts`, `backend/test/contract/errors.test.ts`                                                                                                                 |
| `feat(backend): add demo control routes`                                            | `routes/demoRoutes.ts`, `routes/index.ts`, `backend/test/helpers.ts`, `backend/test/contract/demo.test.ts`                                                                                     |
| `fix(backend): record adapter-accurate payment source`                              | `routes/paymentRoutes.ts`, `backend/test/contract/payments.test.ts`                                                                                                                            |
| `feat(backend): graceful shutdown on sigint/sigterm`                                | `index.ts`                                                                                                                                                                                     |
| `chore(backend): drop dead burn engine and validator`                               | `services/burnEngine.ts`, `middleware/validate.ts`, `config/constants.ts`, `services/meterSimulator.ts`, `backend/package.json`                                                                |
| `build(backend): typecheck test sources`                                            | `tsconfig.test.json`, `backend/package.json`                                                                                                                                                   |
| `ci: add backend gate workflow and commit install policy`                           | `.github/workflows/ci.yml`, `.npmrc`, root `package.json`                                                                                                                                      |
| `style(backend): format sources with prettier`                                      | `backend/src`, `backend/test`                                                                                                                                                                  |
| `docs(backend): refresh readme and audit after remediation`                         | `backend/README.md`, `backend/AUDIT.md`, `backend/BACKEND_PROGRESS.md`, `routes/loanRoutes.ts`                                                                                                 |
| `Merge remote-tracking branch 'origin/main' into feat/backend`                      | `db380b1` — lockfile only (`@phosphor-icons/react` in, `zod`/`pino-pretty`/`lucide-react` out)                                                                                                 |
| `feat(backend): add payment lifecycle and status endpoint`                          | `30399e0` — `PaymentStatus`, `collect()` seam, simulated auto-settle, slim pay/status endpoints, settle-by-reference webhook                                                                   |
| `feat(backend): add business wallets with demo pre-funding`                         | `30246fe` — `wallets`/`wallet_transactions` state, create/balance/statement routes, 402-guarded wallet pay, `nextId` fix                                                                       |
| `feat(backend): real ALAT HTTPS client with status reconciliation`                  | `0f613d8` — `transfer-fund-request` + `CheckTransactionStatus` polling, provider status mapping, poll reconciles stale pendings                                                                |
| `feat(backend): wire Supabase with payments-v2 migration and async repository seam` | `…` — full `SupabaseRepository`, `repositoryFor(env)`, async `Repository`, `.env` loading, `payments-v2.sql`, stub suite                                                                       |
| `docs(backend): payment/wallet handoff spec and doc refresh`                        | `docs/PAYMENT_EXTENSION.md`, `backend/README.md`, `backend/.env.example`, `backend/AUDIT.md`, `backend/BACKEND_PROGRESS.md`                                                                    |

## 10. Risks and open items

- **Vitest `.js` → `.ts` resolution** — proven working by the Phase 0 smoke test;
  if a future suite hits resolution failures, stop and report rather than
  work around scope rules.
- **Verified-burn threshold** — `recomputeBurn` marks a profile verified at
  30+ observed days, matching the MSW reference exactly. The former
  `VERIFIED_BURN_DAYS=14` constant was removed with the unused `burnEngine`.
- **Live auth needs Supabase** — bearer verification requires
  `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`; until Phase 6 the live path fails
  closed with `UNAUTHORIZED` (never hangs).
- **ALAT adapter is demo-tolerant** — without `ALAT_API_KEY` unsigned webhooks
  are accepted. Once real ALAT credentials are configured the signature check
  becomes mandatory. Confirm before production use.
- **Schema not yet applied** — the audit migration and schema exist as SQL; they
  are applied to the live Supabase project in Phase 6 with credentials.
- **Supabase paths stub-tested only** — the full `SupabaseRepository` and the
  realtime publication are verified against a stubbed client and by SQL review;
  nothing has run against a live project (no credentials). Apply
  `supabase/schema.sql` → `backend/migrations/audit.sql` →
  `backend/migrations/payments-v2.sql` in order, then run the live smoke.
- **Async repository seam** — the `Repository` interface is now Promise-returning
  so the DB-backed implementation is honest. All routes and tests await it; the
  demo boot smoke and the 156-test suite pin the behaviour.
- **Backend tests are backend-owned** — new suites live in `backend/test/`
  (`pnpm --filter @lastgen/backend test`); the shared `/tests/` directory is
  only touched for the three committed correctness suites. No further `/tests/`
  edits are expected.
- **`gh` CLI not authenticated** — the PR is opened manually by the team lead
  from the pushed `feat/backend` branch.
- **`.npmrc` is committed** — `ignore-scripts=true` is a deliberate repo-wide
  install policy (Windows/Node 24 esbuild/msw postinstall crash). `render.yaml`
  uses `pnpm install --frozen-lockfile`, which honours it; the esbuild/msw
  `allowBuilds` whitelist in `pnpm-workspace.yaml` stays as a guard.

## 11. Working checklist

- [x] Audit current backend state (`AUDIT.md`)
- [x] Backend-owned contract types
- [x] Typed env config
- [x] Frozen constants
- [x] Lazy Supabase client
- [x] Audit migration
- [x] Vitest resolution smoke test
- [x] Phase 0 verification (typecheck, lint, test, boot)
- [x] Asset state machine (Phase 1)
- [x] Loan state machine (Phase 1)
- [x] Meter simulator + impact engine (Phase 1)
- [x] Vision service (Phase 1)
- [x] Correctness suites: lease-math, asset-state-machine, medical-flag-guard (Phase 1)
- [x] Phase 1 verification (typecheck, lint, tests, boot smoke)
- [x] Roadmap (`backend/ROADMAP.md`)
- [x] Repository layer (interface + in-memory) (Phase 2)
- [x] Deterministic seed with parity proof (Phase 2)
- [x] Realtime publication migration (Phase 2)
- [x] Backend test home + seed-parity suite (Phase 2)
- [x] Phase 2 verification (typecheck, lint, shared suites, backend suite, boot smoke)
- [x] Auth boundary `makeRequireAuth` (demo-skip + fail-closed live) (Phase 3)
- [x] Happy-path routers (businesses, systems, quotes, credit, assets, loans) (Phase 3)
- [x] Contract 404 + async/multer helpers (Phase 3)
- [x] 7 Phase 3 contract suites (47 assertions) (Phase 3)
- [x] Phase 3 verification (typecheck, lint, shared suites, backend suite, demo + live boot smoke)
- [x] Payment adapter seam (simulated + ALAT HMAC) + factory (Phase 4)
- [x] `POST /loans/:id/pay` + `POST /webhooks/alat` (replay-safe) (Phase 4)
- [x] Webhook-idempotency + payment-adapter correctness + webhook/payments contract suites (Phase 4)
- [x] Phase 4 verification (typecheck, lint, shared suites, backend suite, demo boot smoke)
- [x] Phase 4 critical review ping to team lead
- [x] Portfolio + impact routes + `impactFor` seam (Phase 5)
- [x] Impact-parity + portfolio/impact contract suites (Phase 5)
- [x] Phase 5 verification (typecheck, lint, shared suites, backend suite, demo boot smoke)
- [x] Impact parity review gate demonstrated
- [x] Remediation audit of Phases 0–5: JSON error handling, demo routes + suite, adapter-accurate payment source, graceful shutdown
- [x] Remediation: committed `.npmrc`, `tsconfig.test.json`, CI workflow, dead code removed, Prettier pass, docs refreshed
- [x] Payment lifecycle (pending → SUCCESS/FAILED/EXPIRED) + slim pay/status endpoints (Phase 6)
- [x] Business wallets: create/balance/statement + 402-guarded wallet pay + demo pre-fund (Phase 6)
- [x] Real ALAT HTTPS client (transfer-fund-request + CheckTransactionStatus) + status reconciliation (Phase 6)
- [x] `payments-v2.sql` migration (status, wallets, wallet_transactions, realtime) (Phase 6)
- [x] Full `SupabaseRepository` + async repository seam + `repositoryFor(env)` + `.env` loading (Phase 6)
- [x] `docs/PAYMENT_EXTENSION.md` handoff + README/env/audit/progress refresh (Phase 6)
- [x] Remediation Pass (T1–T11): ALAT fail-closed, money safety (no wrong-loan fallback), live identity owner_id, realtime status broadcast, atomic settlement SQL migration, query param validation, CSV export route, demo/live honesty checks, test hygiene cleanup.
- [ ] Render deployment with live Supabase + ALAT credentials (Phase 6/7)
- [ ] Integration suite + final PR (Phase 7)
