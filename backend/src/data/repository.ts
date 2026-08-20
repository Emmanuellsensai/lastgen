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
  now(): Date;
  advanceTime(days: number): void;
  reset(): void;

  /* Businesses ----------------------------------------------------- */
  createBusiness(input: CreateBusinessBody): Business;
  getBusiness(id: string): Business | undefined;

  /* Fuel logs and burn --------------------------------------------- */
  addFuelLog(businessId: string, input: CreateFuelLogBody): FuelLog;
  addReceiptLog(businessId: string, extraction: ReceiptExtraction, receiptUrl: string): FuelLog;
  fuelLogsFor(businessId: string, limit?: number): FuelLog[];
  burnProfileFor(businessId: string): BurnProfile | undefined;
  recomputeBurn(businessId: string): BurnProfile | undefined;

  /* Systems -------------------------------------------------------- */
  listSystems(query: SystemsQuery): SolarSystem[];

  /* Quotes --------------------------------------------------------- */
  createQuote(businessId: string, input: CreateQuoteBody): Quote;
  getQuote(id: string): Quote | undefined;

  /* Credit --------------------------------------------------------- */
  listCreditFiles(status?: CreditFileStatus): CreditFile[];
  getCreditFile(id: string): CreditFileDetail | undefined;
  approveCreditFile(id: string): { loan: Loan; asset: Asset };
  declineCreditFile(id: string, reason: string): CreditFile;

  /* Assets --------------------------------------------------------- */
  getAsset(id: string): Asset | undefined;
  assetByBusiness(businessId: string): Asset | undefined;
  meterReadingsFor(assetId: string, from?: string, to?: string): MeterReading[];
  suspendAsset(id: string, reason: string): Asset;
  restoreAsset(id: string): Asset;

  /* Loans ---------------------------------------------------------- */
  getLoan(id: string): Loan | undefined;
  loanByAsset(assetId: string): Loan | undefined;
  scheduleFor(loanId: string): Installment[];
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
  ): PaySettlement;

  /* Payments lifecycle --------------------------------------------- */
  /** Book a payment as pending_authorisation without touching loan or asset. */
  startPayment(
    loanId: string,
    amountKobo: number,
    source: PaymentSource,
    reference: string,
    platformTransactionReference?: string,
  ): Payment;
  /** Settle a pending payment by reference. Idempotent; returns the current state. */
  settlePayment(reference: string): PaySettlement;
  /** Mark a pending payment FAILED. Idempotent; no loan or asset changes. */
  failPayment(reference: string): Payment | undefined;
  /** Mark a pending payment EXPIRED (consent window elapsed). Idempotent. */
  expirePayment(reference: string): Payment | undefined;
  /** Record the provider's platform reference once the consent request is issued. */
  setPaymentPlatformReference(reference: string, platformTransactionReference: string): void;
  /** Look a payment up by its transaction reference or its id. */
  paymentByRefOrId(key: string): Payment | undefined;

  /* Portfolio ------------------------------------------------------ */
  portfolioStats(): PortfolioStats;
  listPortfolioAssets(query: PortfolioAssetsQuery): PagedEnvelope<Asset>;
  exportCsv(): ExportResult;

  /* Webhook -------------------------------------------------------- */
  settleAlatWebhook(reference: string, amountKobo: number, narration: string): void;

  /* Wallets -------------------------------------------------------- */
  /** Create the business wallet (KYC'd virtual account). Idempotent per business. */
  createWallet(businessId: string, input: CreateWalletBody): Wallet;
  walletForBusiness(businessId: string): Wallet | undefined;
  walletStatement(walletId: string, query: WalletStatementQuery): WalletTransaction[];
  /** Credit a wallet and record an IN transaction. Returns the updated wallet. */
  creditWallet(
    walletId: string,
    amountKobo: number,
    description: string,
    reference: string,
    category: string,
  ): Wallet;
  /** Direct wallet debit: 402 if insufficient, then settle loan + asset atomically. */
  payFromWallet(loanId: string, amountKobo: number): PaySettlement;
  /** Resolve the business owned by a user (Supabase owner_id; demo maps demo-user). */
  businessForOwner(ownerId: string): Business | undefined;

  /* Impact --------------------------------------------------------- */
  impactFor(businessId: string, period: ImpactPeriod): ImpactSummary;

  /* Demo ----------------------------------------------------------- */
  missPayment(loanId: string): { loan: Loan; asset: Asset };

  /* Audit ---------------------------------------------------------- */
  statusHistory(assetId?: string): readonly AssetStatusHistoryEntry[];
}

export type { AssetStatus, AssetStatusHistoryEntry };
