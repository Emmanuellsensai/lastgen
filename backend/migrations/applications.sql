-- Lastgen backend migration: credit file submission stamp
--
-- Additive migration applied AFTER supabase/schema.sql. A credit file is
-- opened as soon as a quote is generated; submitted_at records the moment the
-- owner accepted that quote (POST /api/quotes/:id/accept), which is what the
-- dashboard's application stepper reads. Existing rows predate the accept flow
-- and stay null.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f backend/migrations/applications.sql
-- Idempotent: safe to run more than once.

begin;

alter table credit_files add column if not exists submitted_at timestamptz;

create index if not exists credit_files_submitted_at_idx
  on credit_files (business_id, submitted_at desc);

commit;
