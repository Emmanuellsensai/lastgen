import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers.js';

/**
 * Registration journey test.
 *
 * Tests the new endpoints that were missing from the backend:
 *   - GET /api/businesses/:id/summary
 *   - POST /api/quotes/:id/accept
 *   - DELETE /api/businesses/:id/fuel-logs/:logId
 *   - GET /api/loans/:id/payments
 *   - GET /api/businesses/:id/application
 *
 * Uses the in-memory repository in demo mode (same as the existing E2E test).
 * Creates a fresh business to avoid seed-data interference.
 */
describe('E2E: Registration journey (new endpoints)', () => {
  const { app } = createTestApp();
  const agent = request(app);

  let businessId: string;
  let quoteId: string;
  let creditFileId: string;
  let loanId: string;
  let fuelLogId: string;

  /* ------------------------------------------------------------------ */
  /* Step 1: Register a new account (demo mode shim)                     */
  /* ------------------------------------------------------------------ */

  it('POST /api/auth/register — creates account', async () => {
    const res = await agent
      .post('/api/auth/register')
      .send({
        email: 'newuser@test.com',
        password: 'password123',
        fullName: 'Test User',
        phone: '+2348012345678',
      })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.user.email).toBe('newuser@test.com');
    expect(res.body.data.user.fullName).toBe('Test User');
    expect(res.body.data.role).toBe('owner');
    expect(res.body.data.businessId).toBeDefined();
  });

  /* ------------------------------------------------------------------ */
  /* Step 2: Create a fresh business for the new user                    */
  /* ------------------------------------------------------------------ */

  it('POST /api/businesses — creates a new business', async () => {
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
    businessId = res.body.data.id;
    expect(businessId).toMatch(/^biz_/);
  });

  /* ------------------------------------------------------------------ */
  /* Step 3: Dashboard loads — summary and application (empty)           */
  /* ------------------------------------------------------------------ */

  it('GET /api/businesses/:id/summary — returns null asset/loan/quote ids', async () => {
    const res = await agent.get(`/api/businesses/${businessId}/summary`).expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.assetId).toBeNull();
    expect(res.body.data.loanId).toBeNull();
    expect(res.body.data.quoteId).toBeNull();
  });

  it('GET /api/businesses/:id/application — returns null before first quote', async () => {
    const res = await agent.get(`/api/businesses/${businessId}/application`).expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data).toBeNull();
  });

  /* ------------------------------------------------------------------ */
  /* Step 4: Log fuel and then delete one                                */
  /* ------------------------------------------------------------------ */

  it('POST /api/businesses/:id/fuel-logs — owner logs fuel', async () => {
    const now = Date.now();
    const res = await agent
      .post(`/api/businesses/${businessId}/fuel-logs`)
      .send({
        litres: 20,
        amountKobo: 2_300_000,
        pricePerLitreKobo: 115_000,
        loggedAt: new Date(now - 86_400_000).toISOString(),
      })
      .expect(201);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.litres).toBe(20);
    fuelLogId = res.body.data.id;
  });

  it('POST /api/businesses/:id/fuel-logs — owner logs second fuel entry', async () => {
    const now = Date.now();
    const res = await agent
      .post(`/api/businesses/${businessId}/fuel-logs`)
      .send({
        litres: 25,
        amountKobo: 2_875_000,
        pricePerLitreKobo: 115_000,
        loggedAt: new Date(now).toISOString(),
      })
      .expect(201);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.litres).toBe(25);
  });

  it('DELETE /api/businesses/:id/fuel-logs/:logId — deletes a fuel log', async () => {
    const res = await agent
      .delete(`/api/businesses/${businessId}/fuel-logs/${fuelLogId}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.ok).toBe(true);
  });

  it('GET /api/businesses/:id/fuel-logs — only the remaining log shows', async () => {
    const res = await agent.get(`/api/businesses/${businessId}/fuel-logs`).expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].litres).toBe(25);
  });

  it('DELETE /api/businesses/:id/fuel-logs/:logId — returns 404 for unknown log', async () => {
    const res = await agent
      .delete(`/api/businesses/${businessId}/fuel-logs/fl_nonexistent`)
      .expect(404);

    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  /* ------------------------------------------------------------------ */
  /* Step 5: Create a quote                                              */
  /* ------------------------------------------------------------------ */

  it('POST /api/businesses/:id/quote — owner creates a quote', async () => {
    const systemsRes = await agent.get('/api/systems').expect(200);
    const system = systemsRes.body.data.items[0];

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
  });

  /* ------------------------------------------------------------------ */
  /* Step 6: Summary now shows the quote                                 */
  /* ------------------------------------------------------------------ */

  it('GET /api/businesses/:id/summary — now includes quoteId', async () => {
    const res = await agent.get(`/api/businesses/${businessId}/summary`).expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.quoteId).toBe(quoteId);
    expect(res.body.data.assetId).toBeNull();
    expect(res.body.data.loanId).toBeNull();
  });

  /* ------------------------------------------------------------------ */
  /* Step 7: Accept the quote (submit for underwriting)                  */
  /* ------------------------------------------------------------------ */

  it('POST /api/quotes/:id/accept — owner accepts quote', async () => {
    const res = await agent.post(`/api/quotes/${quoteId}/accept`).expect(201);

    expect(res.body.ok).toBe(true);
    creditFileId = res.body.data.creditFileId;
    expect(creditFileId).toMatch(/^cf_/);
    expect(res.body.data.status).toBeDefined();
  });

  /* ------------------------------------------------------------------ */
  /* Step 8: Application status after accepting quote                    */
  /* ------------------------------------------------------------------ */

  it('GET /api/businesses/:id/application — returns credit file', async () => {
    const res = await agent.get(`/api/businesses/${businessId}/application`).expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data).not.toBeNull();
    expect(res.body.data.id).toBe(creditFileId);
    expect(res.body.data.status).toBe('PENDING');
  });

  /* ------------------------------------------------------------------ */
  /* Step 9: Bank approves → Loan + Asset                                */
  /* ------------------------------------------------------------------ */

  it('POST /api/credit/applications/:id/approve — bank approves', async () => {
    const res = await agent.post(`/api/credit/applications/${creditFileId}/approve`).expect(201);

    expect(res.body.ok).toBe(true);
    loanId = res.body.data.loan.id;
    const assetId = res.body.data.asset.id;
    expect(loanId).toMatch(/^loan_/);
    expect(assetId).toMatch(/^ast_/);
    expect(res.body.data.loan.status).toBe('ACTIVE');
    expect(res.body.data.asset.status).toBe('ACTIVE');
  });

  /* ------------------------------------------------------------------ */
  /* Step 10: Summary now shows asset + loan                             */
  /* ------------------------------------------------------------------ */

  it('GET /api/businesses/:id/summary — shows asset and loan after approval', async () => {
    const res = await agent.get(`/api/businesses/${businessId}/summary`).expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.assetId).not.toBeNull();
    expect(res.body.data.loanId).toBe(loanId);
    expect(res.body.data.quoteId).toBe(quoteId);
  });

  /* ------------------------------------------------------------------ */
  /* Step 11: Check loan payments (empty before any payment)             */
  /* ------------------------------------------------------------------ */

  it('GET /api/loans/:id/payments — returns empty before first payment', async () => {
    const res = await agent.get(`/api/loans/${loanId}/payments`).expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.items).toEqual([]);
  });

  /* ------------------------------------------------------------------ */
  /* Step 12: Accept idempotency — accept again returns same file       */
  /* ------------------------------------------------------------------ */

  it('POST /api/quotes/:id/accept — accept again is idempotent', async () => {
    const res = await agent.post(`/api/quotes/${quoteId}/accept`).expect(201);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.creditFileId).toBe(creditFileId);
  });

  /* ------------------------------------------------------------------ */
  /* Step 13: 404 for non-existent resources                             */
  /* ------------------------------------------------------------------ */

  it('GET /api/businesses/:id/summary — 404 for unknown business', async () => {
    const res = await agent.get('/api/businesses/biz_nonexistent/summary').expect(404);

    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/businesses/:id/application — 404 for unknown business', async () => {
    const res = await agent.get('/api/businesses/biz_nonexistent/application').expect(404);

    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/quotes/:id/accept — 404 for unknown quote', async () => {
    const res = await agent.post('/api/quotes/q_nonexistent/accept').expect(404);

    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/loans/:id/payments — 404 for unknown loan', async () => {
    const res = await agent.get('/api/loans/loan_nonexistent/payments').expect(404);

    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  /* ------------------------------------------------------------------ */
  /* Step 14: Validation errors                                          */
  /* ------------------------------------------------------------------ */

  it('POST /api/auth/register — validates required fields', async () => {
    const res = await agent
      .post('/api/auth/register')
      .send({ email: '', password: '' })
      .expect(400);

    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  it('POST /api/auth/login — validates required fields', async () => {
    const res = await agent.post('/api/auth/login').send({ email: '' }).expect(400);

    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});
