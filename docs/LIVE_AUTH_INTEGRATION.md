# Live Auth Integration — Backend Changes & Frontend Wiring

> **Owner:** Backend  
> **Status:** Backend complete, frontend wiring required  
> **Last updated:** August 2026

---

## What Changed (Backend)

`backend/src/routes/authRoutes.ts` now proxies Supabase auth in live mode
instead of returning 404.

### `POST /auth/register` (live mode)

1. Validates `{ email, password, fullName, phone? }`
2. Creates a Supabase auth user via `admin.createUser` with `email_confirm: true`
3. Creates a `businesses` row linked to the new user (`owner_id = auth user id`)
4. Signs in to mint a real JWT via `signInWithPassword`
5. Returns:

```jsonc
// status 201
{
  "ok": true,
  "data": {
    "user": { "id": "<uuid>", "email": "...", "fullName": "..." },
    "role": "owner",
    "businessId": "biz_<id>",
    "accessToken": "<supabase_jwt>",
  },
}
```

- Duplicate email → `400 VALIDATION "Email already registered"`
- Missing fields → `400 VALIDATION "All fields are required"`

### `POST /auth/login` (live mode)

1. Validates `{ email, password }`
2. Authenticates via `signInWithPassword` on the auth-only client
3. Looks up the user's business via `businessForOwner(userId)`
4. Returns:

```jsonc
// status 200
{
  "ok": true,
  "data": {
    "user": { "id": "<uuid>", "email": "...", "fullName": "..." },
    "role": "owner",
    "businessId": "biz_<id>" | null,
    "accessToken": "<supabase_jwt>"
  }
}
```

- Bad credentials → `401 UNAUTHORIZED "Invalid email or password"`
- `businessId` is `null` if the user has no business yet (edge case)

### `GET /me/session` (unchanged, already worked)

Resolves an authenticated user (via Bearer token) to their business.

```jsonc
// status 200
{
  "ok": true,
  "data": {
    "role": "owner",
    "businessId": "biz_<id>" | null,
    "name": "user@email.com"
  }
}
```

---

## What Must Change (Frontend)

### Problem

In live mode (`VITE_API_MODE=live`), the frontend's `session.ts` bypasses the
backend `/auth/login` and `/auth/register` routes entirely. It calls
`supabase.auth.signInWithPassword()` and `supabase.auth.signUp()` directly
through the Supabase JS client. This causes two critical failures:

1. **No backend business is created** — the backend register route provisions
   a `businesses` row, but the frontend skips it.
2. **`businessId` is `null`** — the session store never receives a `businessId`,
   so the dashboard can't load any data.

### Required Change

**File:** `frontend/src/store/session.ts`

**Rule:** When `API_MODE === 'live'`, both `signInWithEmail` and `register`
must route through the backend API (`api.auth.login` / `api.auth.register`)
instead of calling Supabase JS directly.

#### `signInWithEmail` (line ~63)

```ts
signInWithEmail: async (email, _password) => {
  const { api } = await import('@/lib/api');
  const { API_MODE } = await import('@/lib/api');

  // Live mode: route through backend — it handles Supabase auth
  // AND creates the business row in one shot.
  if (API_MODE === 'live') {
    const result = await api.auth.login({ email, password: _password });
    const { setAuthToken } = await import('@/lib/api');
    setAuthToken(result.accessToken);
    set({
      email: result.user.email,
      fullName: result.user.fullName,
      authProvider: 'email',
      isSignedIn: true,
      role: result.role,
      accessToken: result.accessToken,
      businessId: result.businessId,  // ← critical: now populated
      demoBusinessId: DEMO_IDS.businessId,
      demoAssetId: DEMO_IDS.assetId,
      demoLoanId: DEMO_IDS.loanId,
      demoQuoteId: DEMO_IDS.quoteId,
      isAdmin: result.role === 'bank',
    });
    return;
  }

  // Mock mode: existing Supabase-direct or backend fallback logic unchanged
  const { hasSupabaseConfig, supabase } = await import('@/lib/supabase');
  // ... rest of existing mock path
},
```

#### `register` (line ~128)

```ts
register: async (body) => {
  const { api } = await import('@/lib/api');
  const { API_MODE } = await import('@/lib/api');

  // Live mode: route through backend — creates auth user + business.
  if (API_MODE === 'live') {
    const result = await api.auth.register(body);
    const { setAuthToken } = await import('@/lib/api');
    setAuthToken(result.accessToken);
    set({
      email: result.user.email,
      fullName: result.user.fullName,
      authProvider: 'email',
      isSignedIn: true,
      role: result.role,
      accessToken: result.accessToken,
      businessId: result.businessId,  // ← critical: now populated
      demoBusinessId: DEMO_IDS.businessId,
      demoAssetId: DEMO_IDS.assetId,
      demoLoanId: DEMO_IDS.loanId,
      demoQuoteId: DEMO_IDS.quoteId,
      isAdmin: result.role === 'bank',
    });
    return;
  }

  // Mock mode: existing logic unchanged
  const { hasSupabaseConfig, supabase } = await import('@/lib/supabase');
  // ... rest of existing mock path
},
```

### Key Differences from Current Code

| Field                   | Current (live mode)                         | After fix                                     |
| ----------------------- | ------------------------------------------- | --------------------------------------------- |
| Auth method             | `supabase.auth.signInWithPassword()` direct | `api.auth.login()` → backend proxies Supabase |
| Business created        | **No**                                      | Yes, by backend register route                |
| `businessId` set        | **No** (stays `null`)                       | Yes, from API response                        |
| `accessToken` source    | Supabase session directly                   | Backend response (same JWT)                   |
| `setAuthToken()` called | Yes                                         | Yes (for subsequent backend calls)            |

### Response Shape (matches existing `api.auth.login` / `api.auth.register` types)

The frontend's `api.ts` already declares the correct response types:

```ts
// api.ts — already correct, no changes needed
auth: {
  login: (body: { email: string; password: string }) =>
    post<{ user: { id: string; email: string; fullName: string };
           role: 'owner' | 'bank';
           businessId: string;
           accessToken: string }>('/auth/login', body),
  register: (body: { email: string; password: string; fullName: string; phone: string }) =>
    post<{ user: { id: string; email: string; fullName: string };
           role: 'owner' | 'bank';
           businessId: string;
           accessToken: string }>('/auth/register', body),
},
```

No changes needed to `api.ts`.

---

## End-to-End Flow (After Wiring)

### New User Registration

```
1. User fills register form
2. session.register() → POST /api/auth/register (backend)
3. Backend: creates Supabase auth user + businesses row + mints JWT
4. Response: { user, role: 'owner', businessId, accessToken }
5. Frontend stores businessId + accessToken in session
6. Dashboard loads using businessId → all data resolves
```

### Existing User Login

```
1. User fills login form
2. session.signInWithEmail() → POST /api/auth/login (backend)
3. Backend: validates credentials via Supabase + looks up business
4. Response: { user, role: 'owner', businessId, accessToken }
5. Frontend stores businessId + accessToken in session
6. Dashboard loads using businessId → all data resolves
```

### Subsequent API Calls

```
1. Frontend has accessToken from login/register
2. api.ts sends Authorization: Bearer <accessToken> on all requests
3. Backend middleware/auth.ts validates JWT via supabase.auth.getUser()
4. req.user is populated → routes use req.user.id for business resolution
```

---

## Environment Requirements

| Variable               | Where           | Purpose                                    |
| ---------------------- | --------------- | ------------------------------------------ |
| `VITE_API_MODE=live`   | Frontend `.env` | Enables live API routing                   |
| `VITE_API_URL`         | Frontend `.env` | Backend URL (e.g. `http://localhost:8080`) |
| `SUPABASE_URL`         | Backend `.env`  | Supabase project URL                       |
| `SUPABASE_SERVICE_KEY` | Backend `.env`  | Supabase service-role key (server only)    |
| `DEMO_MODE=false`      | Backend `.env`  | Enables live auth paths                    |

---

## Testing

### Backend (already passing)

```bash
# Unit/contract tests — all 223 pass
pnpm test

# Typecheck
pnpm --filter @lastgen/backend exec tsc --noEmit

# Formatting
pnpm format:check:backend
```

### Live E2E (requires Supabase credentials)

```bash
# Runs against real Supabase — exercises full register → business → data flow
RUN_LIVE_E2E=true pnpm exec vitest run backend/test/live/live-e2e.test.ts
```

---

## Files Modified

| File                               | Change                                                 |
| ---------------------------------- | ------------------------------------------------------ |
| `backend/src/routes/authRoutes.ts` | Live-mode proxy for `/auth/login` and `/auth/register` |
| `docs/LIVE_AUTH_INTEGRATION.md`    | This document                                          |
