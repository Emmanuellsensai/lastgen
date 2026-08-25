import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers.js';

/**
 * End-to-end user journey test.
 *
 * Traces the complete first-time user flow:
 *   1. Owner creates a business
 *   2. Owner logs fuel purchases
 *   3. System computes burn profile
 *   4. Owner gets a solar quote
 *   5. Bank reviews credit application
 *   6. Bank approves → Loan + Asset created
 *   7. Owner makes a payment via wallet
 *   8. Asset status updates
 *   9. Portfolio reflects the new asset
 *
 * Every step is a real HTTP call through Supertest against the in-memory
 * repository — no mocks, no shortcuts.
 */

describe('E2E: First-time user journey', () => {
  const { app } = createTestApp();
  const agent = request(app);

  let businessId: string;
  let quoteId: string;
  let creditFileId: string;
  let assetId: string;
  let loanId: string;

  /* ------------------------------------------------------------------ */
  /* Step 1: Create a new business                                       */
  /* ------------------------------------------------------------------ */

  it('POST /api/businesses — owner creates a business', async () => {
    const res = await agent
      .post('/api/businesses')
      .send({
        name: 'Test Cold Store',
        type: 'Cold store',
        city: 'Lagos',
        generatorKva: 5.5,
        hoursPerDay: 10,
      })
      .expect(201);

    expect(res.body.ok).toBe(true);
    expect(res.body.data).toMatchObject({
      name: 'Test Cold Store',
      type: 'Cold store',
      city: 'Lagos',
      generatorKva: 5.5,
      hoursPerDay: 10,
      medicalFlag: false,
    });
    businessId = res.body.data.id;
    expect(businessId).toMatch(/^biz_/);
  });

  /* ------------------------------------------------------------------ */
  /* Step 2: Log fuel purchases                                          */
  /* ------------------------------------------------------------------ */

  it('POST /api/businesses/:id/fuel-logs — owner logs fuel purchases', async () => {
    // Log 5 fuel purchases over recent days
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      const litres = 15 + i * 2;
      const pricePerLitreKobo = 115_000;
      const amountKobo = litres * pricePerLitreKobo;
      const loggedAt = new Date(now - (5 - i) * 86_400_000).toISOString();

      const res = await agent
        .post(`/api/businesses/${businessId}/fuel-logs`)
        .send({
          litres,
          amountKobo,
          pricePerLitreKobo,
          loggedAt,
        })
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.litres).toBe(litres);
      expect(res.body.data.source).toBe('manual');
    }
  });

  /* ------------------------------------------------------------------ */
  /* Step 3: System computes burn profile                                */
  /* ------------------------------------------------------------------ */

  it('GET /api/businesses/:id/burn — system computes burn profile', async () => {
    const res = await agent
      .get(`/api/businesses/${businessId}/burn`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    const burn = res.body.data;
    expect(burn.businessId).toBe(businessId);
    expect(burn.litresPerDay).toBeGreaterThan(0);
    expect(burn.dailyKobo).toBeGreaterThan(0);
    expect(burn.monthlyKobo).toBeGreaterThan(0);
    expect(burn.annualKobo).toBeGreaterThan(0);
    // 5 purchases over ~5 days → daysObserved should be around 4-5
    expect(burn.daysObserved).toBeGreaterThanOrEqual(4);
    expect(burn.daysObserved).toBeLessThanOrEqual(6);
  });

  /* ------------------------------------------------------------------ */
  /* Step 4: Owner gets a solar quote                                    */
  /* ------------------------------------------------------------------ */

  it('GET /api/systems — owner browses available solar systems', async () => {
    const res = await agent
      .get('/api/systems')
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items[0]).toHaveProperty('capacityKw');
    expect(res.body.data.items[0]).toHaveProperty('priceKobo');
  });

  it('POST /api/businesses/:id/quote — owner generates a quote', async () => {
    // Get available systems first
    const systemsRes = await agent.get('/api/systems').expect(200);
    const systems = systemsRes.body.data.items;
    // Pick the smallest system
    const system = systems[0];

    const res = await agent
      .post(`/api/businesses/${businessId}/quote`)
      .send({
        systemId: system.id,
        tenorMonths: 24,
      })
      .expect(201);

    expect(res.body.ok).toBe(true);
    quoteId = res.body.data.id;
    expect(quoteId).toMatch(/^q_/);
    expect(res.body.data.monthlyPaymentKobo).toBeGreaterThan(0);
    expect(res.body.data.monthlySavingsKobo).toBeGreaterThan(0);
    expect(res.body.data.savingsPct).toBeGreaterThan(0);
    expect(res.body.data.breakEvenMonth).toBeGreaterThan(0);
  });

  it('GET /api/quotes/:id — owner views quote details', async () => {
    const res = await agent
      .get(`/api/quotes/${quoteId}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe(quoteId);
    expect(res.body.data.system).toHaveProperty('name');
    expect(res.body.data.system).toHaveProperty('panelW');
    expect(res.body.data.system).toHaveProperty('batteryKwh');
  });

  /* ------------------------------------------------------------------ */
  /* Step 5: Bank reviews credit application                             */
  /* ------------------------------------------------------------------ */

  it('GET /api/credit/applications — bank sees the new application', async () => {
    const res = await agent
      .get('/api/credit/applications')
      .expect(200);

    expect(res.body.ok).toBe(true);
    // Our new application should appear
    const ourFile = res.body.data.items.find(
      (f: { businessId: string }) => f.businessId === businessId,
    );
    expect(ourFile).toBeDefined();
    creditFileId = ourFile.id;
    expect(ourFile.status).toBe('PENDING');
  });

  it('GET /api/credit/applications/:id — bank views credit file detail', async () => {
    const res = await agent
      .get(`/api/credit/applications/${creditFileId}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    const detail = res.body.data;
    expect(detail.business.id).toBe(businessId);
    expect(detail.burn).toHaveProperty('monthlyKobo');
    expect(detail.quote).toHaveProperty('monthlyPaymentKobo');
    expect(detail.affordabilityRatio).toBeGreaterThan(0);
    expect(detail.fuelLogs).toBeDefined();
    expect(Array.isArray(detail.fuelLogs)).toBe(true);
    expect(detail.schedulePreview).toBeDefined();
    expect(Array.isArray(detail.schedulePreview)).toBe(true);
  });

  /* ------------------------------------------------------------------ */
  /* Step 6: Bank approves → Loan + Asset created                        */
  /* ------------------------------------------------------------------ */

  it('POST /api/credit/applications/:id/approve — bank approves', async () => {
    const res = await agent
      .post(`/api/credit/applications/${creditFileId}/approve`)
      .expect(201);

    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveProperty('loan');
    expect(res.body.data).toHaveProperty('asset');

    assetId = res.body.data.asset.id;
    loanId = res.body.data.loan.id;

    expect(assetId).toMatch(/^ast_/);
    expect(loanId).toMatch(/^loan_/);
    expect(res.body.data.asset.status).toBe('ACTIVE');
    expect(res.body.data.loan.status).toBe('ACTIVE');
    expect(res.body.data.loan.balanceKobo).toBeGreaterThan(0);
  });

  /* ------------------------------------------------------------------ */
  /* Step 7: Owner makes a payment via wallet                            */
  /* ------------------------------------------------------------------ */

  it('POST /api/wallets/create — owner creates a wallet', async () => {
    const res = await agent
      .post('/api/wallets/create')
      .send({
        businessId,
        nin: '12345678901',
        firstName: 'Test',
        lastName: 'Owner',
        phone: '+2348012345678',
      })
      .expect(200);

    expect(res.body.ok).toBe(true);
    const wallet = res.body.data.wallet ?? res.body.data;
    expect(wallet).toHaveProperty('accountNumber');
    expect(wallet.bankCode).toBe('035');
    expect(wallet.balanceKobo).toBeGreaterThan(0);
  });

  it('GET /api/loans/:id — owner checks loan before payment', async () => {
    const res = await agent
      .get(`/api/loans/${loanId}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe(loanId);
    expect(res.body.data.balanceKobo).toBeGreaterThan(0);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('POST /api/loans/:id/pay — owner pays via wallet', async () => {
    const payAmount = 500_000; // ₦5,000

    const res = await agent
      .post(`/api/loans/${loanId}/pay`)
      .send({ source: 'wallet', amountKobo: payAmount })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe('SUCCESS');
    expect(res.body.data.paymentId).toBeDefined();
  });

  /* ------------------------------------------------------------------ */
  /* Step 8: Verify state after payment                                  */
  /* ------------------------------------------------------------------ */

  it('GET /api/loans/:id — loan balance decreased after payment', async () => {
    const res = await agent
      .get(`/api/loans/${loanId}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.balanceKobo).toBeLessThan(
      res.body.data.principalKobo,
    );
  });

  it('GET /api/assets/:id — asset is still ACTIVE after payment', async () => {
    const res = await agent
      .get(`/api/assets/${assetId}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('GET /api/loans/:id/schedule — schedule shows paid installments', async () => {
    const res = await agent
      .get(`/api/loans/${loanId}/schedule`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    const paidInstallment = res.body.data.items.find(
      (i: { paidAt?: string }) => i.paidAt,
    );
    expect(paidInstallment).toBeDefined();
  });

  /* ------------------------------------------------------------------ */
  /* Step 9: Portfolio reflects the new asset                            */
  /* ------------------------------------------------------------------ */

  it('GET /api/portfolio/stats — portfolio includes new asset', async () => {
    const res = await agent
      .get('/api/portfolio/stats')
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.assetsFinanced).toBeGreaterThan(0);
    expect(res.body.data.portfolioValueKobo).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.byCity)).toBe(true);
  });

  /* ------------------------------------------------------------------ */
  /* Step 10: Impact calculation works                                   */
  /* ------------------------------------------------------------------ */

  it('GET /api/businesses/:id/impact — impact metrics available', async () => {
    const res = await agent
      .get(`/api/businesses/${businessId}/impact`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.litresDisplaced).toBeGreaterThanOrEqual(0);
    expect(res.body.data.co2KgAvoided).toBeGreaterThanOrEqual(0);
    expect(res.body.data.nairaSavedKobo).toBeGreaterThanOrEqual(0);
  });

  /* ------------------------------------------------------------------ */
  /* Step 11: Decline flow for another application                       */
  /* ------------------------------------------------------------------ */

  it('POST /api/credit/applications/:id/decline — bank can decline', async () => {
    // Find a pending application that is NOT ours
    const listRes = await agent
      .get('/api/credit/applications?status=PENDING')
      .expect(200);

    const pending = listRes.body.data.items.find(
      (f: { businessId: string }) => f.businessId !== businessId,
    );
    if (!pending) return; // no other pending files in seed

    const res = await agent
      .post(`/api/credit/applications/${pending.id}/decline`)
      .send({ reason: 'Insufficient fuel history' })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe('DECLINED');
  });

  /* ------------------------------------------------------------------ */
  /* Step 12: Auth boundary works                                        */
  /* ------------------------------------------------------------------ */

  it('GET /api/businesses/:id — returns 404 for nonexistent business', async () => {
    const res = await agent
      .get('/api/businesses/biz_nonexistent')
      .expect(404);

    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/businesses — validates required fields', async () => {
    const res = await agent
      .post('/api/businesses')
      .send({ name: '' })
      .expect(400);

    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  /* ------------------------------------------------------------------ */
  /* Step 13: Demo controls work                                         */
  /* ------------------------------------------------------------------ */

  it('POST /api/demo/reset — demo reset restores seed data', async () => {
    const res = await agent
      .post('/api/demo/reset')
      .expect(200);

    expect(res.body.ok).toBe(true);

    // Verify the demo business is back
    const bizRes = await agent
      .get('/api/businesses/biz_adaeze_frozen')
      .expect(200);
    expect(bizRes.body.data.name).toBe('Adaeze Frozen Foods');
  });
});
