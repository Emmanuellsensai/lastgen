-- Lastgen payments v3 atomic migration
-- SECURITY DEFINER functions for atomic wallet debit, loan payment, and asset state transition.
-- Apply after payments-v2.sql.

begin;

-- ---------------------------------------------------------------------------
-- Function: fn_pay_from_wallet
-- Performs wallet balance check, CAS debit, wallet transaction record, payment
-- record, loan balance update, installment update, asset status transition,
-- and asset status history audit write within a single Postgres transaction.
-- ---------------------------------------------------------------------------

create or replace function fn_pay_from_wallet(
  p_business_id text,
  p_loan_id text,
  p_amount_kobo bigint,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet wallets%rowtype;
  v_loan loans%rowtype;
  v_asset assets%rowtype;
  v_business businesses%rowtype;
  v_new_loan_balance bigint;
  v_new_loan_status loan_status;
  v_old_asset_status asset_status;
  v_new_asset_status asset_status;
  v_wtx_id text;
  v_pay_id text;
  v_audit_id text;
  v_paid_at timestamptz := now();
begin
  -- Lock and load business
  select * into v_business from businesses where id = p_business_id for update;
  if not found then
    raise exception 'NOT_FOUND: Business % not found', p_business_id;
  end if;

  -- Lock and load loan
  select * into v_loan from loans where id = p_loan_id for update;
  if not found then
    raise exception 'NOT_FOUND: Loan % not found', p_loan_id;
  end if;
  if v_loan.status = 'CLOSED' then
    raise exception 'INVALID_TRANSITION: Loan % is already closed', p_loan_id;
  end if;

  -- Lock and load asset
  select * into v_asset from assets where id = v_loan.asset_id for update;
  if not found then
    raise exception 'NOT_FOUND: Asset % not found for loan %', v_loan.asset_id, p_loan_id;
  end if;

  -- Lock and load wallet
  select * into v_wallet from wallets where business_id = p_business_id for update;
  if not found then
    raise exception 'NOT_FOUND: Wallet for business % not found', p_business_id;
  end if;

  -- CAS balance check
  if v_wallet.balance_kobo < p_amount_kobo then
    raise exception 'PAYMENT_REQUIRED: Wallet balance % is insufficient for amount %', v_wallet.balance_kobo, p_amount_kobo;
  end if;

  -- Debit wallet
  update wallets
  set balance_kobo = balance_kobo - p_amount_kobo
  where id = v_wallet.id;

  -- Create wallet transaction
  v_wtx_id := 'wtx_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  insert into wallet_transactions (
    id, wallet_id, ts, direction, amount_kobo, description, reference, category
  ) values (
    v_wtx_id, v_wallet.id, v_paid_at, 'OUT', p_amount_kobo, 'Loan repayment', p_reference, 'loan_payment'
  );

  -- Create payment record
  v_pay_id := 'pay_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  insert into payments (
    id, loan_id, amount_kobo, paid_at, source, reference, status, platform_transaction_reference
  ) values (
    v_pay_id, v_loan.id, p_amount_kobo, v_paid_at, 'WALLET', p_reference, 'SUCCESS', null
  );

  -- Calculate new loan balance and status
  v_new_loan_balance := greatest(0, v_loan.balance_kobo - p_amount_kobo);
  if v_new_loan_balance = 0 then
    v_new_loan_status := 'CLOSED';
  elsif v_loan.status = 'DELINQUENT' then
    v_new_loan_status := 'ACTIVE';
  else
    v_new_loan_status := v_loan.status;
  end if;

  update loans
  set balance_kobo = v_new_loan_balance,
      status = v_new_loan_status
  where id = v_loan.id;

  -- Mark next unpaid installment paid
  update installments
  set paid_at = v_paid_at
  where (loan_id, n) = (
    select loan_id, n from installments
    where loan_id = v_loan.id and paid_at is null
    order by n asc
    limit 1
  );

  -- Determine asset status transition
  v_old_asset_status := v_asset.status;
  if v_new_loan_balance = 0 then
    v_new_asset_status := 'OWNED';
  elsif v_asset.status in ('GRACE', 'SUSPENDED') then
    v_new_asset_status := 'ACTIVE';
  else
    v_new_asset_status := v_asset.status;
  end if;

  if v_new_asset_status <> v_old_asset_status then
    update assets
    set status = v_new_asset_status,
        suspended_at = case when v_new_asset_status = 'ACTIVE' or v_new_asset_status = 'OWNED' then null else suspended_at end,
        suspend_reason = case when v_new_asset_status = 'ACTIVE' or v_new_asset_status = 'OWNED' then null else suspend_reason end
    where id = v_asset.id;

    -- Record audit log entry
    v_audit_id := 'ash_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    insert into asset_status_history (
      id, asset_id, from_status, to_status, reason, changed_at, changed_by
    ) values (
      v_audit_id, v_asset.id, v_old_asset_status, v_new_asset_status, 'Wallet payment received', v_paid_at, 'wallet'
    );
  end if;

  return jsonb_build_object(
    'payment_id', v_pay_id,
    'loan_id', v_loan.id,
    'asset_id', v_asset.id,
    'status', 'SUCCESS'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Function: fn_settle_payment
-- Settles a pending_authorisation payment atomically.
-- ---------------------------------------------------------------------------

create or replace function fn_settle_payment(
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment payments%rowtype;
  v_loan loans%rowtype;
  v_asset assets%rowtype;
  v_business businesses%rowtype;
  v_new_loan_balance bigint;
  v_new_loan_status loan_status;
  v_old_asset_status asset_status;
  v_new_asset_status asset_status;
  v_audit_id text;
  v_now timestamptz := now();
begin
  -- Lock pending payment
  select * into v_payment from payments
  where reference = p_reference and status = 'pending_authorisation'
  for update;

  if not found then
    -- Return current payment if already settled
    select * into v_payment from payments where reference = p_reference;
    if found then
      return jsonb_build_object(
        'payment_id', v_payment.id,
        'loan_id', v_payment.loan_id,
        'status', v_payment.status
      );
    end if;
    raise exception 'NOT_FOUND: Payment with reference % not found', p_reference;
  end if;

  -- Lock loan and asset
  select * into v_loan from loans where id = v_payment.loan_id for update;
  select * into v_asset from assets where id = v_loan.asset_id for update;

  -- Update payment status to SUCCESS
  update payments set status = 'SUCCESS' where id = v_payment.id;

  -- Update loan balance and status
  v_new_loan_balance := greatest(0, v_loan.balance_kobo - v_payment.amount_kobo);
  if v_new_loan_balance = 0 then
    v_new_loan_status := 'CLOSED';
  elsif v_loan.status = 'DELINQUENT' then
    v_new_loan_status := 'ACTIVE';
  else
    v_new_loan_status := v_loan.status;
  end if;

  update loans
  set balance_kobo = v_new_loan_balance,
      status = v_new_loan_status
  where id = v_loan.id;

  -- Mark next unpaid installment paid
  update installments
  set paid_at = v_now
  where (loan_id, n) = (
    select loan_id, n from installments
    where loan_id = v_loan.id and paid_at is null
    order by n asc
    limit 1
  );

  -- Determine asset status transition
  v_old_asset_status := v_asset.status;
  if v_new_loan_balance = 0 then
    v_new_asset_status := 'OWNED';
  elsif v_asset.status in ('GRACE', 'SUSPENDED') then
    v_new_asset_status := 'ACTIVE';
  else
    v_new_asset_status := v_asset.status;
  end if;

  if v_new_asset_status <> v_old_asset_status then
    update assets
    set status = v_new_asset_status,
        suspended_at = case when v_new_asset_status = 'ACTIVE' or v_new_asset_status = 'OWNED' then null else suspended_at end,
        suspend_reason = case when v_new_asset_status = 'ACTIVE' or v_new_asset_status = 'OWNED' then null else suspend_reason end
    where id = v_asset.id;

    v_audit_id := 'ash_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    insert into asset_status_history (
      id, asset_id, from_status, to_status, reason, changed_at, changed_by
    ) values (
      v_audit_id, v_asset.id, v_old_asset_status, v_new_asset_status, 'Payment settled', v_now, case when v_payment.source = 'ALAT' then 'alat' else 'bank' end
    );
  end if;

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'loan_id', v_loan.id,
    'status', 'SUCCESS'
  );
end;
$$;

commit;
