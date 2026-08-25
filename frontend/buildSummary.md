# Lastgen Frontend - Build Summary for Backend Dev

All endpoints below are required for the live frontend to function.
Mock implementations exist in frontend/src/mocks/handlers.ts and show
the exact request/response shapes. Backend must match these shapes exactly.
The API envelope is always { ok: boolean, data?: T, error?: { code, message } }.
Money is always integer kobo. Energy is always integer Wh.

---

## Auth

POST /api/auth/login - Sign in, returns JWT + businessId
POST /api/auth/register - Register, creates user + business shell

When VITE_API_MODE=live, the frontend routes ALL auth through these endpoints.

## Businesses

POST /api/businesses - Create business
GET /api/businesses/:id - Get business
GET /api/businesses/:id/burn - Get burn profile
GET /api/businesses/:id/fuel-logs - List fuel logs (?limit&offset)
POST /api/businesses/:id/fuel-logs - Add fuel log
DELETE /api/businesses/:id/fuel-logs/:logId - Delete fuel log [NEW]
POST /api/businesses/:id/receipts - Upload receipt for OCR
GET /api/businesses/:id/impact - Impact summary (?period)
GET /api/businesses/:id/wrapped - Wrapped summary (?days=N)
POST /api/businesses/:id/quote - Generate quote
GET /api/businesses/:id/summary - Returns live IDs [NEW]
GET /api/businesses/:id/application - Credit file for business [NEW]

## Quotes

GET /api/quotes/:id - Get quote
POST /api/quotes/:id/accept - Submit quote as application [NEW]

## Assets

GET /api/assets/:id - Get asset
GET /api/assets/:id/meter - Generation readings (?from&to)
POST /api/assets/:id/suspend - Suspend asset
POST /api/assets/:id/restore - Restore asset

## Loans

GET /api/loans/:id - Get loan
POST /api/loans/:id/pay - Pay loan installment
GET /api/loans/:id/schedule - Repayment schedule
GET /api/loans/:id/payments - Payments made [NEW]

## Payments

GET /api/payments/:ref/status - Poll payment status

## Portfolio

GET /api/portfolio/stats - Portfolio summary
GET /api/portfolio/assets - Paginated asset list
POST /api/portfolio/export - Export portfolio

## Credit

GET /api/credit/applications - List credit files
GET /api/credit/applications/:id - Get credit file detail
POST /api/credit/applications/:id/approve - Approve
POST /api/credit/applications/:id/decline - Decline

## Admin

GET /api/admin/users - All users with asset/loan summary [NEW]
POST /api/admin/loans/:id/approve-payment - Manually approve payment [NEW]

## Wallets

POST /api/wallets/create - Create wallet
GET /api/wallets/balance - Wallet balance
GET /api/wallets/statement - Transaction history

## Systems

GET /api/systems - List available solar systems

---

## NEW endpoints (backend must build)

P0: GET /api/businesses/:id/summary - Dashboard needs live assetId, loanId, quoteId
P0: POST /api/quotes/:id/accept - Quote accept action submits application
P0: DELETE /api/businesses/:id/fuel-logs/:logId - Delete fuel log from history
P1: GET /api/loans/:id/payments - Payment history on asset page
P1: GET /api/businesses/:id/application - Application status stepper on dashboard
P2: POST /api/admin/loans/:id/approve-payment - Admin orders tab payment action

## Dependencies added

PACKAGE REQUEST: recharts - for generation history bar charts on asset and credit file pages

## session.ts changes

The frontend no longer calls supabase.auth directly. In live mode, both
signInWithEmail and register call the backend API endpoints instead.
Backend must return { accessToken, businessId, role, user } from both.