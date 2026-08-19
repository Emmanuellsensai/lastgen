import { describe, expect, it } from 'vitest';
import { ApiError } from '../../backend/src/middleware/errorHandler.js';
import { transition } from '../../backend/src/services/assetStateMachine.js';
import type { Asset, Business, Loan } from '../../backend/src/types/api.js';

// Correctness suite: medical-flag-guard
// The medical flag must block EVERY suspension path — bank suspend, a missed
// payment escalation, and the advance-time overdue sweep. Payments still work.

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

const MEDICAL: Business = {
  id: 'biz_gwarinpa_mart',
  name: 'Gwarinpa Value Mart',
  type: 'Mini-supermarket',
  city: 'Abuja',
  generatorKva: 8.0,
  hoursPerDay: 12,
  createdAt: '2026-07-11T00:00:00.000Z',
  medicalFlag: true,
};

function makeAsset(status: Asset['status'] = 'ACTIVE'): Asset {
  return {
    id: 'ast_medical',
    businessId: MEDICAL.id,
    systemId: 'sys_works_100',
    serial: 'LG-00006',
    controllerId: 'CTL-00006',
    status,
    installedAt: '2026-06-01T00:00:00.000Z',
    suspendedAt: status === 'SUSPENDED' ? '2026-08-20T00:00:00.000Z' : undefined,
    suspendReason: status === 'SUSPENDED' ? 'Previous attempt' : undefined,
  };
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'loan_medical',
    assetId: 'ast_medical',
    principalKobo: 871_200_000,
    tenorMonths: 30,
    monthlyPaymentKobo: 34_200_000,
    balanceKobo: 750_000_000,
    nextDueAt: '2026-08-20T00:00:00.000Z',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('medical-flag guard', () => {
  it('blocks a direct bank suspension', () => {
    throwsCode(
      () =>
        transition(makeAsset(), makeLoan(), MEDICAL, 'SUSPEND', {
          now: NOW,
          reason: 'Two instalments overdue',
        }),
      'MEDICAL_FLAG',
    );
  });

  it('blocks a grace-to-suspended escalation on a missed payment', () => {
    const result = transition(
      makeAsset('GRACE'),
      makeLoan({ status: 'DELINQUENT' }),
      MEDICAL,
      'MISS_PAYMENT',
      { now: NOW },
    );
    expect(result.asset.status).not.toBe('SUSPENDED');
    expect(result.asset.status).toBe('GRACE');
    expect(result.loan.status).toBe('DELINQUENT');
  });

  it('blocks the overdue sweep once the grace window has elapsed', () => {
    const asset = makeAsset();
    const loan = makeLoan({ nextDueAt: '2026-08-20T00:00:00.000Z' }); // 12 days overdue
    const result = transition(asset, loan, MEDICAL, 'OVERDUE', { now: NOW });
    expect(result.asset.status).not.toBe('SUSPENDED');
    expect(result.asset.status).toBe('GRACE');
    expect(result.loan.status).toBe('DELINQUENT');
  });

  it('still allows payment to restore the asset to active', () => {
    const result = transition(makeAsset('SUSPENDED'), makeLoan({ status: 'DELINQUENT' }), MEDICAL, 'PAY', {
      now: NOW,
      amountKobo: 34_200_000,
    });
    expect(result.asset.status).toBe('ACTIVE');
    expect(result.asset.suspendedAt).toBeUndefined();
    expect(result.loan.status).toBe('ACTIVE');
  });

  it('still allows a non-medical business to be suspended', () => {
    const business: Business = { ...MEDICAL, medicalFlag: false };
    const result = transition(makeAsset(), makeLoan(), business, 'SUSPEND', {
      now: NOW,
      reason: 'Two instalments overdue',
    });
    expect(result.asset.status).toBe('SUSPENDED');
  });
});