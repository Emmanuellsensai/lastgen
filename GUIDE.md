# Lastgen Frontend ↔ Backend Integration Guide

This guide tells the frontend team how to run, point, and verify the Lastgen
backend on the `feat/backend` branch. The API contract in `docs/CONTRACT.md` is
frozen and is the single source of truth — the backend mirrors it exactly.

## 1. Run the backend

Prerequisites: Node 22+, `pnpm`. On Windows Node 24, install with
`pnpm install --ignore-scripts` (the esbuild postinstall crashes; `.npmrc` is
intentionally untracked and must never be committed).

```bash
cd backend
pnpm install --ignore-scripts
pnpm dev            # tsx watch src/index.ts → http://localhost:8080
```

Check it is alive:

```bash
curl http://localhost:8080/health
# {"ok":true}
```

The backend boots in demo mode without any credentials. Supabase, ALAT and
Gemini keys are only needed when the corresponding feature is exercised live.

## 2. Point the frontend at the live backend

`frontend/src/lib/api.ts` reads two env values. Set them in `frontend/.env`
(the file lives outside `/backend`; it is the frontend team's to own):

```dotenv
VITE_API_MODE=live
VITE_API_URL=http://localhost:8080
```

- `VITE_API_MODE=mock` (default) → MSW handlers serve the demo.
- `VITE_API_MODE=live` → every `api.` call hits the backend.
- `setAuthToken(token)` is a no-op in demo mode (the backend skips `requireAuth`
  when `DEMO_MODE=true`) and attaches `Authorization: Bearer <token>` in
  production.

The demo flow is `npm run dev` in the root (or the frontend workspace), then
`VITE_API_MODE=live` and visit `http://localhost:5173`.

## 3. Endpoint ↔ `api.ts` mapping

Every method in `frontend/src/lib/api.ts` corresponds to a backend route:

| `api.` method | HTTP + path |
| --- | --- |
| `businesses.create(body)` | `POST /api/businesses` |
| `businesses.get(id)` | `GET /api/businesses/:id` |
| `businesses.uploadReceipt(id, file)` | `POST /api/businesses/:id/receipts` (multipart) |
| `businesses.addFuelLog(id, body)` | `POST /api/businesses/:id/fuel-logs` |
| `businesses.burn(id)` | `GET /api/businesses/:id/burn` |
| `businesses.impact(id, period)` | `GET /api/businesses/:id/impact?period=month|year|all` |
| `businesses.wrapped(id, year)` | `GET /api/businesses/:id/wrapped?year=` |
| `businesses.quote(id, body)` | `POST /api/businesses/:id/quote` |
| `systems.list(query)` | `GET /api/systems` |
| `quotes.get(id)` | `GET /api/quotes/:id` |
| `credit.applications(query)` | `GET /api/credit/applications` |
| `credit.application(id)` | `GET /api/credit/applications/:id` |
| `credit.approve(id)` | `POST /api/credit/applications/:id/approve` |
| `credit.decline(id, body)` | `POST /api/credit/applications/:id/decline` |
| `assets.get(id)` | `GET /api/assets/:id` |
| `assets.meter(id, query)` | `GET /api/assets/:id/meter` |
| `assets.suspend(id, body)` | `POST /api/assets/:id/suspend` |
| `assets.restore(id)` | `POST /api/assets/:id/restore` |
| `loans.get(id)` | `GET /api/loans/:id` |
| `loans.pay(id, body)` | `POST /api/loans/:id/pay` |
| `loans.schedule(id)` | `GET /api/loans/:id/schedule` |
| `portfolio.stats()` | `GET /api/portfolio/stats` |
| `portfolio.assets(query)` | `GET /api/portfolio/assets` |
| `portfolio.exportCsv()` | `POST /api/portfolio/export` |
| `demo.reset()` | `POST /api/demo/reset` |
| `demo.advanceTime(body)` | `POST /api/demo/advance-time` |
| `demo.missPayment(body)` | `POST /api/demo/miss-payment` |

All responses use the `{ ok: true, data }` / `{ ok: false, error: { code,
message } }` envelope from the contract. Error codes are stable — the UI can
switch on `error.code`.

## 4. Demo behaviour (in-memory)

In demo mode the backend serves a deterministic in-memory dataset seeded from
the same spec as the frontend MSW mock (`mulberry32(20260819)`, anchor
2026-08-19):

- 8 solar systems and 6 named businesses (Gwarinpa Value Mart carries the
  medical flag).
- 3 approved / 3 pending credit files; 3 installed assets (ACTIVE / GRACE /
  ACTIVE) with 540 meter readings each.
- A 520-asset portfolio (ACTIVE 317, OWNED 140, GRACE 42, SUSPENDED 21).
- Deterministic deep-link IDs the UI already uses:
  `biz_adaeze_frozen`, `ast_biz_adaeze_frozen`, `q_biz_adaeze_frozen`,
  `loan_biz_adaeze_frozen`.

`demo.advanceTime` and `demo.missPayment` drive the **real** asset state
machine, so asset statuses actually change and the impact numbers respond.
`demo.reset` restores the seed.

## 5. Asset states and the medical-flag rule

Frozen transitions: `ACTIVE → GRACE → SUSPENDED → ACTIVE`, and `→ OWNED` when
the loan balance clears. A payment restores GRACE/SUSPENDED assets.

A business with `medicalFlag = true` can never be suspended:

- The bank-facing `POST /assets/:id/suspend` returns `409 { code: "MEDICAL_FLAG" }`.
- Automated paths (a second missed window, the advance-time overdue sweep) keep
  the asset in GRACE instead of suspending it.

## 6. Realtime (Phase 6)

The backend will add `assets` to the Supabase Realtime publication so the
frontend can subscribe:

```ts
const channel = supabase.channel('asset-status')
  .on('postgres_changes', { event: 'UPDATE', table: 'assets' }, (payload) => {
    if (payload.new.status !== payload.old.status) {
      // status_changed broadcast for /asset/:id and the portfolio board
    }
  })
  .subscribe();
```

Only live in Supabase mode; demo mode polls after demo actions.

## 7. Verification checklist (what to check on the PR)

1. **No float money math** — money is integer kobo everywhere in the API and
   persistence; rounding happens once via `Math.round`.
2. **ALAT webhook idempotent** on `transactionReference` (Phase 4).
3. **Medical-flag guard** enforced inside the single asset state-machine
   function, including demo routes.
4. **Payment updates loan + asset in one transaction.**

Fast sanity check once running (the domain routes land in Phases 3–6; until
then only the root health probe responds):

```bash
curl -s http://localhost:8080/health          # {"ok":true}
```

Phase 3 onward:

```bash
curl -s http://localhost:8080/api/systems | head -c 200
curl -s http://localhost:8080/api/portfolio/stats
curl -s http://localhost:8080/api/businesses/biz_gwarinpa_mart/burn
```

## 8. Troubleshooting

- **`.js` extension errors** — local TypeScript imports use the NodeNext `.js`
  convention; a missing extension is a compile error, not a runtime bug.
- **esbuild/msw postinstall crash on Windows Node 24** — `pnpm install
  --ignore-scripts`; do not commit a workaround `.npmrc`.
- **Health OK but pages show mock data** — `VITE_API_MODE` is still `mock`;
  check `frontend/.env`.
- **Missing receipts parsing** — the backend needs `multer` (Phase 3) for the
  multipart upload; until then `uploadReceipt` returns 501, everything else works.