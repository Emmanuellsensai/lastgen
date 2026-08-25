import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../../src/data/inMemoryRepository.js';
import { buildSeed, DEMO_BUSINESS_ID } from '../../src/data/seed.js';

// Correctness suite: seed-parity
//
// Proves backend/src/data/seed.ts reproduces the frontend MSW fixture
// (frontend/src/mocks/seed.ts buildDb()) byte-for-byte. Every expected value in
// this file was captured from the frontend's FIRST build on 2026-08-19 with a
// fresh mulberry32(20260819) — the same seed and the same PRNG consumption
// order the backend uses. If any number drifts, demo and live data no longer
// agree and this suite fails loudly.

const seed = buildSeed();

function statusCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const asset of seed.assets) counts[asset.status] = (counts[asset.status] ?? 0) + 1;
  return counts;
}

function groupCounts<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

describe('seed counts and shape', () => {
  it('matches the captured collection sizes', () => {
    expect(seed.businesses).toHaveLength(9);
    expect(seed.solarSystems).toHaveLength(8);
    expect(seed.fuelLogs).toHaveLength(328);
    expect(seed.burnProfiles).toHaveLength(9);
    expect(seed.quotes).toHaveLength(9);
    expect(seed.creditFiles).toHaveLength(9);
    expect(seed.assets).toHaveLength(524);
    expect(seed.loans).toHaveLength(524);
    expect(seed.payments).toHaveLength(55);
    expect(seed.meterReadings).toHaveLength(2160);
    expect(Object.keys(seed.assetCity)).toHaveLength(524);
    expect(Object.keys(seed.assetBusinessName)).toHaveLength(524);
    expect(Object.keys(seed.installments)).toHaveLength(4);
    expect(seed.seenReferences.size).toBe(0);
    expect(seed.assetStatusHistory).toHaveLength(0);
  });

  it('matches the asset and credit status distributions', () => {
    expect(statusCounts()).toEqual({ ACTIVE: 319, GRACE: 43, OWNED: 140, SUSPENDED: 22 });
    expect(groupCounts(seed.creditFiles, (c) => c.status)).toEqual({
      APPROVED: 4,
      PENDING: 4,
      DECLINED: 1,
    });
  });

  it('matches the fuel log count per business', () => {
    expect(groupCounts(seed.fuelLogs, (l) => l.businessId)).toEqual({
      biz_adaeze_frozen: 36,
      biz_bilikisu_tailor: 35,
      biz_kelechi_cuts: 36,
      biz_wuse_press: 37,
      biz_ogunlade_welding: 37,
      biz_gwarinpa_mart: 36,
      biz_ph_coldstore: 36,
      biz_sabongari_provisions: 39,
      biz_benin_grinding: 36,
    });
  });

  it('matches the paid installments per financed loan', () => {
    expect(groupCounts(seed.payments, (p) => p.loanId)).toEqual({
      loan_biz_adaeze_frozen: 11,
      loan_biz_wuse_press: 14,
      loan_biz_gwarinpa_mart: 20,
      loan_biz_sabongari_provisions: 10,
    });
  });
});

describe('demo business figures (biz_adaeze_frozen)', () => {
  it('matches the captured quote', () => {
    const quote = seed.quotes.find((q) => q.businessId === DEMO_BUSINESS_ID);
    expect(quote).toMatchObject({
      depositKobo: 74_200_000,
      monthlyPaymentKobo: 36_654_539,
      totalPayableKobo: 953_908_926,
      monthlySavingsKobo: 11_795_281,
      savingsPct: 24.3,
      breakEvenMonth: 7,
    });
  });

  it('matches the captured burn profile', () => {
    const burn = seed.burnProfiles.find((p) => p.businessId === DEMO_BUSINESS_ID);
    expect(burn).toMatchObject({
      litresPerDay: 13.97,
      dailyKobo: 1_614_994,
      monthlyKobo: 48_449_820,
      annualKobo: 589_472_810,
      verified: true,
    });
  });

  it('matches the captured credit file', () => {
    const file = seed.creditFiles.find((c) => c.businessId === DEMO_BUSINESS_ID);
    expect(file).toMatchObject({
      affordabilityRatio: 0.76,
      loadProfileScore: 62,
      status: 'APPROVED',
      verifiedMonths: 3,
    });
  });

  it('matches the captured asset and loan', () => {
    const asset = seed.assets.find((a) => a.businessId === DEMO_BUSINESS_ID);
    const loan = seed.loans.find((l) => l.assetId === asset?.id);
    expect(asset).toMatchObject({
      id: 'ast_biz_adaeze_frozen',
      status: 'ACTIVE',
      serial: 'LG-00001',
      controllerId: 'CTL-00001',
      installedAt: '2026-01-12T09:00:00.000Z',
    });
    expect(loan).toMatchObject({
      id: 'loan_biz_adaeze_frozen',
      principalKobo: 667_800_000,
      monthlyPaymentKobo: 36_654_539,
      balanceKobo: 361_725_000,
      nextDueAt: '2026-09-19T09:00:00.000Z',
      status: 'ACTIVE',
    });
  });
});

describe('portfolio', () => {
  it('matches row zero and its loan exactly', () => {
    const asset = seed.assets.find((a) => a.id === 'ast_p000');
    const loan = seed.loans.find((l) => l.id === 'loan_p000');
    expect(asset).toMatchObject({
      businessId: 'biz_p000',
      systemId: 'sys_lite_1k',
      serial: 'LG-01041',
      controllerId: 'CTL-02207',
      status: 'ACTIVE',
      installedAt: '2025-07-17T09:00:00.000Z',
      suspendedAt: undefined,
      suspendReason: undefined,
    });
    expect(loan).toMatchObject({
      principalKobo: 103_840_000,
      tenorMonths: 36,
      monthlyPaymentKobo: 4_465_239,
      balanceKobo: 23_075_556,
      nextDueAt: '2026-09-19T09:00:00.000Z',
      status: 'ACTIVE',
    });
    expect(seed.assetCity['ast_p000']).toBe('Lagos');
    expect(seed.assetBusinessName['ast_p000']).toBe('Kelechi Provisions');
  });

  it('every portfolio asset has a loan, a city and a business name', () => {
    for (const asset of seed.assets) {
      const loan = seed.loans.find((l) => l.assetId === asset.id);
      expect(loan, asset.id).toBeDefined();
      expect(seed.assetCity[asset.id], asset.id).toBeDefined();
      expect(seed.assetBusinessName[asset.id], asset.id).toBeDefined();
    }
  });
});

describe('meter readings', () => {
  it('matches the first and last captured readings', () => {
    expect(seed.meterReadings[0]).toMatchObject({
      id: 'mr_ast_biz_adaeze_frozen_0000',
      ts: '2026-05-21T06:00:00.000Z',
      whGenerated: 3155,
      whConsumed: 13712,
      batterySocPct: 51,
    });
    const last = seed.meterReadings[seed.meterReadings.length - 1];
    expect(last).toMatchObject({
      id: 'mr_ast_biz_sabongari_provisions_0539',
      ts: '2026-08-18T21:00:00.000Z',
      batterySocPct: 51,
    });
  });

  it('provides exactly 540 readings per installed asset', () => {
    const perAsset = groupCounts(seed.meterReadings, (r) => r.assetId);
    expect(Object.values(perAsset)).toEqual([540, 540, 540, 540]);
  });
});

describe('deterministic rebuild', () => {
  it('a fresh build reproduces identical data', () => {
    const second = buildSeed();
    expect(second.fuelLogs).toEqual(seed.fuelLogs);
    expect(second.meterReadings).toEqual(seed.meterReadings);
    expect(second.assets).toEqual(seed.assets);
    expect(second.loans).toEqual(seed.loans);
    expect(second.quotes).toEqual(seed.quotes);
  });

  it('a repository reset restores the pristine seed', async () => {
    const repo = new InMemoryRepository();
    await repo.advanceTime(90);
    await repo.reset();
    expect((await repo.now()).toISOString()).toBe('2026-08-19T09:00:00.000Z');
    expect((await repo.getAsset('ast_biz_adaeze_frozen'))?.status).toBe('ACTIVE');
    expect((await repo.getLoan('loan_biz_wuse_press'))?.status).toBe('DELINQUENT');
    expect((await repo.getBusiness('biz_gwarinpa_mart'))?.medicalFlag).toBe(true);
    expect(await repo.statusHistory()).toHaveLength(0);
  });
});

describe('repository portfolio stats parity', () => {
  it('matches the reference projection to the kobo', async () => {
    const repo = new InMemoryRepository();
    expect(await repo.portfolioStats()).toEqual({
      assetsFinanced: 524,
      portfolioValueKobo: 260_712_290_000,
      repaymentRatePct: 87.8,
      parPct: 12.2,
      suspendedCount: 22,
      litresDisplaced: 396144,
      co2TonnesAvoided: 915.1,
      byCity: [
        { city: 'Lagos', count: 215 },
        { city: 'Abuja', count: 100 },
        { city: 'Ibadan', count: 78 },
        { city: 'Port Harcourt', count: 58 },
        { city: 'Kano', count: 42 },
        { city: 'Benin City', count: 31 },
      ],
    });
  });
});
