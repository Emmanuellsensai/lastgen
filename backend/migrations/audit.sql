-- Lastgen backend migration: asset status audit trail
--
-- Additive migration applied AFTER supabase/schema.sql. It records every asset
-- status transition so the asset state machine can write a full audit history.
-- The backend assignment requires an audit row per transition; the base schema
-- deliberately has no such table, and this file does not modify schema.sql.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f backend/migrations/audit.sql
-- Idempotent: safe to run more than once.

begin;

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

-- Owners may read the audit trail of their own assets, mirroring the
-- assets_owner policy. The service role bypasses RLS for the whole book.
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

commit;