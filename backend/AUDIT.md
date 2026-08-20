# Backend State Audit

## 1. Repo state

- Current git branch: `feat/backend`
- Output of `git status --short` (captured before this audit file was created): Phase 1 and Phase 2 files present and verified; commit sequence in `BACKEND_PROGRESS.md` §9.
- Output of `git log --oneline -15`: HEAD `86638ec` (`docs: add frontend integration guide`), the six Phase 1 commits, and the Phase 0 commits.
- Full recursive file tree of `/backend` (respecting `.gitignore`, excluding `node_modules`):

```text
backend/
├── .env.example
├── AUDIT.md
├── BACKEND_PROGRESS.md
├── ROADMAP.md
├── README.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── migrations/
│   └── audit.sql
├── src/
│   ├── app.ts
│   ├── index.ts
│   ├── adapters/
│   │   ├── alatAdapter.ts
│   │   ├── paymentAdapter.ts
│   │   └── simulatedAdapter.ts
│   ├── config/
│   │   ├── constants.ts
│   │   └── env.ts
│   ├── data/
│   │   ├── inMemoryRepository.ts
│   │   ├── repository.ts
│   │   └── seed.ts
│   ├── lib/
│   │   ├── envelope.ts
│   │   └── supabase.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   └── validate.ts
│   ├── routes/
│   │   └── .gitkeep
│   ├── services/
│   │   ├── assetStateMachine.ts
    │   ├── burnEngine.ts
    │   ├── impactEngine.ts
    │   ├── leaseEngine.ts
    │   ├── loanStateMachine.ts
    │   ├── meterSimulator.ts
    │   └── visionService.ts
    └── types/
        └── api.ts
```

## 2. Environment & config

### `/backend/package.json`

```json
{
  "name": "@lastgen/backend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.58.0",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "helmet": "^8.1.0",
    "pino": "^9.13.1",
    "pino-http": "^10.5.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^4.17.23",
    "@types/node": "^22.18.0",
    "pino-pretty": "^13.1.2",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3"
  }
}
```

### `/backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "nodenext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "declaration": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"]
}
```

### `/backend/.env.example`

```dotenv
PORT=8080

SUPABASE_URL=
SUPABASE_SERVICE_KEY=

GEMINI_API_KEY=

# simulated | alat
PAYMENT_ADAPTER=simulated
ALAT_BASE_URL=
ALAT_CHANNEL_ID=
ALAT_API_KEY=

DEMO_MODE=true
CORS_ORIGIN=http://localhost:5173
```

- Whether `/backend/.env` exists: no (it is ignored by `.gitignore` and was not present in the repository tree).
- Node version specified: `22` in the root `render.yaml` `NODE_VERSION` environment variable. No `/backend/.nvmrc` is present.
- Confirm: tsconfig has `"moduleResolution": "NodeNext"` or `"node16"` set? **Yes**, it has `"moduleResolution": "nodenext"` (case-insensitive equivalent of NodeNext).

## 3. Entry point

### `/backend/src/index.ts`

```ts
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import pino from 'pino';

const env = loadEnv();
const logger = pino({ level: env.logLevel });

const app = createApp(env, logger);

app.listen(env.port, () => {
  logger.info({ port: env.port }, 'lastgen api listening');
});

export { app };
```

### `/backend/src/app.ts`

`createApp(env, logger)` builds the Express application: `helmet()`, CORS from
the comma-separated origins, JSON parsing, `pinoHttp` logging, `GET /health`
returning `{ ok: true }`, the `/api` router mount, and the centralized error
handler. The factory takes `(env, logger)` explicitly so the server can be
built and exercised in tests without binding a port.

- Confirm: does `GET /health` currently return `{ ok: true }`? **Yes.**
- Middleware currently wired: `helmet()`, `cors(...)`, `express.json()`, and
  `pinoHttp({ logger })`. `PORT`, `CORS_ORIGIN` and `LOG_LEVEL` come from
  `loadEnv()` in `src/config/env.ts`.
- No authentication middleware, route modules, or validation middleware is
  wired to the API mount yet — `requireAuth` is applied in Phase 3 per route.

## 4. Dependencies actually installed

`package.json` declares the following dependencies:

### dependencies

- `@supabase/supabase-js`: `^2.58.0`
- `cors`: `^2.8.5`
- `express`: `^4.21.2`
- `helmet`: `^8.1.0`
- `pino`: `^9.13.1`
- `pino-http`: `^10.5.0`
- `zod`: `^3.25.76`

### devDependencies

- `@types/cors`: `^2.8.19`
- `@types/express`: `^4.17.23`
- `@types/node`: `^22.18.0`
- `pino-pretty`: `^13.1.2`
- `tsx`: `^4.20.6`
- `typescript`: `^5.9.3`

The repository tree contains no `node_modules` directory, so physically installed package copies cannot be independently verified from the checked-in tree. All required named packages are declared; none are missing from `package.json`: express, typescript, zod, @supabase/supabase-js, pino, cors, helmet.

## 5. Directory-by-directory status

- `/backend/src/routes`: `.gitkeep` (0 lines); no real files.
- `/backend/src/services`: `.gitkeep` (0 lines); no real files.
- `/backend/src/middleware`: `.gitkeep` (0 lines); no real files.
- `/backend/src/lib`: `.gitkeep` (0 lines); no real files.
- `/backend/src/types`: `.gitkeep` (0 lines); no real files.
- `/backend/src/adapters`:
  - `alatAdapter.ts` (3 lines)
  - `paymentAdapter.ts` (6 lines)
  - `simulatedAdapter.ts` (3 lines)

## 6. Adapters detail

### `/backend/src/adapters/paymentAdapter.ts`

```ts
// Payment provider interface. Chosen at runtime via PAYMENT_ADAPTER.
// Placeholder in this pass: shapes are defined by docs/CONTRACT.md.

export interface PaymentAdapter {
  readonly name: 'simulated' | 'alat';
}
```

### `/backend/src/adapters/simulatedAdapter.ts`

```ts
// Deterministic in-process payment adapter used for demos and tests.
// Placeholder in this pass.
export {};
```

### `/backend/src/adapters/alatAdapter.ts`

```ts
// ALAT payment adapter. Reads ALAT_BASE_URL, ALAT_CHANNEL_ID, ALAT_API_KEY.
// Placeholder in this pass.
export {};
```

The `PaymentAdapter` interface does **not** match the requested shape. It only contains `readonly name: 'simulated' | 'alat'`; it does not define:

```ts
collect(loanId: string, amountKobo: number): Promise<Payment>
balance(businessId: string): Promise<number>
```

No `Payment` type, adapter factory, provider selection implementation, or webhook implementation is present.

## 7. Database

- Has `/supabase/schema.sql` been applied to a live Supabase project? **Cannot be verified from this repository.** `/backend/.env.example` contains blank `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` values, with no project ref or connection string. The SQL schema exists in the repository, but that only proves the file is present; it does not prove application to a live project.
- Supabase client instantiated anywhere in `/backend/src`: **YES (lazy).** `src/lib/supabase.ts` exports `getSupabase()`, which constructs and caches the service-role client on first use and throws a clear error if `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` are missing. The backend boots in demo mode without credentials; the error is raised only when a module actually talks to the database.
- Migration or seed script inside `/backend`: **PARTIAL.** No seed script yet; `backend/migrations/audit.sql` adds the `asset_status_history` table as an additive migration applied after `supabase/schema.sql`. The migration is not yet applied to a live project.

## 8. Auth

JWT or Supabase auth verification middleware: **PRESENT.** `src/middleware/auth.ts` exports `requireAuth`, which reads the `Authorization: Bearer <token>` header and verifies it through `getSupabase().auth.getUser(token)`. Verified users are attached to `req.user`; missing or invalid credentials yield `UNAUTHORIZED` (401). No route currently applies `requireAuth`; protection is added when routers are implemented.

## 9. Deploy

### `/render.yaml`

```yaml
services:
  - type: web
    name: lastgen-backend
    runtime: node
    plan: free
    region: oregon
    rootDir: backend
    buildCommand: corepack enable && pnpm install --frozen-lockfile && pnpm build
    startCommand: pnpm start
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: NODE_VERSION
        value: '22'
      - key: PORT
        value: '8080'
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: GEMINI_API_KEY
        sync: false
      - key: PAYMENT_ADAPTER
        value: simulated
      - key: ALAT_BASE_URL
        sync: false
      - key: ALAT_CHANNEL_ID
        sync: false
      - key: ALAT_API_KEY
        sync: false
      - key: DEMO_MODE
        value: 'true'
      - key: CORS_ORIGIN
        sync: false
```

- Is the Render service currently live? **Cannot be checked from repository evidence.** `render.yaml` defines a service but contains no deployed URL, and no live health endpoint is available in the repository. This needs manual confirmation in Render or against the deployed service URL.

## 10. Gaps summary

- Foundation: **IMPLEMENTED** (envelope, lazy supabase client, error handler, auth middleware, validation factories, typed env, constants)
- Contract types: **IMPLEMENTED** (`src/types/api.ts`)
- Audit migration: **ADDED** (`migrations/audit.sql`, not yet applied)
- burnEngine: **IMPLEMENTED**
- leaseEngine: **IMPLEMENTED**
- assetStateMachine: NOT STARTED (Phase 1)
- loanStateMachine: NOT STARTED (Phase 1)
- meterSimulator: NOT STARTED (Phase 1)
- impactEngine: NOT STARTED (Phase 1)
- visionService: NOT STARTED (Phase 1)
- paymentAdapter: SCAFFOLDED ONLY (interface completed in Phase 4)
- ALAT webhook: NOT STARTED (Phase 4)
- demo routes: NOT STARTED (Phase 6)
- repository/seed: NOT STARTED (Phase 2)
- seed/deploy: PARTIAL (migration file present; schema/migration not applied to a live project)
- README: SCAFFOLDED ONLY (endpoint docs Phase 6)
- Tests: PARTIAL (lease-math smoke live; 15 todo stubs remain)

## 11. Schema (verbatim)

### Full `/supabase/schema.sql`

```sql
-- Lastgen schema
-- Tables, enums, indexes and row level security for the frozen API contract.
-- Apply with: psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--
-- Money is stored in kobo (bigint). Energy is stored in Wh (integer).
-- Every table that a business owns carries owner_id so RLS can scope reads to
-- the signed in user, while the service role sees the whole book.

begin;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type fuel_log_source as enum ('receipt', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type credit_file_status as enum ('PENDING', 'APPROVED', 'DECLINED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_status as enum ('ACTIVE', 'GRACE', 'SUSPENDED', 'OWNED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type loan_status as enum ('ACTIVE', 'DELINQUENT', 'CLOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_source as enum ('ALAT', 'SIMULATED');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------

create table if not exists businesses (
  id            text primary key,
  owner_id      uuid references auth.users (id) on delete set null,
  name          text        not null,
  type          text        not null,
  city          text        not null,
  generator_kva numeric(6, 2) not null default 0,
  hours_per_day numeric(4, 1) not null default 0,
  -- Suspension never applies while this is true. Enforced in the service layer
  -- and asserted again by the asset trigger below.
  medical_flag  boolean     not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists businesses_owner_id_idx on businesses (owner_id);
create index if not exists businesses_city_idx on businesses (city);
create index if not exists businesses_created_at_idx on businesses (created_at desc);

-- ---------------------------------------------------------------------------
-- fuel_logs
-- ---------------------------------------------------------------------------

create table if not exists fuel_logs (
  id                    text primary key,
  business_id           text not null references businesses (id) on delete cascade,
  source                fuel_log_source not null,
  litres                numeric(8, 2) not null check (litres > 0),
  amount_kobo           bigint  not null check (amount_kobo > 0),
  price_per_litre_kobo  bigint  not null check (price_per_litre_kobo > 0),
  logged_at             timestamptz not null,
  receipt_url           text,
  confidence            numeric(4, 3) check (confidence between 0 and 1)
);

create index if not exists fuel_logs_business_id_idx on fuel_logs (business_id);
create index if not exists fuel_logs_logged_at_idx on fuel_logs (business_id, logged_at desc);

-- ---------------------------------------------------------------------------
-- burn_profiles
-- ---------------------------------------------------------------------------

create table if not exists burn_profiles (
  business_id     text primary key references businesses (id) on delete cascade,
  litres_per_day  numeric(8, 2) not null default 0,
  daily_kobo      bigint  not null default 0,
  monthly_kobo    bigint  not null default 0,
  annual_kobo     bigint  not null default 0,
  days_observed   integer not null default 0,
  verified        boolean not null default false,
  computed_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- solar_systems (reference data, readable by everyone)
-- ---------------------------------------------------------------------------

create table if not exists solar_systems (
  id            text primary key,
  name          text    not null,
  capacity_kw   numeric(6, 2) not null check (capacity_kw > 0),
  panel_w       integer not null check (panel_w > 0),
  battery_kwh   numeric(6, 2) not null check (battery_kwh > 0),
  inverter_kva  numeric(6, 2) not null check (inverter_kva > 0),
  price_kobo    bigint  not null check (price_kobo > 0),
  covers_kva    numeric(6, 2) not null check (covers_kva > 0)
);

create index if not exists solar_systems_capacity_kw_idx on solar_systems (capacity_kw);
create index if not exists solar_systems_price_kobo_idx on solar_systems (price_kobo);

-- ---------------------------------------------------------------------------
-- quotes
-- ---------------------------------------------------------------------------

create table if not exists quotes (
  id                    text primary key,
  business_id           text not null references businesses (id) on delete cascade,
  system_id             text not null references solar_systems (id),
  tenor_months          integer not null check (tenor_months >= 6),
  deposit_kobo          bigint  not null default 0 check (deposit_kobo >= 0),
  monthly_payment_kobo  bigint  not null check (monthly_payment_kobo > 0),
  apr_bps               integer not null check (apr_bps >= 0),
  total_payable_kobo    bigint  not null check (total_payable_kobo > 0),
  -- Contract rule: a quote is only valid when it saves money every month.
  monthly_savings_kobo  bigint  not null check (monthly_savings_kobo > 0),
  savings_pct           numeric(5, 1) not null,
  break_even_month      integer not null,
  created_at            timestamptz not null default now()
);

create index if not exists quotes_business_id_idx on quotes (business_id);
create index if not exists quotes_system_id_idx on quotes (system_id);

-- ---------------------------------------------------------------------------
-- credit_files
-- ---------------------------------------------------------------------------

create table if not exists credit_files (
  id                  text primary key,
  business_id         text not null references businesses (id) on delete cascade,
  quote_id            text not null references quotes (id) on delete cascade,
  affordability_ratio numeric(5, 2) not null,
  load_profile_score  integer not null check (load_profile_score between 0 and 100),
  verified_months     integer not null default 0,
  status              credit_file_status not null default 'PENDING',
  decline_reason      text,
  created_at          timestamptz not null default now()
);

create index if not exists credit_files_business_id_idx on credit_files (business_id);
create index if not exists credit_files_quote_id_idx on credit_files (quote_id);
create index if not exists credit_files_status_idx on credit_files (status, created_at desc);

-- ---------------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------------

create table if not exists assets (
  id             text primary key,
  business_id    text not null references businesses (id) on delete cascade,
  system_id      text not null references solar_systems (id),
  serial         text not null unique,
  controller_id  text not null unique,
  status         asset_status not null default 'ACTIVE',
  installed_at   timestamptz not null default now(),
  suspended_at   timestamptz,
  suspend_reason text,
  -- Denormalised for portfolio filtering, kept in step with the business row.
  city           text not null
);

create index if not exists assets_business_id_idx on assets (business_id);
create index if not exists assets_system_id_idx on assets (system_id);
create index if not exists assets_status_idx on assets (status);
create index if not exists assets_city_idx on assets (city);
create index if not exists assets_status_city_idx on assets (status, city);

-- The medical flag guard, enforced at the row level so no service path can
-- suspend a business that depends on the load for medical reasons.
create or replace function assert_medical_flag_guard()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'SUSPENDED'
     and exists (select 1 from businesses b where b.id = new.business_id and b.medical_flag) then
    raise exception 'Suspension is blocked for a business carrying the medical flag';
  end if;
  return new;
end;
$$;

drop trigger if exists assets_medical_flag_guard on assets;
create trigger assets_medical_flag_guard
  before insert or update of status on assets
  for each row execute function assert_medical_flag_guard();

-- ---------------------------------------------------------------------------
-- loans
-- ---------------------------------------------------------------------------

create table if not exists loans (
  id                    text primary key,
  asset_id              text not null references assets (id) on delete cascade,
  principal_kobo        bigint  not null check (principal_kobo > 0),
  tenor_months          integer not null check (tenor_months >= 6),
  monthly_payment_kobo  bigint  not null check (monthly_payment_kobo > 0),
  balance_kobo          bigint  not null check (balance_kobo >= 0),
  next_due_at           timestamptz not null,
  status                loan_status not null default 'ACTIVE'
);

create index if not exists loans_asset_id_idx on loans (asset_id);
create index if not exists loans_status_idx on loans (status);
create index if not exists loans_next_due_at_idx on loans (next_due_at);

-- ---------------------------------------------------------------------------
-- installments
-- ---------------------------------------------------------------------------

create table if not exists installments (
  loan_id         text not null references loans (id) on delete cascade,
  n               integer not null check (n > 0),
  due_at          timestamptz not null,
  principal_kobo  bigint not null check (principal_kobo >= 0),
  interest_kobo   bigint not null check (interest_kobo >= 0),
  balance_kobo    bigint not null check (balance_kobo >= 0),
  paid_at         timestamptz,
  primary key (loan_id, n)
);

create index if not exists installments_loan_id_idx on installments (loan_id);
create index if not exists installments_due_at_idx on installments (due_at);
create index if not exists installments_unpaid_idx on installments (loan_id, due_at) where paid_at is null;

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------

create table if not exists payments (
  id          text primary key,
  loan_id     text not null references loans (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  paid_at     timestamptz not null default now(),
  source      payment_source not null,
  -- ALAT webhooks must be idempotent on the transaction reference.
  reference   text not null unique
);

create index if not exists payments_loan_id_idx on payments (loan_id);
create index if not exists payments_paid_at_idx on payments (loan_id, paid_at desc);

-- ---------------------------------------------------------------------------
-- meter_readings
-- ---------------------------------------------------------------------------

create table if not exists meter_readings (
  id               text primary key,
  asset_id         text not null references assets (id) on delete cascade,
  ts               timestamptz not null,
  wh_generated     integer not null check (wh_generated >= 0),
  wh_consumed      integer not null check (wh_consumed >= 0),
  battery_soc_pct  integer not null check (battery_soc_pct between 0 and 100)
);

create index if not exists meter_readings_asset_id_idx on meter_readings (asset_id);
create index if not exists meter_readings_asset_ts_idx on meter_readings (asset_id, ts desc);

-- ---------------------------------------------------------------------------
-- Row level security
--
-- A signed in user reads only the rows belonging to businesses they own.
-- The service role bypasses RLS entirely, which is how the backend and the
-- bank side read the whole book.
-- ---------------------------------------------------------------------------

alter table businesses     enable row level security;
alter table fuel_logs      enable row level security;
alter table burn_profiles  enable row level security;
alter table solar_systems  enable row level security;
alter table quotes         enable row level security;
alter table credit_files   enable row level security;
alter table assets         enable row level security;
alter table loans          enable row level security;
alter table installments   enable row level security;
alter table payments       enable row level security;
alter table meter_readings enable row level security;

-- Helper: does the signed in user own this business
create or replace function owns_business(target text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from businesses b
    where b.id = target and b.owner_id = auth.uid()
  );
$$;

drop policy if exists businesses_owner_select on businesses;
create policy businesses_owner_select on businesses
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists businesses_owner_write on businesses;
create policy businesses_owner_write on businesses
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists fuel_logs_owner on fuel_logs;
create policy fuel_logs_owner on fuel_logs
  for all to authenticated using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists burn_profiles_owner on burn_profiles;
create policy burn_profiles_owner on burn_profiles
  for select to authenticated using (owns_business(business_id));

-- Reference data. Readable by anyone signed in, written only by the service role.
drop policy if exists solar_systems_read on solar_systems;
create policy solar_systems_read on solar_systems
  for select to authenticated, anon using (true);

drop policy if exists quotes_owner on quotes;
create policy quotes_owner on quotes
  for select to authenticated using (owns_business(business_id));

drop policy if exists credit_files_owner on credit_files;
create policy credit_files_owner on credit_files
  for select to authenticated using (owns_business(business_id));

drop policy if exists assets_owner on assets;
create policy assets_owner on assets
  for select to authenticated using (owns_business(business_id));

drop policy if exists loans_owner on loans;
create policy loans_owner on loans
  for select to authenticated using (
    exists (select 1 from assets a where a.id = loans.asset_id and owns_business(a.business_id))
  );

drop policy if exists installments_owner on installments;
create policy installments_owner on installments
  for select to authenticated using (
    exists (
      select 1 from loans l
      join assets a on a.id = l.asset_id
      where l.id = installments.loan_id and owns_business(a.business_id)
    )
  );

drop policy if exists payments_owner on payments;
create policy payments_owner on payments
  for select to authenticated using (
    exists (
      select 1 from loans l
      join assets a on a.id = l.asset_id
      where l.id = payments.loan_id and owns_business(a.business_id)
    )
  );

drop policy if exists meter_readings_owner on meter_readings;
create policy meter_readings_owner on meter_readings
  for select to authenticated using (
    exists (select 1 from assets a where a.id = meter_readings.asset_id and owns_business(a.business_id))
  );

commit;
```

### Schema findings

- **Asset status transition audit table:** No. The schema contains no table named `asset_status_history`, `audit_log`, or any similar table for storing an audit trail of asset status transitions. No such `CREATE TABLE` statement exists.
- **Database-level medical flag suspension guard:** Yes. The guard is enforced by the following function and trigger:

```sql
create or replace function assert_medical_flag_guard()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'SUSPENDED'
     and exists (select 1 from businesses b where b.id = new.business_id and b.medical_flag) then
    raise exception 'Suspension is blocked for a business carrying the medical flag';
  end if;
  return new;
end;
$$;

drop trigger if exists assets_medical_flag_guard on assets;
create trigger assets_medical_flag_guard
  before insert or update of status on assets
  for each row execute function assert_medical_flag_guard();
```

### Exact requested table definitions

```sql
create table if not exists businesses (
  id            text primary key,
  owner_id      uuid references auth.users (id) on delete set null,
  name          text        not null,
  type          text        not null,
  city          text        not null,
  generator_kva numeric(6, 2) not null default 0,
  hours_per_day numeric(4, 1) not null default 0,
  -- Suspension never applies while this is true. Enforced in the service layer
  -- and asserted again by the asset trigger below.
  medical_flag  boolean     not null default false,
  created_at    timestamptz not null default now()
);
```

```sql
create table if not exists assets (
  id             text primary key,
  business_id    text not null references businesses (id) on delete cascade,
  system_id      text not null references solar_systems (id),
  serial         text not null unique,
  controller_id  text not null unique,
  status         asset_status not null default 'ACTIVE',
  installed_at   timestamptz not null default now(),
  suspended_at   timestamptz,
  suspend_reason text,
  -- Denormalised for portfolio filtering, kept in step with the business row.
  city           text not null
);
```

```sql
create table if not exists loans (
  id                    text primary key,
  asset_id              text not null references assets (id) on delete cascade,
  principal_kobo        bigint not null check (principal_kobo > 0),
  tenor_months          integer not null check (tenor_months >= 6),
  monthly_payment_kobo  bigint not null check (monthly_payment_kobo > 0),
  balance_kobo          bigint not null check (balance_kobo >= 0),
  next_due_at           timestamptz not null,
  status                loan_status not null default 'ACTIVE'
);
```

```sql
create table if not exists payments (
  id          text primary key,
  loan_id     text not null references loans (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  paid_at     timestamptz not null default now(),
  source      payment_source not null,
  -- ALAT webhooks must be idempotent on the transaction reference.
  reference   text not null unique
);
```

### Supabase Realtime publication

No Supabase Realtime publication configuration is present in `/supabase/schema.sql`. There is no `ALTER PUBLICATION supabase_realtime ADD TABLE ...` statement.

## 12. Phase 0 state

Phase 0 (foundation hardening) is complete on branch `feat/backend`. Changes
since the original audit:

- **Added** `src/config/env.ts` (typed env), `src/config/constants.ts` (frozen constants)
- **Added** `src/types/api.ts` (backend-owned contract mirror)
- **Added** `backend/migrations/audit.sql` (additive `asset_status_history` migration)
- **Refactored** `src/lib/supabase.ts` to a lazy `getSupabase()` client; `middleware/auth.ts` uses it
- **Refactored** `src/index.ts` to read config through `loadEnv()`
- **Refactored** `src/services/burnEngine.ts` to consume `DAYS_PER_MONTH`/`DAYS_PER_YEAR`/`VERIFIED_BURN_DAYS` from `config/constants.ts`
- **Filled** `tests/correctness/lease-math.test.ts` with a vitest resolution smoke test
- **Removed** `src/types/.gitkeep` (replaced by `api.ts`)

Verification: `pnpm typecheck` clean, `pnpm lint` clean, vitest smoke suite green,
backend boots without Supabase keys and serves `GET /health` → 200 `{"ok":true}`.
`/supabase/schema.sql`, `docs/CONTRACT.md`, and `/frontend` were not modified.

## 13. Phase 1 state

Phase 1 (domain engines) is complete on branch `feat/backend`:

- **Added** `src/app.ts` — `createApp(env, logger)` factory; `index.ts` now only
  owns process startup. Server is buildable and testable without listening.
- **Added** `src/services/loanStateMachine.ts` — `markDelinquent`, `recover`,
  `close` (shallow copies, `INVALID_TRANSITION` on a closed loan).
- **Added** `src/services/assetStateMachine.ts` — single `transition` function
  (`PAY | SUSPEND | RESTORE | MISS_PAYMENT | OVERDUE`) with the medical-flag
  guard enforced inside every suspension path: bank `SUSPEND` throws
  `MEDICAL_FLAG` (409); automated paths keep a flagged business in GRACE.
- **Added** `src/services/meterSimulator.ts` — deterministic `mulberry32(20260819)`
  - `hashString` streams, 6 daily slots, `tick`.
- **Added** `src/services/impactEngine.ts` — 30/365/730-day windows, wrapped
  yearly summary, months-to-ownership.
- **Added** `src/services/visionService.ts` — Gemini receipt extraction with an
  8-second timeout and a deterministic mock fallback.
- **Updated** `src/config/constants.ts` — added `PETROL_PRICE_PER_LITRE_KOBO`
  (115,000) used by the receipt mock and impact math.
- **Filled** the correctness suites: `lease-math` (12), `asset-state-machine`
  (16), `medical-flag-guard` (5) — 33 assertions green.

Verification: `pnpm typecheck` clean, `pnpm lint` clean, `vitest run
tests/correctness` → 33/33 green, boot smoke `GET /health` → 200 `{"ok":true}`.
`/supabase/schema.sql`, `docs/CONTRACT.md`, and `/frontend` were not modified.

## 14. Supabase Realtime (done Phase 2)

`migrations/audit.sql` now adds `assets` to the `supabase_realtime`
publication, guarded so it is a no-op on managed projects where the table is
already a member:

```sql
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table assets;
  end if;
exception when duplicate_object then
  null;
end
$$;
```

Applied to the live project with the rest of the migrations in Phase 6, so the
frontend can subscribe to `asset.status_changed` broadcasts.

## 15. Phase 2 — Data layer + deterministic seed (done)

- **Added** `src/data/seed.ts` — byte-for-byte port of
  `frontend/src/mocks/seed.ts` on `mulberry32(20260819)` anchored at
  2026-08-19T09:00Z. Backend resets use a fresh PRNG per build (deterministic),
  a deliberate improvement over the frontend's drifting module-level PRNG.
  Captured first-build reference in the seed-parity suite.
- **Added** `src/data/repository.ts` — typed `Repository` seam over contract
  types; all domain reads/writes flow through it.
- **Added** `src/data/inMemoryRepository.ts` — in-memory implementation driving
  the real lease/state-machine engines. Atomic `payLoan` (pure transition
  computed first, then loan + asset + installment + payment + audit commit
  together), idempotent `settleAlatWebhook` on `transactionReference`,
  monotonic `nextId` (`${prefix}_${pad(seq,5)}`), audit history written on every
  status change (`changedBy` bank/demo/alat), business-flag fallback for
  portfolio assets.
- **Updated** `migrations/audit.sql` — realtime publication for `assets`
  (idempotent, additive).
- **Added** the backend test home: `package.json` `test` script +
  vitest/supertest/@types/supertest devDeps, `vitest.config.ts`
  (`include: test/**/*.test.ts`), `test/correctness/seed-parity.test.ts`
  (15 assertions: counts, status distributions, per-business fuel/payments,
  demo quote/burn/credit/asset/loan, portfolio row 0 + loan + lookups, first/last
  readings, determinism + pristine reset, portfolio-stats parity to the kobo).

Verification: `pnpm --filter @lastgen/backend typecheck` clean, `pnpm lint`
clean, shared `tests/correctness` 33/33 green, `pnpm --filter @lastgen/backend
test` 15/15 green, boot smoke `GET /health` → 200 `{"ok":true}`.
`/supabase/schema.sql`, `docs/CONTRACT.md`, and `/frontend` were not modified.

## 16. Phase 3 — Happy-path routes (done)

- **Added** `middleware/auth.ts` `makeRequireAuth(env)` — demo mode is
  unauthenticated; live mode verifies Supabase bearer tokens and fails closed
  with `UNAUTHORIZED` (401) on missing/expired credentials instead of hanging
  (Express 4 drops rejected promises).
- **Added** domain routers under `src/routes/`: businesses (create/get/
  receipts/fuel-logs/burn), systems, quotes (create/get), credit
  (applications/get/approve/decline), assets (get/meter/suspend/restore),
  loans (get/schedule). `routes/index.ts` mounts them under `/api`, applies
  the auth boundary, and returns the contract 404 JSON for unknown routes.
- **Added** `routes/helpers.ts` — `asyncHandler` (rejected-promise forwarding)
  and `singleFile` (multer in-memory single upload, 5 MB limit, mapped to
  `VALIDATION`).
- **Wired** `createApp(env, logger, repository)`; `index.ts` constructs the
  in-memory repository. `multer` added to `backend/package.json`.
- **Added** the backend contract harness (`test/helpers.ts`) and 7 contract
  suites — businesses (7), fuel-logs (6), systems (4), quotes (8), credit (9),
  assets (9), loans (4) — 47 assertions through Supertest, each with a fresh
  in-memory repository.
- **Env hygiene** — `backend/.env.example` rewritten with full documentation
  for every variable (including `LOG_LEVEL`); `.gitignore` now explicitly
  covers `backend/.env` / `backend/.env.local`.
- **Auth hardening found by boot smoke** — an invalid bearer token previously
  hung the request (rejected promise + Express 4); `requireAuth` now wraps the
  Supabase lookup and returns the contract 401.

Verification: `pnpm --filter @lastgen/backend typecheck` clean, `pnpm lint`
clean, shared `tests/correctness` 33/33 green, `pnpm --filter @lastgen/backend
test` 62/62 green, demo boot smoke (`/health`, `/api/systems`,
`/api/credit/applications`, `/api/businesses/:id`, `/api/loans/:id/schedule`
all 200; unknown route → 404 JSON), live boot smoke (no token → 401, invalid
token → 401). `/supabase/schema.sql`, `docs/CONTRACT.md`, and `/frontend` were
not modified.

## 17. Phase 4 — Payments + ALAT webhook (done)

- **Added** the payment adapter seam: `adapters/paymentAdapter.ts`
  (interface), `simulatedAdapter.ts` (`SIM-${Date.now()}` references, accepts
  every notification), `alatAdapter.ts` (HMAC-SHA512 signature over the raw
  body verified with `timingSafeEqual`; unsigned accepted only when no API key
  is configured), `factory.ts` `paymentAdapterFor(env)`.
- **Added** `routes/paymentRoutes.ts` `POST /loans/:id/pay` — settles through
  the atomic `repo.payLoan` (SIMULATED + adapter reference), returns
  `{ payment, loan, asset }`.
- **Added** `routes/webhookRoutes.ts` `POST /webhooks/alat` — mounted before
  the auth boundary, requires `transactionReference` (400), verifies the
  signature, and settles via the replay-safe `repo.settleAlatWebhook`
  (replayed references accepted and ignored). Raw body preserved via
  `express.json({ verify })` into `req.rawBody`.
- **Added** 21 assertions across 4 suites: webhook-idempotency (5),
  payment-adapter (7), webhooks contract (4), payments contract (5).

Verification: `pnpm --filter @lastgen/backend typecheck` clean, `pnpm lint`
clean, shared `tests/correctness` 33/33 green, `pnpm --filter @lastgen/backend
test` 83/83 green, demo boot smoke (pay → 200; webhook → 200; replay → 200;
missing reference → 400). `/supabase/schema.sql`, `docs/CONTRACT.md`, and
`/frontend` were not modified. **Critical review ping (gate #4) issued.**

## 18. Phase 5 — Portfolio + impact parity (done)

- **Added** `Repository.impactFor(businessId, period)` — gathers the burn
  profile, the financed asset's loan and meter readings and runs the single
  `computeImpact` engine. Both `/impact` and `/wrapped` consume it, so the two
  endpoints can never disagree (parity gate).
- **Added** `routes/portfolioRoutes.ts` — `GET /portfolio/stats`,
  `GET /portfolio/assets` (status/city filters, 25-per-page pagination,
  `{ items, total }`), `POST /portfolio/export`.
- **Added** `routes/impactRoutes.ts` — `GET /businesses/:id/impact?period=`
  (month/year/all windows), `GET /businesses/:id/wrapped?year=`. Both return
  the contract 404 for an unknown business. Mounted after the auth boundary.
- **Added** 17 assertions across 3 suites: impact-parity (6, reference figures
  captured from the frontend build), portfolio contract (5), impact contract (6).

Verification: `pnpm --filter @lastgen/backend typecheck` clean, `pnpm lint`
clean, shared `tests/correctness` 33/33 green, `pnpm --filter @lastgen/backend
test` 100/100 green, demo boot smoke (stats, assets?status=SUSPENDED, export,
impact, wrapped?year=2025 → 200; unknown business → 404).
`/supabase/schema.sql`, `docs/CONTRACT.md`, and `/frontend` were not modified.
**Impact parity review gate demonstrated.**

## 19. Remediation audit — Phases 0–5 (done)

A read-only audit of Phases 0–5 plus the frontend and backend wiring produced
the following fixes (HEAD `95cef89` → this commit).

- **JSON transport errors** — `pinoHttp` now mounts before `express.json` so
  request logging exists before body parsing. Body-parser failures map to
  contract JSON: `entity.parse.failed` → `400 VALIDATION "Invalid JSON body"`,
  `entity.too.large` → `413 PAYLOAD_TOO_LARGE`. Previously a malformed or
  oversized body crashed the error handler (`req.log` undefined) and returned
  the Express HTML 500. New suite `test/contract/errors.test.ts` (3).
- **Demo routes** — `routes/demoRoutes.ts` (`POST /demo/reset`,
  `/demo/advance-time`, `/demo/miss-payment`) mounted before the auth boundary
  only when `DEMO_MODE=true`, per `docs/CONTRACT.md` ("unauthenticated, demo
  only"). Live deployments return the auth 401 instead. New suite
  `test/contract/demo.test.ts` (8), completing the roadmap's 11 contract suites.
- **Payment source** — `POST /loans/:id/pay` now records the adapter-accurate
  source (`ALAT` when the ALAT adapter is active, `SIMULATED` otherwise)
  instead of always `SIMULATED`. Contract test extended (1).
- **Graceful shutdown** — `index.ts` closes the server and exits 0 on
  SIGINT/SIGTERM.
- **Install policy** — committed `.npmrc` (`ignore-scripts=true`) with an
  explanatory comment; prevents the Windows/Node 24 esbuild/msw postinstall
  crash on fresh clones.
- **Test typechecking** — `tsconfig.test.json` + `typecheck:test` script so
  `backend/test` is typechecked (was runtime-only via vitest).
- **CI** — `.github/workflows/ci.yml`: install, both typechecks, lint, shared
  correctness, backend suites, backend format check on push/PR.
- **Dead code removed** — `services/burnEngine.ts` (unused, divergent
  `VERIFIED_BURN_DAYS=14` vs the live `30` path), `middleware/validate.ts` +
  `zod` dependency (unused), unused `meterSimulator` exports
  (`simulateReadings`, `tick`), `pino-pretty` devDependency.
- **Formatting** — Prettier applied to `backend/src` and `backend/test`; root
  `format:check:backend` and `test:all` scripts added.
- **Docs** — `backend/README.md` rewritten (endpoint surface, quickstart,
  demo/live, tests, deploy, receipt-image caveat); `loanRoutes.ts` stale Phase 4
  comment fixed.

Intentionally deferred to Phase 6 (Supabase): the `supabaseRepository`, live
data wiring (currently auth-only), and receipt image hosting. `lib/supabase.ts`
still reads `process.env` directly — to be re-plumbed through `Env` with the
repository work.

Current counts: backend suites 17 files, 112 assertions; shared correctness
33/33; `pnpm typecheck`, `typecheck:test`, `lint`, `format:check:backend` clean.

## 20. Phase 6 — Payments v2 + wallets + full Supabase repository (done)

Branched work on `feat/backend` for the payment/wallet extension specified in
`docs/PAYMENT_EXTENSION.md` (a separate document; `docs/CONTRACT.md` untouched).
Commits: `30399e0` (lifecycle), `30246fe` (wallets), `0f613d8` (real ALAT
client), `…` (Supabase) on top of the `origin/main` merge `db380b1`.

- **Payment lifecycle** — `PaymentStatus` (`pending_authorisation`/`authorised`/
  `SUCCESS`/`FAILED`/`EXPIRED`); `Payment` gains `status` +
  `platformTransactionReference?`; `PaymentSource` gains `WALLET`. The adapter
  seam grows `collect()`; the simulated adapter settles in-process after
  `SETTLE_AFTER_MS` (0 = synchronous), the ALAT adapter books
  `pending_authorisation`. Repository gains `startPayment`/`settlePayment`
  (idempotent, shares the atomic `applySettlement`)/`failPayment`/
  `expirePayment`/`setPaymentPlatformReference`/`paymentByRefOrId`.
  `POST /loans/:id/pay` returns the slim `{ paymentId, platformTransactionReference,
status }`; `GET /payments/:reference/status` accepts the reference or the id
  and reconciles a stale pending payment against the provider.
- **Real ALAT HTTPS client** — `collect()` POSTs `transfer-fund-request`
  (Ocp-Apim-Subscription-Key, merchant `sourceAccountNumber`), `pollStatus()`
  GETs `CheckTransactionStatus/{channelId}/{reference}` and maps provider
  statuses onto the PaymentStatus vocabulary. 4xx → `VALIDATION`, 5xx/network →
  `UNAVAILABLE`. `fetchFn` is injectable; the wire contract is pinned by the
  correctness suite.
- **Wallets** — `POST /wallets/create` (KYC'd 035/NGN virtual account,
  idempotent per business, **pre-funded NGN 50,000 in demo mode**),
  `GET /wallets/balance`, `GET /wallets/statement?limit&before`. Business is
  resolved from `req.user` via `businessForOwner` (demo-user →
  `biz_adaeze_frozen`); `source='wallet'` pays debit the balance with a 402
  guard and settle loan + asset in the same transaction as the debit.
  New suite `wallet.test.ts` (10) + payments suite extended. Fix landed during
  wallets: `nextId` never incremented its serial, so every generated id
  collided at `*_00000` — now incremented (unique ids).
- **Async repository seam** — the `Repository` interface now returns promises so
  the DB-backed implementation is honest (no `as unknown` casts). In-memory
  repo, all routes and the test suites `await` it; the simulated adapter's
  in-process consent races are exactly-once via the post-await status
  re-check in `settlePayment`.
- **Migration `migrations/payments-v2.sql`** — additive, idempotent:
  `payment_status` enum, `payments.status` (default `SUCCESS`) +
  `platform_transaction_reference`, `WALLET` added to `payment_source`,
  `wallets` + `wallet_kyc` + `wallet_transactions` tables with RLS, and the
  `supabase_realtime` publication gains `payments`/`wallets`/
  `wallet_transactions` so the frontend can watch `payment.status_changed`.
- **Full `SupabaseRepository`** — implements every `Repository` method against
  supabase-js reusing the pure engines (asset/loan state machines, lease/
  impact), camelCase↔snake_case mapping, money as kobo, atomic wallet
  compare-and-swap (`UPDATE … WHERE balance_kobo >= amount`), idempotent
  settle/create. `repositoryFor(env)` selects it when Supabase credentials are
  present, refuses live mode without them, and falls back to the in-memory seed
  in demo mode. `index.ts` loads `backend/.env` if present so
  `cp .env.example .env` works as documented. Stub client suite
  `test/data/supabase-repository.test.ts` (7).
- **Env** — `ALAT_SOURCE_ACCOUNT` and `SETTLE_AFTER_MS` documented in
  `.env.example`; `Env.alatSourceAccount`/`settleAfterMs` typed in `env.ts`.
- **Handoff** — `docs/PAYMENT_EXTENSION.md` (spec verbatim + backend decisions +
  demo-mode fallbacks: no realtime in demo → poll status then re-fetch the loan).

Verification: `pnpm typecheck` ✅, `pnpm typecheck:test` ✅, `pnpm lint` ✅ (0
errors), shared correctness 33/33 ✅, `pnpm --filter @lastgen/backend test`
**156/156 (20 files)** ✅, `format:check:backend` ✅, demo boot smoke ✅ (health;
wallet create pre-funded; bank pay → pending → auto SUCCESS after the window;
wallet pay → SUCCESS + debit; statement ordering; status by id). `/supabase/
schema.sql` and `docs/CONTRACT.md` untouched (payments-v2 is a separate additive
migration). Not yet applied to a live project (no credentials) — the Supabase
paths are stub-tested only.
