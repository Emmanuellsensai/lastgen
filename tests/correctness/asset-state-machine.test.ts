import { describe, expect, it } from 'vitest';
import { ApiError } from '../../backend/src/middleware/errorHandler.js';
import { transition } from '../../backend/src/services/assetStateMachine.js';
import type { Asset, Business, Loan } from '../../backend/src/types/api.js';

// Correctness suite: asset-state-machine
// Verifies the frozen transitions:
//   ACTIVE -> GRACE -> SUSPENDED -> ACTIVE
//   ACTIVE -> OWNED | GRACE -> OWNED (loan balance clears)

/** Asserts a function throws an ApiError with the given stable code. */
function throwsCode(run: () => unknown, code: string) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
    return;
  }
  throw new Error(`expected ApiError with code ${code}`);
}

const NOW = new Date('2026-09-01T00:00:00.000Z');

function makeBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: 'biz_test',
    name: 'Test Business',
    type: 'Shop',
    city: 'Lagos',
    generatorKva: 2.5,
    hoursPerDay: 8,
    createdAt: '2026-01-01T00:00:00.000Z',
    medicalFlag: false,
    ...overrides,
  };
}

function makeAsset(status: Asset['status'] = 'ACTIVE'): Asset {
  return {
    id: 'ast_test',
    businessId: 'biz_test',
    systemId: 'sys_shop_15',
    serial: 'LG-00001',
    controllerId: 'CTL-00001',
    status,
    installedAt: '2026-06-01T00:00:00.000Z',
    suspendedAt: status === 'SUSPENDED' ? '2026-08-20T00:00:00.000Z' : undefined,
    suspendReason: status === 'SUSPENDED' ? 'Grace period expired' : undefined,
  };
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'loan_test',
    assetId: 'ast_test',
    principalKobo: 900_000,
    tenorMonths: 12,
    monthlyPaymentKobo: 75_000,
    balanceKobo: 600_000,
    nextDueAt: '2026-08-01T00:00:00.000Z',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('PAY', () => {
  it('reduces the balance and keeps the asset active', () => {
    const asset = makeAsset();
    const loan = makeLoan();
    const result = transition(asset, loan, makeBusiness(), 'PAY', {
      now: NOW,
      amountKobo: 75_000,
    });
    expect(result.asset.status).toBe('ACTIVE');
    expect(result.loan.balanceKobo).toBe(525_000);
    expect(result.loan.status).toBe('ACTIVE');
    expect(result.loan.nextDueAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('restores a grace or suspended asset to active', () => {
    for (const status of ['GRACE', 'SUSPENDED'] as const) {
      const asset = makeAsset(status);
      const loan = makeLoan({ status: 'DELINQUENT' });
      const result = transition(asset, loan, makeBusiness(), 'PAY', {
        now: NOW,
        amountKobo: 75_000,
      });
      expect(result.asset.status).toBe('ACTIVE');
      expect(result.asset.suspendedAt).toBeUndefined();
      expect(result.asset.suspendReason).toBeUndefined();
      expect(result.loan.status).toBe('ACTIVE');
    }
  });

  it('transfers ownership when the balance reaches zero', () => {
    const asset = makeAsset();
    const loan = makeLoan({ balanceKobo: 75_000 });
    const result = transition(asset, loan, makeBusiness(), 'PAY', {
      now: NOW,
      amountKobo: 75_000,
    });
    expect(result.asset.status).toBe('OWNED');
    expect(result.loan.status).toBe('CLOSED');
    expect(result.loan.balanceKobo).toBe(0);
  });

  it('rejects payment on a closed loan', () => {
    const loan = makeLoan({ status: 'CLOSED', balanceKobo: 0 });
    throwsCode(
      () => transition(makeAsset(), loan, makeBusiness(), 'PAY', { now: NOW, amountKobo: 75_000 }),
      'INVALID_TRANSITION',
    );
  });

  it('rejects a non-positive amount', () => {
    throwsCode(
      () => transition(makeAsset(), makeLoan(), makeBusiness(), 'PAY', { now: NOW, amountKobo: 0 }),
      'VALIDATION',
    );
  });
});

describe('SUSPEND and RESTORE', () => {
  it('suspends an active asset with a reason', () => {
    const result = transition(makeAsset(), makeLoan(), makeBusiness(), 'SUSPEND', {
      now: NOW,
      reason: 'Two instalments overdue',
    });
    expect(result.asset.status).toBe('SUSPENDED');
    expect(result.asset.suspendedAt).toBe('2026-09-01T00:00:00.000Z');
    expect(result.asset.suspendReason).toBe('Two instalments overdue');
  });

  it('refuses to suspend an owned asset', () => {
    throwsCode(
      () =>
        transition(makeAsset('OWNED'), makeLoan({ status: 'CLOSED' }), makeBusiness(), 'SUSPEND', {
          now: NOW,
          reason: 'nope',
        }),
      'INVALID_TRANSITION',
    );
  });

  it('requires a reason to suspend', () => {
    throwsCode(
      () => transition(makeAsset(), makeLoan(), makeBusiness(), 'SUSPEND', { now: NOW }),
      'VALIDATION',
    );
  });

  it('restores a suspended asset and clears the fields', () => {
    const asset = makeAsset('SUSPENDED');
    const loan = makeLoan({ status: 'DELINQUENT' });
    const result = transition(asset, loan, makeBusiness(), 'RESTORE', { now: NOW });
    expect(result.asset.status).toBe('ACTIVE');
    expect(result.asset.suspendedAt).toBeUndefined();
    expect(result.asset.suspendReason).toBeUndefined();
    expect(result.loan.status).toBe('ACTIVE');
  });

  it('refuses to restore an owned asset', () => {
    throwsCode(
      () =>
        transition(makeAsset('OWNED'), makeLoan({ status: 'CLOSED' }), makeBusiness(), 'RESTORE', {
          now: NOW,
        }),
      'INVALID_TRANSITION',
    );
  });
});

describe('MISS_PAYMENT', () => {
  it('moves an active asset into grace and marks the loan delinquent', () => {
    const result = transition(makeAsset(), makeLoan(), makeBusiness(), 'MISS_PAYMENT', {
      now: NOW,
    });
    expect(result.asset.status).toBe('GRACE');
    expect(result.loan.status).toBe('DELINQUENT');
  });

  it('escalates a grace asset to suspended on a second miss', () => {
    const result = transition(makeAsset('GRACE'), makeLoan({ status: 'DELINQUENT' }), makeBusiness(), 'MISS_PAYMENT', {
      now: NOW,
    });
    expect(result.asset.status).toBe('SUSPENDED');
    expect(result.asset.suspendReason).toBe('Grace period expired without payment');
  });

  it('refuses to miss a payment on an owned asset', () => {
    throwsCode(
      () =>
        transition(makeAsset('OWNED'), makeLoan({ status: 'CLOSED' }), makeBusiness(), 'MISS_PAYMENT', {
          now: NOW,
        }),
      'INVALID_TRANSITION',
    );
  });
});

describe('OVERDUE', () => {
  it('moves an overdue-but-within-grace asset to grace', () => {
    const asset = makeAsset();
    const loan = makeLoan({ nextDueAt: '2026-08-31T00:00:00.000Z' }); // 1 day overdue
    const result = transition(asset, loan, makeBusiness(), 'OVERDUE', { now: NOW });
    expect(result.asset.status).toBe('GRACE');
    expect(result.loan.status).toBe('DELINQUENT');
  });

  it('suspends once the grace window (72h) has elapsed', () => {
    const asset = makeAsset();
    const loan = makeLoan({ nextDueAt: '2026-08-20T00:00:00.000Z' }); // 12 days overdue
    const result = transition(asset, loan, makeBusiness(), 'OVERDUE', { now: NOW });
    expect(result.asset.status).toBe('SUSPENDED');
    expect(result.loan.status).toBe('DELINQUENT');
  });

  it('leaves a not-yet-overdue loan untouched', () => {
    const asset = makeAsset();
    const loan = makeLoan({ nextDueAt: '2026-10-01T00:00:00.000Z' });
    const result = transition(asset, loan, makeBusiness(), 'OVERDUE', { now: NOW });
    expect(result.asset.status).toBe('ACTIVE');
    expect(result.loan.status).toBe('ACTIVE');
  });
});