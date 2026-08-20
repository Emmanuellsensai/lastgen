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
  PaymentSource,
  PayResult,
  PortfolioAssetsQuery,
  PortfolioStats,
  Quote,
  SolarSystem,
  SystemsQuery,
} from '../types/api.js';
import type { AssetStatusHistoryEntry } from './seed.js';

export interface ReceiptExtraction {
  litres: number;
  pricePerLitreKobo: number;
  confidence?: number;
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
  payLoan(loanId: string, amountKobo: number, source: PaymentSource, reference: string): PayResult;

  /* Portfolio ------------------------------------------------------ */
  portfolioStats(): PortfolioStats;
  listPortfolioAssets(query: PortfolioAssetsQuery): PagedEnvelope<Asset>;
  exportCsv(): ExportResult;

  /* Webhook -------------------------------------------------------- */
  settleAlatWebhook(reference: string, amountKobo: number, narration: string): void;

  /* Impact --------------------------------------------------------- */
  impactFor(businessId: string, period: ImpactPeriod): ImpactSummary;

  /* Demo ----------------------------------------------------------- */
  missPayment(loanId: string): { loan: Loan; asset: Asset };

  /* Audit ---------------------------------------------------------- */
  statusHistory(assetId?: string): readonly AssetStatusHistoryEntry[];
}

export type { AssetStatus, AssetStatusHistoryEntry };
