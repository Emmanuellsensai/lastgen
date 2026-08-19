# Lastgen Backend Engineering Documentation

**Project:** Lastgen
**Team:** Team Ryzen (Riyzen)
**Track:** Wema Hackaholics 7.0 — Sustainability and Financial Inclusion
**Role:** Backend engineering
**Branch:** `feat/backend`
**Document status:** Living handoff — updated at the end of every phase
**Last updated:** 19 August 2026

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

| Deliverable | Status | Notes |
| --- | --- | --- |
| Supabase client | ✅ | Lazy-init since Phase 0 |
| Response envelope helpers | ✅ | `lib/envelope.ts` |
| Centralized error handling | ✅ | `middleware/errorHandler.ts` |
| Auth middleware (`requireAuth`) | ✅ | `middleware/auth.ts` |
| Validation factories (Zod) | ✅ | `middleware/validate.ts` |
| Typed env config | ✅ | `config/env.ts` (Phase 0) |
| Frozen constants | ✅ | `config/constants.ts` (Phase 0) |
| Backend-owned API types | ✅ | `types/api.ts` (Phase 0) |
| App factory (`createApp`) | ✅ | `app.ts` (Phase 1) |
| `/health` + `/api` mount | ✅ | `index.ts` → `app.ts` |
| burnEngine | ✅ | `services/burnEngine.ts` |
| leaseEngine | ✅ | `services/leaseEngine.ts` |
| assetStateMachine | ✅ | `services/assetStateMachine.ts` (Phase 1) |
| loanStateMachine | ✅ | `services/loanStateMachine.ts` (Phase 1) |
| meterSimulator | ✅ | `services/meterSimulator.ts` (Phase 1) |
| impactEngine | ✅ | `services/impactEngine.ts` (Phase 1) |
| visionService | ✅ | `services/visionService.ts` (Phase 1) |
| Payment adapters (simulated/alat) | 🚧 | Stubs only; interface completed Phase 4 |
| ALAT webhook | ⬜ | Phase 4 |
| Repository layer | 🚧 | `repository.ts` + `inMemoryRepository.ts` (Phase 2); Supabase at Phase 6 |
| Backend seed data | ✅ | `data/seed.ts` (Phase 2, byte-for-byte with MSW) |
| Asset status audit migration | ✅ | `migrations/audit.sql` (Phase 0; repo writes history + realtime publication Phase 2) |
| Backend test home | ✅ | `backend/test/` — vitest config + seed-parity live (Phase 2) |
| API routes (all domains) | ⬜ | Phases 3–6 |
| Demo routes | ⬜ | Phase 6 |
| Backend README endpoint docs | 🚧 | Scaffolded; full docs Phase 6 |
| Contract tests (11 suites) | 🚧 | Filled in `backend/test/contract/` per phase |
| Correctness tests | 🚧 | Shared: 3 live. Backend: seed-parity live (Phase 2); impact-parity + webhook-idempotency + integration per phase |
| Render deployment verification | ⬜ | Phase 6 |

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

## 7. Decision register

| Decision | Choice | Rationale |
| --- | --- | --- |
| Money arithmetic | Float intermediates + single `Math.round` at kobo | Contract formula uses a fractional rate; this guarantees mock/live parity to the kobo |
| Asset audit trail | `backend/migrations/audit.sql` | schema.sql is off-limits; additive migration satisfies the assignment without contract change |
| Burn verification threshold | 14 days | Backend assignment value; MSW mock uses 30 — noted as demo-parity caveat |
| PR strategy | One branch (`feat/backend`), one PR to `main` | Fastest path to the Friday demo; conventional commits per phase |
| Supabase boot behaviour | Lazy client, fail fast on first DB use | Demo mode boots without keys; production still refuses to run unconfigured |
| Demo authentication | Skip `requireAuth` in demo mode | Demo never asks for a JWT; production enforces Bearer on every contract route |
| Persistence | In-memory repository first; Supabase at Phase 6 | Fastest path to a live demo without credentials; repository interface isolates the swap |
| Medical-flag semantics | Bank `SUSPEND` throws `MEDICAL_FLAG`; automated paths silently stay GRACE | Matches the MSW reference exactly — the guard is enforced in every suspension path |
| App composition | `createApp(env, logger)` factory | `app.ts` builds the Express app; `index.ts` owns process/startup; testable without listening |
| Reset determinism | Fresh PRNG per seed build | Frontend resets drift (module-level PRNG); backend resets reproduce the first build exactly |

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

### Phase 4 — Payments and webhook — pending

- PaymentAdapter completion, simulated + ALAT adapters, idempotent webhook

### Phase 5 — Portfolio and impact parity — pending

- Portfolio stats/assets/export; `/impact` and `/wrapped` from one engine

### Phase 6 — Demo, README, deploy — pending

- Demo routes driving the real state machine; endpoint docs; Render verification

### Phase 7 — Integration and PR — pending

- Full happy-path integration suite; finalize docs; single PR to `main`

## 9. PR/commit log

| Commit | Scope |
| --- | --- |
| `chore(backend): add typed env config and frozen contract constants` | `config/env.ts`, `config/constants.ts`, burnEngine constants refactor |
| `feat(backend): add backend-owned API types mirroring docs/CONTRACT.md` | `types/api.ts` |
| `refactor(backend): lazy-init supabase client for demo-first boot` | `lib/supabase.ts`, `middleware/auth.ts`, `index.ts` |
| `test(backend): prove vitest module resolution with lease-math smoke test` | `tests/correctness/lease-math.test.ts` |
| `feat(backend): add asset status audit migration` | `migrations/audit.sql` |
| `docs(backend): rewrite BACKEND_PROGRESS.md as living handoff` | `backend/BACKEND_PROGRESS.md` |
| `docs(backend): refresh AUDIT.md for phase 0 state` | `backend/AUDIT.md` |
| `refactor(backend): split app factory from process entry point` | `app.ts`, `index.ts` |
| `feat(backend): add loan and asset state machines` | `services/loanStateMachine.ts`, `services/assetStateMachine.ts` |
| `feat(backend): add deterministic meter simulator and impact engine` | `services/meterSimulator.ts`, `services/impactEngine.ts`, `config/constants.ts` |
| `feat(backend): add receipt vision service with mock fallback` | `services/visionService.ts` |
| `test(backend): fill correctness suites for lease, state machine, medical guard` | `tests/correctness/lease-math.test.ts`, `tests/correctness/asset-state-machine.test.ts`, `tests/correctness/medical-flag-guard.test.ts` |
| `docs(backend): document phase 1 engines and verification` | `backend/BACKEND_PROGRESS.md`, `backend/AUDIT.md` |
| `docs: add frontend integration guide` | `GUIDE.md` |
| `docs: add backend roadmap` | `backend/ROADMAP.md` |
| `feat(backend): add deterministic in-memory seed` | `data/seed.ts` |
| `feat(backend): add repository interface and in-memory implementation` | `data/repository.ts`, `data/inMemoryRepository.ts` |
| `feat(backend): add asset realtime publication to audit migration` | `migrations/audit.sql` |
| `test(backend): add backend test home and seed-parity suite` | `backend/package.json`, `backend/vitest.config.ts`, `backend/test/correctness/seed-parity.test.ts` |
| `docs(backend): document phase 2 data layer` | `backend/BACKEND_PROGRESS.md`, `backend/AUDIT.md` |

## 10. Risks and open items

- **Vitest `.js` → `.ts` resolution** — proven working by the Phase 0 smoke test;
  if a future suite hits resolution failures, stop and report rather than
  work around scope rules.
- **Verified-threshold divergence** — backend uses 14 days (assignment), MSW
  uses 30. Demo data may show fewer verified profiles; confirm with the team
  lead if it becomes visible in the demo.
- **Receipts multipart** — Phase 3 route work needs `multer` added to
  `backend/package.json` (backend-owned dependency, not a root config change).
- **Schema not yet applied** — the audit migration and schema exist as SQL; they
  are applied to the live Supabase project in Phase 6 with credentials.
- **Backend tests are backend-owned** — new suites live in `backend/test/`
  (`pnpm --filter @lastgen/backend test`); the shared `/tests/` directory is
  only touched for the three committed correctness suites. No further `/tests/`
  edits are expected.
- **`gh` CLI not authenticated** — the PR is opened manually by the team lead
  from the pushed `feat/backend` branch.
- **`.npmrc` is intentionally untracked** — the local `ignore-scripts=true`
  workaround for the Windows esbuild postinstall crash must never be committed
  (it would break the Render build).

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
- [ ] Happy-path routes (Phase 3)
- [ ] Payments + ALAT webhook (Phase 4)
- [ ] Portfolio + impact parity (Phase 5)
- [ ] Demo routes + README + deploy (Phase 6)
- [ ] Integration suite + final PR (Phase 7)