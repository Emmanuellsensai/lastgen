# Getting Started — Local Development

> **Lastgen · Wema Hackaholics 7.0 · Team Ryzen**

---

## Prerequisites

- Node.js 18+
- pnpm 8+

---

## Quick Start (Mock Mode — 2 minutes)

No backend required. MSW intercepts all API calls.

```bash
# Clone and install
git clone <repo-url> lastgen
cd lastgen
pnpm install

# Start frontend
cd frontend
pnpm dev

# Open http://localhost:5173
```

Click "I'm a business owner" on the login page. You're in.

---

## Full Stack (Live Mode — 5 minutes)

Runs both backend and frontend. Backend serves the API, frontend proxies to it.

### Terminal 1: Backend

```bash
cd backend
cp .env.example .env
# Edit .env — ensure DEMO_MODE=true
pnpm install
pnpm dev
# API listening on http://localhost:8080
```

Verify:
```bash
curl http://localhost:8080/health
# → {"ok":true}
```

### Terminal 2: Frontend

```bash
cd frontend
# Create .env.local with:
#   VITE_API_MODE=live
#   VITE_API_URL=http://localhost:8080
pnpm dev
# Frontend on http://localhost:5173, proxying /api → localhost:8080
```

### Verify Integration

1. Open `http://localhost:5173`
2. Click "I'm a business owner"
3. Dashboard loads with seeded demo data
4. Navigate to `/burn` — burn counter ticks
5. Navigate to `/wallet` — shows ₦50,000 balance
6. Navigate to `/loan/:id` — amortization schedule loads
7. Make a payment — wallet balance decreases

---

## Running Tests

### Backend

```bash
cd backend
pnpm test
# 22 test files, 189 tests — all should pass
```

### Frontend Typecheck

```bash
cd frontend
npx tsc --noEmit
# Should exit 0 with no errors
```

---

## Environment Variables

### Frontend (`frontend/.env.local`)

```dotenv
# mock = MSW service worker (default, no backend needed)
# live = Vite proxy to backend at VITE_API_URL
VITE_API_MODE=mock

# Backend URL (only used when VITE_API_MODE=live)
VITE_API_URL=http://localhost:8080

# Supabase (only needed for live mode authentication)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Backend (`backend/.env`)

```dotenv
PORT=8080
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
DEMO_MODE=true
PAYMENT_ADAPTER=simulated
SETTLE_AFTER_MS=0
```

---

## Project Structure

```
lastgen/
├── frontend/                    # React + Vite + TypeScript
│   ├── src/
│   │   ├── lib/api.ts          # API client (all backend calls)
│   │   ├── types/api.ts        # TypeScript types
│   │   ├── store/              # Zustand stores
│   │   ├── routes/             # Page components
│   │   │   ├── owner/          # Owner views
│   │   │   ├── bank/           # Bank views
│   │   │   ├── demo/           # Demo control
│   │   │   ├── auth/           # Login, Register
│   │   │   └── marketing/      # Landing page
│   │   ├── mocks/              # MSW handlers + seed data
│   │   └── components/         # Shared UI components
│   ├── vite.config.ts          # Vite config + API proxy
│   └── .env.example
├── backend/                     # Express + TypeScript
│   ├── src/
│   │   ├── routes/             # Express route handlers
│   │   ├── data/               # Repository layer
│   │   ├── services/           # Domain logic
│   │   ├── middleware/         # Auth, error handler
│   │   └── config/             # Constants, env
│   └── .env.example
└── docs/                        # Documentation
    ├── CONTRACT.md              # Frozen API contract
    ├── BACKEND_API_REFERENCE.md # API reference
    └── ...
```

---

## Common Tasks

### Add a new API endpoint

1. Add route in `backend/src/routes/`
2. Add method to `backend/src/data/repository.ts`
3. Add frontend type in `frontend/src/types/api.ts`
4. Add client method in `frontend/src/lib/api.ts`
5. Add MSW handler in `frontend/src/mocks/handlers.ts`
6. Use in your component

### Add a new page

1. Create component in `frontend/src/routes/`
2. Add route in `frontend/src/App.tsx`
3. Add nav entry in `frontend/src/components/layout/navigation.ts`
4. Wrap with `<RequireRole>` for auth protection

### Debug API calls

1. Open browser DevTools → Network tab
2. Filter by `/api/`
3. Check request/response payloads
4. In mock mode, MSW handlers show in console
5. Health check: `curl http://localhost:8080/health` → `{"ok":true}`
6. Portfolio export: `POST /api/portfolio/export` → returns `{ url, generatedAt }`

---

## Troubleshooting

### "404 Not Found" on `/api/*`

- **Mock mode:** MSW didn't start. Hard refresh (`Ctrl+Shift+R`).
- **Live mode:** Backend not running or Vite proxy misconfigured.

### "Insufficient wallet balance"

- Wallet has less than the payment amount. Fund it first via `/wallet`.

### Frontend shows stale data

- Clear localStorage (`lastgen.session` key) and reload.
- Or click "Reset" in demo control (`/demo`).

### Type errors after changes

```bash
cd frontend && npx tsc --noEmit
cd backend && npx tsc --noEmit
```

Fix any errors before committing.
