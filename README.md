# Lastgen

> Hackaholics submission. Fill in every section below before the deadline.

## 1. Project description

_Placeholder. One paragraph on the problem, who it is for, and how Lastgen solves it._

## 2. Live frontend URL

https://lastgen-frontend.vercel.app/

## 3. Live backend API URL

https://lastgen.onrender.com/

Health check: https://lastgen.onrender.com/health

## 4. Demo video link

_Placeholder. Public link to the demo video._

---

## Repository layout

```
frontend/   Vite + React 18 + TypeScript SPA
backend/    Express + TypeScript API
supabase/   schema, seed and RLS policy SQL
docs/       contract, demo script, decision log
tests/      Vitest contract and correctness suites
```

## Getting started

```bash
pnpm install
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
pnpm dev
```

`pnpm dev (clearify)` runs both workspaces concurrently. Frontend on `http://localhost:5173`,
backend on `http://localhost:8080`.

## Scripts

| Script        | What it does                       |
| ------------- | ---------------------------------- |
| `pnpm dev`    | Runs frontend and backend together |
| `pnpm dev:fe` | Frontend only                      |
| `pnpm dev:be` | Backend only                       |
| `pnpm build`  | Builds both workspaces             |
| `pnpm lint`   | ESLint across the repo             |
| `pnpm format` | Prettier write across the repo     |
| `pnpm test`   | Vitest run over `tests/`           |

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Ownership is by directory.
