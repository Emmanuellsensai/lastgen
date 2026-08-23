// MSW request handlers, one group per contract domain.
//
// These mocks are the frontend contract test. They enforce the asset state
// machine, the medical flag guard, webhook idempotency on transactionReference
// and the rule that a quote is only valid when monthlySavings is positive.

import { http, HttpResponse, delay, type HttpHandler } from 'msw';
import {
  CO2_KG_PER_LITRE_PETROL,
  DEFAULT_GRACE_PERIOD_HOURS,
  type ApiEnvelope,
  type Asset,
  type AssetStatus,
  type Business,
  type CreditFile,
  type CreditFileDetail,
  type FuelLog,
  type Installment,
  type Loan,
  type MeterReading,
  type Payment,
  type Quote,
  type SolarSystem,
  type Wallet,
} from '@/types/api';
import { breakEvenMonth, buildSchedule, monthlyPaymentKobo, monthsToOwnership } from '@/lib/lease';
import { buildDb, DEMO_BUSINESS_ID, PETROL_PRICE_PER_LITRE_KOBO, type Db } from './seed';

const BASE = '/api';
const PAGE_SIZE = 25;

let db: Db = buildDb();

export function resetDb() {
  db = buildDb();
}

export function getDb(): Db {
  return db;
}

/* ------------------------------------------------------------------ */
/* Envelope helpers                                                    */
/* ------------------------------------------------------------------ */

/** Artificial latency so loading states are exercised during development. */
async function lag() {
  await delay(400 + Math.random() * 500);
}

function ok<T>(data: T, status = 200) {
  return HttpResponse.json<ApiEnvelope<T>>({ ok: true, data }, { status });
}

function fail(code: string, message: string, status = 400) {
  return HttpResponse.json<ApiEnvelope<never>>({ ok: false, error: { code, message } }, { status });
}

function notFound(what: string) {
  return fail('NOT_FOUND', `${what} not found`, 404);
}

function nextId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/* Domain helpers                                                      */
/* ------------------------------------------------------------------ */

function businessById(id: string): Business | undefined {
  return db.businesses.find((b) => b.id === id);
}

function assetByBusiness(businessId: string): Asset | undefined {
  return db.assets.find((a) => a.businessId === businessId);
}

function loanByAsset(assetId: string): Loan | undefined {
  return db.loans.find((l) => l.assetId === assetId);
}

function recomputeBurn(businessId: string) {
  const logs = db.fuelLogs.filter((l) => l.businessId === businessId);
  const profile = db.burnProfiles.find((p) => p.businessId === businessId);
  if (!profile || logs.length === 0) return profile;
  const totalLitres = logs.reduce((sum, l) => sum + l.litres, 0);
  const totalKobo = logs.reduce((sum, l) => sum + l.amountKobo, 0);
  const first = new Date(logs[0].loggedAt).getTime();
  const last = new Date(logs[logs.length - 1].loggedAt).getTime();
  const daysObserved = Math.max(1, Math.round((last - first) / 86_400_000));
  profile.litresPerDay = Number((totalLitres / daysObserved).toFixed(2));
  profile.dailyKobo = Math.round(totalKobo / daysObserved);
  profile.monthlyKobo = profile.dailyKobo * 30;
  profile.annualKobo = profile.dailyKobo * 365;
  profile.daysObserved = daysObserved;
  profile.verified = daysObserved >= 30;
  profile.computedAt = db.now.toISOString();
  return profile;
}

/**
 * Asset state machine, exactly as frozen in the contract.
 * ACTIVE -> GRACE -> SUSPENDED, any of them back to ACTIVE on payment,
 * ACTIVE -> OWNED when the loan balance clears. A business carrying the
 * medical flag is never suspended.
 */
function applyPaymentToAsset(asset: Asset, loan: Loan) {
  if (loan.balanceKobo <= 0) {
    asset.status = 'OWNED';
    loan.status = 'CLOSED';
    return;
  }
  if (asset.status === 'GRACE' || asset.status === 'SUSPENDED') {
    asset.status = 'ACTIVE';
    asset.suspendedAt = undefined;
    asset.suspendReason = undefined;
  }
  loan.status = 'ACTIVE';
}

function canSuspend(asset: Asset): boolean {
  const business = businessById(asset.businessId);
  return !business?.medicalFlag;
}

function creditFileDetail(file: CreditFile): CreditFileDetail {
  const principal = file.quote.system.priceKobo - file.quote.depositKobo;
  return {
    ...file,
    fuelLogs: db.fuelLogs.filter((l) => l.businessId === file.businessId).slice(-24),
    schedulePreview: buildSchedule(
      principal,
      file.quote.aprBps,
      file.quote.tenorMonths,
      db.now,
    ).slice(0, 6),
  };
}

function impactFor(businessId: string, period: 'month' | 'year' | 'all' | number) {
  const burn = db.burnProfiles.find((p) => p.businessId === businessId);
  const asset = assetByBusiness(businessId);
  const days =
    typeof period === 'number'
      ? period
      : period === 'month' ? 30
      : period === 'year' ? 365
      : 730;
  const litresPerDay = burn?.litresPerDay ?? 0;
  const readings = asset ? db.meterReadings.filter((r) => r.assetId === asset.id) : [];
  const windowStart = db.now.getTime() - days * 86_400_000;
  const inWindow = readings.filter((r) => new Date(r.ts).getTime() >= windowStart);
  const kwhGenerated = Number(
    (inWindow.reduce((sum, r) => sum + r.whGenerated, 0) / 1000).toFixed(1),
  );
  const litresDisplaced = Number((litresPerDay * days).toFixed(0));
  const loan = asset ? loanByAsset(asset.id) : undefined;

  return {
    litresDisplaced,
    co2KgAvoided: Number((litresDisplaced * CO2_KG_PER_LITRE_PETROL).toFixed(1)),
    nairaSavedKobo: Math.round(litresDisplaced * PETROL_PRICE_PER_LITRE_KOBO),
    kwhGenerated,
    monthsToOwnership: loan ? monthsToOwnership(loan.balanceKobo, loan.monthlyPaymentKobo) : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

const businessHandlers: HttpHandler[] = [
  http.post(`${BASE}/businesses`, async ({ request }) => {
    await lag();
    const body = (await request.json()) as {
      name: string;
      type: string;
      city: string;
      generatorKva?: number;
      hoursPerDay?: number;
    };
    if (!body?.name || !body?.type || !body?.city) {
      return fail('VALIDATION', 'name, type and city are required');
    }
    const business: Business = {
      id: nextId('biz'),
      name: body.name,
      type: body.type,
      city: body.city,
      generatorKva: body.generatorKva ?? 2.5,
      hoursPerDay: body.hoursPerDay ?? 8,
      createdAt: db.now.toISOString(),
      medicalFlag: false,
    };
    db.businesses.push(business);
    db.burnProfiles.push({
      businessId: business.id,
      litresPerDay: 0,
      dailyKobo: 0,
      monthlyKobo: 0,
      annualKobo: 0,
      daysObserved: 0,
      verified: false,
      computedAt: db.now.toISOString(),
    });
    return ok(business, 201);
  }),

  http.get(`${BASE}/businesses/:id`, async ({ params }) => {
    await lag();
    const business = businessById(String(params.id));
    return business ? ok(business) : notFound('Business');
  }),

  http.post(`${BASE}/businesses/:id/receipts`, async ({ params }) => {
    await lag();
    const businessId = String(params.id);
    if (!businessById(businessId)) return notFound('Business');
    // Vision extract, mocked. Values sit in the range a jerrycan receipt shows.
    const litres = Number((8 + Math.random() * 14).toFixed(1));
    const pricePerLitreKobo = PETROL_PRICE_PER_LITRE_KOBO;
    const log: FuelLog = {
      id: nextId('fl'),
      businessId,
      source: 'receipt',
      litres,
      amountKobo: Math.round(litres * pricePerLitreKobo),
      pricePerLitreKobo,
      loggedAt: db.now.toISOString(),
      receiptUrl: '/img/receipts/uploaded.jpg',
      confidence: Number((0.88 + Math.random() * 0.1).toFixed(2)),
    };
    db.fuelLogs.push(log);
    recomputeBurn(businessId);
    return ok(log, 201);
  }),

  http.post(`${BASE}/businesses/:id/fuel-logs`, async ({ params, request }) => {
    await lag();
    const businessId = String(params.id);
    if (!businessById(businessId)) return notFound('Business');
    const body = (await request.json()) as {
      litres: number;
      amountKobo: number;
      pricePerLitreKobo: number;
      loggedAt: string;
    };
    if (!body || body.litres <= 0 || body.amountKobo <= 0) {
      return fail('VALIDATION', 'litres and amountKobo must be greater than zero');
    }
    const log: FuelLog = {
      id: nextId('fl'),
      businessId,
      source: 'manual',
      litres: body.litres,
      amountKobo: body.amountKobo,
      pricePerLitreKobo: body.pricePerLitreKobo,
      loggedAt: body.loggedAt ?? db.now.toISOString(),
    };
    db.fuelLogs.push(log);
    db.fuelLogs.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
    recomputeBurn(businessId);
    return ok(log, 201);
  }),

  http.get(`${BASE}/businesses/:id/fuel-logs`, async ({ params, request }) => {
    await lag();
    const businessId = String(params.id);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit')) || 30;
    const offset = Number(url.searchParams.get('offset')) || 0;
    const logs = db.fuelLogs
      .filter((fl) => fl.businessId === businessId)
      .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
      .slice(offset, offset + limit);
    const total = db.fuelLogs.filter((fl) => fl.businessId === businessId).length;
    return ok({ items: logs, total });
  }),

  http.get(`${BASE}/businesses/:id/burn`, async ({ params }) => {
    await lag();
    const profile = db.burnProfiles.find((p) => p.businessId === String(params.id));
    return profile ? ok(profile) : notFound('Burn profile');
  }),
];

const quoteHandlers: HttpHandler[] = [
  http.get(`${BASE}/systems`, async ({ request }) => {
    await lag();
    const url = new URL(request.url);
    const minKw = Number(url.searchParams.get('minKw') ?? 0);
    const maxPriceKobo = Number(url.searchParams.get('maxPriceKobo') ?? Number.MAX_SAFE_INTEGER);
    const items = db.solarSystems.filter(
      (s: SolarSystem) => s.capacityKw >= minKw && s.priceKobo <= maxPriceKobo,
    );
    return ok({ items });
  }),

  http.post(`${BASE}/businesses/:id/quote`, async ({ params, request }) => {
    await lag();
    const businessId = String(params.id);
    if (!businessById(businessId)) return notFound('Business');
    const burn = db.burnProfiles.find((p) => p.businessId === businessId);
    if (!burn) return notFound('Burn profile');

    const body = (await request.json()) as {
      systemId: string;
      tenorMonths: number;
      depositKobo?: number;
    };
    const system = db.solarSystems.find((s) => s.id === body?.systemId);
    if (!system) return notFound('Solar system');
    if (!body.tenorMonths || body.tenorMonths < 6) {
      return fail('VALIDATION', 'tenorMonths must be at least 6');
    }

    const aprBps = 2800;
    const depositKobo = body.depositKobo ?? Math.round(system.priceKobo * 0.1);
    const principal = system.priceKobo - depositKobo;
    const payment = monthlyPaymentKobo(principal, aprBps, body.tenorMonths);
    const monthlySavingsKobo = burn.monthlyKobo - payment;

    // Contract rule: a quote is only valid when it saves money every month.
    if (monthlySavingsKobo <= 0) {
      return fail(
        'QUOTE_NOT_VIABLE',
        'This system costs more per month than the current fuel burn. Try a longer tenor or a smaller system.',
        422,
      );
    }

    const quote: Quote = {
      id: nextId('q'),
      businessId,
      system,
      tenorMonths: body.tenorMonths,
      depositKobo,
      monthlyPaymentKobo: payment,
      aprBps,
      totalPayableKobo: payment * body.tenorMonths + depositKobo,
      monthlySavingsKobo,
      savingsPct: Number(((monthlySavingsKobo / burn.monthlyKobo) * 100).toFixed(1)),
      breakEvenMonth: breakEvenMonth(depositKobo, monthlySavingsKobo),
    };
    db.quotes.push(quote);
    return ok(quote, 201);
  }),

  http.get(`${BASE}/quotes/:id`, async ({ params }) => {
    await lag();
    const quote = db.quotes.find((q) => q.id === String(params.id));
    return quote ? ok(quote) : notFound('Quote');
  }),
];

const creditHandlers: HttpHandler[] = [
  http.get(`${BASE}/credit/applications`, async ({ request }) => {
    await lag();
    const status = new URL(request.url).searchParams.get('status');
    const items = status ? db.creditFiles.filter((f) => f.status === status) : db.creditFiles;
    return ok({ items });
  }),

  http.get(`${BASE}/credit/applications/:id`, async ({ params }) => {
    await lag();
    const file = db.creditFiles.find((f) => f.id === String(params.id));
    return file ? ok(creditFileDetail(file)) : notFound('Credit file');
  }),

  http.post(`${BASE}/credit/applications/:id/approve`, async ({ params }) => {
    await lag();
    const file = db.creditFiles.find((f) => f.id === String(params.id));
    if (!file) return notFound('Credit file');
    if (file.status !== 'PENDING') {
      return fail('INVALID_TRANSITION', `Credit file is already ${file.status}`, 409);
    }
    if (file.quote.monthlySavingsKobo <= 0) {
      return fail('QUOTE_NOT_VIABLE', 'The attached quote does not save the business money', 422);
    }

    file.status = 'APPROVED';
    const principal = file.quote.system.priceKobo - file.quote.depositKobo;
    const asset: Asset = {
      id: nextId('ast'),
      businessId: file.businessId,
      systemId: file.quote.system.id,
      serial: `LG-${Math.floor(10000 + Math.random() * 89999)}`,
      controllerId: `CTL-${Math.floor(10000 + Math.random() * 89999)}`,
      status: 'ACTIVE',
      installedAt: db.now.toISOString(),
    };
    const loan: Loan = {
      id: nextId('loan'),
      assetId: asset.id,
      principalKobo: principal,
      tenorMonths: file.quote.tenorMonths,
      monthlyPaymentKobo: file.quote.monthlyPaymentKobo,
      balanceKobo: principal,
      nextDueAt: new Date(db.now.getTime() + 30 * 86_400_000).toISOString(),
      status: 'ACTIVE',
    };
    db.assets.push(asset);
    db.loans.push(loan);
    db.installments[loan.id] = buildSchedule(
      principal,
      file.quote.aprBps,
      file.quote.tenorMonths,
      db.now,
    );
    db.assetCity[asset.id] = file.business.city;
    db.assetBusinessName[asset.id] = file.business.name;
    return ok({ loan, asset }, 201);
  }),

  http.post(`${BASE}/credit/applications/:id/decline`, async ({ params, request }) => {
    await lag();
    const file = db.creditFiles.find((f) => f.id === String(params.id));
    if (!file) return notFound('Credit file');
    if (file.status !== 'PENDING') {
      return fail('INVALID_TRANSITION', `Credit file is already ${file.status}`, 409);
    }
    const body = (await request.json()) as { reason: string };
    if (!body?.reason) return fail('VALIDATION', 'reason is required');
    file.status = 'DECLINED';
    return ok(file);
  }),
];

const assetHandlers: HttpHandler[] = [
  http.get(`${BASE}/assets/:id`, async ({ params }) => {
    await lag();
    const asset = db.assets.find((a) => a.id === String(params.id));
    return asset ? ok(asset) : notFound('Asset');
  }),

  http.get(`${BASE}/assets/:id/meter`, async ({ params, request }) => {
    await lag();
    const assetId = String(params.id);
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    let items: MeterReading[] = db.meterReadings.filter((r) => r.assetId === assetId);
    if (from) items = items.filter((r) => r.ts >= from);
    if (to) items = items.filter((r) => r.ts <= to);
    return ok({ items });
  }),

  http.post(`${BASE}/assets/:id/suspend`, async ({ params, request }) => {
    await lag();
    const asset = db.assets.find((a) => a.id === String(params.id));
    if (!asset) return notFound('Asset');
    const body = (await request.json()) as { reason: string };
    if (!body?.reason) return fail('VALIDATION', 'reason is required');

    if (!canSuspend(asset)) {
      return fail(
        'MEDICAL_FLAG',
        'This business is flagged for medical load. Suspension is blocked.',
        409,
      );
    }
    if (asset.status === 'OWNED') {
      return fail('INVALID_TRANSITION', 'An owned asset cannot be suspended', 409);
    }
    asset.status = 'SUSPENDED';
    asset.suspendedAt = db.now.toISOString();
    asset.suspendReason = body.reason;
    return ok(asset);
  }),

  http.post(`${BASE}/assets/:id/restore`, async ({ params }) => {
    await lag();
    const asset = db.assets.find((a) => a.id === String(params.id));
    if (!asset) return notFound('Asset');
    if (asset.status === 'OWNED') {
      return fail('INVALID_TRANSITION', 'An owned asset is already unrestricted', 409);
    }
    asset.status = 'ACTIVE';
    asset.suspendedAt = undefined;
    asset.suspendReason = undefined;
    const loan = loanByAsset(asset.id);
    if (loan && loan.status === 'DELINQUENT') loan.status = 'ACTIVE';
    return ok(asset);
  }),
];

function settlePayment(loan: Loan, amountKobo: number, source: Payment['source'], reference: string) {
  const payment: Payment = {
    id: nextId('pay'),
    loanId: loan.id,
    amountKobo,
    paidAt: db.now.toISOString(),
    source,
    reference,
  };
  db.payments.push(payment);
  loan.balanceKobo = Math.max(0, loan.balanceKobo - amountKobo);
  loan.nextDueAt = new Date(db.now.getTime() + 30 * 86_400_000).toISOString();

  const schedule: Installment[] = db.installments[loan.id] ?? [];
  const nextUnpaid = schedule.find((i) => !i.paidAt);
  if (nextUnpaid) nextUnpaid.paidAt = db.now.toISOString();

  const asset = db.assets.find((a) => a.id === loan.assetId);
  if (asset) applyPaymentToAsset(asset, loan);
  return { payment, asset };
}

const loanHandlers: HttpHandler[] = [
  http.get(`${BASE}/loans/:id`, async ({ params }) => {
    await lag();
    const loan = db.loans.find((l) => l.id === String(params.id));
    return loan ? ok(loan) : notFound('Loan');
  }),

  http.post(`${BASE}/loans/:id/pay`, async ({ params, request }) => {
    await lag();
    const loan = db.loans.find((l) => l.id === String(params.id));
    if (!loan) return notFound('Loan');
    if (loan.status === 'CLOSED') {
      return fail('INVALID_TRANSITION', 'This loan is already closed', 409);
    }
    const body = (await request.json()) as { source: 'wallet' | 'bank_account'; amountKobo?: number };
    const amount = body.amountKobo ?? loan.balanceKobo;
    if (amount <= 0) {
      return fail('VALIDATION', 'amountKobo must be greater than zero');
    }

    if (body.source === 'wallet') {
      const asset = db.assets.find((a) => a.id === loan.assetId);
      const wallet = asset ? db.wallets.find((w) => w.businessId === asset.businessId) : undefined;
      if (!wallet || wallet.balanceKobo < amount) {
        return fail('PAYMENT_REQUIRED', 'Insufficient wallet balance', 402);
      }
      wallet.balanceKobo -= amount;
      const { payment } = settlePayment(loan, amount, 'WALLET', `SIM-${Date.now()}`);
      return ok<{ paymentId: string; platformTransactionReference: null; status: 'SUCCESS' | 'pending_authorisation' }>({ paymentId: payment.id, platformTransactionReference: null, status: 'SUCCESS' });
    }

    // Bank account path: pending, auto-settle after 3 seconds
    const ref = `SIM-${Date.now()}`;
    const paymentId = `pay_${Date.now()}`;
    db.pendingPayments.push({
      id: paymentId,
      loanId: loan.id,
      amountKobo: amount,
      reference: ref,
      status: 'pending_authorisation',
    });

    setTimeout(() => {
      const p = db.pendingPayments.find((x) => x.reference === ref);
      if (p && p.status === 'pending_authorisation') {
        p.status = 'SUCCESS';
        settlePayment(loan, amount, 'ALAT', ref);
      }
    }, 3000);

    return ok<{ paymentId: string; platformTransactionReference: null; status: 'SUCCESS' | 'pending_authorisation' }>({ paymentId, platformTransactionReference: null, status: 'pending_authorisation' });
  }),

  http.get(`${BASE}/loans/:id/schedule`, async ({ params }) => {
    await lag();
    const items = db.installments[String(params.id)];
    return items ? ok({ items }) : notFound('Schedule');
  }),
];

const portfolioHandlers: HttpHandler[] = [
  http.get(`${BASE}/portfolio/stats`, async () => {
    await lag();
    const financed = db.assets.length;
    const portfolioValueKobo = db.loans.reduce((sum, l) => sum + l.principalKobo, 0);
    const suspendedCount = db.assets.filter((a) => a.status === 'SUSPENDED').length;
    const delinquent = db.loans.filter((l) => l.status === 'DELINQUENT').length;
    const litresDisplaced = db.assets.length * 90 * 8.4;
    const byCityMap = new Map<string, number>();
    for (const asset of db.assets) {
      const city = db.assetCity[asset.id] ?? 'Lagos';
      byCityMap.set(city, (byCityMap.get(city) ?? 0) + 1);
    }
    return ok({
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
    });
  }),

  http.get(`${BASE}/portfolio/assets`, async ({ request }) => {
    await lag();
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as AssetStatus | null;
    const city = url.searchParams.get('city');
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));

    let items = db.assets;
    if (status) items = items.filter((a) => a.status === status);
    if (city) items = items.filter((a) => db.assetCity[a.id] === city);
    const total = items.length;
    const start = (page - 1) * PAGE_SIZE;
    return ok({ items: items.slice(start, start + PAGE_SIZE), total });
  }),

  http.post(`${BASE}/portfolio/export`, async () => {
    await lag();
    return ok({
      url: `/exports/lastgen-portfolio-${db.now.toISOString().slice(0, 10)}.csv`,
      generatedAt: db.now.toISOString(),
    });
  }),
];

const impactHandlers: HttpHandler[] = [
  http.get(`${BASE}/businesses/:id/impact`, async ({ params, request }) => {
    await lag();
    const businessId = String(params.id);
    if (!businessById(businessId)) return notFound('Business');
    const period = (new URL(request.url).searchParams.get('period') ?? 'month') as
      | 'month'
      | 'year'
      | 'all';
    return ok(impactFor(businessId, period));
  }),

  http.get(`${BASE}/businesses/:id/wrapped`, async ({ params, request }) => {
    await lag();
    const businessId = String(params.id);
    if (!businessById(businessId)) return notFound('Business');
    const url = new URL(request.url);
    const year = Number(url.searchParams.get('year') ?? db.now.getUTCFullYear());
    const days = url.searchParams.get('days') ? Number(url.searchParams.get('days')) : 365;
    const impact = impactFor(businessId, days);
    return ok({
      year,
      nairaSavedKobo: impact.nairaSavedKobo,
      litresNotBurned: impact.litresDisplaced,
      co2KgAvoided: impact.co2KgAvoided,
      kwhGenerated: impact.kwhGenerated,
      monthsToOwnership: impact.monthsToOwnership,
      bestMonth: 'March',
      rank: 12,
    });
  }),
];

const demoHandlers: HttpHandler[] = [
  http.post(`${BASE}/demo/reset`, async () => {
    await lag();
    resetDb();
    return ok({ ok: true as const });
  }),

  http.post(`${BASE}/demo/advance-time`, async ({ request }) => {
    await lag();
    const body = (await request.json()) as { days: number };
    const days = Number(body?.days ?? 0);
    if (!Number.isFinite(days) || days === 0) {
      return fail('VALIDATION', 'days must be a non zero number');
    }
    db.now = new Date(db.now.getTime() + days * 86_400_000);

    // Roll the state machine forward for anything now past due.
    const graceMs = DEFAULT_GRACE_PERIOD_HOURS * 3_600_000;
    for (const loan of db.loans) {
      if (loan.status === 'CLOSED') continue;
      const overdueBy = db.now.getTime() - new Date(loan.nextDueAt).getTime();
      if (overdueBy <= 0) continue;
      const asset = db.assets.find((a) => a.id === loan.assetId);
      if (!asset || asset.status === 'OWNED') continue;
      loan.status = 'DELINQUENT';
      if (overdueBy > graceMs && canSuspend(asset)) {
        asset.status = 'SUSPENDED';
        asset.suspendedAt = db.now.toISOString();
        asset.suspendReason = 'Grace period expired without payment';
      } else if (asset.status === 'ACTIVE') {
        asset.status = 'GRACE';
      }
    }
    return ok({ ok: true as const });
  }),

  http.post(`${BASE}/demo/miss-payment`, async ({ request }) => {
    await lag();
    const body = (await request.json()) as { loanId: string };
    const loan = db.loans.find((l) => l.id === body?.loanId);
    if (!loan) return notFound('Loan');
    const asset = db.assets.find((a) => a.id === loan.assetId);
    if (!asset) return notFound('Asset');
    if (asset.status === 'OWNED') {
      return fail('INVALID_TRANSITION', 'An owned asset has nothing left to miss', 409);
    }
    loan.status = 'DELINQUENT';
    loan.nextDueAt = new Date(db.now.getTime() - 86_400_000).toISOString();
    if (asset.status === 'ACTIVE') asset.status = 'GRACE';
    else if (asset.status === 'GRACE' && canSuspend(asset)) {
      asset.status = 'SUSPENDED';
      asset.suspendedAt = db.now.toISOString();
      asset.suspendReason = 'Grace period expired without payment';
    }
    return ok({ loan, asset });
  }),
];

interface AlatNotification {
  transactionReference?: string;
  amount?: number;
  narration?: string;
  accountNumber?: string;
}

const webhookHandlers: HttpHandler[] = [
  http.post(`${BASE}/webhooks/alat`, async ({ request }) => {
    const body = (await request.json()) as AlatNotification;
    const reference = body?.transactionReference;
    if (!reference) return fail('VALIDATION', 'transactionReference is required');

    // Idempotent on transactionReference: a replay is accepted and ignored.
    if (db.seenReferences.has(reference)) return ok({ ok: true as const });
    db.seenReferences.add(reference);

    const loan = db.loans.find((l) => body.narration?.includes(l.id)) ?? db.loans[0];
    if (loan && loan.status !== 'CLOSED' && body.amount && body.amount > 0) {
      settlePayment(loan, Math.round(body.amount * 100), 'ALAT', reference);
    }
    return ok({ ok: true as const });
  }),
];

const walletHandlers: HttpHandler[] = [
  http.get(`${BASE}/wallets/balance`, async () => {
    await lag();
    const wallet = db.wallets[0];
    if (!wallet) return notFound('Wallet');
    return ok(wallet);
  }),

  http.get(`${BASE}/wallets/statement`, async ({ request }) => {
    await lag();
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit')) || 20;
    const txs = db.walletTransactions.slice(0, limit);
    return ok({ items: txs });
  }),

  http.post(`${BASE}/wallets/create`, async ({ request }) => {
    await new Promise((r) => setTimeout(r, 2500));
    const body = (await request.json()) as Record<string, string>;
    const wallet: Wallet = {
      id: `wlt_${Date.now()}`,
      businessId: body.businessId,
      accountNumber: `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      bankCode: '035',
      balanceKobo: 5_000_000,
      currency: 'NGN',
      createdAt: new Date().toISOString(),
    };
    db.wallets.push(wallet);
    db.walletTransactions.push({
      id: `wtx_${Date.now()}`,
      walletId: wallet.id,
      ts: new Date().toISOString(),
      direction: 'IN',
      amountKobo: 5_000_000,
      description: 'Demo account pre-funding',
      reference: 'DEMO-PREFUND',
      category: 'credit',
    });
    return ok(wallet);
  }),

  http.get(`${BASE}/payments/:ref/status`, async ({ params }) => {
    await lag();
    const ref = String(params.ref);
    const payment = db.pendingPayments.find((p) => p.reference === ref || p.id === ref);
    if (!payment) return notFound('Payment');
    return ok({ paymentId: payment.id, status: payment.status });
  }),

  http.post(`${BASE}/auth/verify-nin`, async ({ request }) => {
    await new Promise((r) => setTimeout(r, 1500));
    const body = (await request.json()) as { nin: string };
    if (!body.nin || body.nin.length !== 11) {
      return fail('VALIDATION', 'NIN must be 11 digits');
    }
    return ok({
      verified: true,
      owner: {
        firstName: 'Adaeze',
        lastName: 'Okafor',
        dateOfBirth: '1988-04-12',
        phone: '+2348012345678',
      },
    });
  }),

    http.post(`${BASE}/auth/login`, async ({ request }) => {
    await lag();
    const body = (await request.json()) as { email: string; password: string };
    if (!body.email || !body.password) {
      return fail('VALIDATION', 'Email and password are required');
    }
    return ok({
      user: { id: 'demo-user', email: body.email, fullName: 'Adaeze Okafor' },
      role: 'owner',
      businessId: DEMO_BUSINESS_ID,
      accessToken: 'demo-token-xxx',
    });
  }),

  http.post(`${BASE}/auth/register`, async ({ request }) => {
    await lag();
    const body = (await request.json()) as { email: string; password: string; fullName: string; phone: string };
    if (!body.email || !body.password || !body.fullName) {
      return fail('VALIDATION', 'All fields are required');
    }
    return ok({
      user: { id: 'demo-user-new', email: body.email, fullName: body.fullName },
      role: 'owner',
      businessId: DEMO_BUSINESS_ID,
      accessToken: 'demo-token-xxx',
    });
  }),

  http.get(`${BASE}/me/session`, async () => {
    await lag();
    return ok({
      role: 'owner',
      businessId: DEMO_BUSINESS_ID,
      name: 'Adaeze Okafor',
    });
  }),
];

export const handlers: HttpHandler[] = [
  ...businessHandlers,
  ...quoteHandlers,
  ...creditHandlers,
  ...assetHandlers,
  ...loanHandlers,
  ...portfolioHandlers,
  ...impactHandlers,
  ...demoHandlers,
  ...webhookHandlers,
  ...walletHandlers,
];

export { DEMO_BUSINESS_ID };
