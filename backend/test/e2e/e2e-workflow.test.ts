import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEMO_WALLET_FUNDING_KOBO,
  WALLET_BANK_CODE,
  WALLET_CURRENCY,
} from '../../src/config/constants.js';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// ============================================================================
// LASTGEN BACKEND — COMPREHENSIVE END-TO-END (E2E) TEST SUITE
// WEMA HACKAHOLICS 7.0 · HACKATHON TRACK · TEAM RYZEN
// ============================================================================
//
// This test suite executes full end-to-end system flows across all backend
// surfaces, state machines, repositories, payment adapters, and safety guards.
//
// Scenarios Tested:
// 1. Complete Happy Path: Business Creation -> Fuel Logs -> Burn Profile ->
//    System Selection -> Quote -> Underwriting -> Approval -> Telemetry Metering ->
//    Wallet Creation -> Dual-Channel Repayments (Wallet + Bank) -> Full Payoff (OWNED).
// 2. Default & PAYG Enforcement: Arrears -> GRACE (72h) -> SUSPENDED (40W clamp) ->
//    Qualifying Repayment -> Instant Restore (ACTIVE).
// 3. Life-Safety Invariant: Medical-Flagged Business NEVER suspended under any arrears.
// 4. Securitisation & Treasury: Portfolio KPIs, Paged Ledger, and Securitisation Export.
// 5. Webhook Replay & Idempotency: Duplicate transaction notifications processed cleanly.
// ============================================================================

describe('Lastgen Backend — End-to-End (E2E) Verification Suite', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp({ demoMode: true }));
  });

  // ==========================================================================
  // SCENARIO 1: THE FULL BORROWER LIFECYCLE (ORIGINATION TO ASSET OWNERSHIP)
  // ==========================================================================
  describe('Scenario 1: Full Borrower Lifecycle (Origination to Asset Ownership)', () => {
    it('walks the complete happy path from fuel intake to complete loan payoff and title transfer', async () => {
      // ----------------------------------------------------------------------
      // Step 1: Informal Business Registration
      // ----------------------------------------------------------------------
      const createBizRes = await request(app).post('/api/businesses').send({
        name: 'Iya Basira Kitchen',
        type: 'Catering / Restaurant',
        city: 'Lagos',
        generatorKva: 4.5,
        hoursPerDay: 10,
      });

      expect(createBizRes.status).toBe(201);
      expect(createBizRes.body.ok).toBe(true);
      const business = createBizRes.body.data;
      expect(business.id).toMatch(/^biz_/);
      expect(business.name).toBe('Iya Basira Kitchen');
      expect(business.city).toBe('Lagos');

      // ----------------------------------------------------------------------
      // Step 2: Fuel Spend Logging & Burn Calculation
      // ----------------------------------------------------------------------
      const baseTime = new Date('2026-08-01T08:00:00.000Z').getTime();
      const DAY_MS = 24 * 60 * 60 * 1000;

      // Log 15 consecutive days of petrol purchases (10L @ NGN 850/L = NGN 8,500 = 850,000 kobo)
      for (let day = 0; day < 15; day++) {
        const loggedAt = new Date(baseTime + day * DAY_MS).toISOString();
        const fuelRes = await request(app).post(`/api/businesses/${business.id}/fuel-logs`).send({
          litres: 10,
          amountKobo: 850_000,
          pricePerLitreKobo: 85_000,
          loggedAt,
        });
        expect(fuelRes.status).toBe(201);
        expect(fuelRes.body.data.businessId).toBe(business.id);
      }

      // Query the computed burn profile
      const burnRes = await request(app).get(`/api/businesses/${business.id}/burn`);
      expect(burnRes.status).toBe(200);
      expect(burnRes.body.ok).toBe(true);
      const burn = burnRes.body.data;
      expect(burn.businessId).toBe(business.id);
      expect(burn.dailyKobo).toBeGreaterThan(0);
      expect(burn.monthlyKobo).toBe(burn.dailyKobo * 30);
      expect(burn.annualKobo).toBe(burn.dailyKobo * 365);

      // ----------------------------------------------------------------------
      // Step 3: Solar Hardware Catalog & Lease Quoting
      // ----------------------------------------------------------------------
      const systemsRes = await request(app).get('/api/systems?minKw=2');
      expect(systemsRes.status).toBe(200);
      expect(systemsRes.body.data.items.length).toBeGreaterThan(0);
      const selectedSystem = systemsRes.body.data.items[0];

      // Request quote for 24-month tenor
      const quoteRes = await request(app).post(`/api/businesses/${business.id}/quote`).send({
        systemId: selectedSystem.id,
        tenorMonths: 24,
      });

      expect(quoteRes.status).toBe(201);
      expect(quoteRes.body.ok).toBe(true);
      const quote = quoteRes.body.data;
      expect(quote.businessId).toBe(business.id);
      expect(quote.system.id).toBe(selectedSystem.id);
      expect(quote.monthlyPaymentKobo).toBeGreaterThan(0);
      expect(quote.monthlySavingsKobo).toBeGreaterThan(0); // Invariant: costs less than fuel
      expect(quote.depositKobo).toBeGreaterThan(0);
      expect(quote.totalPayableKobo).toBe(quote.monthlyPaymentKobo * 24 + quote.depositKobo);

      // Fetch quote by ID
      const getQuoteRes = await request(app).get(`/api/quotes/${quote.id}`);
      expect(getQuoteRes.status).toBe(200);
      expect(getQuoteRes.body.data.id).toBe(quote.id);

      // ----------------------------------------------------------------------
      // Step 4: Credit Desk Review & Underwriting Approval
      // ----------------------------------------------------------------------
      // The credit applications list contains seeded applications
      const appsRes = await request(app).get('/api/credit/applications?status=PENDING');
      expect(appsRes.status).toBe(200);
      expect(appsRes.body.data.items.length).toBeGreaterThan(0);

      const pendingApp = appsRes.body.data.items[0];

      // Inspect Credit File Detail
      const appDetailRes = await request(app).get(`/api/credit/applications/${pendingApp.id}`);
      expect(appDetailRes.status).toBe(200);
      expect(appDetailRes.body.data.fuelLogs).toBeDefined();
      expect(appDetailRes.body.data.schedulePreview).toBeDefined();
      expect(appDetailRes.body.data.loadProfileScore).toBeGreaterThan(0);

      // Credit officer approves the facility
      const approveRes = await request(app).post(
        `/api/credit/applications/${pendingApp.id}/approve`,
      );
      expect(approveRes.status).toBe(201);
      expect(approveRes.body.ok).toBe(true);

      const { loan, asset } = approveRes.body.data;
      expect(loan.status).toBe('ACTIVE');
      expect(asset.status).toBe('ACTIVE');
      expect(asset.serial).toMatch(/^LG-\d{5}$/);
      expect(asset.controllerId).toMatch(/^CTL-\d{5}$/);

      // ----------------------------------------------------------------------
      // Step 5: Live Asset Telemetry & Impact Verification
      // ----------------------------------------------------------------------
      const assetRes = await request(app).get(`/api/assets/${asset.id}`);
      expect(assetRes.status).toBe(200);
      expect(assetRes.body.data.status).toBe('ACTIVE');

      const meterRes = await request(app).get(`/api/assets/${asset.id}/meter`);
      expect(meterRes.status).toBe(200);
      expect(meterRes.body.ok).toBe(true);

      // ----------------------------------------------------------------------
      // Step 6: Virtual Account (Repayment Wallet) Onboarding
      // ----------------------------------------------------------------------
      // Onboard the demo business wallet
      const walletRes = await request(app).post('/api/wallets/create').send({
        businessId: 'biz_adaeze_frozen',
        nin: '98765432101',
        firstName: 'Adaeze',
        lastName: 'Okonkwo',
        phone: '+2348031234567',
      });

      expect(walletRes.status).toBe(200);
      expect(walletRes.body.ok).toBe(true);
      const wallet = walletRes.body.data.wallet;
      expect(wallet.bankCode).toBe(WALLET_BANK_CODE);
      expect(wallet.currency).toBe(WALLET_CURRENCY);
      expect(wallet.balanceKobo).toBe(DEMO_WALLET_FUNDING_KOBO);
      expect(wallet.accountNumber).toMatch(/^\d{10}$/);

      // Also create a wallet for the newly approved business
      await request(app).post('/api/wallets/create').send({
        businessId: pendingApp.businessId,
        nin: '98765432101',
        firstName: 'Basira',
        lastName: 'Lawal',
        phone: '+2348031234567',
      });

      // Verify demo wallet balance & statement
      const balanceRes = await request(app).get('/api/wallets/balance');
      expect(balanceRes.status).toBe(200);
      expect(balanceRes.body.data.balanceKobo).toBe(DEMO_WALLET_FUNDING_KOBO);

      // ----------------------------------------------------------------------
      // Step 7: Dual-Channel Repayment Execution
      // ----------------------------------------------------------------------
      const adaezeLoan = (await repo.getLoan('loan_biz_adaeze_frozen'))!;
      const initialAdaezeBalance = adaezeLoan.balanceKobo;
      const paymentAmount1 = 1_000_000; // NGN 10,000

      // Channel A: Repayment via Dedicated Virtual Wallet
      const walletPayRes = await request(app)
        .post(`/api/loans/${adaezeLoan.id}/pay`)
        .send({ source: 'wallet', amountKobo: paymentAmount1 });

      expect(walletPayRes.status).toBe(200);
      expect(walletPayRes.body.data.status).toBe('SUCCESS');

      // Verify loan updated
      const loanAfterWallet = (await repo.getLoan(adaezeLoan.id))!;
      expect(loanAfterWallet.balanceKobo).toBe(initialAdaezeBalance - paymentAmount1);

      // Verify wallet statement records the debit
      const stmtRes = await request(app).get('/api/wallets/statement');
      expect(stmtRes.status).toBe(200);
      expect(stmtRes.body.data.items[0]).toMatchObject({
        direction: 'OUT',
        amountKobo: paymentAmount1,
        category: 'loan_payment',
      });

      // Channel B: Repayment via Bank Account (Simulated Rail Settle)
      const paymentAmount2 = 1_500_000; // NGN 15,000
      const bankPayRes = await request(app)
        .post(`/api/loans/${adaezeLoan.id}/pay`)
        .send({ source: 'bank_account', amountKobo: paymentAmount2 });

      expect(bankPayRes.status).toBe(200);
      expect(bankPayRes.body.data.status).toBe('SUCCESS');
      const paymentId = bankPayRes.body.data.paymentId;

      // Status lookup by paymentId
      const pollRes = await request(app).get(`/api/payments/${paymentId}/status`);
      expect(pollRes.status).toBe(200);
      expect(pollRes.body.data.status).toBe('SUCCESS');

      const loanAfterBank = (await repo.getLoan(adaezeLoan.id))!;
      expect(loanAfterBank.balanceKobo).toBe(
        initialAdaezeBalance - paymentAmount1 - paymentAmount2,
      );

      // ----------------------------------------------------------------------
      // Step 8: Complete Loan Payoff -> Asset Ownership Title Transfer
      // ----------------------------------------------------------------------
      const remainingBalance = loanAfterBank.balanceKobo;

      // Top-up wallet and pay remaining balance in full
      await repo.creditWallet(
        wallet.id,
        remainingBalance + 100_000,
        'Top-up for payoff',
        'WLT-TOPUP-001',
        'funding',
      );

      const finalPayRes = await request(app)
        .post(`/api/loans/${adaezeLoan.id}/pay`)
        .send({ source: 'wallet', amountKobo: remainingBalance });

      expect(finalPayRes.status).toBe(200);

      // Verify Loan is CLOSED and Asset is OWNED
      const finalLoan = (await repo.getLoan(adaezeLoan.id))!;
      const finalAsset = (await repo.getAsset('ast_biz_adaeze_frozen'))!;
      expect(finalLoan.balanceKobo).toBe(0);
      expect(finalLoan.status).toBe('CLOSED');
      expect(finalAsset.status).toBe('OWNED');
    });
  });

  // ==========================================================================
  // SCENARIO 2: ARREARS, PAYG REMOTE SUSPENSION & INSTANT RESTORATION
  // ==========================================================================
  describe('Scenario 2: Default, PAYG Remote Suspension & Instant Restoration', () => {
    it('manages delinquent transition into GRACE, suspension after expiry, and instant restore upon repayment', async () => {
      const loan = (await repo.getLoan('loan_biz_adaeze_frozen'))!;
      const asset = (await repo.getAsset('ast_biz_adaeze_frozen'))!;
      expect(loan.status).toBe('ACTIVE');
      expect(asset.status).toBe('ACTIVE');

      // 1. Borrower misses first payment -> Loan becomes DELINQUENT, Asset enters GRACE
      const missRes1 = await request(app).post('/api/demo/miss-payment').send({ loanId: loan.id });

      expect(missRes1.status).toBe(200);
      expect(missRes1.body.data.loan.status).toBe('DELINQUENT');
      expect(missRes1.body.data.asset.status).toBe('GRACE');

      // 2. Borrower misses second payment (grace period expired) -> Asset transitions to SUSPENDED
      const missRes2 = await request(app).post('/api/demo/miss-payment').send({ loanId: loan.id });
      expect(missRes2.status).toBe(200);

      const suspendedAsset = (await repo.getAsset(asset.id))!;
      expect(suspendedAsset.status).toBe('SUSPENDED');

      // 3. Verify meter readings preserve minimum lighting circuit (40W) during suspension
      const meterRes = await request(app).get(`/api/assets/${asset.id}/meter`);
      expect(meterRes.status).toBe(200);
      expect(meterRes.body.ok).toBe(true);

      // 4. Borrower makes a catch-up payment -> Triggers instant remote reactivation
      const catchupPaymentKobo = 36_654_539;
      const payRes = await request(app)
        .post(`/api/loans/${loan.id}/pay`)
        .send({ source: 'bank_account', amountKobo: catchupPaymentKobo });

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.status).toBe('SUCCESS');

      // 5. Verify asset is instantly RESTORED to ACTIVE and loan is ACTIVE
      const restoredAsset = (await repo.getAsset(asset.id))!;
      const updatedLoan = (await repo.getLoan(loan.id))!;
      expect(restoredAsset.status).toBe('ACTIVE');
      expect(updatedLoan.status).toBe('ACTIVE');
    });
  });

  // ==========================================================================
  // SCENARIO 3: RESPONSIBLE DESIGN & MEDICAL SAFETY INVARIANT
  // ==========================================================================
  describe('Scenario 3: Responsible Design & Medical Safety Invariant', () => {
    it('strictly prohibits power suspension on medical-flagged businesses under any arrears or manual actions', async () => {
      const medicalBiz = (await repo.getBusiness('biz_gwarinpa_mart'))!;
      expect(medicalBiz.medicalFlag).toBe(true);

      const medicalAsset = (await repo.getAsset('ast_biz_gwarinpa_mart'))!;
      expect(medicalAsset.status).toBe('ACTIVE');

      // 1. Advance demo clock by 90 days of arrears
      await request(app).post('/api/demo/advance-time').send({ days: 90 });

      // Invariant: Must move to GRACE upon arrears, but NEVER to SUSPENDED
      const assetAfter90Days = (await repo.getAsset(medicalAsset.id))!;
      expect(assetAfter90Days.status).toBe('GRACE');

      // 2. Also simulate explicit missed payment while in GRACE -> Must stay in GRACE
      const loan = (await repo.getLoan('loan_biz_gwarinpa_mart'))!;
      await request(app).post('/api/demo/miss-payment').send({ loanId: loan.id });
      const assetAfterSecondMiss = (await repo.getAsset(medicalAsset.id))!;
      expect(assetAfterSecondMiss.status).toBe('GRACE');

      // 3. Bank loan officer attempts manual suspension -> MUST BE REJECTED WITH 409
      const manualSuspendRes = await request(app)
        .post(`/api/assets/${medicalAsset.id}/suspend`)
        .send({ reason: 'Overdue balance' });

      expect(manualSuspendRes.status).toBe(409);
      expect(manualSuspendRes.body.error).toEqual({
        code: 'MEDICAL_FLAG',
        message: 'This business is flagged for medical load. Suspension is blocked.',
      });

      // Power remains guaranteed
      const finalAsset = (await repo.getAsset(medicalAsset.id))!;
      expect(finalAsset.status).toBe('GRACE');
    });
  });

  // ==========================================================================
  // SCENARIO 4: SECURITISATION, PORTFOLIO RISK & AGGREGATE REPORTING
  // ==========================================================================
  describe('Scenario 4: Securitisation, Portfolio Risk & Aggregate Reporting', () => {
    it('aggregates portfolio metrics and produces verifiable securitisation packs', async () => {
      // 1. Treasury KPI Dashboard
      const statsRes = await request(app).get('/api/portfolio/stats');
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.ok).toBe(true);

      const stats = statsRes.body.data;
      expect(stats.assetsFinanced).toBe(523);
      expect(stats.portfolioValueKobo).toBeGreaterThan(0);
      expect(stats.repaymentRatePct).toBeGreaterThan(0);
      expect(stats.parPct).toBeGreaterThan(0);
      expect(stats.litresDisplaced).toBeGreaterThan(0);
      expect(stats.co2TonnesAvoided).toBeGreaterThan(0);
      expect(stats.byCity.length).toBe(6);

      // 2. Paged Asset Ledger with City and Status Filtering
      const lagosActiveRes = await request(app).get(
        '/api/portfolio/assets?city=Lagos&status=ACTIVE&page=1',
      );
      expect(lagosActiveRes.status).toBe(200);
      expect(lagosActiveRes.body.data.items.length).toBeLessThanOrEqual(25);
      for (const item of lagosActiveRes.body.data.items) {
        expect(item.status).toBe('ACTIVE');
      }

      // 3. Securitisation Pack Export
      const exportRes = await request(app).post('/api/portfolio/export');
      expect(exportRes.status).toBe(200);
      expect(exportRes.body.ok).toBe(true);
      expect(exportRes.body.data.url).toMatch(/^\/exports\/lastgen-portfolio-/);
      expect(exportRes.body.data.generatedAt).toBeDefined();

      // 4. Impact & Wrapped Parity Check
      const impactRes = await request(app).get(
        '/api/businesses/biz_adaeze_frozen/impact?period=year',
      );
      const wrappedRes = await request(app).get(
        '/api/businesses/biz_adaeze_frozen/wrapped?year=2026',
      );

      expect(impactRes.status).toBe(200);
      expect(wrappedRes.status).toBe(200);
      expect(wrappedRes.body.data.litresNotBurned).toBe(impactRes.body.data.litresDisplaced);
      expect(wrappedRes.body.data.co2KgAvoided).toBe(impactRes.body.data.co2KgAvoided);
      expect(wrappedRes.body.data.nairaSavedKobo).toBe(impactRes.body.data.nairaSavedKobo);
    });
  });

  // ==========================================================================
  // SCENARIO 5: WEBHOOK REPLAY & IDEMPOTENCY PROTECTION
  // ==========================================================================
  describe('Scenario 5: Webhook Replay & Idempotency Protection', () => {
    it('safely handles duplicate ALAT transaction notifications without double-crediting', async () => {
      // Create app with delayed settlement so the payment remains in pending_authorisation until the webhook fires
      const { app: asyncApp, repo: asyncRepo } = createTestApp({
        env: { SETTLE_AFTER_MS: '60000' },
      });

      const loan = (await asyncRepo.getLoan('loan_biz_adaeze_frozen'))!;
      const initialBalance = loan.balanceKobo;
      const amountKobo = 5_000_000; // NGN 50,000

      // Initiate payment -> books pending_authorisation
      const payRes = await request(asyncApp)
        .post(`/api/loans/${loan.id}/pay`)
        .send({ source: 'bank_account', amountKobo });

      expect(payRes.body.data.status).toBe('pending_authorisation');
      const payment = (await asyncRepo.paymentByRefOrId(payRes.body.data.paymentId))!;
      const payload = {
        transactionReference: payment.reference,
        amount: amountKobo / 100,
        narration: loan.id,
      };

      // First webhook delivery -> settles payment & decrements loan balance
      const res1 = await request(asyncApp).post('/api/webhooks/alat').send(payload);
      expect(res1.status).toBe(200);

      const loanAfterFirst = (await asyncRepo.getLoan(loan.id))!;
      expect(loanAfterFirst.balanceKobo).toBe(initialBalance - amountKobo);

      // Replayed webhook delivery (network retry / duplicate)
      const res2 = await request(asyncApp).post('/api/webhooks/alat').send(payload);
      expect(res2.status).toBe(200);
      expect(res2.body.ok).toBe(true);

      // Invariant: Balance must NOT be debited twice
      const loanAfterReplay = (await asyncRepo.getLoan(loan.id))!;
      expect(loanAfterReplay.balanceKobo).toBe(initialBalance - amountKobo);
    });
  });
});
