-- ============================================================
-- Lastgen: Apply ALL missing migrations to Supabase
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- All migrations are idempotent (safe to run multiple times)
-- ============================================================

begin;

-- ============================================================
-- 1. audit.sql: Asset status audit trail
-- ============================================================
create table if not exists asset_status_history (
  id          text primary key,
  asset_id    text not null references assets (id) on delete cascade,
  from_status asset_status,
  to_status   asset_status not null,
  reason      text,
  changed_at  timestamptz not null default now(),
  changed_by  text
);

create index if not exists asset_status_history_asset_id_idx
  on asset_status_history (asset_id, changed_at desc);

alter table asset_status_history enable row level security;

drop policy if exists asset_status_history_owner on asset_status_history;
create policy asset_status_history_owner on asset_status_history
  for select to authenticated using (
    exists (
      select 1 from assets a
      where a.id = asset_status_history.asset_id
        and owns_business(a.business_id)
    )
  );

-- ============================================================
-- 2. payments-v2.sql: Payment status + wallets
-- ============================================================
do $$ begin
  create type payment_status as enum
    ('pending_authorisation', 'authorised', 'SUCCESS', 'FAILED', 'EXPIRED');
exception when duplicate_object then null; end $$;

alter table payments add column if not exists status payment_status not null default 'SUCCESS';
alter table payments add column if not exists platform_transaction_reference text;

alter type payment_source add value if not exists 'WALLET';

do $$ begin
  create type wallet_tx_direction as enum ('IN', 'OUT');
exception when duplicate_object then null; end $$;

create table if not exists wallets (
  id             text primary key,
  business_id    text not null unique references businesses (id) on delete cascade,
  account_number text not null unique check (account_number ~ '^[0-9]{10}$'),
  bank_code      text not null default '035',
  currency       text not null default 'NGN',
  balance_kobo   bigint not null default 0 check (balance_kobo >= 0),
  created_at     timestamptz not null default now()
);

create table if not exists wallet_kyc (
  wallet_id  text primary key references wallets (id) on delete cascade,
  nin        text not null,
  first_name text not null,
  last_name  text not null,
  phone      text not null,
  created_at timestamptz not null default now()
);

create index if not exists wallets_business_id_idx on wallets (business_id);

create table if not exists wallet_transactions (
  id          text primary key,
  wallet_id   text not null references wallets (id) on delete cascade,
  direction   wallet_tx_direction not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  category    text not null,
  description text,
  reference   text not null unique,
  ts          timestamptz not null default now()
);

create index if not exists wallet_transactions_wallet_ts_idx
  on wallet_transactions (wallet_id, ts desc);

alter table wallets             enable row level security;
alter table wallet_kyc          enable row level security;
alter table wallet_transactions enable row level security;

drop policy if exists wallets_owner on wallets;
create policy wallets_owner on wallets
  for all to authenticated using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists wallet_kyc_owner on wallet_kyc;
create policy wallet_kyc_owner on wallet_kyc
  for select to authenticated using (
    exists (select 1 from wallets w where w.id = wallet_kyc.wallet_id and owns_business(w.business_id))
  );

drop policy if exists wallet_transactions_owner on wallet_transactions;
create policy wallet_transactions_owner on wallet_transactions
  for select to authenticated using (
    exists (select 1 from wallets w where w.id = wallet_transactions.wallet_id and owns_business(w.business_id))
  );

-- ============================================================
-- 3. applications.sql: Credit file submission stamp
-- ============================================================
alter table credit_files add column if not exists submitted_at timestamptz;

create index if not exists credit_files_submitted_at_idx
  on credit_files (business_id, submitted_at desc);

-- ============================================================
-- 4. rbac-kyc.sql: Bank identities + KYC records
-- ============================================================
create table if not exists bank_users (
  id         uuid primary key references auth.users (id) on delete cascade,
  bank_id    text not null unique,
  bank_name  text not null,
  created_at timestamptz not null default now()
);

alter table bank_users enable row level security;

do $$ begin
  create type kyc_status as enum ('unverified', 'pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists kyc_records (
  id               text primary key,
  business_id      text not null references businesses (id) on delete cascade,
  user_id          uuid references auth.users (id) on delete set null,
  status           kyc_status not null default 'unverified',
  submitted_at     timestamptz,
  reviewed_at      timestamptz,
  rejection_reason text,
  selfie_url       text,
  bank_slip_url    text,
  nin_number       text,
  nin_verified     boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists kyc_records_business_id_idx
  on kyc_records (business_id);

alter table kyc_records enable row level security;

drop policy if exists kyc_records_owner on kyc_records;
create policy kyc_records_owner on kyc_records
  for all to authenticated using (owns_business(business_id)) with check (owns_business(business_id));

-- ============================================================
-- 5. Realtime publications (idempotent)
-- ============================================================
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['payments', 'wallets', 'wallet_transactions', 'assets']
    loop
      begin
        execute format('alter publication supabase_realtime add table %I', t);
      exception when duplicate_object then
        null;
      end;
    end loop;
  end if;
end
$$;

commit;
