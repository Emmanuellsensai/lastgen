import { ApiError } from '../middleware/errorHandler.js';

export interface Installment {
  n: number;
  dueAt: string;
  principalKobo: number;
  interestKobo: number;
  balanceKobo: number;
  paidAt?: string;
}

export interface LeaseBurn {
  monthlyKobo: number;
}

export interface LeaseQuoteInput {
  systemPriceKobo: number;
  tenorMonths: number;
  aprBps: number;
  depositKobo?: number;
  burn: LeaseBurn;
  firstDueAt?: Date;
}

export interface LeaseQuoteResult {
  monthlyPaymentKobo: number;
  totalPayableKobo: number;
  monthlySavingsKobo: number;
  savingsPct: number;
  breakEvenMonth: number;
  schedule: Installment[];
}

export function monthlyRate(aprBps: number): number {
  return aprBps / 10000 / 12;
}

export function monthlyPaymentKobo(
  principalKobo: number,
  aprBps: number,
  tenorMonths: number,
): number {
  assertPositiveInteger(principalKobo, 'principalKobo');
  assertPositiveInteger(tenorMonths, 'tenorMonths');
  if (aprBps < 0 || !Number.isInteger(aprBps)) {
    throw new ApiError('VALIDATION', 'aprBps must be a non-negative integer', 400);
  }

  const rate = monthlyRate(aprBps);
  if (rate === 0) return Math.round(principalKobo / tenorMonths);

  const payment = (principalKobo * rate) / (1 - Math.pow(1 + rate, -tenorMonths));
  return Math.round(payment);
}

export function monthlySavingsKobo(
  burn: Pick<LeaseBurn, 'monthlyKobo'>,
  quote: Pick<LeaseQuoteResult, 'monthlyPaymentKobo'>,
): number {
  return burn.monthlyKobo - quote.monthlyPaymentKobo;
}

export function isQuoteValid(quote: Pick<LeaseQuoteResult, 'monthlySavingsKobo'>): boolean {
  return quote.monthlySavingsKobo > 0;
}

export function breakEvenMonth(depositKobo: number, savingsPerMonthKobo: number): number {
  if (savingsPerMonthKobo <= 0) return 0;
  if (depositKobo <= 0) return 1;
  return Math.ceil(depositKobo / savingsPerMonthKobo);
}

export function buildSchedule(
  principalKobo: number,
  aprBps: number,
  tenorMonths: number,
  firstDueAt: Date,
): Installment[] {
  const rate = monthlyRate(aprBps);
  const payment = monthlyPaymentKobo(principalKobo, aprBps, tenorMonths);
  const schedule: Installment[] = [];
  let balanceKobo = principalKobo;

  for (let n = 1; n <= tenorMonths; n += 1) {
    const interestKobo = Math.round(balanceKobo * rate);
    const principalPart =
      n === tenorMonths ? balanceKobo : Math.min(balanceKobo, payment - interestKobo);
    balanceKobo = Math.max(0, balanceKobo - principalPart);
    const dueAt = new Date(firstDueAt);
    dueAt.setMonth(dueAt.getMonth() + n - 1);

    schedule.push({
      n,
      dueAt: dueAt.toISOString(),
      principalKobo: principalPart,
      interestKobo,
      balanceKobo,
    });
  }

  return schedule;
}

export function createLeaseQuote(input: LeaseQuoteInput): LeaseQuoteResult {
  const depositKobo = input.depositKobo ?? 0;
  assertNonNegativeInteger(depositKobo, 'depositKobo');
  assertPositiveInteger(input.systemPriceKobo, 'systemPriceKobo');
  assertPositiveInteger(input.tenorMonths, 'tenorMonths');
  assertNonNegativeInteger(input.burn.monthlyKobo, 'burn.monthlyKobo');

  const monthlyPaymentKoboValue = monthlyPaymentKobo(
    input.systemPriceKobo - depositKobo,
    input.aprBps,
    input.tenorMonths,
  );
  const savings = input.burn.monthlyKobo - monthlyPaymentKoboValue;
  if (savings <= 0) {
    throw new ApiError(
      'QUOTE_NOT_VIABLE',
      'The solar payment must be lower than the monthly fuel spend',
      422,
    );
  }
  const schedule = buildSchedule(
    input.systemPriceKobo - depositKobo,
    input.aprBps,
    input.tenorMonths,
    input.firstDueAt ?? new Date(),
  );
  const scheduleSum = schedule.reduce((sum, row) => sum + row.principalKobo + row.interestKobo, 0);

  return {
    monthlyPaymentKobo: monthlyPaymentKoboValue,
    totalPayableKobo: depositKobo + scheduleSum,
    monthlySavingsKobo: savings,
    savingsPct: Number(((savings / input.burn.monthlyKobo) * 100).toFixed(1)),
    breakEvenMonth: breakEvenMonth(depositKobo, savings),
    schedule,
  };
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApiError('VALIDATION', `${name} must be a positive integer`, 400);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ApiError('VALIDATION', `${name} must be a non-negative integer`, 400);
  }
}
