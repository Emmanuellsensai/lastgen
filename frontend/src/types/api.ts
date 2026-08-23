// Shared API types, written by hand from docs/CONTRACT.md.
// Field names, casing and enum members match the frozen contract exactly.
// Money is always kobo (integer). Energy is always Wh (integer).

export type ApiMode = 'mock' | 'live';

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}

/* Shared constants. Both sides must use these exact values. */
export const CO2_KG_PER_LITRE_PETROL = 2.31;
export const CO2_KG_PER_LITRE_DIESEL = 2.68;
export const DEFAULT_GRACE_PERIOD_HOURS = 72;
export const MIN_LIGHTING_CIRCUIT_W = 40;

/* Enums */
export type FuelLogSource = 'receipt' | 'manual';
export type CreditFileStatus = 'PENDING' | 'APPROVED' | 'DECLINED';
export type AssetStatus = 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'OWNED';
export type LoanStatus = 'ACTIVE' | 'DELINQUENT' | 'CLOSED';
export type PaymentSource = 'ALAT' | 'SIMULATED' | 'WALLET';

export type PaymentStatus =
  | 'pending_authorisation'
  | 'authorised'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED';
export type ImpactPeriod = 'month' | 'year' | 'all';

export type KycStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

export interface KycRecord {
  id: string;
  businessId: string;
  userId: string;
  status: KycStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  selfieUrl: string | null;
  ninVerified: boolean;
}

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

export interface Wallet {
  id: string;
  businessId: string;
  accountNumber: string;
  bankCode: string;
  balanceKobo: number;
  currency: string;
  createdAt: string;
}

export type WalletDirection = 'IN' | 'OUT';

export interface WalletTransaction {
  id: string;
  walletId: string;
  ts: string;
  direction: WalletDirection;
  amountKobo: number;
  description: string;
  reference: string;
  category: string;
}

export interface CreateWalletBody {
  businessId: string;
  nin: string;
  firstName: string;
  lastName: string;
  phone: string;
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

/* CreditFileDetail is the detail projection returned by
   GET /credit/applications/:id. It carries the same shape as CreditFile plus
   the supporting evidence a credit officer needs on one screen. */
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
  source: 'wallet' | 'bank_account';
  amountKobo?: number;
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
  paymentId: string;
  platformTransactionReference: string | null;
  status: PaymentStatus;
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

export interface AdminUser {
  id: string;
  name: string;
  city: string;
  type: string;
  createdAt: string;
  kycStatus: KycStatus;
  assetStatus: AssetStatus | null;
  assetId: string | null;
  loanId: string | null;
  loanBalanceKobo: number | null;
}

export interface AdminOrder {
  loanId: string;
  businessName: string;
  businessId: string;
  assetId: string;
  assetStatus: AssetStatus;
  balanceKobo: number;
  monthlyPaymentKobo: number;
  nextDueAt: string;
  status: string;
}
