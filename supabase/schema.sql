-- LastGen schema
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
