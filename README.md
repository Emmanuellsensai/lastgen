# Lastgen

> Hackaholics submission.

## 1. Project description

Nigerian small businesses run on petrol generators, and the fuel is a
recurring cost nobody tracks precisely — it leaves as cash, a few thousand
naira at a time, and never shows up as a number anyone can act on. Solar would
be cheaper, but it needs money upfront that a frozen-foods shop or a print
studio does not have, and no lender will underwrite an asset for a business
whose real running costs are undocumented.

Lastgen turns the fuel spend itself into the credit file. An owner logs what
they paid at the pump — by photographing the receipt, or typing the amount —
and the burn profile that accumulates becomes evidence: a verified monthly
cost, observed over time. Against that number Lastgen sizes a solar system and
quotes a lease that must, by rule, cost less every month than the fuel it
replaces. The owner accepts, a credit desk underwrites the file, and on
approval the system is installed with a metered loan behind it: repayments
tracked, generation measured, and the asset remotely suspendable if the loan
falls delinquent. What the business saves is what pays for the system.

## 2. Live frontend URL

https://lastgen-frontend.vercel.app/

## 3. Live backend API URL

https://lastgen.onrender.com/

Health check: https://lastgen.onrender.com/health

## 4. Demo video link

_To add before submission._

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
