import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed, DEMO_BUSINESS_ID } from '../../src/data/seed.js';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: quotes
// Quote generation must match the frozen lease math and the MSW reference:
// 2800bps APR, default 10% deposit, 422 when the system does not save money.

describe('quotes contract', () => {
  let app: TestApp['app'];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it('reproduces the seeded demo quote deterministically', async () => {
    const seed = buildSeed();
    const reference = seed.quotes.find((q) => q.businessId === DEMO_BUSINESS_ID);
    expect(reference).toBeDefined();

    const res = await request(app).post(`/api/businesses/${DEMO_BUSINESS_ID}/quote`).send({
      systemId: reference!.system.id,
      tenorMonths: reference!.tenorMonths,
      depositKobo: reference!.depositKobo,
    });

    expect(res.status).toBe(201);
    const { id: _id, ...quote } = res.body.data;
    const { id: _refId, ...expected } = reference!;
    expect(quote).toEqual(expected);
  });

  it('defaults the deposit to 10% of the system price', async () => {
    const res = await request(app)
      .post('/api/businesses/biz_adaeze_frozen/quote')
      .send({ systemId: 'sys_cold_75', tenorMonths: 24 });

    expect(res.status).toBe(201);
    expect(res.body.data.depositKobo).toBe(74_200_000);
    expect(res.body.data.aprBps).toBe(2800);
    // totalPayableKobo = scheduleSum + deposit (may differ by a few kobo from payment×months+deposit due to rounding in the amortisation schedule)
    const approxTotal = res.body.data.monthlyPaymentKobo * 24 + res.body.data.depositKobo;
    expect(Math.abs(res.body.data.totalPayableKobo - approxTotal)).toBeLessThanOrEqual(100);
    expect(res.body.data.monthlySavingsKobo).toBeGreaterThan(0);
    expect(res.body.data.breakEvenMonth).toBe(
      Math.ceil(res.body.data.depositKobo / res.body.data.monthlySavingsKobo),
    );
  });

  it('rejects a tenor below six months', async () => {
    const res = await request(app)
      .post('/api/businesses/biz_adaeze_frozen/quote')
      .send({ systemId: 'sys_cold_75', tenorMonths: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.message).toBe('tenorMonths must be at least 6');
  });

  it('returns the contract 404 for an unknown system', async () => {
    const res = await request(app)
      .post('/api/businesses/biz_adaeze_frozen/quote')
      .send({ systemId: 'nope', tenorMonths: 12 });

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Solar system not found' });
  });

  it('returns the contract 404 for an unknown business', async () => {
    const res = await request(app)
      .post('/api/businesses/nope/quote')
      .send({ systemId: 'sys_cold_75', tenorMonths: 12 });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Business not found');
  });

  it('rejects a quote that does not save money every month', async () => {
    const res = await request(app)
      .post('/api/businesses/biz_bilikisu_tailor/quote')
      .send({ systemId: 'sys_works_150', tenorMonths: 6 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('QUOTE_NOT_VIABLE');
    expect(res.body.error.message).toContain('costs more per month');
  });

  it('reads a quote by id', async () => {
    const seed = buildSeed();
    const id = seed.quotes[0].id;
    const res = await request(app).get(`/api/quotes/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.system.id).toBeTruthy();
  });

  it('returns the contract 404 for an unknown quote', async () => {
    const res = await request(app).get('/api/quotes/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Quote not found' });
  });
});
