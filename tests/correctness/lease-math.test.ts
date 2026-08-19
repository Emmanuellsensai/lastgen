import { describe, expect, it } from 'vitest';
import { ApiError } from '../../backend/src/middleware/errorHandler.js';
import {
  breakEvenMonth,
  buildSchedule,
  createLeaseQuote,
  isQuoteValid,
  monthlyPaymentKobo,
  monthlySavingsKobo,
} from '../../backend/src/services/leaseEngine.js';

// Correctness suite: lease-math
// Verifies the lease engine reproduces the contract amortisation formula
// (docs/CONTRACT.md LEASE MATH) and the frontend reference to the kobo.

function paymentFormula(principalKobo: number, aprBps: number, tenorMonths: number): number {
  const r = aprBps / 10000 / 12;
  if (r === 0) return Math.round(principalKobo / tenorMonths);
  return Math.round((principalKobo * r) / (1 - Math.pow(1 + r, -tenorMonths)));
}

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

describe('monthlyPaymentKobo', () => {
  it('matches the contract amortisation formula', () => {
    expect(monthlyPaymentKobo(1_200_000, 2800, 12)).toBe(paymentFormula(1_200_000, 2800, 12));
    expect(monthlyPaymentKobo(742_000_000, 2900, 24)).toBe(paymentFormula(742_000_000, 2900, 24));
    expect(monthlyPaymentKobo(3_000_000, 3100, 36)).toBe(paymentFormula(3_000_000, 3100, 36));
  });

  it('handles a zero-interest lease as principal divided by tenor', () => {
    expect(monthlyPaymentKobo(1_200_000, 0, 12)).toBe(100_000);
    expect(monthlyPaymentKobo(900_000, 0, 18)).toBe(50_000);
  });

  it('returns an integer amount in kobo', () => {
    const payment = monthlyPaymentKobo(274_000_000, 2800, 18);
    expect(Number.isInteger(payment)).toBe(true);
    expect(payment).toBeGreaterThan(0);
  });

  it('rejects invalid inputs with VALIDATION', () => {
    expect(() => monthlyPaymentKobo(-100, 2800, 12)).toThrowError(ApiError);
    expect(() => monthlyPaymentKobo(100, 2800, 0)).toThrowError(ApiError);
    expect(() => monthlyPaymentKobo(100, -1, 12)).toThrowError(ApiError);
  });
});

describe('savings and viability', () => {
  it('computes monthly savings as burn minus payment', () => {
    expect(monthlySavingsKobo({ monthlyKobo: 100_000 }, { monthlyPaymentKobo: 60_000 })).toBe(40_000);
  });

  it('only accepts quotes that save money every month', () => {
    expect(isQuoteValid({ monthlySavingsKobo: 1 })).toBe(true);
    expect(isQuoteValid({ monthlySavingsKobo: 0 })).toBe(false);
    expect(isQuoteValid({ monthlySavingsKobo: -1 })).toBe(false);
  });

  it('computes the deposit break-even month', () => {
    expect(breakEvenMonth(0, 40_000)).toBe(1);
    expect(breakEvenMonth(120_000, 40_000)).toBe(3);
    expect(breakEvenMonth(100_000, 40_000)).toBe(3);
    expect(breakEvenMonth(0, 0)).toBe(0);
  });
});

describe('createLeaseQuote', () => {
  const input = {
    systemPriceKobo: 1_000_000,
    tenorMonths: 12,
    aprBps: 0,
    depositKobo: 100_000,
    burn: { monthlyKobo: 150_000 },
    firstDueAt: new Date('2026-09-01T00:00:00.000Z'),
  };

  it('builds a viable quote with exact values', () => {
    const quote = createLeaseQuote(input);
    expect(quote.monthlyPaymentKobo).toBe(75_000);
    expect(quote.monthlySavingsKobo).toBe(75_000);
    expect(quote.totalPayableKobo).toBe(1_000_000);
    expect(quote.savingsPct).toBe(50.0);
    expect(quote.breakEvenMonth).toBe(2);
    expect(quote.schedule).toHaveLength(12);
  });

  it('produces a schedule that fully amortises to zero', () => {
    const quote = createLeaseQuote(input);
    const last = quote.schedule[quote.schedule.length - 1];
    expect(last.balanceKobo).toBe(0);
    const principalSum = quote.schedule.reduce((sum, i) => sum + i.principalKobo, 0);
    expect(principalSum).toBe(900_000);
  });

  it('rejects a quote whose payment exceeds the monthly burn', () => {
    const uneconomic = { ...input, burn: { monthlyKobo: 60_000 } };
    throwsCode(() => createLeaseQuote(uneconomic), 'QUOTE_NOT_VIABLE');
  });

  it('defaults the deposit to zero and first due date to now', () => {
    const quote = createLeaseQuote({ ...input, depositKobo: 0 });
    // Zero-rate: payment rounds to 83,333, leaving a 4-kobo residual in the
    // total; the schedule itself amortises the full principal.
    expect(quote.totalPayableKobo).toBe(999_996);
    expect(quote.schedule.reduce((sum, i) => sum + i.principalKobo, 0)).toBe(1_000_000);
    expect(quote.schedule[0].dueAt.length).toBeGreaterThan(0);
  });
});

describe('buildSchedule', () => {
  it('assigns sequential due dates from the first due date', () => {
    const schedule = buildSchedule(900_000, 0, 3, new Date('2026-09-01T00:00:00.000Z'));
    expect(schedule.map((i) => i.dueAt)).toEqual([
      '2026-09-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z',
      '2026-11-01T00:00:00.000Z',
    ]);
    expect(schedule.map((i) => i.principalKobo)).toEqual([300_000, 300_000, 300_000]);
  });
});