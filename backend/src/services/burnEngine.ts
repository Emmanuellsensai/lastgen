import { DAYS_PER_MONTH, DAYS_PER_YEAR, VERIFIED_BURN_DAYS } from '../config/constants.js';

export interface FuelLogInput {
  litres: number;
  amountKobo: number;
  loggedAt: string | Date;
}

export interface BurnProfile {
  businessId: string;
  litresPerDay: number;
  dailyKobo: number;
  monthlyKobo: number;
  annualKobo: number;
  daysObserved: number;
  verified: boolean;
  computedAt: string;
}

export interface GeneratorEstimateInput {
  businessId: string;
  generatorKva: number;
  hoursPerDay: number;
  petrolPriceKobo: number;
  computedAt?: Date;
}

const HOURS_PER_DAY = 8;
const LITRES_PER_KVA_HOUR = 0.6;

export function computeBurnProfile(
  businessId: string,
  logs: readonly FuelLogInput[],
  computedAt = new Date(),
): BurnProfile {
  if (logs.length === 0) {
    return emptyProfile(businessId, computedAt);
  }

  const orderedLogs = [...logs].sort(
    (left, right) => toTimestamp(left.loggedAt) - toTimestamp(right.loggedAt),
  );
  const firstTimestamp = toTimestamp(orderedLogs[0].loggedAt);
  const lastTimestamp = toTimestamp(orderedLogs[orderedLogs.length - 1].loggedAt);
  const daysObserved = Math.max(1, Math.ceil((lastTimestamp - firstTimestamp) / DAY_MS));
  const totalLitres = orderedLogs.reduce((sum, log) => sum + log.litres, 0);
  const totalKobo = orderedLogs.reduce((sum, log) => sum + log.amountKobo, 0);
  const litresPerDay = roundToTwo(totalLitres / daysObserved);
  const dailyKobo = Math.round(totalKobo / daysObserved);

  return {
    businessId,
    litresPerDay,
    dailyKobo,
    monthlyKobo: dailyKobo * DAYS_PER_MONTH,
    annualKobo: dailyKobo * DAYS_PER_YEAR,
    daysObserved,
    verified: daysObserved >= VERIFIED_BURN_DAYS,
    computedAt: computedAt.toISOString(),
  };
}

export function estimateBurnProfile(input: GeneratorEstimateInput): BurnProfile {
  const litresPerDay = roundToTwo(
    input.generatorKva * (input.hoursPerDay || HOURS_PER_DAY) * LITRES_PER_KVA_HOUR,
  );
  const dailyKobo = Math.round(litresPerDay * input.petrolPriceKobo);

  return {
    businessId: input.businessId,
    litresPerDay,
    dailyKobo,
    monthlyKobo: dailyKobo * DAYS_PER_MONTH,
    annualKobo: dailyKobo * DAYS_PER_YEAR,
    daysObserved: 0,
    verified: false,
    computedAt: (input.computedAt ?? new Date()).toISOString(),
  };
}

function emptyProfile(businessId: string, computedAt: Date): BurnProfile {
  return {
    businessId,
    litresPerDay: 0,
    dailyKobo: 0,
    monthlyKobo: 0,
    annualKobo: 0,
    daysObserved: 0,
    verified: false,
    computedAt: computedAt.toISOString(),
  };
}

function toTimestamp(value: string | Date): number {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error('Fuel log loggedAt must be a valid date');
  }
  return timestamp;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

const DAY_MS = 86_400_000;
