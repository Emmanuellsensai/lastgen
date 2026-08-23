# Lastgen — Build Summary

Generated after completing the multi-feature sprint.

---

## Changes made

### Feature 1 — Landing Page Overhaul

| File | What changed |
|------|-------------|
| `frontend/src/routes/marketing/Landing.tsx` | Nav CTA replaced with Sign in/Sign up buttons. Hero primary CTA routes to /register. Hero secondary CTA scrolls to how-it-works section. "For the bank" CTA renamed to "Sign up as a bank" routing to /register. Footer updated with Open the demo, Sign in, and Sign in as a bank links. |
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
| `frontend/src/types/api.ts` | Added KycStatus type and KycRecord interface. |
| `frontend/src/store/session.ts` | Added kycStatus field and setKycStatus setter to session state. |
| `frontend/src/mocks/handlers.ts` | Added kycHandlers with GET /businesses/:id/kyc, POST /businesses/:id/kyc/submit, GET /admin/kyc, POST /admin/kyc/:id/approve, POST /admin/kyc/:id/reject. |
| `frontend/src/lib/api.ts` | Added api.kyc namespace with get and submit methods. |
| `frontend/src/routes/owner/Kyc.tsx` | New file. KYC page with check, capture, submitting, and submitted phases. Camera capture with front-facing input. |
| `frontend/src/App.tsx` | Added /kyc route guarded by RequireRole owner. |
| `frontend/src/components/layout/navigation.ts` | Added ShieldCheck import. Added Identity check to OWNER_NAV_GROUPS. Added Verify tab to OWNER_PRIMARY_NAV. |

### Feature 4 — Admin Dashboard

| File | What changed |
|------|-------------|
| `frontend/src/types/api.ts` | Added AdminUser and AdminOrder interfaces. |
| `frontend/src/lib/api.ts` | Added api.admin namespace with kyc, users, assets, and orders sub-namespaces. |
| `frontend/src/mocks/handlers.ts` | Added adminHandlers with GET /admin/users, POST /admin/assets/:id/toggle-power, GET /admin/orders, POST /admin/loans/:id/approve-payment. Uses settlePayment helper. |
| `frontend/src/routes/admin/Dashboard.tsx` | New file. Four-tab admin dashboard (Users, KYC review, Solar control, Orders). |
| `frontend/src/App.tsx` | Added /admin route guarded by RequireAdmin. |
| `frontend/src/components/layout/navigation.ts` | Added Gauge import. Added Admin heading to BANK_NAV_GROUPS. Added Admin tab to BANK_PRIMARY_NAV. |
| `frontend/src/routes/auth/Login.tsx` | Changed bank role redirect from /bank to /admin. |

---

## Backend endpoints required

The following endpoints are needed from the backend to support what was built.
All are currently mocked in `frontend/src/mocks/handlers.ts`.

### KYC

| Method | Path | Description | Request body | Response |
|--------|------|-------------|--------------|----------|
| GET | /businesses/:id/kyc | Get KYC status for a business | — | KycRecord |
| POST | /businesses/:id/kyc/submit | Submit selfie for KYC | multipart: selfie (image file) | KycRecord |

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
- The KYC submission endpoint receives `multipart/form-data`. The backend needs to handle file upload, store the selfie (S3 or Supabase storage), and return a signed URL or stored path as `selfieUrl` on the `KycRecord`.
- KYC approval/rejection should trigger a notification to the business owner (email or in-app). The frontend does not yet implement notifications but the backend should emit the event.
- The toggle-power endpoint should go through the existing `AssetStateMachine` so that suspend/restore events are logged and realtime events are emitted the same way the existing `/assets/:id/suspend` and `/assets/:id/restore` endpoints work. Consider whether toggle-power should simply proxy to those existing endpoints.

---

## Types added to `frontend/src/types/api.ts`

- `KycStatus` — union type: `'unverified' | 'pending' | 'approved' | 'rejected'`
- `KycRecord` — full KYC record shape
- `AdminUser` — user record as seen from admin panel
- `AdminOrder` — loan record as seen from admin orders tab

---

## Notes for Emmanuel (lead)

- `frontend/src/components/ui/accordion.tsx` was edited to add smooth open/close animation. Keyframes were added to `globals.css` and `tailwind.config.js`.
- `frontend/src/components/layout/navigation.ts` was edited to add KYC and Admin routes to both sidebar groups and mobile bottom tabs.
- `frontend/src/components/layout/Sidebar.tsx` and `BottomTabs.tsx` were NOT directly edited. Navigation changes went through `navigation.ts` only.
- The `admin` namespace was added to `api.ts`. If a real backend is wired, these can be pointed at live endpoints by changing the mock handlers.
