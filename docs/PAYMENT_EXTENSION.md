# Payment Extension — Frontend Handoff

This document is the authoritative spec for the **payment lifecycle + business
wallet** extension that the backend landed on `feat/backend`. It is deliberately
a **separate** document from `docs/CONTRACT.md`, which stays frozen. The frontend
agent should implement against this spec and the live backend endpoints below —
not against `docs/CONTRACT.md`.

## 1. The spec (verbatim from the team lead)

### Wallets

```
POST /wallets/create  { businessId, nin, firstName, lastName, phone } -> { wallet }
GET  /wallets/balance                                           -> Wallet
GET  /wallets/statement  ?limit & before                        -> { items }
```

### Payments

```
POST /loans/:id/pay  { source: 'wallet' | 'bank_account', amountKobo? } -> { paymentId, platformTransactionReference, status }
GET  /payments/:reference/status                                        -> { status, payment? }
```

### Types

- `Wallet` — `{ id, businessId, accountNumber, bankCode, currency, balanceKobo, createdAt }`
- `WalletTransaction` — `{ id, walletId, ts, direction: 'IN' | 'OUT', amountKobo, description, reference, category }`
- `PaymentStatus` — `'pending_authorisation' | 'authorised' | 'SUCCESS' | 'FAILED' | 'EXPIRED'`
- `Payment` gains `source: 'ALAT' | 'SIMULATED' | 'WALLET'`, `status`, `platformTransactionReference?`

### Realtime

- Channel `payments` → event `payment.status_changed` — `{ paymentId, from, to, reference }`

### Authz invariants (non-negotiable)

1. `/wallets/*` resolves the business from `req.user` — never from the body. No cross-user access.
2. `source='wallet'` MUST return `402` when `wallet.balanceKobo < amountKobo`.
3. Settlement — whether via the ALAT webhook or a direct wallet debit — MUST update the
   **loan and the asset in the same transaction** as the debit/credit.

## 2. Backend decisions (as built)

| Question                    | Decision                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real ALAT or mock?          | Real ALAT adapter implemented behind the seam (`PAYMENT_ADAPTER=alat`), **mock-tested** — no sandbox credentials are available. The demo/tests run the simulated adapter.                                     |
| `docs/CONTRACT.md` changes? | None. This spec is the single source for the extension.                                                                                                                                                       |
| What is the wallet?         | A business cash wallet (`bankCode 035`, `currency NGN`). **Demo mode pre-funds NGN 50,000 (5,000,000 kobo) on create.** Live starts at 0 and is funded externally; there is no top-up endpoint.               |
| Supabase?                   | Wired end-to-end: `payments-v2.sql` migration (status column, wallets, wallet_transactions, realtime publication) + a full `SupabaseRepository`. Live deployments need `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`. |
| Pay response shape          | Slim: `{ paymentId, platformTransactionReference, status }` — no loan internals.                                                                                                                              |
| Status lookup key           | `GET /payments/:reference/status` accepts the transaction **reference** _or_ the **paymentId** (the pay response only returns the id, so both work).                                                          |

## 3. Lifecycle contract

**`source='bank_account'`** — the ALAT consent dance:

1. `POST /loans/:id/pay` books a payment as `pending_authorisation`, asks the
   adapter to collect, and responds `{ paymentId, platformTransactionReference, status }`.
2. The customer approves in the ALAT Authenticator. ALAT notifies the backend
   webhook, which settles the booked payment by reference (replay-safe).
3. The frontend polls `GET /payments/:reference/status` every ~2s and shows the
   "waiting for approval" state until the status flips to `SUCCESS`.
4. A still-pending payment is reconciled against ALAT on each poll (a missed
   webhook is caught). Provider `FAILED`/`EXPIRED` states map to `FAILED`/`EXPIRED`.

**`source='wallet'`** — instant direct debit:

1. `POST /loans/:id/pay` debits the wallet (`402 PAYMENT_REQUIRED` when the
   balance is short) and settles the loan + asset in the same transaction.
2. Response is immediately `SUCCESS` with `platformTransactionReference: null`.

## 4. Demo-mode notes (important for the frontend)

- **No realtime in demo mode.** The demo runs the in-memory repository and the
  simulated adapter — there is no Supabase Realtime to subscribe to. The
  frontend must **fall back to polling** `GET /payments/:reference/status` and
  re-fetching `GET /assets/:id` (or the loan) to reflect settlement. The
  `payment.status_changed` subscription is only live on a Supabase deployment.
- The simulated adapter auto-settles after `SETTLE_AFTER_MS` (demo default
  3000 ms) so the pending → SUCCESS transition is visible without a real ALAT
  account. Set `SETTLE_AFTER_MS=0` for instant settlement (tests do this).
- Wallet create in demo mode returns a wallet pre-funded with
  `balanceKobo: 5_000_000` and a `wlt_*` id; a second create for the same
  business is idempotent (same account number).

## 5. Example flows

```
# wallet onboarding + balance
POST /api/wallets/create
{ "businessId":"biz_adaeze_frozen", "nin":"12345678901",
  "firstName":"Adaeze","lastName":"Okonkwo","phone":"+2348012345678" }
-> { "ok":true, "data": { "wallet": { "id":"wlt_00001", "businessId":"biz_adaeze_frozen",
     "accountNumber":"2010000001","bankCode":"035","balanceKobo":5000000,
     "currency":"NGN","createdAt":"2026-08-19T09:00:00.000Z" } } }

# bank payment (pending until simulated consent settles after ~3s)
POST /api/loans/loan_biz_adaeze_frozen/pay
{ "source":"bank_account", "amountKobo":5000000 }
-> { "ok":true, "data": { "paymentId":"pay_00003",
     "platformTransactionReference":"SIM-PLT-...", "status":"pending_authorisation" } }

GET /api/payments/pay_00003/status
-> { "ok":true, "data": { "status":"SUCCESS", "payment": { ... } } }

# wallet payment (instant, debits the balance)
POST /api/loans/loan_biz_adaeze_frozen/pay
{ "source":"wallet", "amountKobo":2000000 }
-> { "ok":true, "data": { "paymentId":"pay_00005", "platformTransactionReference":null, "status":"SUCCESS" } }

GET /api/wallets/statement
-> { "ok":true, "data": { "items": [ { "id":"wtx_00004", ... "direction":"OUT",
     "amountKobo":2000000, "category":"loan_payment", ... } ] } }
```

## 6. Environment (backend)

```dotenv
# simulated | alat
PAYMENT_ADAPTER=simulated
# ALAT gateway (only read when PAYMENT_ADAPTER=alat)
ALAT_BASE_URL=
ALAT_CHANNEL_ID=
ALAT_API_KEY=
# merchant account debited by transfer-fund-request
ALAT_SOURCE_ACCOUNT=
# simulated adapter auto-settle delay (ms); 0 = instant, demo = 3000
SETTLE_AFTER_MS=3000
```

## 7. Error codes the frontend must handle

| Code                 | HTTP | When                                                              |
| -------------------- | ---- | ----------------------------------------------------------------- |
| `VALIDATION`         | 400  | bad source, missing wallet KYC fields, non-positive amount        |
| `NOT_FOUND`          | 404  | unknown loan, wallet, business, or payment reference              |
| `PAYMENT_REQUIRED`   | 402  | wallet balance < amountKobo for `source='wallet'`                 |
| `INVALID_TRANSITION` | 409  | paying a closed loan                                              |
| `UNAUTHORIZED`       | 401  | live mode without a bearer token                                  |
| `UNAVAILABLE`        | 503  | ALAT gateway unreachable / 5xx (only with `PAYMENT_ADAPTER=alat`) |

## 8. Frontend wiring contract (BE-frozen)

This section summarizes all frozen backend behaviors and exact API payloads required for frontend implementation:

1. **`POST /loans/:id/pay` Payload**:
   - Request body: `{ source: 'wallet' | 'bank_account', amountKobo?: number }`
   - Response envelope: `{ ok: true, data: { paymentId: string, platformTransactionReference: string | null, status: PaymentStatus } }`
   - Note: The response intentionally omits `{ payment, loan, asset }`. The frontend MUST re-fetch `GET /loans/:id` or `GET /assets/:id` after receiving `SUCCESS` to obtain updated balances and statuses.

2. **Payment Type & Source Deltas**:
   - `Payment.status`: `'pending_authorisation' | 'authorised' | 'SUCCESS' | 'FAILED' | 'EXPIRED'`
   - `Payment.source`: `'ALAT' | 'SIMULATED' | 'WALLET'`
   - New types: `Wallet`, `WalletTransaction`, `CreateWalletBody`, `PaymentStatus`

3. **New API Endpoints**:
   - `GET /payments/:reference/status`: Accepts `paymentId` OR `reference`. Returns `{ status, payment? }`.
   - `POST /wallets/create`: Body `{ businessId, nin, firstName, lastName, phone }`. Returns `{ wallet }`.
   - `GET /wallets/balance`: Returns `Wallet`. Scoped to signed-in owner's business.
   - `GET /wallets/statement`: Query `?limit&before`. Returns `{ items: WalletTransaction[] }`.

4. **Realtime & Polling Behavior**:
   - On Supabase deployment: Listen to channel `payments` for broadcast event `status_changed` (`{ paymentId, from, to, reference }`).
   - In Demo mode: Poll `GET /payments/:reference/status` every ~2s until `status === 'SUCCESS' | 'FAILED' | 'EXPIRED'`, then re-fetch loan/asset.

5. **Authentication & Authorization**:
   - Send `Authorization: Bearer <Supabase session token>` on all requests.
   - In demo mode, the backend injects a demo user (`demo-user`) automatically if no token is present.
   - All `/wallets/*` endpoints resolve business ID from `req.user` server-side (never trust request body).

6. **Error Codes & Handling**:
   - `402 PAYMENT_REQUIRED`: Wallet balance insufficient for `source: 'wallet'`.
   - `400 VALIDATION`: Bad parameters or invalid request format.
   - `404 NOT_FOUND`: Resource not found.
   - `409 INVALID_TRANSITION`: Operation not permitted on current resource state.
   - `503 UNAVAILABLE`: ALAT provider endpoint unavailable.

