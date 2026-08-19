// Backend-owned API types, written by hand from docs/CONTRACT.md.
//
// Field names, casing and enum members match the frozen contract exactly so
// the backend and frontend agree at every boundary. Money is always kobo
// (integer). Energy is always Wh (integer).
//
// These types are the backend's own copy on purpose: the backend never
// imports from /frontend. The frontend ships its own mirror
// (frontend/src/types/api.ts) that must stay in sync by contract.

/* Envelope */
export interface ApiError {
  code: string;
  message: string;
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}

/* Enums */
export type FuelLogSource = 'receipt' | 'manual';
export type CreditFileStatus = 'PENDING' | 'APPROVED' | 'DECLINED';
export type AssetStatus = 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'OWNED';
export type LoanStatus = 'ACTIVE' | 'DELINQUENT' | 'CLOSED';
export type PaymentSource = 'ALAT' | 'SIMULATED';
export type ImpactPeriod = 'month' | 'year' | 'all';

/* Entities */
export interface Business {
  id: string;
  name: string;
  type: string;
  city: string;
  generatorKva: number;
  hoursPerDay: number;
  createdAt: string;
  /* Referenced by the asset state machine: suspension never applies when true. */
  medicalFlag?: boolean;
}

export interface FuelLog {
  id: string;
  businessId: string;
  source: FuelLogSource;
  litres: number;
  amountKobo: number;
  pricePerLitreKobo: number;
  loggedAt: string;
  receiptUrl?: string;
  confidence?: number;
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

export interface SolarSystem {
  id: string;
  name: string;
  capacityKw: number;
  panelW: number;
  batteryKwh: number;
  inverterKva: number;
  priceKobo: number;
  coversKva: number;
}

export interface Quote {
  id: string;
  businessId: string;
  system: SolarSystem;
  tenorMonths: number;
  depositKobo: number;
  monthlyPaymentKobo: number;
  aprBps: number;
  totalPayableKobo: number;
  monthlySavingsKobo: number;
  savingsPct: number;
  breakEvenMonth: number;
}

export interface CreditFile {
  id: string;
  businessId: string;
  business: Business;
  burn: BurnProfile;
  quote: Quote;
  affordabilityRatio: number;
  loadProfileScore: number;
  verifiedMonths: number;
  status: CreditFileStatus;
  createdAt: string;
}

export interface Asset {
  id: string;
  businessId: string;
  systemId: string;
  serial: string;
  controllerId: string;
  status: AssetStatus;
  installedAt: string;
  suspendedAt?: string;
  suspendReason?: string;
}

export interface Loan {
  id: string;
  assetId: string;
  principalKobo: number;
  tenorMonths: number;
  monthlyPaymentKobo: number;
  balanceKobo: number;
  nextDueAt: string;
  status: LoanStatus;
}

export interface Installment {
  n: number;
  dueAt: string;
  principalKobo: number;
  interestKobo: number;
  balanceKobo: number;
  paidAt?: string;
}

export interface Payment {
  id: string;
  loanId: string;
  amountKobo: number;
  paidAt: string;
  source: PaymentSource;
  reference: string;
}

export interface MeterReading {
  id: string;
  assetId: string;
  ts: string;
  whGenerated: number;
  whConsumed: number;
  batterySocPct: number;
}

export interface ImpactSummary {
  litresDisplaced: number;
  co2KgAvoided: number;
  nairaSavedKobo: number;
  kwhGenerated: number;
  monthsToOwnership: number;
}

export interface PortfolioCityCount {
  city: string;
  count: number;
}

export interface PortfolioStats {
  assetsFinanced: number;
  portfolioValueKobo: number;
  repaymentRatePct: number;
  parPct: number;
  suspendedCount: number;
  litresDisplaced: number;
  co2TonnesAvoided: number;
  byCity: PortfolioCityCount[];
}

export interface WrappedPayload {
  year: number;
  nairaSavedKobo: number;
  litresNotBurned: number;
  co2KgAvoided: number;
  kwhGenerated: number;
  monthsToOwnership: number;
  bestMonth: string;
  rank: number;
}

/** Detail projection returned by GET /credit/applications/:id. */
export interface CreditFileDetail extends CreditFile {
  fuelLogs: FuelLog[];
  schedulePreview: Installment[];
}

/* Request bodies */
export interface CreateBusinessBody {
  name: string;
  type: string;
  city: string;
  generatorKva?: number;
  hoursPerDay?: number;
}

export interface CreateFuelLogBody {
  litres: number;
  amountKobo: number;
  pricePerLitreKobo: number;
  loggedAt: string;
}

export interface CreateQuoteBody {
  systemId: string;
  tenorMonths: number;
  depositKobo?: number;
}

export interface DeclineBody {
  reason: string;
}

export interface SuspendBody {
  reason: string;
}

export interface PayBody {
  amountKobo: number;
}

export interface AdvanceTimeBody {
  days: number;
}

export interface MissPaymentBody {
  loanId: string;
}

/* Response payloads */
export interface ListEnvelope<T> {
  items: T[];
}

export interface PagedEnvelope<T> {
  items: T[];
  total: number;
}

export interface ApproveResult {
  loan: Loan;
  asset: Asset;
}

export interface PayResult {
  payment: Payment;
  loan: Loan;
  asset: Asset;
}

export interface ExportResult {
  url: string;
  generatedAt: string;
}

export interface DemoResult {
  ok: true;
}

/* Query params */
export interface SystemsQuery {
  minKw?: number;
  maxPriceKobo?: number;
}

export interface ApplicationsQuery {
  status?: CreditFileStatus;
}

export interface MeterQuery {
  from?: string;
  to?: string;
}

export interface PortfolioAssetsQuery {
  status?: AssetStatus;
  city?: string;
  page?: number;
}