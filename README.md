# Lastgen: Solar Financing for Nigerian SMEs

> **HackFest 2025 Submission** · Track: Sustainability

---

## Team Members

| Name | Role |
|------|------|
| Emmanuel Usang | Full-stack Lead |
| Micheal Samuel | Frontend / UX |
| Uchechukwu Jeremiah | Backend / API |
| Oyelabi Timileyin | Product / Research |

---

## Live Demo

| Service | URL |
|---------|-----|
| Frontend (Vercel) | https://lastgen-frontend.vercel.app |
| Backend API (Render) | https://lastgen-backend.onrender.com |
| Demo login (owner) | Click [**"Sign in as owner"**](https://lastgen-frontend.vercel.app/login) on the login page |
| Demo login (bank) | Click [**"Sign in as bank"**](https://lastgen-frontend.vercel.app/login-bank) on the login page | 
| Demo Video | Click [**"LASTGEN DEMO VIDEO"**](https://www.loom.com/share/8b96250fbb39440cb6bff282ed98eebf) GO TO LOOM | 


> The app runs in **mock mode** by default — all data is seeded and in-memory. No real money moves.

---

## The Problem

Over 40 million Nigerian small businesses run diesel generators for 6–12 hours every day. A typical SME spends ₦80,000–₦200,000 per month on fuel, money that buys nothing: no asset, no equity, no savings. Solar is the obvious fix, but the upfront cost (₦1.5M–₦4M) is out of reach without financing, and banks won't lend without a verified income signal.

**The data is already there — it just isn't being used.** Every fuel receipt, every generator log, is proof of income that no lender is reading.

---

## Our Solution

Lastgen turns a business owner's fuel history into a bankable credit file.

1. **Fuel logging** — owners record their generator spending (manual entry or receipt photo scan).
2. **Burn profile** — our engine computes a verified monthly spend, averaged over weeks or months.
3. **Solar quote** — we size a system to their load and price a loan they can afford.
4. **Credit file** — the verified burn profile, quote, and KYC documents package into a single file the bank sees.
5. **Loan + monitoring** — once approved, we install, monitor energy output, and enforce the contract via remote power control if payments lapse.

The bank sees a real income signal. The owner gets solar without upfront cost. We keep the grid honest.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS v4 + custom design tokens |
| State | Zustand with localStorage persistence |
| Mock API | MSW (Mock Service Worker) — zero backend needed locally |
| Backend | Express + TypeScript, Node 22 |
| Database | Supabase (PostgreSQL) — in-memory seed in demo mode |
| Payments | ALAT by Wema (simulated in demo) |
| Deployment | Vercel (frontend) + Render (backend) |

---

## How to Set Up and Run Locally

### Prerequisites

- Node.js 22+
- pnpm (`npm i -g pnpm`)

### 1. Clone and install

```bash
git clone https://github.com/Emmanuellsensai/lastgen.git
cd lastgen
pnpm install
```

### 2. Configure environment

Create `frontend/.env.local`:

```env
VITE_API_MODE=mock
VITE_API_URL=http://localhost:8080
```

> In mock mode, the frontend uses MSW to intercept all API calls. You do **not** need the backend running to explore the UI.

### 3. Run the frontend

```bash
cd frontend
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

### 4. (Optional) Run the backend

```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY if you have them
# Leave DEMO_MODE=true and PAYMENT_ADAPTER=simulated to skip live credentials
pnpm dev
```

Set `VITE_API_MODE=live` in `frontend/.env.local` to point the UI at the local backend.

---

## Demo Walkthrough

### Owner flow

1. Register with an email address → you land on the dashboard
2. Go to **Burn** → log fuel entries (e.g. 40L at ₦950/L, twice a week)
3. Navigate to **Quote** → review the solar system sized to your load → **Accept**
4. Go to **KYC** → enter NIN, upload a bank slip, take a selfie → Submit
5. Go to **Wallet** → fund your wallet → balance updates instantly
6. Check the dashboard — loan payment card and asset status appear

### Bank flow

1. Sign in as bank → **Admin dashboard** → **Users** tab shows all registered businesses
2. **KYC review** tab → approve or reject pending submissions
3. **Solar control** → toggle power on any asset (simulates remote enforcement)
4. **Applications** (at `/bank`) → PENDING credit files ready for a decision

### Demo control (both roles)

Navigate to `/demo` for the control panel:

- **Reset to seed** — returns everything to the starting state
- **Advance 30 days** — moves the clock forward; loans go overdue → GRACE → SUSPENDED
- **Miss a payment** — forces arrears on the demo loan
- **Switch system OFF/ON** — manually suspend or restore the demo solar asset

---

## Architecture Notes

```
frontend/          React SPA, talks to /api/* via MSW (mock) or fetch (live)
  src/mocks/       MSW handlers + seeded in-memory database
  src/routes/      Page components (owner/, bank/, admin/, demo/)
  src/store/       Zustand session store
  src/lib/api.ts   Typed API client (single source of truth for all endpoints)

backend/           Express API
  src/routes/      Route handlers (businesses, quotes, credit, assets, loans, wallets)
  src/seed.ts      Demo seed data
```

The frontend can run entirely without the backend by setting `VITE_API_MODE=mock`. MSW intercepts every `/api/*` request and serves from the in-memory seed, making the local dev loop instant.

---

## What's Next (Post-Hackfest)

- Live OCR pipeline for receipt scanning (Gemini Vision)
- Supabase Auth integration (Google / Apple OAuth)
- ALAT payment webhook in production
- Push notifications when asset status changes
- Multi-language support (Yoruba, Igbo, Hausa)
