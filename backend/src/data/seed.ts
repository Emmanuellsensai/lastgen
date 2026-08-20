// Deterministic in-memory seed, ported from frontend/src/mocks/seed.ts.
//
// The dataset is byte-for-byte reproducible from the frontend's FIRST build:
// the same mulberry32(20260819) PRNG is consumed in the same order, anchored
// at the same instant (2026-08-19T09:00Z). Unlike the frontend (whose module-
// level PRNG advances across resets), the backend rebuilds the seed with a
// fresh PRNG on every build, so reset is fully deterministic.
//
// The backend never imports frontend code; every value here is reproduced from
// the reference source so demo and live data agree.

import { PETROL_PRICE_PER_LITRE_KOBO } from '../config/constants.js';
import { mulberry32, type Random } from '../services/meterSimulator.js';
import { breakEvenMonth, buildSchedule, monthlyPaymentKobo } from '../services/leaseEngine.js';
import type {
  Asset,
  AssetStatus,
  Business,
  BurnProfile,
  CreditFile,
  FuelLog,
  Installment,
  Loan,
  MeterReading,
  Payment,
  Quote,
  SolarSystem,
} from '../types/api.js';

/* ------------------------------------------------------------------ */
/* Anchors                                                             */
/* ------------------------------------------------------------------ */

/** Demo clock anchor. advance-time shifts the clock, it never rewrites history. */
export const ANCHOR = new Date('2026-08-19T09:00:00.000Z');

function daysAgo(days: number, from: Date = ANCHOR): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function monthsFrom(months: number, from: Date = ANCHOR): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/* ------------------------------------------------------------------ */
/* Deterministic randomness (consumed in the reference order)          */
/* ------------------------------------------------------------------ */

function pick<T>(rand: Random, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function between(rand: Random, min: number, max: number): number {
  return min + rand() * (max - min);
}

function intBetween(rand: Random, min: number, max: number): number {
  return Math.floor(between(rand, min, max + 1));
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/* ------------------------------------------------------------------ */
/* Solar systems                                                       */
/* ------------------------------------------------------------------ */

export const SOLAR_SYSTEMS: SolarSystem[] = [
  {
    id: 'sys_lite_1k',
    name: 'Sunbelt Lite 1.0',
    capacityKw: 1.0,
    panelW: 1200,
    batteryKwh: 2.56,
    inverterKva: 1.5,
    priceKobo: 118_000_000,
    coversKva: 1.5,
  },
  {
    id: 'sys_shop_15',
    name: 'Sunbelt Shop 1.5',
    capacityKw: 1.5,
    panelW: 1800,
    batteryKwh: 5.12,
    inverterKva: 2.5,
    priceKobo: 186_000_000,
    coversKva: 2.5,
  },
  {
    id: 'sys_shop_25',
    name: 'Sunbelt Shop 2.5',
    capacityKw: 2.5,
    panelW: 3000,
    batteryKwh: 7.68,
    inverterKva: 3.5,
    priceKobo: 274_000_000,
    coversKva: 3.5,
  },
  {
    id: 'sys_trade_35',
    name: 'Harmattan Trade 3.5',
    capacityKw: 3.5,
    panelW: 4200,
    batteryKwh: 10.24,
    inverterKva: 5.0,
    priceKobo: 392_000_000,
    coversKva: 5.0,
  },
  {
    id: 'sys_trade_50',
    name: 'Harmattan Trade 5.0',
    capacityKw: 5.0,
    panelW: 6000,
    batteryKwh: 15.36,
    inverterKva: 6.0,
    priceKobo: 545_000_000,
    coversKva: 6.0,
  },
  {
    id: 'sys_cold_75',
    name: 'Harmattan Cold Chain 7.5',
    capacityKw: 7.5,
    panelW: 9000,
    batteryKwh: 20.48,
    inverterKva: 8.0,
    priceKobo: 742_000_000,
    coversKva: 8.0,
  },
  {
    id: 'sys_works_100',
    name: 'Ironsun Works 10',
    capacityKw: 10.0,
    panelW: 12000,
    batteryKwh: 25.6,
    inverterKva: 10.0,
    priceKobo: 968_000_000,
    coversKva: 10.0,
  },
  {
    id: 'sys_works_150',
    name: 'Ironsun Works 15',
    capacityKw: 15.0,
    panelW: 18000,
    batteryKwh: 40.96,
    inverterKva: 15.0,
    priceKobo: 1_420_000_000,
    coversKva: 15.0,
  },
];

/* ------------------------------------------------------------------ */
/* Businesses                                                          */
/* ------------------------------------------------------------------ */

export const DEMO_BUSINESS_ID = 'biz_adaeze_frozen';

interface BusinessSpec extends Business {
  litresPerDay: number;
  systemId: string;
  tenorMonths: number;
  aprBps: number;
  depositPct: number;
}

const BUSINESS_SPECS: BusinessSpec[] = [
  {
    id: DEMO_BUSINESS_ID,
    name: 'Adaeze Frozen Foods',
    type: 'Frozen food seller',
    city: 'Lagos',
    generatorKva: 5.5,
    hoursPerDay: 11,
    createdAt: daysAgo(94).toISOString(),
    medicalFlag: false,
    litresPerDay: 13.8,
    systemId: 'sys_cold_75',
    tenorMonths: 24,
    aprBps: 2800,
    depositPct: 0.1,
  },
  {
    id: 'biz_bilikisu_tailor',
    name: 'Bilikisu Couture',
    type: 'Tailor',
    city: 'Ibadan',
    generatorKva: 2.5,
    hoursPerDay: 8,
    createdAt: daysAgo(71).toISOString(),
    medicalFlag: false,
    litresPerDay: 5.1,
    systemId: 'sys_shop_25',
    tenorMonths: 18,
    aprBps: 2600,
    depositPct: 0.1,
  },
  {
    id: 'biz_kelechi_cuts',
    name: 'Kelechi Cuts Barbing Salon',
    type: 'Barber',
    city: 'Lagos',
    generatorKva: 2.0,
    hoursPerDay: 9,
    createdAt: daysAgo(63).toISOString(),
    medicalFlag: false,
    litresPerDay: 4.4,
    systemId: 'sys_shop_15',
    tenorMonths: 18,
    aprBps: 2600,
    depositPct: 0.1,
  },
  {
    id: 'biz_wuse_press',
    name: 'Wuse Press and Print',
    type: 'Printer',
    city: 'Abuja',
    generatorKva: 6.5,
    hoursPerDay: 9,
    createdAt: daysAgo(58).toISOString(),
    medicalFlag: false,
    litresPerDay: 12.2,
    systemId: 'sys_trade_50',
    tenorMonths: 24,
    aprBps: 2800,
    depositPct: 0.12,
  },
  {
    id: 'biz_ogunlade_welding',
    name: 'Ogunlade Welding Works',
    type: 'Welder',
    city: 'Ibadan',
    generatorKva: 10.0,
    hoursPerDay: 7,
    createdAt: daysAgo(47).toISOString(),
    medicalFlag: false,
    litresPerDay: 17.5,
    systemId: 'sys_works_100',
    tenorMonths: 30,
    aprBps: 2900,
    depositPct: 0.15,
  },
  {
    id: 'biz_gwarinpa_mart',
    name: 'Gwarinpa Value Mart',
    type: 'Mini-supermarket',
    city: 'Abuja',
    generatorKva: 8.0,
    hoursPerDay: 12,
    createdAt: daysAgo(39).toISOString(),
    medicalFlag: true,
    litresPerDay: 20.4,
    systemId: 'sys_works_100',
    tenorMonths: 30,
    aprBps: 2900,
    depositPct: 0.12,
  },
];

const BUSINESSES: Business[] = BUSINESS_SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  type: spec.type,
  city: spec.city,
  generatorKva: spec.generatorKva,
  hoursPerDay: spec.hoursPerDay,
  createdAt: spec.createdAt,
  medicalFlag: spec.medicalFlag,
}));

/* ------------------------------------------------------------------ */
/* Fuel logs and burn profiles                                         */
/* ------------------------------------------------------------------ */

const FUEL_DAYS = 90;

function buildFuelLogs(spec: BusinessSpec, rand: Random): FuelLog[] {
  // Buying trips, not daily entries. A typical seller fills a jerrycan every
  // two or three days.
  const logs: FuelLog[] = [];
  let day = FUEL_DAYS;
  let n = 0;
  while (day > 0) {
    const span = intBetween(rand, 2, 3);
    const litres = Number((spec.litresPerDay * span * between(rand, 0.88, 1.12)).toFixed(1));
    const pricePerLitreKobo = PETROL_PRICE_PER_LITRE_KOBO + intBetween(rand, -40, 60) * 100;
    const amountKobo = Math.round(litres * pricePerLitreKobo);
    const source: FuelLog['source'] = n % 3 === 0 ? 'manual' : 'receipt';
    logs.push({
      id: `fl_${spec.id}_${pad(n, 3)}`,
      businessId: spec.id,
      source,
      litres,
      amountKobo,
      pricePerLitreKobo,
      loggedAt: daysAgo(day).toISOString(),
      receiptUrl: source === 'receipt' ? `/img/receipts/${spec.id}-${pad(n, 3)}.jpg` : undefined,
      confidence: source === 'receipt' ? Number(between(rand, 0.86, 0.99).toFixed(2)) : undefined,
    });
    day -= span;
    n += 1;
  }
  return logs.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
}

function buildBurnProfile(spec: BusinessSpec, logs: FuelLog[]): BurnProfile {
  const totalLitres = logs.reduce((sum, l) => sum + l.litres, 0);
  const totalKobo = logs.reduce((sum, l) => sum + l.amountKobo, 0);
  const daysObserved = FUEL_DAYS;
  const litresPerDay = Number((totalLitres / daysObserved).toFixed(2));
  const dailyKobo = Math.round(totalKobo / daysObserved);
  return {
    businessId: spec.id,
    litresPerDay,
    dailyKobo,
    monthlyKobo: dailyKobo * 30,
    annualKobo: dailyKobo * 365,
    daysObserved,
    verified: true,
    computedAt: ANCHOR.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Quotes                                                              */
/* ------------------------------------------------------------------ */

function buildQuote(spec: BusinessSpec, burn: BurnProfile): Quote {
  const system = SOLAR_SYSTEMS.find((s) => s.id === spec.systemId) as SolarSystem;
  const depositKobo = Math.round(system.priceKobo * spec.depositPct);
  const principal = system.priceKobo - depositKobo;
  const payment = monthlyPaymentKobo(principal, spec.aprBps, spec.tenorMonths);
  const savings = burn.monthlyKobo - payment;
  return {
    id: `q_${spec.id}`,
    businessId: spec.id,
    system,
    tenorMonths: spec.tenorMonths,
    depositKobo,
    monthlyPaymentKobo: payment,
    aprBps: spec.aprBps,
    totalPayableKobo: payment * spec.tenorMonths + depositKobo,
    monthlySavingsKobo: savings,
    savingsPct: Number(((savings / burn.monthlyKobo) * 100).toFixed(1)),
    breakEvenMonth: breakEvenMonth(depositKobo, savings),
  };
}

/* ------------------------------------------------------------------ */
/* Credit files, assets, loans                                         */
/* ------------------------------------------------------------------ */

const CREDIT_STATUS_BY_BUSINESS: Record<string, CreditFile['status']> = {
  biz_adaeze_frozen: 'APPROVED',
  biz_bilikisu_tailor: 'PENDING',
  biz_kelechi_cuts: 'PENDING',
  biz_wuse_press: 'APPROVED',
  biz_ogunlade_welding: 'PENDING',
  biz_gwarinpa_mart: 'APPROVED',
};

const ASSET_STATUS_BY_BUSINESS: Record<string, AssetStatus> = {
  biz_adaeze_frozen: 'ACTIVE',
  biz_wuse_press: 'GRACE',
  biz_gwarinpa_mart: 'ACTIVE',
};

function buildCreditFile(
  spec: BusinessSpec,
  burn: BurnProfile,
  quote: Quote,
  rand: Random,
): CreditFile {
  const affordabilityRatio = Number((quote.monthlyPaymentKobo / burn.monthlyKobo).toFixed(2));
  return {
    id: `cf_${spec.id}`,
    businessId: spec.id,
    business: BUSINESSES.find((b) => b.id === spec.id) as Business,
    burn,
    quote,
    affordabilityRatio,
    loadProfileScore: Number(between(rand, 62, 91).toFixed(0)),
    verifiedMonths: 3,
    status: CREDIT_STATUS_BY_BUSINESS[spec.id],
    createdAt: daysAgo(intBetween(rand, 4, 26)).toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Meter readings                                                      */
/* ------------------------------------------------------------------ */

/** A solar day collapsed to six readings, repeated over the requested window. */
function buildMeterReadings(
  assetId: string,
  capacityKw: number,
  days: number,
  rand: Random,
): MeterReading[] {
  const readings: MeterReading[] = [];
  const slots = [6, 9, 12, 15, 18, 21];
  const curve = [0.18, 0.72, 1.0, 0.81, 0.24, 0.0];
  let n = 0;
  for (let d = days; d > 0; d -= 1) {
    const cloud = between(rand, 0.72, 1.0);
    let soc = between(rand, 38, 62);
    for (let s = 0; s < slots.length; s += 1) {
      const ts = daysAgo(d);
      ts.setUTCHours(slots[s], 0, 0, 0);
      const whGenerated = Math.round(capacityKw * 1000 * curve[s] * cloud * 3);
      const whConsumed = Math.round(capacityKw * 1000 * between(rand, 0.28, 0.62) * 3);
      soc = Math.max(14, Math.min(100, soc + (whGenerated - whConsumed) / (capacityKw * 260)));
      readings.push({
        id: `mr_${assetId}_${pad(n, 4)}`,
        assetId,
        ts: ts.toISOString(),
        whGenerated,
        whConsumed,
        batterySocPct: Math.round(soc),
      });
      n += 1;
    }
  }
  return readings.sort((a, b) => a.ts.localeCompare(b.ts));
}

/* ------------------------------------------------------------------ */
/* Portfolio: 520 assets                                               */
/* ------------------------------------------------------------------ */

const PORTFOLIO_SIZE = 520;

const CITY_WEIGHTS: Array<[string, number]> = [
  ['Lagos', 0.41],
  ['Abuja', 0.19],
  ['Ibadan', 0.15],
  ['Port Harcourt', 0.11],
  ['Kano', 0.08],
  ['Benin City', 0.06],
];

const STATUS_PLAN: Array<[AssetStatus, number]> = [
  ['ACTIVE', 317],
  ['OWNED', 140],
  ['GRACE', 42],
  ['SUSPENDED', 21],
];

const SUSPEND_REASONS = [
  'Two instalments overdue, grace window closed',
  'Grace period expired without payment',
  'Repeated failed direct debit, account frozen',
];

const TRADE_NAMES = [
  'Cold Store',
  'Fabrics',
  'Barbing Salon',
  'Press',
  'Welding Works',
  'Value Mart',
  'Provisions',
  'Frozen Foods',
  'Tailoring',
  'Printers',
];

const FIRST_NAMES = [
  'Adaeze',
  'Bilikisu',
  'Kelechi',
  'Chinedu',
  'Aisha',
  'Segun',
  'Ngozi',
  'Yusuf',
  'Folake',
  'Emeka',
  'Halima',
  'Tunde',
  'Ifeoma',
  'Musa',
  'Bukola',
  'Obinna',
  'Zainab',
  'Femi',
  'Amaka',
  'Ibrahim',
  'Temitope',
  'Uche',
  'Fatima',
  'Gbenga',
];

function cityForIndex(i: number): string {
  const t = ((i * 37) % PORTFOLIO_SIZE) / PORTFOLIO_SIZE;
  let acc = 0;
  for (const [city, weight] of CITY_WEIGHTS) {
    acc += weight;
    if (t < acc) return city;
  }
  return CITY_WEIGHTS[0][0];
}

interface PortfolioRow {
  asset: Asset;
  loan: Loan;
  businessName: string;
  city: string;
}

function buildPortfolio(rand: Random): PortfolioRow[] {
  const statuses: AssetStatus[] = [];
  for (const [status, count] of STATUS_PLAN) {
    for (let i = 0; i < count; i += 1) statuses.push(status);
  }
  // Interleave so a paged listing shows a realistic mix on every page.
  statuses.sort(() => rand() - 0.5);

  const rows: PortfolioRow[] = [];
  for (let i = 0; i < PORTFOLIO_SIZE; i += 1) {
    const status = statuses[i];
    const system = pick(rand, SOLAR_SYSTEMS);
    const city = cityForIndex(i);
    const businessId = `biz_p${pad(i, 3)}`;
    const assetId = `ast_p${pad(i, 3)}`;
    const tenorMonths = pick(rand, [18, 24, 30, 36]);
    const aprBps = pick(rand, [2600, 2800, 2900, 3100]);
    const depositKobo = Math.round(system.priceKobo * pick(rand, [0.1, 0.12, 0.15]));
    const principal = system.priceKobo - depositKobo;
    const payment = monthlyPaymentKobo(principal, aprBps, tenorMonths);
    const monthsPaid =
      status === 'OWNED' ? tenorMonths : intBetween(rand, 1, Math.max(2, tenorMonths - 2));
    const balanceKobo =
      status === 'OWNED' ? 0 : Math.max(0, Math.round(principal * (1 - monthsPaid / tenorMonths)));
    const installedAt = daysAgo(intBetween(rand, 40, 900)).toISOString();

    const loanStatus: Loan['status'] =
      status === 'OWNED' ? 'CLOSED' : status === 'ACTIVE' ? 'ACTIVE' : 'DELINQUENT';

    rows.push({
      asset: {
        id: assetId,
        businessId,
        systemId: system.id,
        serial: `LG-${pad(i + 1041, 5)}`,
        controllerId: `CTL-${pad(i + 2207, 5)}`,
        status,
        installedAt,
        suspendedAt:
          status === 'SUSPENDED' ? daysAgo(intBetween(rand, 2, 30)).toISOString() : undefined,
        suspendReason: status === 'SUSPENDED' ? pick(rand, SUSPEND_REASONS) : undefined,
      },
      loan: {
        id: `loan_p${pad(i, 3)}`,
        assetId,
        principalKobo: principal,
        tenorMonths,
        monthlyPaymentKobo: payment,
        balanceKobo,
        nextDueAt:
          status === 'OWNED' ? installedAt : monthsFrom(status === 'ACTIVE' ? 1 : 0).toISOString(),
        status: loanStatus,
      },
      businessName: `${pick(rand, FIRST_NAMES)} ${pick(rand, TRADE_NAMES)}`,
      city,
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Database assembly                                                   */
/* ------------------------------------------------------------------ */

/** One row per asset status transition, mirroring backend/migrations/audit.sql. */
export interface AssetStatusHistoryEntry {
  id: string;
  assetId: string;
  fromStatus?: AssetStatus;
  toStatus: AssetStatus;
  reason?: string;
  changedAt: string;
  changedBy?: string;
}

export interface DemoDb {
  now: Date;
  businesses: Business[];
  fuelLogs: FuelLog[];
  burnProfiles: BurnProfile[];
  solarSystems: SolarSystem[];
  quotes: Quote[];
  creditFiles: CreditFile[];
  assets: Asset[];
  loans: Loan[];
  installments: Record<string, Installment[]>;
  payments: Payment[];
  meterReadings: MeterReading[];
  /** Denormalised lookups for columns the contract does not model on Asset. */
  assetCity: Record<string, string>;
  assetBusinessName: Record<string, string>;
  /** Webhook idempotency ledger, keyed on transactionReference. */
  seenReferences: Set<string>;
  /** Audit trail written by the repository on every status transition. */
  assetStatusHistory: AssetStatusHistoryEntry[];
}

export function buildSeed(): DemoDb {
  const rand = mulberry32(20260819);
  const fuelLogs: FuelLog[] = [];
  const burnProfiles: BurnProfile[] = [];
  const quotes: Quote[] = [];
  const creditFiles: CreditFile[] = [];
  const assets: Asset[] = [];
  const loans: Loan[] = [];
  const installments: Record<string, Installment[]> = {};
  const payments: Payment[] = [];
  const meterReadings: MeterReading[] = [];
  const assetCity: Record<string, string> = {};
  const assetBusinessName: Record<string, string> = {};

  BUSINESS_SPECS.forEach((spec, specIndex) => {
    const logs = buildFuelLogs(spec, rand);
    fuelLogs.push(...logs);
    const burn = buildBurnProfile(spec, logs);
    burnProfiles.push(burn);
    const quote = buildQuote(spec, burn);
    quotes.push(quote);
    creditFiles.push(buildCreditFile(spec, burn, quote, rand));

    const assetStatus = ASSET_STATUS_BY_BUSINESS[spec.id];
    if (!assetStatus) return;

    const assetId = `ast_${spec.id}`;
    const installedAt = daysAgo(intBetween(rand, 120, 260)).toISOString();
    const principal = quote.system.priceKobo - quote.depositKobo;
    const monthsPaid = intBetween(rand, 3, Math.max(4, spec.tenorMonths - 6));
    const balanceKobo = Math.round(principal * (1 - monthsPaid / spec.tenorMonths));

    assets.push({
      id: assetId,
      businessId: spec.id,
      systemId: quote.system.id,
      serial: `LG-${pad(specIndex + 1, 5)}`,
      controllerId: `CTL-${pad(specIndex + 1, 5)}`,
      status: assetStatus,
      installedAt,
    });

    const loanId = `loan_${spec.id}`;
    loans.push({
      id: loanId,
      assetId,
      principalKobo: principal,
      tenorMonths: spec.tenorMonths,
      monthlyPaymentKobo: quote.monthlyPaymentKobo,
      balanceKobo,
      nextDueAt: monthsFrom(assetStatus === 'GRACE' ? 0 : 1).toISOString(),
      status: assetStatus === 'GRACE' ? 'DELINQUENT' : 'ACTIVE',
    });

    const schedule = buildSchedule(principal, spec.aprBps, spec.tenorMonths, new Date(installedAt));
    for (let i = 0; i < monthsPaid; i += 1) {
      schedule[i].paidAt = schedule[i].dueAt;
      payments.push({
        id: `pay_${spec.id}_${pad(i, 2)}`,
        loanId,
        amountKobo: quote.monthlyPaymentKobo,
        paidAt: schedule[i].dueAt,
        source: i % 4 === 0 ? 'SIMULATED' : 'ALAT',
        reference: `ALT-${spec.id.slice(4, 10).toUpperCase()}-${pad(i, 3)}`,
      });
    }
    installments[loanId] = schedule;

    meterReadings.push(...buildMeterReadings(assetId, quote.system.capacityKw, 90, rand));
    assetCity[assetId] = spec.city;
    assetBusinessName[assetId] = spec.name;
  });

  for (const row of buildPortfolio(rand)) {
    assets.push(row.asset);
    loans.push(row.loan);
    assetCity[row.asset.id] = row.city;
    assetBusinessName[row.asset.id] = row.businessName;
  }

  return {
    now: new Date(ANCHOR),
    businesses: [...BUSINESSES],
    fuelLogs,
    burnProfiles,
    solarSystems: [...SOLAR_SYSTEMS],
    quotes,
    creditFiles,
    assets,
    loans,
    installments,
    payments,
    meterReadings,
    assetCity,
    assetBusinessName,
    seenReferences: new Set<string>(),
    assetStatusHistory: [],
  };
}
