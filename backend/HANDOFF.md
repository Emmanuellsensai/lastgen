# Lastgen Backend — Admin Sprint Handoff

**Date:** 2026-08-25
**Branch:** `feat/backend` @ `b545b72`
**Scope:** Phases 8–11 (bank identity, KYC lifecycle, guarded admin desk, docs polish)
**Audience:** Frontend developers wiring the sprint UI to the live API, reviewers of the
upstream PR, and any developer joining the repo.

This document is the single entry point for consuming everything that shipped in this
sprint. Deeper records live in the companion docs referenced throughout — see
[§8 Where to find everything](#8-where-to-find-everything).

---

## 1. Executive summary

The frontend admin sprint (`frontend/buildSummary.md`) defined 11 new endpoints and a
role model. All 11 are implemented in both repository backends (in-memory demo and
Supabase live), pinned by 34 new contract tests. Nothing frozen was modified: no
changes to `frontend/**`, `docs/CONTRACT.md`, or `supabase/schema.sql` — all schema
work is an additive migration.

| Phase | Delivered | Commits |
| --- | --- | --- |
| 8 | Role-aware authz (`makeRequireRole`), bank identities (register/login), `rbac-kyc.sql` migration | 2026-08-24 (6) |
| 9 | KYC get/submit with multipart uploads, NIN provider seam, document storage | 2026-08-24 (7) |
| 10 | Guarded `/admin/*` surface: users, KYC review, power control, orders, manual payment approval | 2026-08-25 (4) |
| 11 | Env vars documented, README endpoint table extended, audit record | 2026-08-25 (2) |

Verification gate at HEAD: TypeScript strict ✓ · ESLint 0 errors ✓ · **223/223 tests
across 25 suites** ✓ · boot smoke ✓ (Phase 8).

---

## 2. Endpoint contract

All endpoints live under the `/api` prefix and use the standard envelope
`{ ok: true, data }` / `{ ok: false, error: { code, message } }`. Money is integer
kobo everywhere.

### Bank identity (public — mounted before the auth boundary)

| Method & path | Request | Response | Errors | Pinned by |
| --- | --- | --- | --- | --- |
| `POST /api/auth/bank/register` | `{ bankName, bankId, password, confirmPassword }` | `{ user: { id, bankId, bankName }, role: 'bank', accessToken }` · **201** | `VALIDATION` 400 (missing fields / password mismatch / duplicate bankId) | `test/contract/bank-auth.test.ts` |
| `POST /api/auth/bank/login` | `{ bankId, password }` | same shape as register · **200** | `UNAUTHORIZED` 401 (single shape for unknown id *and* wrong password) | `test/contract/bank-auth.test.ts` |

### KYC (owner-facing; live mode requires owning the business)

| Method & path | Request | Response | Errors | Pinned by |
| --- | --- | --- | --- | --- |
| `GET /api/businesses/:id/kyc` | — | `KycRecord` — synthesized as `status: 'unverified'` before the first submission | `NOT_FOUND` 404, `FORBIDDEN` 403 (live, non-owner) | `test/contract/kyc.test.ts` |
| `POST /api/businesses/:id/kyc/submit` | `multipart/form-data`: `ninNumber` (11 digits), `bankSlip` (image/PDF ≤5 MB), `selfie` (image ≤5 MB) | `KycRecord` with `status: 'pending'`, document URLs, `ninVerified` · **201** | `VALIDATION` 400 (documents/mime/NIN), `INVALID_TRANSITION` 409 (already approved) | `test/contract/kyc.test.ts` |

### Admin desk (every route requires the `bank` or `admin` role)

| Method & path | Request | Response | Errors | Pinned by |
| --- | --- | --- | --- | --- |
| `GET /api/admin/users` | — | `ListEnvelope<AdminUser>` — every business joined with asset/loan/KYC state (`kycStatus` defaults `'unverified'`) | — | `test/contract/admin.test.ts` |
| `GET /api/admin/kyc?status=` | optional `unverified\|pending\|approved\|rejected` | `ListEnvelope<KycRecord & { businessName }>` | `VALIDATION` 400 (bad filter) | `test/contract/admin.test.ts` |
| `POST /api/admin/kyc/:id/approve` | — | `{ id, status: 'approved', reviewedAt }` | `NOT_FOUND` 404, `INVALID_TRANSITION` 409 (non-pending) | `test/contract/admin.test.ts` |
| `POST /api/admin/kyc/:id/reject` | `{ reason }` (required) | `{ id, status: 'rejected', rejectionReason, reviewedAt }` | `VALIDATION` 400 (empty reason), `NOT_FOUND` 404, `INVALID_TRANSITION` 409 | `test/contract/admin.test.ts` |
| `POST /api/admin/assets/:id/toggle-power` | — | `{ id, status: AssetStatus }` — suspends `ACTIVE`, restores suspended | `NOT_FOUND` 404, `MEDICAL_FLAG` 409, `INVALID_TRANSITION` 409 (owned asset) | `test/contract/admin.test.ts` |
| `GET /api/admin/orders?status=` | optional `ACTIVE\|DELINQUENT` | `ListEnvelope<AdminOrder>` — non-closed loans fleet-wide | `VALIDATION` 400 (bad filter; `CLOSED` is not a work item) | `test/contract/admin.test.ts` |
| `POST /api/admin/loans/:id/approve-payment` | — | `{ paymentId, status: 'SUCCESS' }` — settles one installment atomically | `NOT_FOUND` 404, `INVALID_TRANSITION` 409 (closed loan) | `test/contract/admin.test.ts` |

**Hardening beyond the MSW mock.** The mocks accepted anything; the live API enforces
the state machines. Notable differences FE should code against:

- Owned assets refuse power control (`409 INVALID_TRANSITION`).
- KYC review only transitions `pending` records — re-review answers 409.
- Rejecting without a reason is a 400, not silently accepted.
- Manual payment approval runs the *same* atomic settlement primitive as wallet pay
  and webhook settle — balances can never drift.

---

## 3. Auth & RBAC model

Two modes, selected by `DEMO_MODE`:

| Aspect | Demo mode (`DEMO_MODE=true`) | Live mode |
| --- | --- | --- |
| Owner identity | `requireAuth` injects the demo owner; no JWT needed | Supabase JWT verified per request (fail-closed `UNAUTHORIZED`) |
| Role source | `requireRole` permits all callers | Server-only `app_metadata.role` claim read from the auth user |
| `/admin/*` access | Always allowed (demo convenience) | Only claims `role = 'bank'` or `'admin'`; everyone else gets `FORBIDDEN` 403 |
| Bank credentials | Token format `tok_bank_<bankId>` | Real GoTrue accounts |

Bank registration provisions a Supabase Auth user under the synthesized email
`<bankId>@banks.lastgen.local` (GoTrue authenticates by email; `bankId` stays the only
public credential) plus a mirror row in the `bank_users` table. Login failures return
one `UNAUTHORIZED` shape so callers cannot probe which half of the credential pair was
wrong.

### The `FORBIDDEN` (403) code — action required

Role denials on `/admin/*` (and ownership violations on business-scoped routes) answer

```json
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "…" } }
```

`FORBIDDEN` is **new relative to `docs/CONTRACT.md`**: returning 401 would misstate an
authenticated caller, but the contract's error table has not been amended yet because
that file is outside the backend's change scope. Until the docs owner lands the
amendment, treat this section as normative for FE error handling:

```ts
if (err.code === 'UNAUTHORIZED') redirect('/login');        // not signed in / expired token
if (err.code === 'FORBIDDEN')    showNoAccess();            // signed in, lacking role/ownership
```

---

## 4. KYC lifecycle

```
            submit (multipart, NIN verified)
 unverified ─────────────────────────────────► pending ──► approved   (terminal, immutable)
                                                 │                        ▲
                                                 │ reject(reason)         │ resubmit after
                                                 ▼                        │ rejection restarts
                                              rejected ───────────────────┘
```

- **Storage.** Live mode stores documents in the private `kyc-docs` bucket and returns
  short-lived signed URLs; demo mode returns base64 data URLs. The bucket is created by
  the migration below.
- **NIN verification.** Provider seam (`src/services/ninVerification.ts`):
  `NIN_PROVIDER=simulated` passes after an 11-digit format check;
  `NIN_PROVIDER=nimc` fails closed with `503 UNAVAILABLE` until real NIMC credentials
  are wired — a misconfigured deployment can never silently approve identities.
- **Immutability.** Approved records cannot be resubmitted (409). A rejected record may
  resubmit, which restarts the review cycle.
- **Notifications.** Approve/reject broadcasts an in-app realtime event (see §5). Email
  delivery is explicitly out of scope for this sprint.

---

## 5. Realtime events

Both are best-effort broadcast messages — a realtime outage never fails the HTTP
operation that produced them. Subscribe via Supabase Realtime channels.

| Channel | Event | Payload | Emitted by |
| --- | --- | --- | --- |
| `payments` | `status_changed` | `{ paymentId, from, to, reference }` | Payment settlement/failure/expiry (pre-existing, Phase 6) |
| `notifications` | `kyc_reviewed` | `{ kycId, businessId, status }` | Admin KYC approve/reject (**new**, Phase 10) |

---

## 6. Environment variables (new in this sprint)

Full table in [`README.md` §4](./README.md#4-configuration--environment-variables).

| Variable | Default | Purpose |
| --- | --- | --- |
| `NIN_PROVIDER` | `simulated` | `simulated` = format check; `nimc` = fail-closed until credentials exist |
| `KYC_BUCKET` | `kyc-docs` | Private storage bucket for submitted KYC documents |

---

## 7. Deployment notes (live mode)

1. Apply `backend/migrations/rbac-kyc.sql` — additive and idempotent: creates
   `bank_users`, `kyc_records` (+ unique index on `business_id`, RLS policies) and the
   private `kyc-docs` bucket. Safe to re-run.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DEMO_MODE=false`.
3. Register the first credit-desk operator via `POST /api/auth/bank/register`.

Render deployment verification remains pending — it requires live Supabase + ALAT
credentials (tracked in `BACKEND_PROGRESS.md` §4).

---

## 8. Where to find everything

### Backend documentation

| Document | Contents |
| --- | --- |
| [`README.md`](./README.md) | Setup, full endpoint reference table, env configuration, domain-engine overview |
| [`ROADMAP.md`](./ROADMAP.md) | Phase plan and status dashboard; §3 details Phases 8–11 design decisions |
| [`BACKEND_PROGRESS.md`](./BACKEND_PROGRESS.md) | Deep per-phase build log (§6.13–6.15 cover this sprint), decision register with rationale |
| [`AUDIT.md`](./AUDIT.md) | §22 records Phases 8–10 including the hardening deltas vs the MSW mock |
| [`HANDOFF.md`](./HANDOFF.md) | This document |
| `migrations/rbac-kyc.sql` | Additive schema for this sprint |

### Backend source (this sprint's additions in bold)

| Area | Path |
| --- | --- |
| Role middleware | `backend/src/middleware/auth.ts` — `makeRequireAuth`, **`makeRequireRole`** |
| Routes | **`routes/bankAuthRoutes.ts`**, **`routes/kycRoutes.ts`**, **`routes/adminRoutes.ts`**, mount order in `routes/index.ts` |
| Services | **`services/ninVerification.ts`**, **`services/kycStorage.ts`** |
| Repository seam | `data/repository.ts` — **`registerBank`/`authenticateBank`, `kycRecordFor`/`submitKyc`, `listAdminUsers`, `listKycSubmissions`, `reviewKyc`, `listAdminOrders`**; implementations in `data/inMemoryRepository.ts` + `data/supabaseRepository.ts` |
| Types | `types/api.ts` — backend-owned mirror (never imports from `/frontend`) |
| Tests | **`test/contract/bank-auth.test.ts`** (10), **`test/contract/kyc.test.ts`** (9), **`test/contract/admin.test.ts`** (15); harness in `test/helpers.ts` |

### Frontend reference points (read-only — do not modify from backend work)

| File | Relevance |
| --- | --- |
| `frontend/buildSummary.md` | Sprint spec: features built + "Backend endpoints required" tables |
| `frontend/src/lib/api.ts` L217–247 | `api.kyc`, `api.bankAuth`, `api.admin` namespaces — call shapes this API serves |
| `frontend/src/types/api.ts` | `KycStatus`/`KycRecord` (L39+), `AdminUser` (L347), `AdminOrder` (L360), `BankRegisterBody`/`BankLoginBody`/`BankAuthResult` (L384+) |
| `frontend/src/mocks/handlers.ts` L844–1004 | MSW behavior this backend mirrors (and hardens — see §2 note) |

### Commit history (Phases 8–11)

```
b545b72 2026-08-25 docs(backend): record phase 11 and close the admin sprint
7c41c0f 2026-08-25 docs(backend): document phase 8-11 env vars and endpoints
f11a75d 2026-08-25 docs(backend): record phase 10
e1226ce 2026-08-25 test(backend): cover admin contract incl. frozen invariants
edf1544 2026-08-25 feat(backend): add guarded /admin surface routes
3188d0f 2026-08-25 feat(backend): add admin projections and kyc review to the repository seam
700f24f 2026-08-24 docs(backend): record phase 9 in progress and roadmap
1f30818 2026-08-24 test(backend): cover kyc contract
bb6da83 2026-08-24 fix(backend): resolve kyc storage client lazily per upload
df119d0 2026-08-24 feat(backend): implement business kyc get/submit endpoints
1476b2a 2026-08-24 feat(backend): add kyc storage service
e90bbf0 2026-08-24 feat(backend): add nin verification service seam
cd3b2ad 2026-08-24 feat(backend): add multipart upload helper for kyc documents
25ea8bf 2026-08-24 docs(backend): record phase 8
cd4cce7 2026-08-24 test(backend): cover bank-auth contract incl. live-mount guard
a6e8d94 2026-08-24 feat(backend): add additive rbac-kyc migration
1e6f318 2026-08-24 feat(backend): add public /auth/bank/register and /auth/bank/login routes
5f906e2 2026-08-24 feat(backend): add bank_users repository methods
768751b 2026-08-24 feat(backend): add role-aware auth middleware and bank identity types
3818b82 2026-08-24 docs(backend): plan phases 8-11
```

---

## 9. Known gaps & next steps

| Item | Owner | Note |
| --- | --- | --- |
| Amend `docs/CONTRACT.md` with `FORBIDDEN` 403 | Docs owner | See §3 — FE error handling depends on it being recorded |
| Wire real NIMC credentials behind `NIN_PROVIDER=nimc` | Backend (follow-up) | Seam exists; provider currently fails closed by design |
| Render deployment verification | DevOps/backend | Needs live Supabase + ALAT credentials |
| Email notifications for KYC outcomes | Product decision | In-app realtime event ships now (§5); email was optional per spec |
