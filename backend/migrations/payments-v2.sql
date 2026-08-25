-- Lastgen backend migration: payments v2 + business wallets
--
-- Additive migration applied AFTER supabase/schema.sql and backend/migrations/audit.sql.
-- Extends the payment ledger with the lifecycle (status + provider platform
-- reference) and adds the business cash wallet so POST /loans/:id/pay can
-- debit source='wallet'. The base schema already carries payments; this file
-- does not modify schema.sql — it only adds columns and new tables.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f backend/migrations/payments-v2.sql
-- Idempotent: safe to run more than once.

begin;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type payment_status as enum
    ('pending_authorisation', 'authorised', 'SUCCESS', 'FAILED', 'EXPIRED');
exception when duplicate_object then null; end $$;

-- Existing rows are settled payments; every future payment book starts pending.
alter table payments add column if not exists status payment_status not null default 'SUCCESS';
alter table payments add column if not exists platform_transaction_reference text;

-- Wallets debit through the same payments ledger, so the source enum grows.
alter type payment_source add value if not exists 'WALLET';

do $$ begin
  create type wallet_tx_direction as enum ('IN', 'OUT');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- wallets
-- ---------------------------------------------------------------------------

create table if not exists wallets (
  id             text primary key,
  business_id    text not null unique references businesses (id) on delete cascade,
  account_number text not null unique check (account_number ~ '^[0-9]{10}$'),
  bank_code      text not null default '035',
  currency       text not null default 'NGN',
  balance_kobo   bigint not null default 0 check (balance_kobo >= 0),
  created_at     timestamptz not null default now()
);

-- KYC payload for the virtual account. The API surface returns only the Wallet,
-- but onboarding requires nin/firstName/lastName/phone before an account opens.
create table if not exists wallet_kyc (
  wallet_id  text primary key references wallets (id) on delete cascade,
  nin        text not null,
  first_name text not null,
  last_name  text not null,
  phone      text not null,
  created_at timestamptz not null default now()
);

create index if not exists wallets_business_id_idx on wallets (business_id);

-- ---------------------------------------------------------------------------
-- wallet_transactions
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Wallets and their statements belong to the owning business, exactly like
-- every other owned table. The service role bypasses RLS for the whole book.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Realtime
--
-- Payments broadcast row changes on the `payments` table; the frontend
-- subscribes to the `payments` channel and watches `payment.status_changed`
-- (payment INSERTed pending_authorisation, UPDATEed SUCCESS/FAILED/EXPIRED).
-- Wallets broadcast so balance/statement updates stream live too.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['payments', 'wallets', 'wallet_transactions']
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