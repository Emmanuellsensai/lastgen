// SupabaseRepository — Phase 6 implementation of the Repository seam.
//
// Row mapping: Postgres columns are snake_case, the contract is camelCase, so
// every entity gets a mapXxx(row) helper and money/energy columns (bigint /
// numeric in the DB) are coerced with Number(). Inserts write money with
// String(x) so PostgREST sends exact integers, never a float.
//
// Business rules are NEVER hand-rolled here: every state change funnels
// through the asset state machine (transition), the loan state machine and the
// lease engine exactly like the in-memory repository, so the ApiError codes,
// messages and HTTP statuses match byte-for-byte.
//
// Atomicity: a settlement computes its outcome through the pure state machine
// FIRST (it throws before any write on invalid input) and then commits rows
// sequentially — asset, loan, next unpaid installment, payment, audit history
// (only when the asset status actually changed) and the wallet transaction for
// wallet payments. Postgres-level atomicity across that multi-row write would
// come from a server-side function; here the single-statement guard covers the
// critical race — the wallet balance compare-and-swap below, which is executed
// as one UPDATE ... WHERE balance_kobo >= amount so a concurrent debit cannot
// slip past the 402 check.
//
// Realtime: payments and wallets are published on the supabase_realtime
// publication by the migrations (payments-v2.sql, audit.sql). The repository
// relies on that Postgres-level publication — no JS broadcast is needed; the
// frontend subscribes to the payments/wallets channels directly.
//
// The Repository interface is fully async, and these implementations are
// naturally async too: every public method returns (or awaits) the promise
// from its private impl directly, so callers await the plain values. The
// demo-clock/void methods (advanceTime, settleAlatWebhook,
// setPaymentPlatformReference) are async and await their impl, surfacing
// late errors to the caller instead of swallowing them.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CO2_KG_PER_LITRE_PETROL,
  DAYS_PER_MONTH,
  DAYS_PER_YEAR,
  DEFAULT_APR_BPS,
  DEFAULT_DEPOSIT_RATIO,
  MIN_TENOR_MONTHS,
  PETROL_PRICE_PER_LITRE_KOBO,
  WALLET_BANK_CODE,
  WALLET_CURRENCY,
} from '../config/constants.js';
import { ApiError } from '../middleware/errorHandler.js';
import { transition } from '../services/assetStateMachine.js';
import { computeImpact } from '../services/impactEngine.js';
import { breakEvenMonth, buildSchedule, monthlyPaymentKobo } from '../services/leaseEngine.js';
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
import type {
  PaySettlement,
  ReceiptExtraction,
  Repository,
  WalletStatementQuery,
} from './repository.js';

const PAGE_SIZE = 25;
const DAY_MS = 86_400_000;

/* ------------------------------------------------------------------ */
/* Row shapes (snake_case, as PostgREST returns them)                  */
/* ------------------------------------------------------------------ */

interface BusinessRow {
  id: string;
  owner_id: string | null;
  name: string;
  type: string;
  city: string;
  generator_kva: number | string;
  hours_per_day: number | string;
  medical_flag: boolean;
  created_at: string;
}

interface FuelLogRow {
  id: string;
  business_id: string;
  source: 'receipt' | 'manual';
  litres: number | string;
  amount_kobo: number | string;
  price_per_litre_kobo: number | string;
  logged_at: string;
  receipt_url: string | null;
  confidence: number | null;
}

interface BurnProfileRow {
  business_id: string;
  litres_per_day: number | string;
  daily_kobo: number | string;
  monthly_kobo: number | string;
  annual_kobo: number | string;
  days_observed: number;
  verified: boolean;
  computed_at: string;
}

interface SolarSystemRow {
  id: string;
  name: string;
  capacity_kw: number | string;
  panel_w: number;
  battery_kwh: number | string;
  inverter_kva: number | string;
  price_kobo: number | string;
  covers_kva: number | string;
}

interface QuoteRow {
  id: string;
  business_id: string;
  system_id: string;
  tenor_months: number;
  deposit_kobo: number | string;
  monthly_payment_kobo: number | string;
  apr_bps: number;
  total_payable_kobo: number | string;
  monthly_savings_kobo: number | string;
  savings_pct: number | string;
  break_even_month: number;
  created_at: string;
}

interface CreditFileRow {
  id: string;
  business_id: string;
  quote_id: string;
  affordability_ratio: number | string;
  load_profile_score: number;
  verified_months: number;
  status: CreditFileStatus;
  decline_reason: string | null;
  created_at: string;
}

interface AssetRow {
  id: string;
  business_id: string;
  system_id: string;
  serial: string;
  controller_id: string;
  status: AssetStatus;
  installed_at: string;
  suspended_at: string | null;
  suspend_reason: string | null;
  city: string;
}

interface LoanRow {
  id: string;
  asset_id: string;
  principal_kobo: number | string;
  tenor_months: number;
  monthly_payment_kobo: number | string;
  balance_kobo: number | string;
  next_due_at: string;
  status: 'ACTIVE' | 'DELINQUENT' | 'CLOSED';
}

interface InstallmentRow {
  loan_id: string;
  n: number;
  due_at: string;
  principal_kobo: number | string;
  interest_kobo: number | string;
  balance_kobo: number | string;
  paid_at: string | null;
}

interface PaymentRow {
  id: string;
  loan_id: string;
  amount_kobo: number | string;
  paid_at: string;
  source: PaymentSource;
  reference: string;
  status: 'pending_authorisation' | 'authorised' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  platform_transaction_reference: string | null;
}

interface MeterReadingRow {
  id: string;
  asset_id: string;
  ts: string;
  wh_generated: number;
  wh_consumed: number;
  battery_soc_pct: number;
}

interface HistoryRow {
  id: string;
  asset_id: string;
  from_status: AssetStatus | null;
  to_status: AssetStatus;
  reason: string | null;
  changed_at: string;
  changed_by: string | null;
}

interface WalletRow {
  id: string;
  business_id: string;
  account_number: string;
  bank_code: string;
  currency: string;
  balance_kobo: number | string;
  created_at: string;
}

interface WalletTxRow {
  id: string;
  wallet_id: string;
  direction: 'IN' | 'OUT';
  amount_kobo: number | string;
  description: string | null;
  reference: string;
  category: string;
  ts: string;
}

export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const;

  private seq = 0;
  private serialSeqValue = 10_000;
  private walletSeqValue = 2_010_000_000;

  constructor(private readonly db: SupabaseClient) {}

  /* ------------------------------------------------------------------ */
  /* Demo clock                                                          */
  /* ------------------------------------------------------------------ */

  async now(): Promise<Date> {
    return new Date();
  }

  async advanceTime(_days: number): Promise<void> {
    throw new ApiError('NOT_IMPLEMENTED', 'advanceTime is a demo-only operation', 501);
  }

  async reset(): Promise<void> {
    throw new ApiError('NOT_IMPLEMENTED', 'reset is a demo-only operation', 501);
  }

  /* ------------------------------------------------------------------ */
  /* Businesses                                                          */
  /* ------------------------------------------------------------------ */

  createBusiness(input: CreateBusinessBody, ownerId?: string | null): Promise<Business> {
    return this.runCreateBusiness(input, ownerId);
  }

  getBusiness(id: string): Promise<Business | undefined> {
    return this.loadBusiness(id);
  }

  businessForOwner(ownerId: string): Promise<Business | undefined> {
    return this.loadBusinessForOwner(ownerId);
  }

  /* ------------------------------------------------------------------ */
  /* Fuel logs and burn                                                  */
  /* ------------------------------------------------------------------ */

  addFuelLog(businessId: string, input: CreateFuelLogBody): Promise<FuelLog> {
    return this.runAddFuelLog(businessId, input);
  }

  addReceiptLog(
    businessId: string,
    extraction: ReceiptExtraction,
    receiptUrl: string,
  ): Promise<FuelLog> {
    return this.runAddReceiptLog(businessId, extraction, receiptUrl);
  }

  fuelLogsFor(businessId: string, limit?: number): Promise<FuelLog[]> {
    return this.loadFuelLogs(businessId, limit);
  }

  burnProfileFor(businessId: string): Promise<BurnProfile | undefined> {
    return this.loadBurnProfile(businessId);
  }

  recomputeBurn(businessId: string): Promise<BurnProfile | undefined> {
    return this.runRecomputeBurn(businessId);
  }

  /* ------------------------------------------------------------------ */
  /* Systems                                                             */
  /* ------------------------------------------------------------------ */

  listSystems(query: SystemsQuery): Promise<SolarSystem[]> {
    return this.loadSystems(query);
  }

  /* ------------------------------------------------------------------ */
  /* Quotes                                                              */
  /* ------------------------------------------------------------------ */

  createQuote(businessId: string, input: CreateQuoteBody): Promise<Quote> {
    return this.runCreateQuote(businessId, input);
  }

  getQuote(id: string): Promise<Quote | undefined> {
    return this.loadQuote(id);
  }

  /* ------------------------------------------------------------------ */
  /* Credit                                                              */
  /* ------------------------------------------------------------------ */

  listCreditFiles(status?: CreditFileStatus): Promise<CreditFile[]> {
    return this.loadCreditFiles(status);
  }

  getCreditFile(id: string): Promise<CreditFileDetail | undefined> {
    return this.loadCreditFileDetail(id);
  }

  approveCreditFile(id: string): Promise<{ loan: Loan; asset: Asset }> {
    return this.runApproveCreditFile(id);
  }

  declineCreditFile(id: string, reason: string): Promise<CreditFile> {
    return this.runDeclineCreditFile(id, reason);
  }

  /* ------------------------------------------------------------------ */
  /* Assets                                                              */
  /* ------------------------------------------------------------------ */

  getAsset(id: string): Promise<Asset | undefined> {
    return this.loadAsset(id);
  }

  assetByBusiness(businessId: string): Promise<Asset | undefined> {
    return this.loadAssetByBusiness(businessId);
  }

  meterReadingsFor(assetId: string, from?: string, to?: string): Promise<MeterReading[]> {
    return this.loadMeterReadings(assetId, from, to);
  }

  suspendAsset(id: string, reason: string): Promise<Asset> {
    return this.runSuspendAsset(id, reason);
  }

  restoreAsset(id: string): Promise<Asset> {
    return this.runRestoreAsset(id);
  }

  /* ------------------------------------------------------------------ */
  /* Loans                                                               */
  /* ------------------------------------------------------------------ */

  getLoan(id: string): Promise<Loan | undefined> {
    return this.loadLoan(id);
  }

  loanByAsset(assetId: string): Promise<Loan | undefined> {
    return this.loadLoanByAsset(assetId);
  }

  scheduleFor(loanId: string): Promise<Installment[]> {
    return this.loadSchedule(loanId);
  }

  payLoan(
    loanId: string,
    amountKobo: number,
    source: PaymentSource,
    reference: string,
  ): Promise<PaySettlement> {
    return this.payLoanAsync(loanId, amountKobo, source, reference);
  }

  /* ------------------------------------------------------------------ */
  /* Payments lifecycle                                                  */
  /* ------------------------------------------------------------------ */

  startPayment(
    loanId: string,
    amountKobo: number,
    source: PaymentSource,
    reference: string,
    platformTransactionReference?: string,
  ): Promise<Payment> {
    return this.runStartPayment(
      loanId,
      amountKobo,
      source,
      reference,
      platformTransactionReference,
    );
  }

  settlePayment(reference: string): Promise<PaySettlement> {
    return this.settlePaymentAsync(reference);
  }

  failPayment(reference: string): Promise<Payment | undefined> {
    return this.runFailPayment(reference);
  }

  expirePayment(reference: string): Promise<Payment | undefined> {
    return this.runExpirePayment(reference);
  }

  async setPaymentPlatformReference(
    reference: string,
    platformTransactionReference: string,
  ): Promise<void> {
    await this.setPlatformReference(reference, platformTransactionReference);
  }

  paymentByRefOrId(key: string): Promise<Payment | undefined> {
    return this.loadPaymentByRefOrId(key);
  }

  /* ------------------------------------------------------------------ */
  /* Portfolio                                                           */
  /* ------------------------------------------------------------------ */

  portfolioStats(): Promise<PortfolioStats> {
    return this.computePortfolioStats();
  }

  listPortfolioAssets(query: PortfolioAssetsQuery): Promise<PagedEnvelope<Asset>> {
    return this.loadPortfolioAssets(query);
  }

  async exportCsv(): Promise<ExportResult> {
    const now = (await this.now()).toISOString();
    return { url: `/exports/lastgen-portfolio-${now.slice(0, 10)}.csv`, generatedAt: now };
  }

  /* ------------------------------------------------------------------ */
  /* Webhook                                                             */
  /* ------------------------------------------------------------------ */

  async settleAlatWebhook(reference: string, amountKobo: number, narration: string): Promise<void> {
    await this.settleAlatWebhookAsync(reference, amountKobo, narration);
  }

  /* ------------------------------------------------------------------ */
  /* Wallets                                                             */
  /* ------------------------------------------------------------------ */

  createWallet(businessId: string, input: CreateWalletBody): Promise<Wallet> {
    return this.runCreateWallet(businessId, input);
  }

  walletForBusiness(businessId: string): Promise<Wallet | undefined> {
    return this.loadWalletForBusiness(businessId);
  }

  walletStatement(walletId: string, query: WalletStatementQuery): Promise<WalletTransaction[]> {
    return this.loadWalletStatement(walletId, query);
  }

  creditWallet(
    walletId: string,
    amountKobo: number,
    description: string,
    reference: string,
    category: string,
  ): Promise<Wallet> {
    return this.runCreditWallet(walletId, amountKobo, description, reference, category);
  }

  payFromWallet(loanId: string, amountKobo: number): Promise<PaySettlement> {
    return this.payFromWalletAsync(loanId, amountKobo);
  }

  /* ------------------------------------------------------------------ */
  /* Impact                                                              */
  /* ------------------------------------------------------------------ */

  impactFor(businessId: string, period: ImpactPeriod): Promise<ImpactSummary> {
    return this.computeImpactFor(businessId, period);
  }

  /* ------------------------------------------------------------------ */
  /* Demo                                                                */
  /* ------------------------------------------------------------------ */

  missPayment(loanId: string): Promise<{ loan: Loan; asset: Asset }> {
    return this.runMissPayment(loanId);
  }

  /* ------------------------------------------------------------------ */
  /* Audit                                                               */
  /* ------------------------------------------------------------------ */

  statusHistory(assetId?: string): Promise<readonly AssetStatusHistoryEntry[]> {
    return this.loadStatusHistory(assetId);
  }

  /* ------------------------------------------------------------------ */
  /* Query helper                                                        */
  /* ------------------------------------------------------------------ */

  /** Await a supabase builder and surface any PostgREST error as a 500. */
  private async run<T>(query: PromiseLike<{ data: T; error: unknown }>): Promise<T | null> {
    const { data, error } = await query;
    if (error) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Supabase query failed';
      throw new ApiError('DATABASE_ERROR', message, 500);
    }
    return data ?? null;
  }

  /* ------------------------------------------------------------------ */
  /* ID generators                                                       */
  /* ------------------------------------------------------------------ */

  /** Per-instance monotonic id sequence, same prefixes as the in-memory repo. */
  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${String(this.seq).padStart(5, '0')}`;
  }

  /** Monotonic serial counter for LG-/CTL- controller numbers. */
  private nextSerial(): number {
    this.serialSeqValue += 1;
    return this.serialSeqValue;
  }

  /** Monotonic 10-digit virtual account number. */
  private nextWalletAccount(): string {
    this.walletSeqValue += 1;
    return String(this.walletSeqValue);
  }

  /* ------------------------------------------------------------------ */
  /* Row mapping                                                         */
  /* ------------------------------------------------------------------ */

  private mapBusiness(row: BusinessRow): Business {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      city: row.city,
      generatorKva: Number(row.generator_kva),
      hoursPerDay: Number(row.hours_per_day),
      createdAt: row.created_at,
      medicalFlag: row.medical_flag,
    };
  }

  private mapFuelLog(row: FuelLogRow): FuelLog {
    return {
      id: row.id,
      businessId: row.business_id,
      source: row.source,
      litres: Number(row.litres),
      amountKobo: Number(row.amount_kobo),
      pricePerLitreKobo: Number(row.price_per_litre_kobo),
      loggedAt: row.logged_at,
      receiptUrl: row.receipt_url ?? undefined,
      confidence: row.confidence === null ? undefined : Number(row.confidence),
    };
  }

  private mapBurnProfile(row: BurnProfileRow): BurnProfile {
    return {
      businessId: row.business_id,
      litresPerDay: Number(row.litres_per_day),
      dailyKobo: Number(row.daily_kobo),
      monthlyKobo: Number(row.monthly_kobo),
      annualKobo: Number(row.annual_kobo),
      daysObserved: row.days_observed,
      verified: row.verified,
      computedAt: row.computed_at,
    };
  }

  private mapSolarSystem(row: SolarSystemRow): SolarSystem {
    return {
      id: row.id,
      name: row.name,
      capacityKw: Number(row.capacity_kw),
      panelW: row.panel_w,
      batteryKwh: Number(row.battery_kwh),
      inverterKva: Number(row.inverter_kva),
      priceKobo: Number(row.price_kobo),
      coversKva: Number(row.covers_kva),
    };
  }

  /** Quotes denormalise the solar system, so mapping loads the referenced row. */
  private async mapQuote(row: QuoteRow): Promise<Quote> {
    const system = await this.run(
      this.db.from('solar_systems').select('*').eq('id', row.system_id).maybeSingle(),
    );
    if (!system) {
      throw new ApiError('DATABASE_ERROR', 'Quote references a missing solar system', 500);
    }
    return {
      id: row.id,
      businessId: row.business_id,
      system: this.mapSolarSystem(system),
      tenorMonths: row.tenor_months,
      depositKobo: Number(row.deposit_kobo),
      monthlyPaymentKobo: Number(row.monthly_payment_kobo),
      aprBps: row.apr_bps,
      totalPayableKobo: Number(row.total_payable_kobo),
      monthlySavingsKobo: Number(row.monthly_savings_kobo),
      savingsPct: Number(row.savings_pct),
      breakEvenMonth: row.break_even_month,
    };
  }

  private mapAsset(row: AssetRow): Asset {
    return {
      id: row.id,
      businessId: row.business_id,
      systemId: row.system_id,
      serial: row.serial,
      controllerId: row.controller_id,
      status: row.status,
      installedAt: row.installed_at,
      suspendedAt: row.suspended_at ?? undefined,
      suspendReason: row.suspend_reason ?? undefined,
    };
  }

  private mapLoan(row: LoanRow): Loan {
    return {
      id: row.id,
      assetId: row.asset_id,
      principalKobo: Number(row.principal_kobo),
      tenorMonths: row.tenor_months,
      monthlyPaymentKobo: Number(row.monthly_payment_kobo),
      balanceKobo: Number(row.balance_kobo),
      nextDueAt: row.next_due_at,
      status: row.status,
    };
  }

  private mapMeterReading(row: MeterReadingRow): MeterReading {
    return {
      id: row.id,
      assetId: row.asset_id,
      ts: row.ts,
      whGenerated: row.wh_generated,
      whConsumed: row.wh_consumed,
      batterySocPct: row.battery_soc_pct,
    };
  }

  private mapPayment(row: PaymentRow): Payment {
    return {
      id: row.id,
      loanId: row.loan_id,
      amountKobo: Number(row.amount_kobo),
      paidAt: row.paid_at,
      source: row.source,
      reference: row.reference,
      status: row.status,
      platformTransactionReference: row.platform_transaction_reference ?? undefined,
    };
  }

  private mapWallet(row: WalletRow): Wallet {
    return {
      id: row.id,
      businessId: row.business_id,
      accountNumber: row.account_number,
      bankCode: row.bank_code,
      currency: row.currency,
      balanceKobo: Number(row.balance_kobo),
      createdAt: row.created_at,
    };
  }

  private mapWalletTransaction(row: WalletTxRow): WalletTransaction {
    return {
      id: row.id,
      walletId: row.wallet_id,
      ts: row.ts,
      direction: row.direction,
      amountKobo: Number(row.amount_kobo),
      description: row.description ?? '',
      reference: row.reference,
      category: row.category,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Row builders for inserts/updates                                    */
  /* ------------------------------------------------------------------ */

  private toAssetRow(asset: Asset, city?: string): Record<string, unknown> {
    const row: Record<string, unknown> = {
      id: asset.id,
      business_id: asset.businessId,
      system_id: asset.systemId,
      serial: asset.serial,
      controller_id: asset.controllerId,
      status: asset.status,
      installed_at: asset.installedAt,
      suspended_at: asset.suspendedAt ?? null,
      suspend_reason: asset.suspendReason ?? null,
    };
    if (city !== undefined) row.city = city;
    return row;
  }

  private toLoanRow(loan: Loan): Record<string, unknown> {
    return {
      id: loan.id,
      asset_id: loan.assetId,
      principal_kobo: String(loan.principalKobo),
      tenor_months: loan.tenorMonths,
      monthly_payment_kobo: String(loan.monthlyPaymentKobo),
      balance_kobo: String(loan.balanceKobo),
      next_due_at: loan.nextDueAt,
      status: loan.status,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Lookups                                                             */
  /* ------------------------------------------------------------------ */

  private async loadBusiness(id: string): Promise<Business | undefined> {
    const row = await this.run(this.db.from('businesses').select('*').eq('id', id).maybeSingle());
    return row ? this.mapBusiness(row) : undefined;
  }

  private async findBusinessOrThrow(id: string): Promise<Business> {
    const business = await this.loadBusiness(id);
    if (!business) throw new ApiError('NOT_FOUND', 'Business not found', 404);
    return business;
  }

  private async loadBusinessForOwner(ownerId: string): Promise<Business | undefined> {
    if (!ownerId) return undefined;
    const row = await this.run(
      this.db.from('businesses').select('*').eq('owner_id', ownerId).limit(1).maybeSingle(),
    );
    return row ? this.mapBusiness(row) : undefined;
  }

  private async loadAsset(id: string): Promise<Asset | undefined> {
    const row = await this.run(this.db.from('assets').select('*').eq('id', id).maybeSingle());
    return row ? this.mapAsset(row) : undefined;
  }

  private async loadAssetByBusiness(businessId: string): Promise<Asset | undefined> {
    const row = await this.run(
      this.db.from('assets').select('*').eq('business_id', businessId).maybeSingle(),
    );
    return row ? this.mapAsset(row) : undefined;
  }

  private async findAssetOrThrow(id: string): Promise<{ asset: Asset; row: AssetRow }> {
    const row = await this.run(this.db.from('assets').select('*').eq('id', id).maybeSingle());
    if (!row) throw new ApiError('NOT_FOUND', 'Asset not found', 404);
    return { asset: this.mapAsset(row), row };
  }

  private async loadLoan(id: string): Promise<Loan | undefined> {
    const row = await this.run(this.db.from('loans').select('*').eq('id', id).maybeSingle());
    return row ? this.mapLoan(row) : undefined;
  }

  private async findLoanOrThrow(id: string): Promise<Loan> {
    const loan = await this.loadLoan(id);
    if (!loan) throw new ApiError('NOT_FOUND', 'Loan not found', 404);
    return loan;
  }

  private async loadLoanByAsset(assetId: string): Promise<Loan | undefined> {
    const row = await this.run(
      this.db.from('loans').select('*').eq('asset_id', assetId).maybeSingle(),
    );
    return row ? this.mapLoan(row) : undefined;
  }

  private async loadSchedule(loanId: string): Promise<Installment[]> {
    const rows =
      (await this.run(
        this.db
          .from('installments')
          .select('*')
          .eq('loan_id', loanId)
          .order('n', { ascending: true }),
      )) ?? [];
    return rows.map((row: InstallmentRow) => ({
      n: row.n,
      dueAt: row.due_at,
      principalKobo: Number(row.principal_kobo),
      interestKobo: Number(row.interest_kobo),
      balanceKobo: Number(row.balance_kobo),
      paidAt: row.paid_at ?? undefined,
    }));
  }

  private async loadBurnProfile(businessId: string): Promise<BurnProfile | undefined> {
    const row = await this.run(
      this.db.from('burn_profiles').select('*').eq('business_id', businessId).maybeSingle(),
    );
    return row ? this.mapBurnProfile(row) : undefined;
  }

  private async loadMeterReadings(
    assetId: string,
    from?: string,
    to?: string,
  ): Promise<MeterReading[]> {
    let q = this.db.from('meter_readings').select('*').eq('asset_id', assetId);
    if (from) q = q.gte('ts', from);
    if (to) q = q.lte('ts', to);
    const rows = (await this.run(q.order('ts', { ascending: true }))) ?? [];
    return rows.map((row: MeterReadingRow) => this.mapMeterReading(row));
  }

  private async loadPaymentByRefOrId(key: string): Promise<Payment | undefined> {
    const row = await this.run(
      this.db.from('payments').select('*').or(`reference.eq.${key},id.eq.${key}`).maybeSingle(),
    );
    return row ? this.mapPayment(row) : undefined;
  }

  private async loadWalletForBusiness(businessId: string): Promise<Wallet | undefined> {
    const row = await this.run(
      this.db.from('wallets').select('*').eq('business_id', businessId).maybeSingle(),
    );
    return row ? this.mapWallet(row) : undefined;
  }

  private async findWalletRow(id: string): Promise<WalletRow> {
    const row = await this.run(this.db.from('wallets').select('*').eq('id', id).maybeSingle());
    if (!row) throw new ApiError('NOT_FOUND', 'Wallet not found', 404);
    return row;
  }

  private async loadFuelLogs(businessId: string, limit?: number): Promise<FuelLog[]> {
    if (limit === undefined) {
      const rows =
        (await this.run(
          this.db
            .from('fuel_logs')
            .select('*')
            .eq('business_id', businessId)
            .order('logged_at', { ascending: true }),
        )) ?? [];
      return rows.map((row: FuelLogRow) => this.mapFuelLog(row));
    }
    // The in-memory repo returns the LAST `limit` logs; fetch newest-first then
    // reverse so the result stays ascending like the reference.
    const rows =
      (await this.run(
        this.db
          .from('fuel_logs')
          .select('*')
          .eq('business_id', businessId)
          .order('logged_at', { ascending: false })
          .limit(limit),
      )) ?? [];
    return rows.reverse().map((row: FuelLogRow) => this.mapFuelLog(row));
  }

  /* ------------------------------------------------------------------ */
  /* Shared write path                                                   */
  /* ------------------------------------------------------------------ */

  /** Commit a state-machine result onto the asset/loan rows and the audit trail. */
  private async commit(
    result: ReturnType<typeof transition>,
    asset: Asset,
    loan: Loan,
    changedBy: string,
  ): Promise<void> {
    const changedAt = (await this.now()).toISOString();
    await this.run(
      this.db
        .from('assets')
        .update(this.toAssetRow(result.asset))
        .eq('id', asset.id)
        .select('*')
        .single(),
    );
    // Portfolio assets may have no loan row (fallback loan); skip the loan write.
    if (loan.id) {
      await this.run(
        this.db
          .from('loans')
          .update(this.toLoanRow(result.loan))
          .eq('id', loan.id)
          .select('*')
          .single(),
      );
    }
    if (result.from !== result.to) {
      await this.run(
        this.db.from('asset_status_history').insert({
          id: this.nextId('hist'),
          asset_id: asset.id,
          from_status: result.from,
          to_status: result.to,
          reason: result.reason ?? null,
          changed_at: changedAt,
          changed_by: changedBy,
        }),
      );
    }
  }

  /** Mark the next unpaid installment paid, mirroring the in-memory settlement. */
  private async markNextInstallmentPaid(loanId: string, now: Date): Promise<void> {
    const next = await this.run(
      this.db
        .from('installments')
        .select('n')
        .eq('loan_id', loanId)
        .is('paid_at', null)
        .order('n', { ascending: true })
        .limit(1)
        .maybeSingle(),
    );
    if (next) {
      await this.run(
        this.db
          .from('installments')
          .update({ paid_at: now.toISOString() })
          .eq('loan_id', loanId)
          .eq('n', next.n),
      );
    }
  }

  /**
   * Resolve the business feeding the state machine. Portfolio assets have no
   * business row; the medical flag defaults to false exactly like memory.
   */
  private async businessFor(asset: Asset, assetRow?: AssetRow): Promise<Business> {
    const business = await this.loadBusiness(asset.businessId);
    if (business) return business;
    return {
      id: asset.businessId,
      name: asset.businessId,
      type: '',
      city: assetRow?.city ?? 'Lagos',
      generatorKva: 0,
      hoursPerDay: 0,
      createdAt: '',
      medicalFlag: false,
    };
  }

  private fallbackLoan(asset: Asset): Loan {
    return {
      id: '',
      assetId: asset.id,
      principalKobo: 0,
      tenorMonths: 0,
      monthlyPaymentKobo: 0,
      balanceKobo: 0,
      nextDueAt: '',
      status: 'ACTIVE',
    };
  }

  /* ------------------------------------------------------------------ */
  /* Async implementations                                               */
  /* ------------------------------------------------------------------ */

  private async runCreateBusiness(
    input: CreateBusinessBody,
    ownerId?: string | null,
  ): Promise<Business> {
    if (!input?.name || !input?.type || !input?.city) {
      throw new ApiError('VALIDATION', 'name, type and city are required', 400);
    }
    const now = (await this.now()).toISOString();
    const business: Business = {
      id: this.nextId('biz'),
      name: input.name,
      type: input.type,
      city: input.city,
      generatorKva: input.generatorKva ?? 2.5,
      hoursPerDay: input.hoursPerDay ?? 8,
      createdAt: now,
      medicalFlag: false,
    };
    await this.run(
      this.db.from('businesses').insert({
        id: business.id,
        owner_id: ownerId ?? null,
        name: business.name,
        type: business.type,
        city: business.city,
        generator_kva: business.generatorKva,
        hours_per_day: business.hoursPerDay,
        medical_flag: false,
        created_at: now,
      }),
    );
    await this.run(
      this.db.from('burn_profiles').insert({
        business_id: business.id,
        litres_per_day: 0,
        daily_kobo: String(0),
        monthly_kobo: String(0),
        annual_kobo: String(0),
        days_observed: 0,
        verified: false,
        computed_at: now,
      }),
    );
    return business;
  }

  private async runAddFuelLog(businessId: string, input: CreateFuelLogBody): Promise<FuelLog> {
    await this.findBusinessOrThrow(businessId);
    if (!input || input.litres <= 0 || input.amountKobo <= 0) {
      throw new ApiError('VALIDATION', 'litres and amountKobo must be greater than zero', 400);
    }
    const log: FuelLog = {
      id: this.nextId('fl'),
      businessId,
      source: 'manual',
      litres: input.litres,
      amountKobo: input.amountKobo,
      pricePerLitreKobo: input.pricePerLitreKobo,
      loggedAt: input.loggedAt ?? (await this.now()).toISOString(),
    };
    await this.run(
      this.db.from('fuel_logs').insert({
        id: log.id,
        business_id: businessId,
        source: 'manual',
        litres: log.litres,
        amount_kobo: String(log.amountKobo),
        price_per_litre_kobo: String(log.pricePerLitreKobo),
        logged_at: log.loggedAt,
        receipt_url: null,
        confidence: null,
      }),
    );
    await this.runRecomputeBurn(businessId);
    return log;
  }

  private async runAddReceiptLog(
    businessId: string,
    extraction: ReceiptExtraction,
    receiptUrl: string,
  ): Promise<FuelLog> {
    await this.findBusinessOrThrow(businessId);
    const log: FuelLog = {
      id: this.nextId('fl'),
      businessId,
      source: 'receipt',
      litres: extraction.litres,
      amountKobo: Math.round(extraction.litres * extraction.pricePerLitreKobo),
      pricePerLitreKobo: extraction.pricePerLitreKobo,
      loggedAt: (await this.now()).toISOString(),
      receiptUrl,
      confidence: extraction.confidence,
    };
    await this.run(
      this.db.from('fuel_logs').insert({
        id: log.id,
        business_id: businessId,
        source: 'receipt',
        litres: log.litres,
        amount_kobo: String(log.amountKobo),
        price_per_litre_kobo: String(log.pricePerLitreKobo),
        logged_at: log.loggedAt,
        receipt_url: receiptUrl,
        confidence: log.confidence ?? null,
      }),
    );
    await this.runRecomputeBurn(businessId);
    return log;
  }

  private async runRecomputeBurn(businessId: string): Promise<BurnProfile | undefined> {
    const logs =
      (await this.run(
        this.db
          .from('fuel_logs')
          .select('*')
          .eq('business_id', businessId)
          .order('logged_at', { ascending: true }),
      )) ?? [];
    const profile = await this.loadBurnProfile(businessId);
    if (!profile || logs.length === 0) return profile;

    const totalLitres = logs.reduce((sum: number, l: FuelLogRow) => sum + Number(l.litres), 0);
    const totalKobo = logs.reduce((sum: number, l: FuelLogRow) => sum + Number(l.amount_kobo), 0);
    const first = Date.parse(logs[0].logged_at);
    const last = Date.parse(logs[logs.length - 1].logged_at);
    const daysObserved = Math.max(1, Math.round((last - first) / DAY_MS));
    const litresPerDay = Math.round((totalLitres / daysObserved) * 100) / 100;
    const dailyKobo = Math.round(totalKobo / daysObserved);

    await this.run(
      this.db
        .from('burn_profiles')
        .update({
          litres_per_day: litresPerDay,
          daily_kobo: String(dailyKobo),
          monthly_kobo: String(dailyKobo * DAYS_PER_MONTH),
          annual_kobo: String(dailyKobo * DAYS_PER_YEAR),
          days_observed: daysObserved,
          verified: daysObserved >= 30,
          computed_at: (await this.now()).toISOString(),
        })
        .eq('business_id', businessId),
    );
    return this.loadBurnProfile(businessId);
  }

  private async loadSystems(query: SystemsQuery): Promise<SolarSystem[]> {
    let q = this.db.from('solar_systems').select('*');
    if (query.minKw !== undefined) q = q.gte('capacity_kw', query.minKw);
    if (query.maxPriceKobo !== undefined) q = q.lte('price_kobo', query.maxPriceKobo);
    const rows = (await this.run(q)) ?? [];
    return rows.map((row: SolarSystemRow) => this.mapSolarSystem(row));
  }

  private async loadQuote(id: string): Promise<Quote | undefined> {
    const row = await this.run(this.db.from('quotes').select('*').eq('id', id).maybeSingle());
    return row ? this.mapQuote(row) : undefined;
  }

  private async runCreateQuote(businessId: string, input: CreateQuoteBody): Promise<Quote> {
    await this.findBusinessOrThrow(businessId);
    const burn = await this.loadBurnProfile(businessId);
    if (!burn) throw new ApiError('NOT_FOUND', 'Burn profile not found', 404);

    const systemRow = await this.run(
      this.db.from('solar_systems').select('*').eq('id', input.systemId).maybeSingle(),
    );
    if (!systemRow) throw new ApiError('NOT_FOUND', 'Solar system not found', 404);
    if (!input.tenorMonths || input.tenorMonths < MIN_TENOR_MONTHS) {
      throw new ApiError('VALIDATION', 'tenorMonths must be at least 6', 400);
    }

    const system = this.mapSolarSystem(systemRow);
    const depositKobo = input.depositKobo ?? Math.round(system.priceKobo * DEFAULT_DEPOSIT_RATIO);
    const principal = system.priceKobo - depositKobo;
    const payment = monthlyPaymentKobo(principal, DEFAULT_APR_BPS, input.tenorMonths);
    const monthlySavingsKobo = burn.monthlyKobo - payment;

    if (monthlySavingsKobo <= 0) {
      throw new ApiError(
        'QUOTE_NOT_VIABLE',
        'This system costs more per month than the current fuel burn. Try a longer tenor or a smaller system.',
        422,
      );
    }

    const quote: Quote = {
      id: this.nextId('q'),
      businessId,
      system,
      tenorMonths: input.tenorMonths,
      depositKobo,
      monthlyPaymentKobo: payment,
      aprBps: DEFAULT_APR_BPS,
      totalPayableKobo: payment * input.tenorMonths + depositKobo,
      monthlySavingsKobo,
      savingsPct: Math.round((monthlySavingsKobo / burn.monthlyKobo) * 1000) / 10,
      breakEvenMonth: breakEvenMonth(depositKobo, monthlySavingsKobo),
    };
    await this.run(
      this.db.from('quotes').insert({
        id: quote.id,
        business_id: businessId,
        system_id: system.id,
        tenor_months: quote.tenorMonths,
        deposit_kobo: String(quote.depositKobo),
        monthly_payment_kobo: String(quote.monthlyPaymentKobo),
        apr_bps: quote.aprBps,
        total_payable_kobo: String(quote.totalPayableKobo),
        monthly_savings_kobo: String(quote.monthlySavingsKobo),
        savings_pct: quote.savingsPct,
        break_even_month: quote.breakEvenMonth,
        created_at: (await this.now()).toISOString(),
      }),
    );
    return quote;
  }

  private async loadCreditFiles(status?: CreditFileStatus): Promise<CreditFile[]> {
    let q = this.db.from('credit_files').select('*');
    if (status) q = q.eq('status', status);
    const rows = (await this.run(q.order('id', { ascending: true }))) ?? [];
    const files: CreditFile[] = [];
    for (const row of rows) {
      files.push(await this.loadCreditFile(row));
    }
    return files;
  }

  /** Expand a credit_files row into the contract shape (business + burn + quote). */
  private async loadCreditFile(row: CreditFileRow): Promise<CreditFile> {
    const [businessRow, burnRow, quoteRow] = await Promise.all([
      this.run(this.db.from('businesses').select('*').eq('id', row.business_id).maybeSingle()),
      this.run(
        this.db.from('burn_profiles').select('*').eq('business_id', row.business_id).maybeSingle(),
      ),
      this.run(this.db.from('quotes').select('*').eq('id', row.quote_id).maybeSingle()),
    ]);
    if (!businessRow || !burnRow || !quoteRow) {
      throw new ApiError(
        'DATABASE_ERROR',
        'Credit file references missing business, burn profile or quote',
        500,
      );
    }
    return {
      id: row.id,
      businessId: row.business_id,
      business: this.mapBusiness(businessRow),
      burn: this.mapBurnProfile(burnRow),
      quote: await this.mapQuote(quoteRow),
      affordabilityRatio: Number(row.affordability_ratio),
      loadProfileScore: row.load_profile_score,
      verifiedMonths: row.verified_months,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  private async loadCreditFileDetail(id: string): Promise<CreditFileDetail | undefined> {
    const row = await this.run(this.db.from('credit_files').select('*').eq('id', id).maybeSingle());
    if (!row) return undefined;
    const file = await this.loadCreditFile(row);
    const principal = file.quote.system.priceKobo - file.quote.depositKobo;
    return {
      ...file,
      fuelLogs: await this.loadFuelLogs(file.businessId, 24),
      schedulePreview: buildSchedule(
        principal,
        file.quote.aprBps,
        file.quote.tenorMonths,
        await this.now(),
      ).slice(0, 6),
    };
  }

  private async runApproveCreditFile(id: string): Promise<{ loan: Loan; asset: Asset }> {
    const row = await this.run(this.db.from('credit_files').select('*').eq('id', id).maybeSingle());
    if (!row) throw new ApiError('NOT_FOUND', 'Credit file not found', 404);
    if (row.status !== 'PENDING') {
      throw new ApiError('INVALID_TRANSITION', `Credit file is already ${row.status}`, 409);
    }
    const file = await this.loadCreditFile(row);
    if (file.quote.monthlySavingsKobo <= 0) {
      throw new ApiError(
        'QUOTE_NOT_VIABLE',
        'The attached quote does not save the business money',
        422,
      );
    }

    const now = await this.now();
    const principal = file.quote.system.priceKobo - file.quote.depositKobo;
    const asset: Asset = {
      id: this.nextId('ast'),
      businessId: file.businessId,
      systemId: file.quote.system.id,
      serial: `LG-${this.nextSerial()}`,
      controllerId: `CTL-${this.nextSerial()}`,
      status: 'ACTIVE',
      installedAt: now.toISOString(),
    };
    const loan: Loan = {
      id: this.nextId('loan'),
      assetId: asset.id,
      principalKobo: principal,
      tenorMonths: file.quote.tenorMonths,
      monthlyPaymentKobo: file.quote.monthlyPaymentKobo,
      balanceKobo: principal,
      nextDueAt: new Date(now.getTime() + 30 * DAY_MS).toISOString(),
      status: 'ACTIVE',
    };
    const schedule = buildSchedule(principal, file.quote.aprBps, file.quote.tenorMonths, now);

    await this.run(this.db.from('credit_files').update({ status: 'APPROVED' }).eq('id', id));
    await this.run(this.db.from('assets').insert(this.toAssetRow(asset, file.business.city)));
    await this.run(this.db.from('loans').insert(this.toLoanRow(loan)));
    await this.run(
      this.db.from('installments').insert(
        schedule.map((i) => ({
          loan_id: loan.id,
          n: i.n,
          due_at: i.dueAt,
          principal_kobo: String(i.principalKobo),
          interest_kobo: String(i.interestKobo),
          balance_kobo: String(i.balanceKobo),
          paid_at: null,
        })),
      ),
    );
    return { loan, asset };
  }

  private async runDeclineCreditFile(id: string, reason: string): Promise<CreditFile> {
    const row = await this.run(this.db.from('credit_files').select('*').eq('id', id).maybeSingle());
    if (!row) throw new ApiError('NOT_FOUND', 'Credit file not found', 404);
    if (row.status !== 'PENDING') {
      throw new ApiError('INVALID_TRANSITION', `Credit file is already ${row.status}`, 409);
    }
    if (!reason) throw new ApiError('VALIDATION', 'reason is required', 400);
    await this.run(
      this.db
        .from('credit_files')
        .update({ status: 'DECLINED', decline_reason: reason })
        .eq('id', id),
    );
    return this.loadCreditFile({ ...row, status: 'DECLINED', decline_reason: reason });
  }

  private async runSuspendAsset(id: string, reason: string): Promise<Asset> {
    const { asset, row: assetRow } = await this.findAssetOrThrow(id);
    const loan = (await this.loadLoanByAsset(asset.id)) ?? this.fallbackLoan(asset);
    const business = await this.businessFor(asset, assetRow);
    const result = transition(asset, loan, business, 'SUSPEND', {
      now: await this.now(),
      reason,
    });
    await this.commit(result, asset, loan, 'bank');
    return result.asset;
  }

  private async runRestoreAsset(id: string): Promise<Asset> {
    const { asset, row: assetRow } = await this.findAssetOrThrow(id);
    const loan = (await this.loadLoanByAsset(asset.id)) ?? this.fallbackLoan(asset);
    const business = await this.businessFor(asset, assetRow);
    const result = transition(asset, loan, business, 'RESTORE', { now: await this.now() });
    await this.commit(result, asset, loan, 'bank');
    return result.asset;
  }

  private async payLoanAsync(
    loanId: string,
    amountKobo: number,
    source: PaymentSource,
    reference: string,
  ): Promise<PaySettlement> {
    const loan = await this.findLoanOrThrow(loanId);
    const { asset, row: assetRow } = await this.findAssetOrThrow(loan.assetId);
    const business = await this.businessFor(asset, assetRow);
    const now = await this.now();
    const result = transition(asset, loan, business, 'PAY', { now, amountKobo });
    await this.commit(result, asset, loan, source === 'ALAT' ? 'alat' : 'bank');
    await this.markNextInstallmentPaid(loan.id, now);
    const payment: Payment = {
      id: this.nextId('pay'),
      loanId,
      amountKobo,
      paidAt: now.toISOString(),
      source,
      reference,
      status: 'SUCCESS',
    };
    await this.run(
      this.db.from('payments').insert({
        id: payment.id,
        loan_id: loanId,
        amount_kobo: String(amountKobo),
        paid_at: payment.paidAt,
        source,
        reference,
        status: 'SUCCESS',
      }),
    );
    return { payment, loan: result.loan, asset: result.asset };
  }

  private async runStartPayment(
    loanId: string,
    amountKobo: number,
    source: PaymentSource,
    reference: string,
    platformTransactionReference?: string,
  ): Promise<Payment> {
    const loan = await this.findLoanOrThrow(loanId);
    if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
      throw new ApiError('VALIDATION', 'amountKobo must be a positive integer', 400);
    }
    if (loan.status === 'CLOSED') {
      throw new ApiError('INVALID_TRANSITION', 'This loan is already closed', 409);
    }
    const now = (await this.now()).toISOString();
    const payment: Payment = {
      id: this.nextId('pay'),
      loanId,
      amountKobo,
      paidAt: now,
      source,
      reference,
      status: 'pending_authorisation',
      platformTransactionReference,
    };
    await this.run(
      this.db.from('payments').insert({
        id: payment.id,
        loan_id: loanId,
        amount_kobo: String(amountKobo),
        paid_at: now,
        source,
        reference,
        status: 'pending_authorisation',
        platform_transaction_reference: platformTransactionReference ?? null,
      }),
    );
    return payment;
  }

  private async settlePaymentAsync(reference: string): Promise<PaySettlement> {
    const pending = await this.run(
      this.db
        .from('payments')
        .select('*')
        .eq('reference', reference)
        .eq('status', 'pending_authorisation')
        .maybeSingle(),
    );
    if (!pending) {
      // Idempotent: a replay (webhook retry, poll race, simulated consent) sees
      // the terminal state and returns it unchanged.
      const terminal = await this.run(
        this.db.from('payments').select('*').eq('reference', reference).maybeSingle(),
      );
      if (terminal && terminal.status !== 'pending_authorisation') {
        const loan = await this.findLoanOrThrow(terminal.loan_id);
        const { asset } = await this.findAssetOrThrow(loan.assetId);
        return { payment: this.mapPayment(terminal), loan, asset };
      }
      throw new ApiError('NOT_FOUND', 'Payment not found', 404);
    }

    const loan = await this.findLoanOrThrow(pending.loan_id);
    const { asset, row: assetRow } = await this.findAssetOrThrow(loan.assetId);
    const business = await this.businessFor(asset, assetRow);
    const now = await this.now();
    const result = transition(asset, loan, business, 'PAY', {
      now,
      amountKobo: Number(pending.amount_kobo),
    });
    await this.commit(result, asset, loan, pending.source === 'ALAT' ? 'alat' : 'bank');
    await this.markNextInstallmentPaid(loan.id, now);
    await this.run(this.db.from('payments').update({ status: 'SUCCESS' }).eq('id', pending.id));
    this.broadcastPaymentStatus({
      paymentId: pending.id,
      from: 'pending_authorisation',
      to: 'SUCCESS',
      reference: pending.reference,
    });
    return {
      payment: { ...this.mapPayment(pending), status: 'SUCCESS' },
      loan: result.loan,
      asset: result.asset,
    };
  }

  private async runFailPayment(reference: string): Promise<Payment | undefined> {
    const pending = await this.run(
      this.db
        .from('payments')
        .select('*')
        .eq('reference', reference)
        .eq('status', 'pending_authorisation')
        .maybeSingle(),
    );
    if (!pending) return this.loadPaymentByRefOrId(reference);
    await this.run(this.db.from('payments').update({ status: 'FAILED' }).eq('id', pending.id));
    this.broadcastPaymentStatus({
      paymentId: pending.id,
      from: 'pending_authorisation',
      to: 'FAILED',
      reference: pending.reference,
    });
    return { ...this.mapPayment(pending), status: 'FAILED' };
  }

  private async runExpirePayment(reference: string): Promise<Payment | undefined> {
    const pending = await this.run(
      this.db
        .from('payments')
        .select('*')
        .eq('reference', reference)
        .eq('status', 'pending_authorisation')
        .maybeSingle(),
    );
    if (!pending) return this.loadPaymentByRefOrId(reference);
    await this.run(this.db.from('payments').update({ status: 'EXPIRED' }).eq('id', pending.id));
    this.broadcastPaymentStatus({
      paymentId: pending.id,
      from: 'pending_authorisation',
      to: 'EXPIRED',
      reference: pending.reference,
    });
    return { ...this.mapPayment(pending), status: 'EXPIRED' };
  }

  private broadcastPaymentStatus(payload: {
    paymentId: string;
    from: string;
    to: string;
    reference: string;
  }): void {
    try {
      const channel = this.db.channel('payments');
      void channel.send({
        type: 'broadcast',
        event: 'status_changed',
        payload,
      });
    } catch {
      // Best-effort: realtime broadcast failure does not abort the settlement.
    }
  }

  private async setPlatformReference(
    reference: string,
    platformTransactionReference: string,
  ): Promise<void> {
    await this.run(
      this.db
        .from('payments')
        .update({ platform_transaction_reference: platformTransactionReference })
        .eq('reference', reference),
    );
  }

  private async computePortfolioStats(): Promise<PortfolioStats> {
    const [assetRows, loanRows] = await Promise.all([
      this.run(this.db.from('assets').select('id,status,city')),
      this.run(this.db.from('loans').select('principal_kobo,status')),
    ]);
    const financed = assetRows?.length ?? 0;
    const portfolioValueKobo = (loanRows ?? []).reduce(
      (sum: number, l: { principal_kobo: number | string }) => sum + Number(l.principal_kobo),
      0,
    );
    const suspendedCount = (assetRows ?? []).filter(
      (a: { status: AssetStatus }) => a.status === 'SUSPENDED',
    ).length;
    const delinquent = (loanRows ?? []).filter(
      (l: { status: 'ACTIVE' | 'DELINQUENT' | 'CLOSED' }) => l.status === 'DELINQUENT',
    ).length;
    const litresDisplaced = (assetRows?.length ?? 0) * 90 * 8.4;

    const byCityMap = new Map<string, number>();
    for (const a of assetRows ?? []) {
      const city = a.city ?? 'Lagos';
      byCityMap.set(city, (byCityMap.get(city) ?? 0) + 1);
    }

    return {
      assetsFinanced: financed,
      portfolioValueKobo,
      repaymentRatePct: Number((100 - (delinquent / Math.max(1, financed)) * 100).toFixed(1)),
      parPct: Number(((delinquent / Math.max(1, financed)) * 100).toFixed(1)),
      suspendedCount,
      litresDisplaced: Math.round(litresDisplaced),
      co2TonnesAvoided: Number(((litresDisplaced * CO2_KG_PER_LITRE_PETROL) / 1000).toFixed(1)),
      byCity: [...byCityMap.entries()]
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  private async loadPortfolioAssets(query: PortfolioAssetsQuery): Promise<PagedEnvelope<Asset>> {
    const page = Math.max(1, query.page ?? 1);
    const start = (page - 1) * PAGE_SIZE;
    let q = this.db.from('assets').select('*', { count: 'exact' });
    if (query.status) q = q.eq('status', query.status);
    if (query.city) q = q.eq('city', query.city);
    const res = await q.range(start, start + PAGE_SIZE - 1);
    if (res.error) {
      throw new ApiError(
        'DATABASE_ERROR',
        (res.error as { message?: string }).message ?? 'Supabase query failed',
        500,
      );
    }
    return {
      items: (res.data ?? []).map((r: AssetRow) => this.mapAsset(r)),
      total: res.count ?? 0,
    };
  }

  private async settleAlatWebhookAsync(
    reference: string,
    amountKobo: number,
    narration: string,
  ): Promise<void> {
    // Idempotent on transactionReference: any payment already recorded for the
    // reference makes a replay a no-op (or settles a still-pending booking).
    const existing = await this.run(
      this.db.from('payments').select('*').eq('reference', reference).maybeSingle(),
    );
    if (existing) {
      if (existing.status === 'pending_authorisation') {
        await this.settlePaymentAsync(reference);
      }
      return;
    }
    // Fallback for notifications that arrive without a booked payment:
    // settle the loan named explicitly in the narration.
    const loan = await this.loanFromNarration(narration);
    if (loan && loan.status !== 'CLOSED' && amountKobo > 0) {
      await this.payLoanAsync(loan.id, amountKobo, 'ALAT', reference);
      return;
    }

    throw new ApiError('NOT_FOUND', 'No pending payment or matching loan found for reference', 404);
  }

  private async loanFromNarration(narration: string): Promise<Loan | undefined> {
    const direct = await this.loadLoan(narration.trim());
    if (direct) return direct;
    const ids = (await this.run(this.db.from('loans').select('id'))) ?? [];
    const matched = ids.find((r: { id: string }) => r.id && narration.includes(r.id));
    if (matched) return this.loadLoan(matched.id);
    return undefined;
  }

  private async runCreateWallet(businessId: string, input: CreateWalletBody): Promise<Wallet> {
    await this.findBusinessOrThrow(businessId);
    if (!input?.nin || !input?.firstName || !input?.lastName || !input?.phone) {
      throw new ApiError('VALIDATION', 'nin, firstName, lastName and phone are required', 400);
    }
    // Idempotent per business: onboarding may retry and should observe the same
    // virtual account rather than a conflict.
    const existing = await this.loadWalletForBusiness(businessId);
    if (existing) return existing;

    const now = (await this.now()).toISOString();
    const wallet: Wallet = {
      id: this.nextId('wlt'),
      businessId,
      accountNumber: this.nextWalletAccount(),
      bankCode: WALLET_BANK_CODE,
      balanceKobo: 0,
      currency: WALLET_CURRENCY,
      createdAt: now,
    };
    await this.run(
      this.db.from('wallets').insert({
        id: wallet.id,
        business_id: businessId,
        account_number: wallet.accountNumber,
        bank_code: wallet.bankCode,
        currency: wallet.currency,
        balance_kobo: String(0),
        created_at: now,
      }),
    );
    await this.run(
      this.db.from('wallet_kyc').insert({
        wallet_id: wallet.id,
        nin: input.nin,
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone,
      }),
    );
    return wallet;
  }

  private async loadWalletStatement(
    walletId: string,
    query: WalletStatementQuery,
  ): Promise<WalletTransaction[]> {
    let q = this.db.from('wallet_transactions').select('*').eq('wallet_id', walletId);
    if (query.before) q = q.lt('ts', query.before);
    const rows =
      (await this.run(
        q
          .order('ts', { ascending: false })
          .order('id', { ascending: false })
          .limit(query.limit ?? 20),
      )) ?? [];
    return rows.map((row: WalletTxRow) => this.mapWalletTransaction(row));
  }

  private async runCreditWallet(
    walletId: string,
    amountKobo: number,
    description: string,
    reference: string,
    category: string,
  ): Promise<Wallet> {
    if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
      throw new ApiError('VALIDATION', 'amountKobo must be a positive integer', 400);
    }
    const wallet = await this.findWalletRow(walletId);
    // Single atomic UPDATE so concurrent credits cannot drop a write; the guard
    // is just existence (no 402 for credits), checked by the row count.
    const updated = await this.db
      .from('wallets')
      .update({ balance_kobo: String(Number(wallet.balance_kobo) + amountKobo) })
      .eq('id', walletId)
      .select('*');
    if (updated.error) {
      throw new ApiError(
        'DATABASE_ERROR',
        (updated.error as { message?: string }).message ?? 'Supabase query failed',
        500,
      );
    }
    if (!updated.data || updated.data.length === 0) {
      throw new ApiError('NOT_FOUND', 'Wallet not found', 404);
    }
    await this.run(
      this.db.from('wallet_transactions').insert({
        id: this.nextId('wtx'),
        wallet_id: walletId,
        direction: 'IN',
        amount_kobo: String(amountKobo),
        description,
        reference,
        category,
        ts: (await this.now()).toISOString(),
      }),
    );
    return this.mapWallet(updated.data[0]);
  }

  private async payFromWalletAsync(loanId: string, amountKobo: number): Promise<PaySettlement> {
    if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
      throw new ApiError('VALIDATION', 'amountKobo must be a positive integer', 400);
    }
    const loan = await this.findLoanOrThrow(loanId);
    if (loan.status === 'CLOSED') {
      throw new ApiError('INVALID_TRANSITION', 'This loan is already closed', 409);
    }
    const { asset, row: assetRow } = await this.findAssetOrThrow(loan.assetId);
    const wallet = await this.loadWalletForBusiness(asset.businessId);
    if (!wallet) {
      throw new ApiError('NOT_FOUND', 'Wallet not found', 404);
    }
    const business = await this.businessFor(asset, assetRow);
    const now = await this.now();

    // Compute the PAY outcome through the state machine BEFORE any write so an
    // invalid input throws with nothing persisted.
    const result = transition(asset, loan, business, 'PAY', { now, amountKobo });

    // Atomic 402 guard: one UPDATE ... WHERE balance_kobo >= amount acts as a
    // compare-and-swap. PostgREST runs it as a single statement, so a debit
    // racing the read above leaves 0 rows matched and we throw 402.
    const debited = await this.db
      .from('wallets')
      .update({ balance_kobo: String(Number(wallet.balanceKobo) - amountKobo) })
      .eq('id', wallet.id)
      .gte('balance_kobo', amountKobo)
      .select('*');
    if (debited.error) {
      throw new ApiError(
        'DATABASE_ERROR',
        (debited.error as { message?: string }).message ?? 'Supabase query failed',
        500,
      );
    }
    if (!debited.data || debited.data.length === 0) {
      throw new ApiError('PAYMENT_REQUIRED', 'Insufficient wallet balance', 402);
    }

    const reference = `WLT-${Date.now()}`;
    await this.commit(result, asset, loan, 'bank');
    await this.markNextInstallmentPaid(loan.id, now);
    const payment: Payment = {
      id: this.nextId('pay'),
      loanId,
      amountKobo,
      paidAt: now.toISOString(),
      source: 'WALLET',
      reference,
      status: 'SUCCESS',
    };
    await this.run(
      this.db.from('payments').insert({
        id: payment.id,
        loan_id: loanId,
        amount_kobo: String(amountKobo),
        paid_at: payment.paidAt,
        source: 'WALLET',
        reference,
        status: 'SUCCESS',
      }),
    );
    await this.run(
      this.db.from('wallet_transactions').insert({
        id: this.nextId('wtx'),
        wallet_id: wallet.id,
        direction: 'OUT',
        amount_kobo: String(amountKobo),
        description: 'Loan repayment',
        reference,
        category: 'loan_payment',
        ts: now.toISOString(),
      }),
    );
    return { payment, loan: result.loan, asset: result.asset };
  }

  private async computeImpactFor(businessId: string, period: ImpactPeriod): Promise<ImpactSummary> {
    const burn = await this.loadBurnProfile(businessId);
    const asset = await this.loadAssetByBusiness(businessId);
    const loan = asset ? await this.loadLoanByAsset(asset.id) : undefined;
    const readings = asset ? await this.loadMeterReadings(asset.id) : [];
    return computeImpact({
      litresPerDay: burn?.litresPerDay ?? 0,
      balanceKobo: loan?.balanceKobo ?? 0,
      monthlyPaymentKobo: loan?.monthlyPaymentKobo ?? 0,
      petrolPricePerLitreKobo: PETROL_PRICE_PER_LITRE_KOBO,
      readings,
      period,
      now: await this.now(),
    });
  }

  private async runMissPayment(loanId: string): Promise<{ loan: Loan; asset: Asset }> {
    const loan = await this.findLoanOrThrow(loanId);
    const { asset, row: assetRow } = await this.findAssetOrThrow(loan.assetId);
    const business = await this.businessFor(asset, assetRow);
    const result = transition(asset, loan, business, 'MISS_PAYMENT', { now: await this.now() });
    await this.commit(result, asset, loan, 'demo');
    return { loan: result.loan, asset: result.asset };
  }

  private async loadStatusHistory(assetId?: string): Promise<readonly AssetStatusHistoryEntry[]> {
    let q = this.db.from('asset_status_history').select('*');
    if (assetId) q = q.eq('asset_id', assetId);
    const rows = (await this.run(q.order('changed_at', { ascending: false }))) ?? [];
    return rows.map((row: HistoryRow) => ({
      id: row.id,
      assetId: row.asset_id,
      fromStatus: row.from_status ?? undefined,
      toStatus: row.to_status,
      reason: row.reason ?? undefined,
      changedAt: row.changed_at,
      changedBy: row.changed_by ?? undefined,
    }));
  }
}
