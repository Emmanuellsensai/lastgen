# Lastgen Frontend - Build Summary for Backend Dev

All endpoints below are required for the live frontend to function.
Mock implementations exist in `frontend/src/mocks/handlers.ts` and show
the exact request/response shapes. Backend must match these shapes exactly.
The API envelope is always `{ ok: boolean, data?: T, error?: { code, message } }`.
Money is always integer kobo. Energy is always integer Wh.

---

## Auth

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| POST | /api/auth/login | Sign in, returns JWT + businessId | `{ email, password }` | `{ user: { id, email, fullName }, role, businessId, accessToken }` |
| POST | /api/auth/register | Register, creates user + business shell | `{ email, password, fullName, phone }` | same as login |

Note: When `VITE_API_MODE=live`, the frontend routes ALL auth through these endpoints.
It no longer calls Supabase auth directly. The backend is responsible for:
1. Creating the Supabase user (or delegating to Supabase and returning the JWT)
2. Creating the business record
3. Returning the businessId alongside the JWT

---

## Businesses

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| POST | /api/businesses | Create business after registration | `{ name, type, city, generatorKva, hoursPerDay }` | `Business` |
| GET | /api/businesses/:id | Get business by ID | - | `Business` |
| GET | /api/businesses/:id/burn | Get burn profile | - | `BurnProfile` |
| GET | /api/businesses/:id/fuel-logs | List fuel logs | `?limit&offset` | `PagedEnvelope<FuelLog>` |
| POST | /api/businesses/:id/fuel-logs | Add a fuel log | `CreateFuelLogBody` | `FuelLog` |
| DELETE | /api/businesses/:id/fuel-logs/:logId | Delete a fuel log | - | `{ ok: true }` |
| POST | /api/businesses/:id/receipts | Upload pump photo for OCR | `multipart: file` | `FuelLog` |
| GET | /api/businesses/:id/impact | Impact summary | `?period=month\|year\|all` | `ImpactSummary` |
| GET | /api/businesses/:id/wrapped | Wrapped summary | `?days=N` | `WrappedPayload` |
| POST | /api/businesses/:id/quote | Generate a quote | `{ systemId, tenorMonths, depositKobo? }` | `Quote` |
| GET | /api/businesses/:id/summary | Returns live IDs | - | `{ assetId, loanId, quoteId }` |
| GET | /api/businesses/:id/application | Credit file for this business | - | `CreditFile \| null` |

---

## Quotes

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| GET | /api/quotes/:id | Get quote by ID | - | `Quote` |
| POST | /api/quotes/:id/accept | Submit quote as application | `{ quoteId }` | `{ creditFileId, status: 'PENDING' }` |

---

## Assets

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| GET | /api/assets/:id | Get asset | - | `Asset` |
| GET | /api/assets/:id/meter | Generation readings | `?from&to` (ISO dates) | `ListEnvelope<MeterReading>` |
| POST | /api/assets/:id/suspend | Suspend asset | `{ reason }` | `Asset` |
| POST | /api/assets/:id/restore | Restore asset | - | `Asset` |

---

## Loans

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| GET | /api/loans/:id | Get loan | - | `Loan` |
| POST | /api/loans/:id/pay | Pay loan instalment | `{ source: 'wallet'\|'bank_account', amountKobo? }` | `PayResult` |
| GET | /api/loans/:id/schedule | Repayment schedule | - | `ListEnvelope<Installment>` |
| GET | /api/loans/:id/payments | Payments made | - | `ListEnvelope<Payment>` |

---

## Payments

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| GET | /api/payments/:ref/status | Poll payment status | - | `{ paymentId, status: PaymentStatus }` |

---

## Portfolio (bank/admin)

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| GET | /api/portfolio/stats | Portfolio summary stats | - | `PortfolioStats` |
| GET | /api/portfolio/assets | Paginated asset list | `?status&city&page` | `PagedEnvelope<Asset>` |
| POST | /api/portfolio/export | Export portfolio | - | `{ url, generatedAt }` |

---

## Credit

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| GET | /api/credit/applications | List credit files | `?status=PENDING\|APPROVED\|DECLINED` | `ListEnvelope<CreditFile>` |
| GET | /api/credit/applications/:id | Get credit file detail | - | `CreditFileDetail` |
| POST | /api/credit/applications/:id/approve | Approve application | - | `ApproveResult` |
| POST | /api/credit/applications/:id/decline | Decline application | `{ reason }` | `CreditFile` |

---

## Admin

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| GET | /api/admin/users | All users with asset/loan summary | - | `ListEnvelope<AdminUser>` |
| POST | /api/admin/loans/:id/approve-payment | Manually approve payment | - | `{ paymentId, status }` |
| GET | /api/admin/kyc | List KYC submissions | - | `ListEnvelope<KycRecord & { businessName }>` |
| POST | /api/admin/kyc/:id/approve | Approve KYC | - | `{ id, status, reviewedAt }` |
| POST | /api/admin/kyc/:id/reject | Reject KYC | `{ reason }` | `{ id, status, rejectionReason, reviewedAt }` |
| POST | /api/admin/assets/:id/toggle-power | Toggle asset power | - | `{ id, status }` |
| GET | /api/admin/orders | List admin orders | - | `ListEnvelope<AdminOrder>` |

---

## Wallets

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| POST | /api/wallets/create | Create wallet | `CreateWalletBody` | `Wallet` |
| GET | /api/wallets/balance | Wallet balance | - | `Wallet` |
| GET | /api/wallets/statement | Transaction history | `?limit` | `ListEnvelope<WalletTransaction>` |

---

## Systems

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| GET | /api/systems | List available solar systems | `?minKw&maxPriceKobo` | `ListEnvelope<SolarSystem>` |

---

## NEW endpoints summary (items the backend must build that do not yet exist)

| Priority | Method | Path | Why needed |
|----------|--------|------|------------|
| P0 | GET | /api/businesses/:id/summary | Dashboard needs live assetId, loanId, quoteId after login |
| P0 | POST | /api/quotes/:id/accept | Quote accept action submits application |
| P0 | DELETE | /api/businesses/:id/fuel-logs/:logId | Delete fuel log from history list |
| P1 | GET | /api/loans/:id/payments | Payment history accordion on asset page |
| P1 | GET | /api/businesses/:id/application | Application status stepper on dashboard |
| P1 | GET | /api/admin/users | Admin user list tab |
| P2 | POST | /api/admin/loans/:id/approve-payment | Admin orders tab payment action |

---

## API_MODE behaviour

- `VITE_API_MODE=mock` (default): all requests go through MSW service worker. No backend needed.
- `VITE_API_MODE=live`: all requests go to `VITE_API_URL` (default `http://localhost:8080`). Auth goes through `/api/auth/login` and `/api/auth/register`. Supabase is NOT called directly by the frontend.

---

## Changes made to `session.ts`

The frontend no longer calls `supabase.auth.signInWithPassword` or `supabase.auth.signUp` directly.
In live mode, both `signInWithEmail` and `register` call the backend API endpoints instead.
The backend must return `{ accessToken, businessId, role, user }` from both endpoints.
The `accessToken` is then set via `setAuthToken()` and sent as `Authorization: Bearer <token>` on all subsequent requests.

---

## Types added or modified

All types are in `frontend/src/types/api.ts`. The backend must match these shapes exactly:
- `AdminUser` - confirmed shape
- `PayBody.source` - `'wallet' | 'bank_account'`
- `PayResult` - `{ paymentId, platformTransactionReference, status }`
- `WrappedPayload` - the `wrapped` endpoint must accept `?days=N` in addition to `?year=N`
- `MeterReading` - `{ id, assetId, ts, whGenerated, whConsumed, batterySocPct }`
- `Installment` - `{ n, dueAt, principalKobo, interestKobo, balanceKobo, paidAt? }`
- `Payment` - `{ id, loanId, amountKobo, paidAt, source, reference }`

---

## Package additions

- `recharts` added for generation history and burn sparkline charts (Section 6, 7)

---

## Frontend routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Landing | Marketing page with savings calculator |
| `/register` | Register | Account creation + business setup |
| `/login` | Login | Email/password sign in |
| `/app` | Dashboard | Owner dashboard with stepper, burn, quick actions |
| `/burn` | Burn | Fuel counter + capture cards + fuel log history |
| `/quote/:id` | Quote | Dynamic quote with accept action |
| `/asset/:id` | Asset | System detail, generation history chart, payment history |
| `/wrapped/:id` | Wrapped | Duration picker + animated impact story |
| `/kyc` | Kyc | Identity verification |
| `/admin` | AdminDashboard | Admin tabs: Users, KYC review, Solar control, Orders, Portfolio |
| `/bank` | Applications | Credit file list |
| `/bank/file/:id` | CreditFile | Recommendation header, burn sparkline, approval workflow |
| `/bank/portfolio` | Portfolio | Portfolio stats and asset list |
