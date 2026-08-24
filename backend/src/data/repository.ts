// Repository seam — the single way routes and services touch data.
//
// Phase 2 ships the in-memory implementation (src/data/inMemoryRepository.ts)
// ported from the MSW reference; Phase 6 adds the Supabase implementation on
// the same interface. Everything here is expressed in contract types so the
// HTTP layer stays a thin adapter over storage.
//
// State-changing methods apply the real domain rules (assetStateMachine,
// loanStateMachine, leaseEngine) and throw ApiError with stable codes, so
// routes forward errors without re-implementing business logic. payLoan is
// atomic: a payment updates the loan, the asset, the next unpaid installment,
// the payment ledger and the audit history together — or nothing at all.

import type {
  Asset,
  AssetStatus,
  BankUser,
  Business,
  BurnProfile,
  CreateBusinessBody,
  CreateFuelLogBody,
  CreateQuoteBody,
  CreateWalletBody,
  CreditFile,
  CreditFileDetail,
  CreditFileStatus,
  ExportResult,
  FuelLog,
  ImpactPeriod,
  ImpactSummary,
  Installment,
  Loan,
  MeterReading,
  PagedEnvelope,
  Payment,
  PaymentSource,
  PortfolioAssetsQuery,
  PortfolioStats,
  Quote,
  SolarSystem,
  SystemsQuery,
  Wallet,
  WalletTransaction,
} from '../types/api.js';
import type { AssetStatusHistoryEntry } from './seed.js';

export interface ReceiptExtraction {
  litres: number;
  pricePerLitreKobo: number;
  confidence?: number;
}

/** Registration payload for a credit-desk identity (password handled by the store). */
export interface RegisterBankInput {
  bankName: string;
  bankId: string;
  password: string;
}

/** Result of a successful bank register/login: identity plus a fresh token. */
export interface BankSession {
  user: BankUser;
  accessToken: string;
}

/** Internal full settlement result; the HTTP layer maps it to the slim PayResult. */
export interface PaySettlement {
  payment: Payment;
  loan: Loan;
  asset: Asset;
}

export interface WalletStatementQuery {
  limit?: number;
  /** Exclusive ts cursor: return only rows older than this ISO timestamp. */
  before?: string;
}

export interface Repository {
  readonly kind: 'memory' | 'supabase';

  /* Demo clock ----------------------------------------------------- */
  now(): Promise<Date>;
  advanceTime(days: number): Promise<void>;
  reset(): Promise<void>;

  /* Businesses ----------------------------------------------------- */
  createBusiness(input: CreateBusinessBody, ownerId?: string | null): Promise<Business>;
  getBusiness(id: string): Promise<Business | undefined>;

  /* Banks ---------------------------------------------------------- */
  /**
   * Register a credit-desk identity. Duplicate bankId throws VALIDATION;
   * credential storage is delegated to the identity store (Supabase Auth in
   * live mode, in-memory map in demo).
   */
  registerBank(input: RegisterBankInput): Promise<BankSession>;
  /** Verify bankId + password. Unknown id or wrong password throws UNAUTHORIZED. */
  authenticateBank(bankId: string, password: string): Promise<BankSession>;

  /* Fuel logs and burn --------------------------------------------- */
  addFuelLog(businessId: string, input: CreateFuelLogBody): Promise<FuelLog>;
  addReceiptLog(
    businessId: string,
    extraction: ReceiptExtraction,
    receiptUrl: string,
  ): Promise<FuelLog>;
  fuelLogsFor(businessId: string, limit?: number): Promise<FuelLog[]>;
  burnProfileFor(businessId: string): Promise<BurnProfile | undefined>;
  recomputeBurn(businessId: string): Promise<BurnProfile | undefined>;

  /* Systems -------------------------------------------------------- */
  listSystems(query: SystemsQuery): Promise<SolarSystem[]>;

  /* Quotes --------------------------------------------------------- */
  createQuote(businessId: string, input: CreateQuoteBody): Promise<Quote>;
  getQuote(id: string): Promise<Quote | undefined>;

  /* Credit --------------------------------------------------------- */
  listCreditFiles(status?: CreditFileStatus): Promise<CreditFile[]>;
  getCreditFile(id: string): Promise<CreditFileDetail | undefined>;
  approveCreditFile(id: string): Promise<{ loan: Loan; asset: Asset }>;
  declineCreditFile(id: string, reason: string): Promise<CreditFile>;

  /* Assets --------------------------------------------------------- */
  getAsset(id: string): Promise<Asset | undefined>;
  assetByBusiness(businessId: string): Promise<Asset | undefined>;
  meterReadingsFor(assetId: string, from?: string, to?: string): Promise<MeterReading[]>;
  suspendAsset(id: string, reason: string): Promise<Asset>;
  restoreAsset(id: string): Promise<Asset>;

  /* Loans ---------------------------------------------------------- */
  getLoan(id: string): Promise<Loan | undefined>;
  loanByAsset(assetId: string): Promise<Loan | undefined>;
  scheduleFor(loanId: string): Promise<Installment[]>;
  /**
   * Settlement primitive shared by every entry path (simulated consent, ALAT
   * webhook, wallet debit): applies the PAY transition to loan + asset + next
   * unpaid installment + audit atomically and records the settled payment.
   */
  payLoan(
    loanId: string,
    amountKobo: number,
    source: PaymentSource,
    reference: string,
  ): Promise<PaySettlement>;

  /* Payments lifecycle --------------------------------------------- */
  /** Book a payment as pending_authorisation without touching loan or asset. */
  startPayment(
    loanId: string,
    amountKobo: number,
    source: PaymentSource,
    reference: string,
    platformTransactionReference?: string,
  ): Promise<Payment>;
  /** Settle a pending payment by reference. Idempotent; returns the current state. */
  settlePayment(reference: string): Promise<PaySettlement>;
  /** Mark a pending payment FAILED. Idempotent; no loan or asset changes. */
  failPayment(reference: string): Promise<Payment | undefined>;
  /** Mark a pending payment EXPIRED (consent window elapsed). Idempotent. */
  expirePayment(reference: string): Promise<Payment | undefined>;
  /** Record the provider's platform reference once the consent request is issued. */
  setPaymentPlatformReference(
    reference: string,
    platformTransactionReference: string,
  ): Promise<void>;
  /** Look a payment up by its transaction reference or its id. */
  paymentByRefOrId(key: string): Promise<Payment | undefined>;

  /* Portfolio ------------------------------------------------------ */
  portfolioStats(): Promise<PortfolioStats>;
  listPortfolioAssets(query: PortfolioAssetsQuery): Promise<PagedEnvelope<Asset>>;
  exportCsv(): Promise<ExportResult>;

  /* Webhook -------------------------------------------------------- */
  settleAlatWebhook(reference: string, amountKobo: number, narration: string): Promise<void>;

  /* Wallets -------------------------------------------------------- */
  /** Create the business wallet (KYC'd virtual account). Idempotent per business. */
  createWallet(businessId: string, input: CreateWalletBody): Promise<Wallet>;
  walletForBusiness(businessId: string): Promise<Wallet | undefined>;
  walletStatement(walletId: string, query: WalletStatementQuery): Promise<WalletTransaction[]>;
  /** Credit a wallet and record an IN transaction. Returns the updated wallet. */
  creditWallet(
    walletId: string,
    amountKobo: number,
    description: string,
    reference: string,
    category: string,
  ): Promise<Wallet>;
  /** Direct wallet debit: 402 if insufficient, then settle loan + asset atomically. */
  payFromWallet(loanId: string, amountKobo: number): Promise<PaySettlement>;
  /** Resolve the business owned by a user (Supabase owner_id; demo maps demo-user). */
  businessForOwner(ownerId: string): Promise<Business | undefined>;

  /* Impact --------------------------------------------------------- */
  impactFor(businessId: string, period: ImpactPeriod): Promise<ImpactSummary>;

  /* Demo ----------------------------------------------------------- */
  missPayment(loanId: string): Promise<{ loan: Loan; asset: Asset }>;

  /* Audit ---------------------------------------------------------- */
  statusHistory(assetId?: string): Promise<readonly AssetStatusHistoryEntry[]>;
}

export type { AssetStatus, AssetStatusHistoryEntry };
