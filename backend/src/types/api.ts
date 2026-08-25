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
export type PaymentSource = 'ALAT' | 'SIMULATED' | 'WALLET';

/**
 * ALAT's own status vocabulary, surfaced verbatim so the frontend can render
 * the payment sheet without mapping provider codes. WALLET payments skip the
 * provider dance and jump straight to SUCCESS.
 */
export type PaymentStatus =
  'pending_authorisation' | 'authorised' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
export type ImpactPeriod = 'month' | 'year' | 'all';

/**
 * API roles. `owner` is the default for business users; `bank` and `admin`
 * belong to credit-desk identities and gate the /admin/* surface. The claim
 * lives in Supabase app_metadata (server-only) so clients cannot escalate.
 */
export type UserRole = 'owner' | 'bank' | 'admin';

/** KYC review lifecycle for business identity verification. */
export type KycStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

/** Full KYC record for a business identity verification. */
export interface KycRecord {
  id: string;
  businessId: string;
  userId: string;
  status: KycStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  selfieUrl: string | null;
  bankSlipUrl: string | null;
  ninNumber: string | null;
  ninVerified: boolean;
}

/** User row of the admin desk's Users tab. */
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

/** Loan row of the admin desk's Orders tab. */
export interface AdminOrder {
  loanId: string;
  businessName: string;
  businessId: string;
  assetId: string;
  assetStatus: AssetStatus;
  balanceKobo: number;
  monthlyPaymentKobo: number;
  nextDueAt: string;
  status: LoanStatus;
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
  /** Set when the owner accepts the quote and submits the file for underwriting. */
  submittedAt?: string;
  /** Set when the credit file is approved — links to the created loan and asset. */
  loanId?: string;
  assetId?: string;
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
  city?: string;
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
  /** Lifecycle state: pending_authorisation while the provider awaits consent. */
  status: PaymentStatus;
  /** ALAT's platform reference for the transfer; null for wallet payments. */
  platformTransactionReference?: string;
}

/** Business cash wallet backed by a virtual account (bankCode 035, Wema/ALAT). */
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

/* Bank identity ------------------------------------------------------ */

/** A credit-desk identity (bank user) as stored by the repository. */
export interface BankUser {
  id: string;
  bankId: string;
  bankName: string;
  createdAt: string;
}

export interface BankRegisterBody {
  bankName: string;
  bankId: string;
  password: string;
  confirmPassword: string;
}

export interface BankLoginBody {
  bankId: string;
  password: string;
}

/** Response payload for POST /auth/bank/register and POST /auth/bank/login. */
export interface BankAuthResult {
  user: { id: string; bankId: string; bankName: string };
  role: 'bank';
  accessToken: string;
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

export interface CreateWalletBody {
  businessId: string;
  nin: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface PayBody {
  /** 'wallet' debits the business wallet directly; 'bank_account' runs the ALAT dance. */
  source: 'wallet' | 'bank_account';
  /** Optional: defaults to the next unpaid installment amount. */
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

/**
 * The live ids the owner dashboard needs after login. Any of them is null
 * until the corresponding record exists (no quote yet, not yet approved).
 */
export interface BusinessSummary {
  assetId: string | null;
  loanId: string | null;
  quoteId: string | null;
}

/** Result of submitting a quote for underwriting. */
export interface AcceptQuoteResult {
  creditFileId: string;
  status: CreditFileStatus;
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
