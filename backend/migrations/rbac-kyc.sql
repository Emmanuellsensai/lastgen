-- Lastgen backend migration: RBAC + KYC records
--
-- Additive migration applied AFTER supabase/schema.sql (alongside
-- audit.sql and payments-v2.sql). Introduces the persistence for the
-- bank/admin sprint:
--
--   * bank_users   — credit-desk identities mirroring auth.users
--   * kyc_records  — business identity verification lifecycle
--   * kyc-docs     — private storage bucket for bank slips and selfies
--
-- auth.users remains the source of truth for credentials and the role
-- claim (app_metadata.role = 'bank'); bank_users only carries the
-- descriptive columns the API joins against. This file does not modify
-- schema.sql.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f backend/migrations/rbac-kyc.sql
-- Idempotent: safe to run more than once.

begin;

create table if not exists bank_users (
  id         uuid primary key references auth.users (id) on delete cascade,
  bank_id    text not null unique,
  bank_name  text not null,
  created_at timestamptz not null default now()
);

alter table bank_users enable row level security;

-- No owner policies on purpose: bank identities are managed exclusively
-- through the service role, mirroring credit_files / portfolio where
-- authorization lives in the API layer, not the database.

-- KYC status vocabulary for identity verification. Distinct from
-- wallet_kyc, which captures virtual-account data at wallet creation.
do $$
begin
  create type kyc_status as enum ('unverified', 'pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end
$$;

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

-- One KYC record per business; upserts target this key.
create unique index if not exists kyc_records_business_id_key
  on kyc_records (business_id);

-- Owners may read their own KYC record, mirroring assets_owner. Writes go
-- through the service role only (submission/review happen via the API).
alter table kyc_records enable row level security;

drop policy if exists kyc_records_owner on kyc_records;
create policy kyc_records_owner on kyc_records
  for select to authenticated using (owns_business(business_id));

-- Private bucket for KYC documents. Public access stays off; the API hands
-- out time-limited signed URLs instead.
insert into storage.buckets (id, name, public)
values ('kyc-docs', 'kyc-docs', false)
on conflict (id) do nothing;

commit;
