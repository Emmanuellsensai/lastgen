# Lastgen backend

Express + TypeScript API implementing the `docs/CONTRACT.md` surface plus the
payment/wallet extension in `docs/PAYMENT_EXTENSION.md`. The behaviour is ported
from the frontend MSW reference (`frontend/src/mocks/handlers.ts`). Demo mode
runs the full flow against a deterministic in-memory seed with no external
dependencies; live mode enforces Supabase bearer tokens and, when
`SUPABASE_URL`/`SUPABASE_SERVICE_KEY` are present, reads and writes a Supabase
database through the full `SupabaseRepository`.

## Quickstart

```bash
cp .env.example .env          # demo defaults work as-is
pnpm install                  # repo root
pnpm --filter @lastgen/backend dev
curl http://localhost:8080/health   # {"ok":true}
```

`DEMO_MODE=true` (default) skips authentication so every `/api` endpoint is
reachable without a token. Set `DEMO_MODE=false` to require a Supabase bearer
token; without one every `/api` route (except `/health` and the ALAT webhook)
returns `401 UNAUTHORIZED`. A `.env` file (if present) is loaded automatically;
running live mode without Supabase credentials fails fast with an actionable
message instead of silently serving the in-memory store.

## API surface

All routes are under `/api` and wrap responses in `{ ok, data }` or
`{ ok, error: { code, message } }`.

| Area                  | Endpoints                                                                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health                | `GET /health`                                                                                                                                                          |
| Businesses            | `POST /businesses`, `GET /businesses/:id`, `GET /businesses/:id/burn`                                                                                                  |
| Receipts              | `POST /businesses/:id/receipts` (multipart `file`, Gemini vision)                                                                                                      |
| Fuel                  | `POST /businesses/:id/fuel-logs`                                                                                                                                       |
| Systems               | `GET /systems`                                                                                                                                                         |
| Quotes                | `POST /businesses/:id/quote`, `GET /quotes/:id`                                                                                                                        |
| Credit                | `GET /credit/applications`, `GET /credit/applications/:id`, `POST .../approve`, `POST .../decline`                                                                     |
| Assets                | `GET /assets/:id`, `GET /assets/:id/meter`, `POST /assets/:id/suspend`, `POST /assets/:id/restore`                                                                     |
| Loans                 | `GET /loans/:id`, `GET /loans/:id/schedule`, `POST /loans/:id/pay`                                                                                                     |
| Payments              | `POST /loans/:id/pay` (slim `{ paymentId, platformTransactionReference, status }`), `GET /payments/:reference/status` (reconciles stale pendings against the provider) |
| Wallets               | `POST /wallets/create`, `GET /wallets/balance`, `GET /wallets/statement?limit&before`                                                                                  |
| Portfolio             | `GET /portfolio/stats`, `GET /portfolio/assets`, `POST /portfolio/export`                                                                                              |
| Impact                | `GET /businesses/:id/impact`, `GET /businesses/:id/wrapped`                                                                                                            |
| Webhooks              | `POST /webhooks/alat` (HMAC-SHA512 signed, replay-safe)                                                                                                                |
| Demo (demo mode only) | `POST /demo/reset`, `POST /demo/advance-time`, `POST /demo/miss-payment`                                                                                               |

The payment/wallet extension is fully specified in `docs/PAYMENT_EXTENSION.md`
(the frontend handoff). Full base shapes live in `docs/CONTRACT.md`. Unknown
routes return the contract 404 envelope; malformed JSON returns `400 VALIDATION`
and oversized bodies `413`.

## Test

```bash
pnpm --filter @lastgen/backend typecheck       # src only
pnpm --filter @lastgen/backend typecheck:test  # src + test
pnpm --filter @lastgen/backend test            # backend-owned suites
```

From the repo root: `pnpm format:check:backend`, `pnpm lint`, and
`pnpm test:all` (shared correctness + backend suites) cover the CI gate.

## Layout

```
src/routes/      one router per contract domain
src/services/    business logic, no Express types
src/adapters/    external providers behind an interface
src/data/        Repository seam + in-memory + Supabase implementations + seed
src/middleware/  auth, error handling
src/config/      typed env + frozen domain constants
src/lib/         response envelope, supabase client
migrations/      additive SQL migrations (audit, payments-v2)
test/contract/   the domain suites through Supertest
test/correctness/seed parity, webhook idempotency, impact parity, adapters
test/data/       SupabaseRepository mapping/stub suites
```

The `Repository` seam is async (Promise-returning) so the in-memory and Supabase
implementations share one honest interface; routes and tests `await` it.
`repositoryFor(env)` picks the store: Supabase when credentials are present,
otherwise the deterministic in-memory seed (demo mode only).

## Deploy

`render.yaml` (repo root) deploys the backend as a free-tier Render web service
(`rootDir: backend`, Node 22, `/health` health check). Secrets are provided via
Render env vars. Receipt image hosting is not yet wired (Supabase Storage);
`receiptUrl` is a placeholder path until then.
