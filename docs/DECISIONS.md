# Decision log

Append-only. One entry per decision, newest at the bottom. Keep entries short.

## Template

### YYYY-MM-DD — Title

**Context:** what forced the decision.
**Decision:** what we chose.
**Consequence:** what this makes easy, and what it makes hard.

---### 2026-08-19 — pnpm workspaces over a single package

**Context:** frontend and backend are deployed to different platforms and owned by different people.
**Decision:** pnpm monorepo with `frontend` and `backend` as workspaces.
**Consequence:** independent deploys and dependency sets; shared lint and format config lives at the root and changes by agreement.

---

### 2026-08-21 — Backend wallet create returns wallet directly

**Context:** The `POST /wallets/create` endpoint wrapped the wallet in `{ wallet: Wallet }` while all other create endpoints returned the entity directly.
**Decision:** Changed to `ok(wallet)` for consistency with `POST /businesses` and other create endpoints.
**Consequence:** Frontend API client type changed from `post<{ wallet: Wallet }>` to `post<Wallet>`. Tests updated.

---

### 2026-08-21 — Vite proxy for live mode development

**Context:** In live mode, the frontend at `localhost:5173` needed to reach the backend at `localhost:8080`. CORS was fragile.
**Decision:** Added Vite proxy config: `/api` → `http://localhost:8080`.
**Consequence:** Frontend always calls `/api/...` (same origin). No CORS issues in dev. MSW still works in mock mode because it intercepts before the proxy.

---

### 2026-08-21 — Auth: /me/session endpoint for business resolution

**Context:** After Supabase auth, the frontend needed to resolve the user to their business. The backend had `businessForOwner()` but no HTTP endpoint.
**Decision:** Added `GET /me/session` that calls `businessForOwner(req.user.id)` and returns `{ role, businessId, name }`.
**Consequence:** Frontend calls this after every auth event (login, register, OAuth redirect) to get the real `businessId`. Falls back to `DEMO_IDS` in mock mode.

---

### 2026-08-21 — Owner tracking in in-memory repository

**Context:** The in-memory repository only mapped `demo-user` → demo business. New users couldn't be associated with their businesses.
**Decision:** Added `ownerBusinessMap: Map<string, string>` to `InMemoryRepository`. `createBusiness()` stores the mapping, `businessForOwner()` checks it first.
**Consequence:** Live mode auth works end-to-end: create business → store owner → resolve via `/me/session`.

---

### 2026-08-21 — totalPayableKobo from schedule sum

**Context:** `totalPayableKobo` was computed as `payment × months + deposit`, which differs from the actual amortisation sum by a few kobo.
**Decision:** Changed to `depositKobo + sum(schedule[i].principal + schedule[i].interest)` — the schedule is the source of truth.
**Consequence:** Quote page, MSW, seed, backend lease engine, and in-memory repo all use `totalPayableFromSchedule()`. Tests updated with tolerance checks.

---

### 2026-08-21 — Session store resolves business from backend

**Context:** After Supabase auth, the session store hardcoded `DEMO_IDS.businessId` instead of fetching the real business.
**Decision:** Added `resolveSession()` method that calls `api.auth.session()` → `GET /me/session`. Called after every auth event.
**Consequence:** Live mode users get their actual business. OAuth redirect triggers `resolveSession` via `onAuthStateChange(INITIAL_SESSION)`.
