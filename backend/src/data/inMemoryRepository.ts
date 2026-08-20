// In-memory repository — Phase 2 implementation of the Repository seam.
//
// Reproduces the MSW reference behaviour exactly (frontend/src/mocks/handlers.ts)
// against the deterministic seed (src/data/seed.ts), but every state change
// funnels through the real domain engines: assetStateMachine, loanStateMachine
// and leaseEngine. Nothing here hand-rolls business rules.
//
// Atomicity: a state-changing operation computes its outcome through the pure
// state machine FIRST (which throws before any mutation on invalid input) and
// only then commits. payLoan therefore updates the loan, asset, installment,
// payment ledger and audit history together or not at all.

import { ApiError } from '../middleware/errorHandler.js';
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
import { transition } from '../services/assetStateMachine.js';
import { computeImpact } from '../services/impactEngine.js';
import { breakEvenMonth, buildSchedule, monthlyPaymentKobo } from '../services/leaseEngine.js';
import type {
  Asset,
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
import { buildSeed, DEMO_BUSINESS_ID, type AssetStatusHistoryEntry, type DemoDb } from './seed.js';
import type {
  PaySettlement,
  ReceiptExtraction,
  Repository,
  WalletStatementQuery,
} from './repository.js';

const PAGE_SIZE = 25;
const DAY_MS = 86_400_000;

export class InMemoryRepository implements Repository {
  readonly kind = 'memory' as const;

  private state: DemoDb;
  private seq = 0;
  private serialSeqValue = 10_000;
  private walletSeqValue = 2_010_000_000;

  constructor() {
    this.state = buildSeed();
  }

  /* ------------------------------------------------------------------ */
  /* Demo clock                                                          */
  /* ------------------------------------------------------------------ */

  async now(): Promise<Date> {
    return new Date(this.state.now);
  }

  async advanceTime(days: number): Promise<void> {
    if (!Number.isFinite(days) || days === 0) {
      throw new ApiError('VALIDATION', 'days must be a non zero number', 400);
    }
    this.state.now = new Date(this.state.now.getTime() + days * DAY_MS);

    // Roll the asset state machine forward for anything now past due. The
    // OVERDUE transition marks loans delinquent and moves assets to GRACE or
    // SUSPENDED, honouring the medical-flag guard for every flagged business.
    for (const loan of this.state.loans) {
      if (loan.status === 'CLOSED') continue;
      const overdueBy = this.state.now.getTime() - Date.parse(loan.nextDueAt);
      if (overdueBy <= 0) continue;
      const asset = this.state.assets.find((a) => a.id === loan.assetId);
      if (!asset || asset.status === 'OWNED') continue;
      this.commit(
        transition(asset, loan, this.businessFor(asset), 'OVERDUE', { now: this.state.now }),
        asset,
        loan,
        'demo',
      );
    }
  }

  async reset(): Promise<void> {
    this.state = buildSeed();
    this.seq = 0;
    this.serialSeqValue = 10_000;
    this.walletSeqValue = 2_010_000_000;
  }

  /* ------------------------------------------------------------------ */
  /* Businesses                                                          */
  /* ------------------------------------------------------------------ */

  async createBusiness(input: CreateBusinessBody, _ownerId?: string | null): Promise<Business> {
    if (!input?.name || !input?.type || !input?.city) {
      throw new ApiError('VALIDATION', 'name, type and city are required', 400);
    }
    const business: Business = {
      id: this.nextId('biz'),
      name: input.name,
      type: input.type,
      city: input.city,
      generatorKva: input.generatorKva ?? 2.5,
      hoursPerDay: input.hoursPerDay ?? 8,
      createdAt: this.state.now.toISOString(),
      medicalFlag: false,
    };
    this.state.businesses.push(business);
    this.state.burnProfiles.push({
      businessId: business.id,
      litresPerDay: 0,
      dailyKobo: 0,
      monthlyKobo: 0,
      annualKobo: 0,
      daysObserved: 0,
      verified: false,
      computedAt: this.state.now.toISOString(),
    });
    return business;
  }

  async getBusiness(id: string): Promise<Business | undefined> {
    return this.state.businesses.find((b) => b.id === id);
  }

  /* ------------------------------------------------------------------ */
  /* Fuel logs and burn                                                  */
  /* ------------------------------------------------------------------ */

  async addFuelLog(businessId: string, input: CreateFuelLogBody): Promise<FuelLog> {
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
      loggedAt: input.loggedAt ?? this.state.now.toISOString(),
    };
    await this.pushFuelLog(log);
    return log;
  }

  async addReceiptLog(
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
      loggedAt: this.state.now.toISOString(),
      receiptUrl,
      confidence: extraction.confidence,
    };
    await this.pushFuelLog(log);
    return log;
  }

  async fuelLogsFor(businessId: string, limit?: number): Promise<FuelLog[]> {
    const logs = this.state.fuelLogs.filter((l) => l.businessId === businessId);
    return limit === undefined ? logs : logs.slice(-limit);
  }

  async burnProfileFor(businessId: string): Promise<BurnProfile | undefined> {
    return this.state.burnProfiles.find((p) => p.businessId === businessId);
  }

  async recomputeBurn(businessId: string): Promise<BurnProfile | undefined> {
    const logs = this.state.fuelLogs.filter((l) => l.businessId === businessId);
    const profile = await this.burnProfileFor(businessId);
    if (!profile || logs.length === 0) return profile;

    const totalLitres = logs.reduce((sum, l) => sum + l.litres, 0);
    const totalKobo = logs.reduce((sum, l) => sum + l.amountKobo, 0);
    const first = Date.parse(logs[0].loggedAt);
    const last = Date.parse(logs[logs.length - 1].loggedAt);
    const daysObserved = Math.max(1, Math.round((last - first) / DAY_MS));
    const litresPerDay = Math.round((totalLitres / daysObserved) * 100) / 100;
    const dailyKobo = Math.round(totalKobo / daysObserved);

    profile.litresPerDay = litresPerDay;
    profile.dailyKobo = dailyKobo;
    profile.monthlyKobo = dailyKobo * DAYS_PER_MONTH;
    profile.annualKobo = dailyKobo * DAYS_PER_YEAR;
    profile.daysObserved = daysObserved;
    profile.verified = daysObserved >= 30;
    profile.computedAt = this.state.now.toISOString();
    return profile;
  }

  /* ------------------------------------------------------------------ */
  /* Systems                                                             */
  /* ------------------------------------------------------------------ */

  async listSystems(query: SystemsQuery): Promise<SolarSystem[]> {
    const minKw = query.minKw ?? 0;
    const maxPriceKobo = query.maxPriceKobo ?? Number.MAX_SAFE_INTEGER;
    return this.state.solarSystems.filter(
      (s) => s.capacityKw >= minKw && s.priceKobo <= maxPriceKobo,
    );
  }

  /* ------------------------------------------------------------------ */
  /* Quotes                                                              */
  /* ------------------------------------------------------------------ */

  async createQuote(businessId: string, input: CreateQuoteBody): Promise<Quote> {
    await this.findBusinessOrThrow(businessId);
    const burn = await this.burnProfileFor(businessId);
    if (!burn) throw new ApiError('NOT_FOUND', 'Burn profile not found', 404);

    const system = this.state.solarSystems.find((s) => s.id === input.systemId);
    if (!system) throw new ApiError('NOT_FOUND', 'Solar system not found', 404);
    if (!input.tenorMonths || input.tenorMonths < MIN_TENOR_MONTHS) {
      throw new ApiError('VALIDATION', 'tenorMonths must be at least 6', 400);
    }

    const depositKobo = input.depositKobo ?? Math.round(system.priceKobo * DEFAULT_DEPOSIT_RATIO);
    const principal = system.priceKobo - depositKobo;
    const payment = monthlyPaymentKobo(principal, DEFAULT_APR_BPS, input.tenorMonths);
    const monthlySavingsKobo = burn.monthlyKobo - payment;

    // Contract rule: a quote is only valid when it saves money every month.
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
    this.state.quotes.push(quote);
    return quote;
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    return this.state.quotes.find((q) => q.id === id);
  }

  /* ------------------------------------------------------------------ */
  /* Credit                                                              */
  /* ------------------------------------------------------------------ */

  async listCreditFiles(status?: CreditFileStatus): Promise<CreditFile[]> {
    return status
      ? this.state.creditFiles.filter((f) => f.status === status)
      : this.state.creditFiles;
  }

  async getCreditFile(id: string): Promise<CreditFileDetail | undefined> {
    const file = this.state.creditFiles.find((f) => f.id === id);
    if (!file) return undefined;

    const principal = file.quote.system.priceKobo - file.quote.depositKobo;
    return {
      ...file,
      fuelLogs: await this.fuelLogsFor(file.businessId, 24),
      schedulePreview: buildSchedule(
        principal,
        file.quote.aprBps,
        file.quote.tenorMonths,
        this.state.now,
      ).slice(0, 6),
    };
  }

  async approveCreditFile(id: string): Promise<{ loan: Loan; asset: Asset }> {
    const file = this.state.creditFiles.find((f) => f.id === id);
    if (!file) throw new ApiError('NOT_FOUND', 'Credit file not found', 404);
    if (file.status !== 'PENDING') {
      throw new ApiError('INVALID_TRANSITION', `Credit file is already ${file.status}`, 409);
    }
    if (file.quote.monthlySavingsKobo <= 0) {
      throw new ApiError(
        'QUOTE_NOT_VIABLE',
        'The attached quote does not save the business money',
        422,
      );
    }

    file.status = 'APPROVED';
    const principal = file.quote.system.priceKobo - file.quote.depositKobo;
    const asset: Asset = {
      id: this.nextId('ast'),
      businessId: file.businessId,
      systemId: file.quote.system.id,
      serial: `LG-${this.serialSeq()}`,
      controllerId: `CTL-${this.serialSeq()}`,
      status: 'ACTIVE',
      installedAt: this.state.now.toISOString(),
    };
    const loan: Loan = {
      id: this.nextId('loan'),
      assetId: asset.id,
      principalKobo: principal,
      tenorMonths: file.quote.tenorMonths,
      monthlyPaymentKobo: file.quote.monthlyPaymentKobo,
      balanceKobo: principal,
      nextDueAt: new Date(this.state.now.getTime() + 30 * DAY_MS).toISOString(),
      status: 'ACTIVE',
    };
    this.state.assets.push(asset);
    this.state.loans.push(loan);
    this.state.installments[loan.id] = buildSchedule(
      principal,
      file.quote.aprBps,
      file.quote.tenorMonths,
      this.state.now,
    );
    this.state.assetCity[asset.id] = file.business.city;
    this.state.assetBusinessName[asset.id] = file.business.name;
    return { loan, asset };
  }

  async declineCreditFile(id: string, reason: string): Promise<CreditFile> {
    const file = this.state.creditFiles.find((f) => f.id === id);
    if (!file) throw new ApiError('NOT_FOUND', 'Credit file not found', 404);
    if (file.status !== 'PENDING') {
      throw new ApiError('INVALID_TRANSITION', `Credit file is already ${file.status}`, 409);
    }
    if (!reason) throw new ApiError('VALIDATION', 'reason is required', 400);
    file.status = 'DECLINED';
    return file;
  }

  /* ------------------------------------------------------------------ */
  /* Assets                                                              */
  /* ------------------------------------------------------------------ */

  async getAsset(id: string): Promise<Asset | undefined> {
    return this.state.assets.find((a) => a.id === id);
  }

  async assetByBusiness(businessId: string): Promise<Asset | undefined> {
    return this.state.assets.find((a) => a.businessId === businessId);
  }

  async meterReadingsFor(assetId: string, from?: string, to?: string): Promise<MeterReading[]> {
    let items = this.state.meterReadings.filter((r) => r.assetId === assetId);
    if (from) items = items.filter((r) => r.ts >= from);
    if (to) items = items.filter((r) => r.ts <= to);
    return items;
  }

  async suspendAsset(id: string, reason: string): Promise<Asset> {
    const asset = await this.findAssetOrThrow(id);
    const loan = (await this.loanByAsset(asset.id)) ?? this.fallbackLoan(asset);
    this.commit(
      transition(asset, loan, this.businessFor(asset), 'SUSPEND', {
        now: this.state.now,
        reason,
      }),
      asset,
      loan,
      'bank',
    );
    return asset;
  }

  async restoreAsset(id: string): Promise<Asset> {
    const asset = await this.findAssetOrThrow(id);
    const loan = (await this.loanByAsset(asset.id)) ?? this.fallbackLoan(asset);
    this.commit(
      transition(asset, loan, this.businessFor(asset), 'RESTORE', { now: this.state.now }),
      asset,
      loan,
      'bank',
    );
    return asset;
  }

  /* ------------------------------------------------------------------ */
  /* Loans                                                               */
  /* ------------------------------------------------------------------ */

  async getLoan(id: string): Promise<Loan | undefined> {
    return this.state.loans.find((l) => l.id === id);
  }

  async loanByAsset(assetId: string): Promise<Loan | undefined> {
    return this.state.loans.find((l) => l.assetId === assetId);
  }

  async scheduleFor(loanId: string): Promise<Installment[]> {
    return this.state.installments[loanId] ?? [];
  }

  async payLoan(
    loanId: string,
    amountKobo: number,
    source: PaymentSource,
    reference: string,
  ): Promise<PaySettlement> {
    const loan = await this.findLoanOrThrow(loanId);
    const asset = await this.findAssetOrThrow(loan.assetId);
    const applied = await this.applySettlement(loan, asset, amountKobo, source);
    const payment: Payment = {
      id: this.nextId('pay'),
      loanId,
      amountKobo,
      paidAt: this.state.now.toISOString(),
      source,
      reference,
      status: 'SUCCESS',
    };
    this.state.payments.push(payment);
    return { payment, loan: applied.loan, asset: applied.asset };
  }

  /* ------------------------------------------------------------------ */
  /* Payments lifecycle                                                  */
  /* ------------------------------------------------------------------ */

  async startPayment(
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

    const payment: Payment = {
      id: this.nextId('pay'),
      loanId,
      amountKobo,
      paidAt: this.state.now.toISOString(),
      source,
      reference,
      status: 'pending_authorisation',
      platformTransactionReference,
    };
    this.state.payments.push(payment);
    return payment;
  }

  async settlePayment(reference: string): Promise<PaySettlement> {
    const payment = this.state.payments.find(
      (p) => p.reference === reference && p.status === 'pending_authorisation',
    );
    // Idempotent: a replay (webhook retry, poll race, simulated consent) sees
    // the terminal state and returns it unchanged.
    if (!payment) {
      const terminal = this.state.payments.find((p) => p.reference === reference);
      if (terminal && terminal.status !== 'pending_authorisation') {
        const loan = await this.findLoanOrThrow(terminal.loanId);
        return {
          payment: terminal,
          loan,
          asset: await this.findAssetOrThrow(loan.assetId),
        };
      }
      throw new ApiError('NOT_FOUND', 'Payment not found', 404);
    }

    // Apply the PAY transition exactly like the direct path, then mark the
    // booked payment settled — one ledger row, one state change.
    const loan = await this.findLoanOrThrow(payment.loanId);
    const asset = await this.findAssetOrThrow(loan.assetId);
    // A concurrent settle (the route's awaited settle racing the simulated
    // adapter's in-process consent callback, or a webhook replay racing a poll)
    // can pass the pending lookup above before the first commit lands. The
    // state machine applies the transition exactly once, so the loser observes
    // the terminal status and returns it unchanged. applySettlement is
    // synchronous and is called without await so the commit is atomic with the
    // status check above — no microtask gap for a second caller to slip in.
    if (payment.status !== 'pending_authorisation') {
      return { payment, loan, asset };
    }
    const applied = this.applySettlement(loan, asset, payment.amountKobo, payment.source);
    payment.status = 'SUCCESS';
    return { payment, loan: applied.loan, asset: applied.asset };
  }

  async failPayment(reference: string): Promise<Payment | undefined> {
    const payment = this.state.payments.find(
      (p) => p.reference === reference && p.status === 'pending_authorisation',
    );
    if (!payment) return this.paymentByRefOrId(reference);
    payment.status = 'FAILED';
    return payment;
  }

  async expirePayment(reference: string): Promise<Payment | undefined> {
    const payment = this.state.payments.find(
      (p) => p.reference === reference && p.status === 'pending_authorisation',
    );
    if (!payment) return this.paymentByRefOrId(reference);
    payment.status = 'EXPIRED';
    return payment;
  }

  async setPaymentPlatformReference(
    reference: string,
    platformTransactionReference: string,
  ): Promise<void> {
    const payment = this.state.payments.find((p) => p.reference === reference);
    if (payment) payment.platformTransactionReference = platformTransactionReference;
  }

  async paymentByRefOrId(key: string): Promise<Payment | undefined> {
    return this.state.payments.find((p) => p.reference === key || p.id === key);
  }

  /* ------------------------------------------------------------------ */
  /* Portfolio                                                            */
  /* ------------------------------------------------------------------ */

  async portfolioStats(): Promise<PortfolioStats> {
    const financed = this.state.assets.length;
    const portfolioValueKobo = this.state.loans.reduce((sum, l) => sum + l.principalKobo, 0);
    const suspendedCount = this.state.assets.filter((a) => a.status === 'SUSPENDED').length;
    const delinquent = this.state.loans.filter((l) => l.status === 'DELINQUENT').length;
    const litresDisplaced = this.state.assets.length * 90 * 8.4;

    const byCityMap = new Map<string, number>();
    for (const asset of this.state.assets) {
      const city = this.state.assetCity[asset.id] ?? 'Lagos';
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

  async listPortfolioAssets(query: PortfolioAssetsQuery): Promise<PagedEnvelope<Asset>> {
    let items = this.state.assets;
    if (query.status) items = items.filter((a) => a.status === query.status);
    if (query.city) items = items.filter((a) => this.state.assetCity[a.id] === query.city);

    const total = items.length;
    const page = Math.max(1, query.page ?? 1);
    const start = (page - 1) * PAGE_SIZE;
    return { items: items.slice(start, start + PAGE_SIZE), total };
  }

  async exportCsv(): Promise<ExportResult> {
    return {
      url: `/exports/lastgen-portfolio-${this.state.now.toISOString().slice(0, 10)}.csv`,
      generatedAt: this.state.now.toISOString(),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Webhook                                                             */
  /* ------------------------------------------------------------------ */

  async settleAlatWebhook(reference: string, amountKobo: number, narration: string): Promise<void> {
    // Idempotent on transactionReference: a replay is accepted and ignored.
    if (this.state.seenReferences.has(reference)) return;

    // Preferred path: settle the payment the API booked for this reference.
    // The narration no longer drives the loan lookup.
    const pending = this.state.payments.find(
      (p) => p.reference === reference && p.status === 'pending_authorisation',
    );
    if (pending) {
      this.state.seenReferences.add(reference);
      await this.settlePayment(reference);
      return;
    }

    // Fallback for notifications that arrive without a booked payment:
    // settle the loan named explicitly in the narration.
    const loan = this.state.loans.find((l) => narration.includes(l.id));
    if (loan && loan.status !== 'CLOSED' && amountKobo > 0) {
      this.state.seenReferences.add(reference);
      await this.payLoan(loan.id, amountKobo, 'ALAT', reference);
      return;
    }

    throw new ApiError('NOT_FOUND', 'No pending payment or matching loan found for reference', 404);
  }

  /* ------------------------------------------------------------------ */
  /* Wallets                                                             */
  /* ------------------------------------------------------------------ */

  async createWallet(businessId: string, input: CreateWalletBody): Promise<Wallet> {
    await this.findBusinessOrThrow(businessId);
    if (!input?.nin || !input?.firstName || !input?.lastName || !input?.phone) {
      throw new ApiError('VALIDATION', 'nin, firstName, lastName and phone are required', 400);
    }

    // Idempotent per business: onboarding may retry and should observe the
    // same virtual account rather than a conflict.
    const existing = await this.walletForBusiness(businessId);
    if (existing) return existing;

    const wallet: Wallet = {
      id: this.nextId('wlt'),
      businessId,
      accountNumber: this.nextWalletAccount(),
      bankCode: WALLET_BANK_CODE,
      balanceKobo: 0,
      currency: WALLET_CURRENCY,
      createdAt: this.state.now.toISOString(),
    };
    this.state.wallets.push(wallet);
    this.state.walletKyc[wallet.id] = {
      nin: input.nin,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
    };
    return wallet;
  }

  async walletForBusiness(businessId: string): Promise<Wallet | undefined> {
    return this.state.wallets.find((w) => w.businessId === businessId);
  }

  async walletStatement(
    walletId: string,
    query: WalletStatementQuery,
  ): Promise<WalletTransaction[]> {
    const txs = this.state.walletTransactions
      .filter((t) => t.walletId === walletId && (!query.before || t.ts < query.before))
      // Newest first; the id tie-break keeps same-instant rows (demo clock)
      // in insertion order — the most recent transaction wins.
      .sort((a, b) => b.ts.localeCompare(a.ts) || b.id.localeCompare(a.id))
      .slice(0, query.limit ?? 20);
    return txs;
  }

  async creditWallet(
    walletId: string,
    amountKobo: number,
    description: string,
    reference: string,
    category: string,
  ): Promise<Wallet> {
    if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
      throw new ApiError('VALIDATION', 'amountKobo must be a positive integer', 400);
    }
    const wallet = this.findWalletOrThrow(walletId);
    wallet.balanceKobo += amountKobo;
    this.pushWalletTx(wallet.id, 'IN', amountKobo, description, reference, category);
    return wallet;
  }

  async payFromWallet(loanId: string, amountKobo: number): Promise<PaySettlement> {
    if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
      throw new ApiError('VALIDATION', 'amountKobo must be a positive integer', 400);
    }
    const loan = await this.findLoanOrThrow(loanId);
    if (loan.status === 'CLOSED') {
      throw new ApiError('INVALID_TRANSITION', 'This loan is already closed', 409);
    }
    const asset = await this.findAssetOrThrow(loan.assetId);
    const wallet = await this.walletForBusiness(asset.businessId);
    if (!wallet) {
      throw new ApiError('NOT_FOUND', 'Wallet not found', 404);
    }
    if (wallet.balanceKobo < amountKobo) {
      throw new ApiError('PAYMENT_REQUIRED', 'Insufficient wallet balance', 402);
    }

    const reference = `WLT-${Date.now()}`;
    wallet.balanceKobo -= amountKobo;
    this.pushWalletTx(wallet.id, 'OUT', amountKobo, 'Loan repayment', reference, 'loan_payment');

    // Settlement applies the exact same PAY transition as every other path,
    // after the wallet debit — the invariant is one transaction per entry path.
    const applied = await this.applySettlement(loan, asset, amountKobo, 'WALLET');
    const payment: Payment = {
      id: this.nextId('pay'),
      loanId,
      amountKobo,
      paidAt: this.state.now.toISOString(),
      source: 'WALLET',
      reference,
      status: 'SUCCESS',
    };
    this.state.payments.push(payment);
    return { payment, loan: applied.loan, asset: applied.asset };
  }

  async businessForOwner(ownerId: string): Promise<Business | undefined> {
    // Demo auth attaches the fixed demo-user; it owns the seeded demo business.
    if (ownerId === 'demo-user') return this.getBusiness(DEMO_BUSINESS_ID);
    return undefined;
  }

  /* ------------------------------------------------------------------ */
  /* Impact                                                              */
  /* ------------------------------------------------------------------ */

  async impactFor(businessId: string, period: ImpactPeriod): Promise<ImpactSummary> {
    const burn = await this.burnProfileFor(businessId);
    const asset = await this.assetByBusiness(businessId);
    const loan = asset ? await this.loanByAsset(asset.id) : undefined;
    return computeImpact({
      litresPerDay: burn?.litresPerDay ?? 0,
      balanceKobo: loan?.balanceKobo ?? 0,
      monthlyPaymentKobo: loan?.monthlyPaymentKobo ?? 0,
      petrolPricePerLitreKobo: PETROL_PRICE_PER_LITRE_KOBO,
      readings: asset ? await this.meterReadingsFor(asset.id) : [],
      period,
      now: this.state.now,
    });
  }

  /* ------------------------------------------------------------------ */
  /* Demo                                                                */
  /* ------------------------------------------------------------------ */

  async missPayment(loanId: string): Promise<{ loan: Loan; asset: Asset }> {
    const loan = await this.findLoanOrThrow(loanId);
    const asset = await this.findAssetOrThrow(loan.assetId);
    const result = transition(asset, loan, this.businessFor(asset), 'MISS_PAYMENT', {
      now: this.state.now,
    });
    this.commit(result, asset, loan, 'demo');
    return { loan: result.loan, asset: result.asset };
  }

  /* ------------------------------------------------------------------ */
  /* Audit                                                               */
  /* ------------------------------------------------------------------ */

  async statusHistory(assetId?: string): Promise<readonly AssetStatusHistoryEntry[]> {
    const history = this.state.assetStatusHistory;
    return assetId ? history.filter((h) => h.assetId === assetId) : history;
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                           */
  /* ------------------------------------------------------------------ */

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${String(this.seq).padStart(5, '0')}`;
  }

  /** Monotonic 5-digit serial sequence, restarting on reset. */
  private serialSeq(): number {
    this.serialSeqValue += 1;
    return this.serialSeqValue;
  }

  private async pushFuelLog(log: FuelLog): Promise<void> {
    this.state.fuelLogs.push(log);
    this.state.fuelLogs.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
    await this.recomputeBurn(log.businessId);
  }

  private async findBusinessOrThrow(id: string): Promise<Business> {
    const business = await this.getBusiness(id);
    if (!business) throw new ApiError('NOT_FOUND', 'Business not found', 404);
    return business;
  }

  private async findAssetOrThrow(id: string): Promise<Asset> {
    const asset = await this.getAsset(id);
    if (!asset) throw new ApiError('NOT_FOUND', 'Asset not found', 404);
    return asset;
  }

  private async findLoanOrThrow(id: string): Promise<Loan> {
    const loan = await this.getLoan(id);
    if (!loan) throw new ApiError('NOT_FOUND', 'Loan not found', 404);
    return loan;
  }

  /** Monotonic 10-digit virtual account number, restarting on reset. */
  private nextWalletAccount(): string {
    this.walletSeqValue += 1;
    return String(this.walletSeqValue);
  }

  private findWalletOrThrow(id: string): Wallet {
    const wallet = this.state.wallets.find((w) => w.id === id);
    if (!wallet) throw new ApiError('NOT_FOUND', 'Wallet not found', 404);
    return wallet;
  }

  private pushWalletTx(
    walletId: string,
    direction: 'IN' | 'OUT',
    amountKobo: number,
    description: string,
    reference: string,
    category: string,
  ): void {
    this.state.walletTransactions.push({
      id: this.nextId('wtx'),
      walletId,
      ts: this.state.now.toISOString(),
      direction,
      amountKobo,
      description,
      reference,
      category,
    });
  }

  /** Portfolio assets have no business row; the medical flag defaults to false. */
  private businessFor(asset: Asset): Business {
    const business = this.state.businesses.find((b) => b.id === asset.businessId);
    if (business) return business;
    return {
      id: asset.businessId,
      name: this.state.assetBusinessName[asset.id] ?? asset.businessId,
      type: '',
      city: this.state.assetCity[asset.id] ?? 'Lagos',
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

  /**
   * Runs the PAY state machine for a settlement and commits the loan, asset and
   * next unpaid installment together. Shared by the direct pay path and the
   * lifecycle settle path so both entry points apply the identical rule.
   */
  private applySettlement(
    loan: Loan,
    asset: Asset,
    amountKobo: number,
    source: PaymentSource,
  ): { loan: Loan; asset: Asset } {
    const result = transition(asset, loan, this.businessFor(asset), 'PAY', {
      now: this.state.now,
      amountKobo,
    });
    this.commit(result, asset, loan, source === 'ALAT' ? 'alat' : 'bank');

    const schedule = this.state.installments[loan.id];
    const nextUnpaid = schedule?.find((i) => !i.paidAt);
    if (nextUnpaid) nextUnpaid.paidAt = this.state.now.toISOString();

    return { loan: result.loan, asset: result.asset };
  }

  /**
   * Commits a transition result onto the live objects and records an audit row
   * when the asset status actually changed. Runs after the pure state machine
   * has already validated and produced the outcome, so it never half-applies.
   */
  private commit(
    result: ReturnType<typeof transition>,
    asset: Asset,
    loan: Loan,
    changedBy: string,
  ): void {
    Object.assign(asset, result.asset);
    Object.assign(loan, result.loan);
    if (result.from !== result.to) {
      this.state.assetStatusHistory.push({
        id: this.nextId('hist'),
        assetId: asset.id,
        fromStatus: result.from,
        toStatus: result.to,
        reason: result.reason,
        changedAt: this.state.now.toISOString(),
        changedBy,
      });
    }
  }
}
