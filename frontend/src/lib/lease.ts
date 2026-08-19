// Lease math. These formulas are frozen in docs/CONTRACT.md and the backend
// implements the identical set, so mock and live agree to the kobo.

import type { BurnProfile, Installment, Quote } from '@/types/api';

export function monthlyRate(aprBps: number): number {
  return aprBps / 10000 / 12;
}

/** Standard amortisation: payment = P * r / (1 - (1+r)^-n). */
export function monthlyPaymentKobo(principalKobo: number, aprBps: number, tenorMonths: number) {
  const r = monthlyRate(aprBps);
  if (r === 0) return Math.round(principalKobo / tenorMonths);
  const payment = (principalKobo * r) / (1 - Math.pow(1 + r, -tenorMonths));
  return Math.round(payment);
}

export function monthlySavingsKobo(burn: Pick<BurnProfile, 'monthlyKobo'>, quote: Pick<Quote, 'monthlyPaymentKobo'>) {
  return burn.monthlyKobo - quote.monthlyPaymentKobo;
}

/** A quote is only valid when it saves the business money every month. */
export function isQuoteValid(quote: Pick<Quote, 'monthlySavingsKobo'>): boolean {
  return quote.monthlySavingsKobo > 0;
}

/** Month at which cumulative savings clear the deposit. */
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
  const r = monthlyRate(aprBps);
  const payment = monthlyPaymentKobo(principalKobo, aprBps, tenorMonths);
  const items: Installment[] = [];
  let balance = principalKobo;

  for (let n = 1; n <= tenorMonths; n += 1) {
    const interestKobo = Math.round(balance * r);
    let principalPart = payment - interestKobo;
    if (n === tenorMonths) principalPart = balance;
    balance = Math.max(0, balance - principalPart);
    const dueAt = new Date(firstDueAt);
    dueAt.setMonth(dueAt.getMonth() + (n - 1));
    items.push({
      n,
      dueAt: dueAt.toISOString(),
      principalKobo: principalPart,
      interestKobo,
      balanceKobo: balance,
    });
  }
  return items;
}

/** Remaining whole months until the loan balance reaches zero. */
export function monthsToOwnership(balanceKobo: number, monthlyPayment: number): number {
  if (balanceKobo <= 0) return 0;
  if (monthlyPayment <= 0) return 0;
  return Math.ceil(balanceKobo / monthlyPayment);
}
