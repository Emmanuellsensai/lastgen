# Lastgen: Solar Financing for Nigerian SMEs

**Wema Hackaholics 7.0 Hackathon Submission**

---

## The Challenge

> This year, we're giving you a blank canvas.
>
> Rather than prescribing exactly what you must build, you define the problem you want to solve.
>
> Your idea should:
>
> 1. Solve a real problem faced by customers, businesses, or the broader financial ecosystem.
> 2. Leverage technology and innovation in a meaningful way.
> 3. Have a clear pathway to being integrated with or plugged into Wema Bank's ecosystem.
>
> In short: Find a real problem. Build a solution. Show us why Wema Bank should care.

---

## Our Answer

Over 40 million Nigerian small businesses run diesel generators for 6 to 12 hours every day. A typical SME spends between 80,000 and 200,000 naira per month on fuel alone. That money buys nothing: no asset, no equity, no savings. Solar is the obvious fix, but the upfront cost (1.5M to 4M naira) is out of reach without financing, and banks will not lend without a verified income signal.

**The data already exists. It just is not being used.** Every fuel receipt, every generator log, is proof of consistent cash flow that no lender is currently reading.

Lastgen turns a business owner's fuel history into a bankable credit file. We give Wema Bank a pipeline of pre-screened, solar-ready SME borrowers it would otherwise never see.

---

## Team

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
| Demo login (bank) | Click [**"Sign in as bank"**](https://lastgen-frontend.vercel.app/login-bank) on the bank login page |
| Demo video | [Watch on Loom](https://www.loom.com/share/8b96250fbb39440cb6bff282ed98eebf) |

The app runs in mock mode by default. All data is seeded and in-memory. No real money moves during the demo.

---

## How It Works

### For the business owner

1. **Register** with an email address and describe your business (type, city, generator size).
2. **Log fuel spend** by entering amounts paid over the past week, month, or longer. The app computes a verified daily and monthly burn rate.
3. **Browse solar packages** sized to your load (Small / Medium / Large). Each card shows the monthly loan repayment and how much you would save versus your current fuel bill.
4. **Apply** for a solar loan directly inside the app. Your burn profile, quote, and KYC documents are packaged into a single credit file.
5. **Track your system** on the dashboard once the loan is approved: payment schedule, asset status, and wallet balance in one place.

### For the bank (Wema)

1. **Sign in** to the bank portal to see all registered businesses and their verification status.
2. **Review KYC submissions** (NIN, bank slip, selfie) and approve or reject with one click.
3. **Review credit files** for applicants who have accepted a solar quote.
4. **Monitor the portfolio**: asset health, loan balances, payment status, and arrears across all active customers.
5. **Remote power control**: suspend or restore a solar asset with a single action if a payment is missed, then restore automatically when the account is settled.

---

## Why Wema Bank Should Care

| Dimension | The case |
|-----------|----------|
| New borrowers | Lastgen surfaces creditworthy SMEs that have no formal credit history but a proven track record of fuel spend. |
| Lower risk | Solar systems are remotely monitored and remotely controllable. Non-payment triggers a power cut, not a legal chase. |
| ALAT integration | The wallet and loan repayments are already wired to ALAT by Wema. The bank collects through its own rails. |
| Sustainability mandate | Every solar installation displaces diesel consumption. Wema can count each loan toward its green finance targets. |
| Recurring revenue | Loan tenor is 24 to 48 months. Each approved customer pays monthly for up to four years. |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS v4 + custom design tokens |
| State | Zustand with localStorage persistence |
| Mock API | MSW (Mock Service Worker) - zero backend needed locally |
| Backend | Express + TypeScript, Node 22 |
| Database | Supabase (PostgreSQL) - in-memory seed in demo mode |
| Payments | ALAT by Wema (simulated in demo) |
| Deployment | Vercel (frontend) + Render (backend) |

---

## Local Setup

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

In mock mode the frontend uses MSW to intercept all API calls. You do **not** need the backend running to explore the full UI.

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
# Fill in SUPABASE_URL and SUPABASE_SERVICE_KEY if you have them.
# Leave DEMO_MODE=true and PAYMENT_ADAPTER=simulated to skip live credentials.
pnpm dev
```

Set `VITE_API_MODE=live` in `frontend/.env.local` to point the UI at the local backend.

---

## Demo Walkthrough

### Owner flow

1. Register with an email address and land on your dashboard
2. Go to **Log Fuel** and add at least two fuel entries (for example, 40L at 950 naira per litre, twice a week)
3. The app shows your estimated daily, weekly, monthly, and yearly fuel spend
4. Navigate to **Solar Options** to see packages matched to your burn rate and apply for a loan
5. Go to **KYC** and enter your NIN, upload a bank slip, and take a selfie
6. Go to **Wallet**, fund your account, and watch the balance update instantly
7. Check the dashboard to see your loan repayment card and solar asset status

### Bank flow

1. Sign in at `/login-bank` as a bank user
2. The **Users** tab shows every registered business, their KYC status, and loan details
3. The **KYC Review** tab lists pending submissions ready for approval or rejection
4. The **Applications** section shows credit files awaiting a lending decision
5. Toggle any solar asset ON or OFF from the bank dashboard to simulate remote enforcement

### Demo control panel

Navigate to `/demo` for the scenario control panel:

- **Reset to seed** restores everything to the initial demo state
- **Advance 30 days** moves the clock forward so loans go overdue and then into GRACE and SUSPENDED states
- **Miss a payment** forces arrears on the demo loan immediately
- **Suspend / Restore system** manually toggles the demo solar asset

---

## Architecture

```
frontend/
  src/mocks/         MSW handlers + seeded in-memory database
  src/routes/        Page components (owner/, bank/, admin/, demo/)
  src/store/         Zustand session store
  src/lib/api.ts     Typed API client (single source of truth for all endpoints)

backend/
  src/routes/        Route handlers (businesses, quotes, credit, assets, loans, wallets)
  src/data/          Repository seam (InMemoryRepository + SupabaseRepository)
  src/services/      Domain logic (state machines, lease engine, impact engine)
  src/seed.ts        Demo seed data
```

The frontend can run entirely without the backend by setting `VITE_API_MODE=mock`. MSW intercepts every `/api/*` request and serves from the in-memory seed, making the local dev loop instant with no credentials needed.

---

## What Comes Next

- Live OCR pipeline for fuel receipt scanning using Gemini Vision
- Google and Apple OAuth via Supabase Auth
- Production ALAT payment webhooks for real-time settlement
- Push notifications when an asset status changes
- Multi-language support (Yoruba, Igbo, Hausa)
- Automated underwriting scoring using the burn profile and KYC data
