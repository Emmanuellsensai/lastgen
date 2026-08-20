import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: fuel logs
// Manual entry and receipt upload must produce the same FuelLog shape the
// frontend api.ts consumes (api.businesses.addFuelLog / uploadReceipt).

describe('fuel logs contract', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp());
  });

  it('adds a manual fuel log and recomputes the burn profile', async () => {
    const res = await request(app)
      .post('/api/businesses/biz_adaeze_frozen/fuel-logs')
      .send({ litres: 10, amountKobo: 1_150_000, pricePerLitreKobo: 115_000 });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toMatchObject({
      businessId: 'biz_adaeze_frozen',
      source: 'manual',
      litres: 10,
      amountKobo: 1_150_000,
      pricePerLitreKobo: 115_000,
      loggedAt: repo.now().toISOString(),
    });
    expect(res.body.data.id).toMatch(/^fl_/);

    const burn = await request(app).get('/api/businesses/biz_adaeze_frozen/burn');
    expect(burn.status).toBe(200);
    expect(burn.body.data.litresPerDay).toBeGreaterThan(0);
    expect(burn.body.data.daysObserved).toBeGreaterThanOrEqual(1);
    expect(burn.body.data.computedAt).toBe(repo.now().toISOString());
  });

  it('rejects non-positive litres or amount', async () => {
    const res = await request(app)
      .post('/api/businesses/biz_adaeze_frozen/fuel-logs')
      .send({ litres: 0, amountKobo: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION',
      message: 'litres and amountKobo must be greater than zero',
    });
  });

  it('returns the contract 404 for an unknown business', async () => {
    const res = await request(app)
      .post('/api/businesses/nope/fuel-logs')
      .send({ litres: 10, amountKobo: 1_150_000 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBe('Business not found');
  });

  it('processes a receipt upload into a receipt-sourced fuel log', async () => {
    const res = await request(app)
      .post('/api/businesses/biz_adaeze_frozen/receipts')
      .attach('file', Buffer.from('receipt-image-bytes'), 'receipt.jpg');

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      businessId: 'biz_adaeze_frozen',
      source: 'receipt',
      pricePerLitreKobo: 115_000,
      receiptUrl: '/img/receipts/uploaded.jpg',
    });
    expect(res.body.data.litres).toBeGreaterThan(0);
    expect(res.body.data.amountKobo).toBe(Math.round(res.body.data.litres * 115_000));
    expect(res.body.data.confidence).toBeGreaterThanOrEqual(0);
    expect(res.body.data.confidence).toBeLessThanOrEqual(1);
  });

  it('still succeeds without an attached file (mock extraction)', async () => {
    const res = await request(app).post('/api/businesses/biz_adaeze_frozen/receipts');
    expect(res.status).toBe(201);
    expect(res.body.data.source).toBe('receipt');
  });

  it('returns the contract 404 for a receipt on an unknown business', async () => {
    const res = await request(app)
      .post('/api/businesses/nope/receipts')
      .attach('file', Buffer.from('x'), 'r.jpg');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBe('Business not found');
  });
});
