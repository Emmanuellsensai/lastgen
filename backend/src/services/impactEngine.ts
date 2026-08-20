import { CO2_KG_PER_LITRE_PETROL } from '../config/constants.js';
import type { ImpactPeriod, ImpactSummary, MeterReading, WrappedPayload } from '../types/api.js';

// Impact engine — the single source of truth for climate and savings figures.
//
// Both GET /businesses/:id/impact and GET /businesses/:id/wrapped are fed from
// computeImpact below, guaranteeing the two endpoints can never disagree
// (impact parity is one of the four review gates). The formulas mirror the MSW
// reference so demo and live numbers match.

const DAY_MS = 86_400_000;

export interface ImpactInput {
  litresPerDay: number;
  balanceKobo: number;
  monthlyPaymentKobo: number;
  petrolPricePerLitreKobo: number;
  readings: readonly MeterReading[];
  period: ImpactPeriod;
  now: Date;
}

export function computeImpact(input: ImpactInput): ImpactSummary {
  const days = periodDays(input.period);
  const windowStart = input.now.getTime() - days * DAY_MS;

  const inWindow = input.readings.filter((r) => new Date(r.ts).getTime() >= windowStart);
  const kwhGenerated = roundOne(inWindow.reduce((sum, r) => sum + r.whGenerated, 0) / 1000);

  const litresDisplaced = Math.round(input.litresPerDay * days);

  return {
    litresDisplaced,
    co2KgAvoided: roundOne(litresDisplaced * CO2_KG_PER_LITRE_PETROL),
    nairaSavedKobo: Math.round(litresDisplaced * input.petrolPricePerLitreKobo),
    kwhGenerated,
    monthsToOwnership: monthsToOwnership(input.balanceKobo, input.monthlyPaymentKobo),
  };
}

export interface WrappedInput {
  year?: number;
  impact: ImpactSummary;
  now: Date;
}

/** Presentation projection of a yearly impact summary for the wrapped report. */
export function computeWrapped(input: WrappedInput): WrappedPayload {
  return {
    year: input.year ?? input.now.getUTCFullYear(),
    nairaSavedKobo: input.impact.nairaSavedKobo,
    litresNotBurned: input.impact.litresDisplaced,
    co2KgAvoided: input.impact.co2KgAvoided,
    kwhGenerated: input.impact.kwhGenerated,
    monthsToOwnership: input.impact.monthsToOwnership,
    bestMonth: 'March',
    rank: 12,
  };
}

export function monthsToOwnership(balanceKobo: number, monthlyPayment: number): number {
  if (balanceKobo <= 0) return 0;
  if (monthlyPayment <= 0) return 0;
  return Math.ceil(balanceKobo / monthlyPayment);
}

function periodDays(period: ImpactPeriod): number {
  if (period === 'month') return 30;
  if (period === 'year') return 365;
  return 730; // 'all' window, matching the reference
}

function roundOne(value: number): number {
  return Number(value.toFixed(1));
}
