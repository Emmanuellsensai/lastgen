import { DEFAULT_GRACE_PERIOD_HOURS } from '../config/constants.js';
import { ApiError } from '../middleware/errorHandler.js';
import type { Asset, AssetStatus, Business, Loan, LoanStatus } from '../types/api.js';
import { close, markDelinquent, recover } from './loanStateMachine.js';

// Asset state machine — the single place that may change asset status.
//
// Frozen transitions (docs/CONTRACT.md):
//   ACTIVE    -> GRACE (payment overdue) | OWNED (loan balance = 0)
//   GRACE     -> SUSPENDED (grace expires) | ACTIVE (payment received) | OWNED
//   SUSPENDED -> ACTIVE (payment received)
//   Suspension NEVER applies when business.medicalFlag = true.
//
// Every suspension path funnels through the private applySuspension helper, so
// the medical-flag guard cannot be bypassed from a call site. The function
// returns shallow copies of the entities plus a from/to summary that the
// orchestration layer uses to persist, write the audit trail, and broadcast.

export type AssetAction = 'PAY' | 'SUSPEND' | 'RESTORE' | 'MISS_PAYMENT' | 'OVERDUE';

export interface TransitionContext {
  now: Date;
  amountKobo?: number;
  reason?: string;
}

export interface TransitionResult {
  asset: Asset;
  loan: Loan;
  from: AssetStatus;
  to: AssetStatus;
  loanFrom: LoanStatus;
  loanTo: LoanStatus;
  reason?: string;
}

const DAY_MS = 86_400_000;

export function transition(
  asset: Asset,
  loan: Loan,
  business: Business,
  action: AssetAction,
  ctx: TransitionContext,
): TransitionResult {
  switch (action) {
    case 'PAY':
      return applyPayment(asset, loan, ctx);
    case 'SUSPEND':
      return applySuspension(asset, loan, business, ctx);
    case 'RESTORE':
      return applyRestore(asset, loan, ctx);
    case 'MISS_PAYMENT':
      return applyMissPayment(asset, loan, business, ctx);
    case 'OVERDUE':
      return applyOverdue(asset, loan, business, ctx);
  }
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function applyPayment(asset: Asset, loan: Loan, ctx: TransitionContext): TransitionResult {
  const amount = ctx.amountKobo;
  if (amount === undefined || !Number.isInteger(amount) || amount <= 0) {
    throw new ApiError('VALIDATION', 'amountKobo must be a positive integer', 400);
  }
  if (loan.status === 'CLOSED') {
    throw new ApiError('INVALID_TRANSITION', 'This loan is already closed', 409);
  }

  const nextLoan = { ...loan, balanceKobo: Math.max(0, loan.balanceKobo - amount) };
  nextLoan.nextDueAt = new Date(ctx.now.getTime() + 30 * DAY_MS).toISOString();
  const nextAsset = { ...asset };

  if (nextLoan.balanceKobo === 0) {
    // Ownership transfers the moment the loan balance clears.
    const ownedLoan = close(nextLoan);
    const ownedAsset = {
      ...asset,
      status: 'OWNED' as const,
      suspendedAt: undefined,
      suspendReason: undefined,
    };
    return summarize(ownedAsset, ownedLoan, asset, loan);
  }

  if (nextAsset.status === 'GRACE' || nextAsset.status === 'SUSPENDED') {
    nextAsset.status = 'ACTIVE';
    nextAsset.suspendedAt = undefined;
    nextAsset.suspendReason = undefined;
  }
  nextLoan.status = 'ACTIVE';
  return summarize(nextAsset, nextLoan, asset, loan);
}

function applySuspension(
  asset: Asset,
  loan: Loan,
  business: Business,
  ctx: TransitionContext,
): TransitionResult {
  if (!ctx.reason) {
    throw new ApiError('VALIDATION', 'reason is required', 400);
  }
  if (asset.status === 'OWNED') {
    throw new ApiError('INVALID_TRANSITION', 'An owned asset cannot be suspended', 409);
  }
  guardSuspension(business);

  const nextAsset = {
    ...asset,
    status: 'SUSPENDED' as const,
    suspendedAt: ctx.now.toISOString(),
    suspendReason: ctx.reason,
  };
  return summarize(nextAsset, { ...loan }, asset, loan);
}

function applyRestore(asset: Asset, loan: Loan, _ctx: TransitionContext): TransitionResult {
  if (asset.status === 'OWNED') {
    throw new ApiError('INVALID_TRANSITION', 'An owned asset is already unrestricted', 409);
  }

  const nextAsset = {
    ...asset,
    status: 'ACTIVE' as const,
    suspendedAt: undefined,
    suspendReason: undefined,
  };
  const nextLoan = loan.status === 'DELINQUENT' ? recover(loan) : { ...loan };
  return summarize(nextAsset, nextLoan, asset, loan);
}

function applyMissPayment(
  asset: Asset,
  loan: Loan,
  business: Business,
  ctx: TransitionContext,
): TransitionResult {
  if (asset.status === 'OWNED') {
    throw new ApiError('INVALID_TRANSITION', 'An owned asset has nothing left to miss', 409);
  }

  const nextLoan = markDelinquent(loan);
  let nextAsset: Asset;

  if (asset.status === 'ACTIVE') {
    nextAsset = { ...asset, status: 'GRACE' };
  } else if (asset.status === 'GRACE') {
    // A second missed window escalates to suspension — unless the business
    // carries the medical flag, in which case it stays in grace.
    if (canSuspend(business)) {
      nextAsset = {
        ...asset,
        status: 'SUSPENDED' as const,
        suspendedAt: ctx.now.toISOString(),
        suspendReason: 'Grace period expired without payment',
      };
    } else {
      nextAsset = { ...asset };
    }
  } else {
    nextAsset = { ...asset };
  }

  return summarize(nextAsset, nextLoan, asset, loan);
}

function applyOverdue(
  asset: Asset,
  loan: Loan,
  business: Business,
  ctx: TransitionContext,
): TransitionResult {
  if (loan.status === 'CLOSED' || asset.status === 'OWNED') {
    return summarize({ ...asset }, { ...loan }, asset, loan);
  }

  const overdueBy = ctx.now.getTime() - new Date(loan.nextDueAt).getTime();
  if (overdueBy <= 0) {
    return summarize({ ...asset }, { ...loan }, asset, loan);
  }

  const nextLoan = markDelinquent(loan);
  const graceMs = DEFAULT_GRACE_PERIOD_HOURS * 3_600_000;

  if (overdueBy > graceMs && canSuspend(business)) {
    const suspended = {
      ...asset,
      status: 'SUSPENDED' as const,
      suspendedAt: ctx.now.toISOString(),
      suspendReason: 'Grace period expired without payment',
    };
    return summarize(suspended, nextLoan, asset, loan);
  }

  if (asset.status === 'ACTIVE') {
    return summarize({ ...asset, status: 'GRACE' }, nextLoan, asset, loan);
  }

  return summarize({ ...asset }, nextLoan, asset, loan);
}

/* ------------------------------------------------------------------ */
/* Guards and helpers                                                  */
/* ------------------------------------------------------------------ */

/** Raises MEDICAL_FLAG instead of allowing a suspension to be produced. */
function guardSuspension(business: Business): void {
  if (!canSuspend(business)) {
    throw new ApiError(
      'MEDICAL_FLAG',
      'This business is flagged for medical load. Suspension is blocked.',
      409,
    );
  }
}

/** Automated paths never suspend a medical-flag business; they stay in grace. */
function canSuspend(business: Business): boolean {
  return !business.medicalFlag;
}

function summarize(
  nextAsset: Asset,
  nextLoan: Loan,
  originalAsset: Asset,
  originalLoan: Loan,
): TransitionResult {
  return {
    asset: nextAsset,
    loan: nextLoan,
    from: originalAsset.status,
    to: nextAsset.status,
    loanFrom: originalLoan.status,
    loanTo: nextLoan.status,
    reason: nextAsset.suspendReason,
  };
}