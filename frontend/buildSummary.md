# Lastgen — Build Summary

Generated after completing the multi-feature sprint.

---

## Changes made

### Feature 1 — Landing Page Overhaul

| File | What changed |
|------|-------------|
| `frontend/src/routes/marketing/Landing.tsx` | Nav CTA replaced with Sign in/Sign up buttons. Hero primary CTA routes to /register. Hero secondary CTA scrolls to how-it-works section. "For the bank" CTA renamed to "Sign up as a bank" routing to /register-bank. Footer updated: Credit desk and "Sign up as a bank" in Partners column route to /register-bank. "Sign in as a bank" added to Product column routing to /login-bank. |
| `frontend/src/components/lastgen/PhotoStrip.tsx` | Changed object-cover to object-contain so images display fully without cropping. |
| `frontend/src/components/ui/accordion.tsx` | Added data-state animation classes for smooth open/close transitions. |
| `frontend/src/styles/globals.css` | Added accordion-down and accordion-up keyframes. |
| `frontend/tailwind.config.js` | Added accordion animation and keyframe definitions. |

### Feature 2 — Dashboard Cleanup

| File | What changed |
|------|-------------|
| `frontend/src/routes/owner/Dashboard.tsx` | Removed "Your system" and "Your year" quick action cards. Grid changed from 4-col to 2-col. Remaining cards use padding="lg". Removed unused SunHorizon and Sparkle icon imports. |

### Feature 3 — KYC Identity Verification

| File | What changed |
|------|-------------|
| `frontend/src/types/api.ts` | Added KycStatus type and KycRecord interface with NIN and bank slip fields. |
| `frontend/src/store/session.ts` | Added kycStatus field and setKycStatus setter to session state. |
| `frontend/src/mocks/handlers.ts` | Added kycHandlers with GET /businesses/:id/kyc, POST /businesses/:id/kyc/submit (now accepts NIN number and bank slip), GET /admin/kyc, POST /admin/kyc/:id/approve, POST /admin/kyc/:id/reject. |
| `frontend/src/lib/api.ts` | Added api.kyc namespace with get and submit methods. |
| `frontend/src/routes/owner/Kyc.tsx` | New file. KYC page with three verification steps: NIN number input, bank slip upload, and selfie capture. Includes check, capture, submitting, and submitted phases. |
| `frontend/src/App.tsx` | Added /kyc route guarded by RequireRole owner. |
| `frontend/src/components/layout/navigation.ts` | Added ShieldCheck import. Added Identity check to OWNER_NAV_GROUPS. Added Verify tab to OWNER_PRIMARY_NAV. |

### Feature 4 — Admin Dashboard

| File | What changed |
|------|-------------|
| `frontend/src/types/api.ts` | Added AdminUser and AdminOrder interfaces. |
| `frontend/src/lib/api.ts` | Added api.admin namespace with kyc, users, assets, and orders sub-namespaces. Added api.bankAuth namespace with register and login methods. |
| `frontend/src/mocks/handlers.ts` | Added adminHandlers with GET /admin/users, POST /admin/assets/:id/toggle-power, GET /admin/orders, POST /admin/loans/:id/approve-payment. Uses settlePayment helper. |
| `frontend/src/routes/admin/Dashboard.tsx` | New file. Four-tab admin dashboard (Users, KYC review, Solar control, Orders). |
| `frontend/src/App.tsx` | Added /admin route guarded by RequireAdmin. |
| `frontend/src/components/layout/navigation.ts` | Added Gauge import. Added Admin heading to BANK_NAV_GROUPS. Added Admin tab to BANK_PRIMARY_NAV. |
| `frontend/src/routes/auth/Login.tsx` | Changed bank role redirect from /bank to /admin. |

### Feature 5 — Bank Auth Pages

| File | What changed |
|------|-------------|
| `frontend/src/routes/auth/BankRegister.tsx` | New file. Bank registration form with fields: bank name, bank ID, password, confirm password. Routes to /admin on success. |
| `frontend/src/routes/auth/BankLogin.tsx` | New file. Bank sign-in form with fields: bank ID, password. Routes to /admin on success. |
| `frontend/src/mocks/handlers.ts` | Added bankAuthHandlers with POST /auth/bank/register and POST /auth/bank/login. |
| `frontend/src/types/api.ts` | Added BankRegisterBody, BankLoginBody, and BankAuthResult types. |
| `frontend/src/App.tsx` | Added /register-bank and /login-bank routes. |
| `frontend/src/routes/marketing/Landing.tsx` | Footer "Sign in as a bank" changed to "Sign up as a bank" routing to /register-bank. Credit desk links to /register-bank. Product column has "Sign in as a bank" linking to /login-bank. |

---

## Backend endpoints required

The following endpoints are needed from the backend to support what was built.
All are currently mocked in `frontend/src/mocks/handlers.ts`.

### Auth — Bank Registration and Login

| Method | Path | Description | Request body | Response |
|--------|------|-------------|--------------|----------|
| POST | /auth/bank/register | Register a new bank account | { bankName, bankId, password, confirmPassword } | { user: { id, bankId, bankName }, role: 'bank', accessToken } |
| POST | /auth/bank/login | Sign in with bank credentials | { bankId, password } | { user: { id, bankId, bankName }, role: 'bank', accessToken } |

### KYC

| Method | Path | Description | Request body | Response |
|--------|------|-------------|--------------|----------|
| GET | /businesses/:id/kyc | Get KYC status for a business | — | KycRecord |
| POST | /businesses/:id/kyc/submit | Submit NIN, bank slip, and selfie for KYC | multipart: ninNumber (string), bankSlip (image/PDF file), selfie (image file) | KycRecord |

### Admin — Users

| Method | Path | Description | Request body | Response |
|--------|------|-------------|--------------|----------|
| GET | /admin/users | List all registered businesses with KYC and asset status | — | ListEnvelope<AdminUser> |

### Admin — KYC Review

| Method | Path | Description | Request body | Response |
|--------|------|-------------|--------------|----------|
| GET | /admin/kyc | List all KYC submissions with optional status filter | ?status=pending\|approved\|rejected | ListEnvelope<KycRecord & { businessName }> |
| POST | /admin/kyc/:id/approve | Approve a KYC submission | — | { id, status, reviewedAt } |
| POST | /admin/kyc/:id/reject | Reject a KYC submission | { reason: string } | { id, status, rejectionReason, reviewedAt } |

### Admin — Solar Control

| Method | Path | Description | Request body | Response |
|--------|------|-------------|--------------|----------|
| POST | /admin/assets/:id/toggle-power | Suspend or restore an asset remotely | — | { id, status: AssetStatus } |

### Admin — Orders and Payments

| Method | Path | Description | Request body | Response |
|--------|------|-------------|--------------|----------|
| GET | /admin/orders | List all active loans with business and asset context | ?status= | ListEnvelope<AdminOrder> |
| POST | /admin/loans/:id/approve-payment | Manually approve a loan payment | — | { paymentId, status } |

---

## Auth notes for backend

- The admin endpoints at `/admin/*` must be protected by a role check. Only users with `role = 'bank'` or `role = 'admin'` should be able to call them.
- Bank registration (`POST /auth/bank/register`) should create a bank user record with the provided bank name, bank ID, and hashed password. Return a JWT access token.
- Bank login (`POST /auth/bank/login`) should validate the bank ID and password, then return a JWT access token. The bank ID is the unique identifier (not email).
- The KYC submission endpoint receives `multipart/form-data` with three fields: `ninNumber` (string, 11 digits), `bankSlip` (image or PDF file), and `selfie` (image file). The backend needs to:
  - Validate the NIN against the national identity database (NIMC)
  - Store the bank slip file (S3 or Supabase storage) and return a signed URL as `bankSlipUrl`
  - Store the selfie file and return a signed URL as `selfieUrl`
  - Set `ninVerified: true` if NIN validation passes
- KYC approval/rejection should trigger a notification to the business owner (email or in-app). The frontend does not yet implement notifications but the backend should emit the event.
- The toggle-power endpoint should go through the existing `AssetStateMachine` so that suspend/restore events are logged and realtime events are emitted the same way the existing `/assets/:id/suspend` and `/assets/:id/restore` endpoints work. Consider whether toggle-power should simply proxy to those existing endpoints.

---

## Types added to `frontend/src/types/api.ts`

- `KycStatus` — union type: `'unverified' | 'pending' | 'approved' | 'rejected'`
- `KycRecord` — full KYC record shape (includes ninNumber, bankSlipUrl, selfieUrl)
- `AdminUser` — user record as seen from admin panel
- `AdminOrder` — loan record as seen from admin orders tab
- `BankRegisterBody` — bank registration request body
- `BankLoginBody` — bank login request body
- `BankAuthResult` — bank auth response payload

---

## Notes for Emmanuel (lead)

- `frontend/src/components/ui/accordion.tsx` was edited to add smooth open/close animation. Keyframes were added to `globals.css` and `tailwind.config.js`.
- `frontend/src/components/layout/navigation.ts` was edited to add KYC and Admin routes to both sidebar groups and mobile bottom tabs.
- `frontend/src/components/layout/Sidebar.tsx` and `BottomTabs.tsx` were NOT directly edited. Navigation changes went through `navigation.ts` only.
- The `admin` namespace and `bankAuth` namespace were added to `api.ts`. If a real backend is wired, these can be pointed at live endpoints by changing the mock handlers.
- Bank auth pages (`BankRegister.tsx`, `BankLogin.tsx`) use the session store's `signIn('bank')` for now. When real auth is wired, replace with `api.bankAuth.register()` and `api.bankAuth.login()` calls.
