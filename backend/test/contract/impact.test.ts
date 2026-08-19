import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: impact
// GET /businesses/:id/impact (period default 'month') and
// GET /businesses/:id/wrapped (year default current). Both return contract
// envelopes with the reference figures captured from the frontend build.

describe('impact contract', () => {
  let app: TestApp['app'];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it('returns the month impact for the demo business', async () => {
    const res = await request(app).get('/api/businesses/biz_adaeze_frozen/impact');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual({
      litresDisplaced: 419,
      co2KgAvoided: 967.9,
      nairaSavedKobo: 48185000,
      kwhGenerated: 1729.2,
      monthsToOwnership: 10,
    });
  });

  it('honours the period query', async () => {
    const year = await request(app).get('/api/businesses/biz_adaeze_frozen/impact?period=year');
    expect(year.body.data).toEqual({
      litresDisplaced: 5099,
      co2KgAvoided: 11778.7,
      nairaSavedKobo: 586385000,
      kwhGenerated: 5121,
      monthsToOwnership: 10,
    });
  });

  it('returns the contract 404 for an unknown business', async () => {
    const res = await request(app).get('/api/businesses/nope/impact');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Business not found' });
  });

  it('returns the wrapped report for an explicit year', async () => {
    const res = await request(app).get('/api/businesses/biz_adaeze_frozen/wrapped?year=2025');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      year: 2025,
      nairaSavedKobo: 586385000,
      litresNotBurned: 5099,
      co2KgAvoided: 11778.7,
      kwhGenerated: 5121,
      monthsToOwnership: 10,
      bestMonth: 'March',
      rank: 12,
    });
  });

  it('defaults the wrapped year to the current year', async () => {
    const res = await request(app).get('/api/businesses/biz_adaeze_frozen/wrapped');
    expect(res.status).toBe(200);
    expect(res.body.data.year).toBe(2026);
  });

  it('returns the contract 404 for an unknown wrapped business', async () => {
    const res = await request(app).get('/api/businesses/nope/wrapped');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Business not found' });
  });
});