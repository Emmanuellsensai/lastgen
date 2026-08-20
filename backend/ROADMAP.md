# Lastgen Backend Roadmap

**Project:** Lastgen — asset-finance for Nigerian informal businesses
**Branch:** `feat/backend` · **Document status:** living plan, updated every phase
**Last updated:** 19 August 2026

This is the canonical map for completing the Lastgen backend. It defines the
remaining phases, the deliverables, the verification gate, the commit
convention, and the documentation each phase must produce. It exists so the
work never drifts from the frozen contract and so every step is reviewable.

---

## 1. How the plan governs the work

### 1.1 Source-of-truth hierarchy

When behaviour is ambiguous, decisions resolve in this order (see
`backend/BACKEND_PROGRESS.md` §3):

1. `docs/CONTRACT.md` — frozen API contract and state machines
2. Backend types and constants (`backend/src/types`, `backend/src/config`)
3. `frontend/src/mocks/handlers.ts` — executable reference for API behaviour
4. `supabase/schema.sql` — persistence model, RLS, triggers
5. `frontend/src/lib/lease.ts` — financial math the backend must match
6. Tests (shared `/tests` + backend-owned `backend/test`)
7. The backend assignment brief from the team lead

The MSW handlers are the executable specification. The backend reproduces
their externally observable behaviour **without importing any frontend code**.

### 1.2 Scope rules

- Only `/backend` and the new `backend/test` tree are modified.
- Never modify `/frontend`, `/supabase/schema.sql`, `/docs/CONTRACT.md`, or
  root config files.
- Additive SQL migrations live in `backend/migrations` and are applied after
  `schema.sql`.
- `.npmrc` (root) is intentionally untracked — never commit it.
- Money is integer kobo, energy integer Wh, everywhere including demo routes.

### 1.3 Phase lifecycle (repeat for every phase)

1. **Update this roadmap** and `backend/BACKEND_PROGRESS.md` with the phase plan.
2. Implement the code.
3. Write the matching tests under `backend/test/`.
4. **Verification gate** — all must pass:
   - `pnpm --filter @lastgen/backend typecheck`
   - `pnpm lint` (root, repository-wide)
   - `pnpm exec vitest run tests/correctness` (shared suites, must stay green)
   - `pnpm --filter @lastgen/backend test` (backend-owned suites)
   - Boot smoke: `curl http://localhost:8080/health` → 200 `{"ok":true}`
5. Commit with conventional commits (one logical change each), push
   `feat/backend`.
6. Update the living docs (`BACKEND_PROGRESS.md`, `AUDIT.md`, `GUIDE.md`).
7. Signal the milestone to the team lead for the review checkpoints (§6).

No PR is opened until the team lead instructs it. The branch accumulates
phase commits; the PR is prepared at Phase 7.

### 1.4 Test strategy — backend-owned test home

The backend owns its verification. New suites live under `backend/test/`, so
the shared `/tests/` directory (owned by the frontend team) is not touched for
backend work — except the three correctness suites already committed with
explicit approval in Phase 1.

| Tree | Contents | When filled |
| --- | --- | --- |
| `backend/test/correctness/` | unit-level: seed-parity, webhook-idempotency, impact-parity, integration | per phase |
| `backend/test/contract/` | the 11 contract domain suites (businesses, fuel-logs, systems, quotes, credit, assets, loans, webhooks, portfolio, impact, demo) | per phase |

Contract suites hit `createApp(...)` through Supertest, never a live server.
Correctness suites import units directly, no HTTP. No test depends on live
Supabase or a live payment provider.

---

## 2. Status dashboard

| Phase | Title | Status |
| --- | --- | --- |
| 0 | Foundation hardening | ✅ complete (7 commits) |
| 1 | Domain engines | ✅ complete (7 commits) |
| 2 | Data layer + deterministic seed | ✅ complete (6 commits) |
| 3 | Happy-path routes | ✅ complete (7 commits) |
| 4 | Payments + ALAT webhook | ✅ complete (3 commits) |
| 5 | Portfolio + impact parity | ✅ complete (2 commits) |
| 6 | Demo routes + README + Supabase/deploy | ⬜ pending |
| 7 | Integration + final docs + PR prep | ⬜ pending |

---

## 3. Phase 2 — Data layer + deterministic seed

**Goal.** Give the API a real, deterministic dataset. A typed `Repository`
seam isolates routes from storage; the in-memory implementation ports
`frontend/src/mocks/seed.ts` byte-for-byte so demo data matches the MSW mock
exactly.

**Scope.**
- `backend/src/data/repository.ts` — typed `Repository` interface: all entity
  access, state-changing operations, the demo clock, and an atomic
  `payLoan` (loan + asset + payment + audit committed together).
- `backend/src/data/seed.ts` — deterministic seed port: mulberry32 PRNG seeded
  fresh per build (deterministic reset), anchors, 8 systems, 6 businesses,
  fuel logs, burn profiles, quotes, credit files, 3 installed assets with 90
  days of readings each, and the 520-asset portfolio.
- `backend/src/data/inMemoryRepository.ts` — mutable in-memory implementation
  driving the real state machines (`assetStateMachine`, `loanStateMachine`)
  for suspend/restore/pay/miss/advance operations.
- `backend/migrations/audit.sql` — add `assets` to the `supabase_realtime`
  publication (idempotent, additive).
- `backend/test/correctness/seed-parity.test.ts` — asserts the backend seed
  reproduces the captured frontend first-build output (counts, status
  distributions, exact demo figures, portfolio row 0, first/last readings)
  and that rebuilds are deterministic.

**Behaviour source.** `frontend/src/mocks/seed.ts` (693 lines) and the seed
values captured from its first build on 2026-08-19.

**Commit plan.**
1. `docs: add backend roadmap`
2. `feat(backend): add deterministic in-memory seed`
3. `feat(backend): add repository interface and in-memory implementation`
4. `feat(backend): add asset realtime publication to audit migration`
5. `test(backend): add backend test home and seed-parity suite`
6. `docs(backend): document phase 2 data layer`

**Docs produced.** `ROADMAP.md` (this file), `BACKEND_PROGRESS.md` §4/§6/§8,
`AUDIT.md` §15.

---

## 4. Phases 3–7 (map)

### Phase 3 — Happy-path routes (complete)
- **Goal:** every contract route except payments returns real data through the
  repository; no MSW-only stubs.
- **Delivered:** `src/routes/businessRoutes.ts` (create/get/receipts/fuel-logs/
  burn), `systemRoutes.ts`, `quoteRoutes.ts` (create/get), `creditRoutes.ts`
  (applications/get/approve/decline), `assetRoutes.ts` (get/meter/suspend/
  restore), `loanRoutes.ts` (get/schedule), `routes/index.ts` (mount + contract
  404), `routes/helpers.ts` (async handler + single-file multer). Routers wired
  into `createApp(env, logger, repository)`; `multer` added for receipts.
  `makeRequireAuth(env)` skips auth in demo mode and enforces Supabase bearer
  tokens in production, failing closed on any credential error.
- **Tests:** 7 backend contract suites (businesses, fuel-logs, systems, quotes,
  credit, assets, loans) — 47 assertions over `createApp` via Supertest.
- **Reference:** `handlers.ts` lines 168–522.
- **Verification:** typecheck ✅, lint ✅, shared correctness 33/33 ✅, backend
  suite 62/62 ✅, demo boot smoke (all `/api` happy-path 200) ✅, live boot
  smoke (401 contract error, no hang) ✅.

### Phase 4 — Payments + ALAT webhook (complete)
- **Goal:** payment adapters completed and the ALAT webhook idempotent on
  `transactionReference` (review gate #4).
- **Delivered:** `src/adapters/paymentAdapter.ts` (full seam),
  `simulatedAdapter.ts` (SIM- references, accepts any notification),
  `alatAdapter.ts` (HMAC-SHA512 signature verification over the raw body,
  constant-time, demo-tolerant), `factory.ts` `paymentAdapterFor(env)`;
  `src/routes/paymentRoutes.ts` (`POST /loans/:id/pay`),
  `src/routes/webhookRoutes.ts` (`POST /webhooks/alat`, mounted before the auth
  boundary, replay-safe, signature-checked). `express.json` captures the raw
  body (`req.rawBody`) for signing.
- **Tests:** `backend/test/correctness/webhook-idempotency.test.ts` (5),
  `backend/test/correctness/payment-adapter.test.ts` (7),
  `backend/test/contract/webhooks.test.ts` (4),
  `backend/test/contract/payments.test.ts` (5).
- **Reference:** `handlers.ts` lines 497–522 (pay) and 665–688 (webhook).
- **Verification:** typecheck ✅, lint ✅, shared correctness 33/33 ✅, backend
  suite 83/83 ✅, demo boot smoke (pay 200, webhook 200 + replay-safe + 400 on
  missing reference) ✅.
- **Milestone:** critical review ping to team lead (emitted).

### Phase 5 — Portfolio + impact parity (complete)
- **Goal:** portfolio stats/assets/CSV export and `/impact` + `/wrapped` fed
  from the single `impactEngine`.
- **Delivered:** `Repository.impactFor` (burn + asset loan + readings through
  `computeImpact`); `src/routes/portfolioRoutes.ts` (`GET /portfolio/stats`,
  `GET /portfolio/assets` with status/city filters + page pagination,
  `POST /portfolio/export`); `src/routes/impactRoutes.ts`
  (`GET /businesses/:id/impact` with period query, `GET /businesses/:id/wrapped`
  with year query), both mounted after the auth boundary.
- **Tests:** `backend/test/correctness/impact-parity.test.ts` (6, reference
  figures captured from the frontend build), `backend/test/contract/portfolio.test.ts`
  (5), `backend/test/contract/impact.test.ts` (6).
- **Reference:** `handlers.ts` lines 525–604.
- **Verification:** typecheck ✅, lint ✅, shared correctness 33/33 ✅, backend
  suite 100/100 ✅, demo boot smoke (stats, assets filter, export, impact,
  wrapped, 404) ✅.
- **Milestone:** impact parity gate demonstrated.

### Phase 6 — Demo routes + README + Supabase/deploy
- **Goal:** demo controls drive the real state machine; endpoint docs
  complete; Supabase swap and Render verification.
- **Files:** `src/routes/demo.ts`, `src/data/supabaseRepository.ts`, backend
  `README.md`.
- **Tests:** backend contract suite `demo`.
- **Needs:** `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` from the team lead to
  apply `schema.sql` + `migrations/audit.sql` and verify live.

### Phase 7 — Integration + final docs + PR prep
- **Goal:** full happy-path journey through `createApp` + in-memory repo; every
  suite green; the four review gates demonstrated.
- **Files:** `backend/test/correctness/integration.test.ts`.
- **End state:** branch pushed, PR-ready. **No PR opened until instructed.**

---

## 5. Cross-cutting invariants

- **Asset states:** ACTIVE → GRACE → SUSPENDED → ACTIVE, plus → OWNED when the
  loan balance clears. The single `assetStateMachine.transition` owns every
  status change; no route mutates statuses directly.
- **Medical flag:** bank `SUSPEND` throws `MEDICAL_FLAG` (409); automated paths
  keep a flagged business in GRACE. Enforced inside the state machine on every
  suspension path.
- **Payments:** one atomic path (`payLoan`); a payment updates loan, asset,
  next unpaid installment, payment ledger, and audit history together.
- **Quote validity:** a quote is only produced when `monthlySavingsKobo > 0`,
  else `QUOTE_NOT_VIABLE` (422).
- **Idempotency:** webhooks replay-safe on `transactionReference`.

---

## 6. Review checkpoints (team-lead gates)

| Phase | Checkpoint |
| --- | --- |
| 1 | ✅ asset state machine + medical guard live and test-covered |
| 4 | Critical review: adapters, atomic pay path, webhook idempotency |
| 7 | Ready: four blocking checks demonstrably pass (no float money math, webhook idempotent, medical guard enforced incl. demo, payment updates loan+asset atomically) |

---

## 7. Decision register (pointer)

Full register with rationales: `backend/BACKEND_PROGRESS.md` §7. Locked entries
relevant to this roadmap: float intermediates + single `Math.round` at kobo;
audit migration owned by backend; 14-day verified-burn threshold; one branch /
one PR; demo auth skipped in demo mode; in-memory repository first with
Supabase at Phase 6; realtime via the backend-owned migration; app composed
through `createApp(env, logger, repository)`.