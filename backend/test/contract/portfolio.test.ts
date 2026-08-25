import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: portfolio
// GET /portfolio/stats, GET /portfolio/assets (status/city filters, page-based
// pagination, 25 per page) and POST /portfolio/export.

describe('portfolio contract', () => {
  let app: TestApp['app'];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it('returns the portfolio stats projection', async () => {
    const res = await request(app).get('/api/portfolio/stats');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual({
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

  it('pages the asset ledger 25 per page', async () => {
    const page1 = await request(app).get('/api/portfolio/assets');
    expect(page1.status).toBe(200);
    expect(page1.body.data.items).toHaveLength(25);
    expect(page1.body.data.total).toBe(524);

    const page2 = await request(app).get('/api/portfolio/assets?page=2');
    expect(page2.body.data.items).toHaveLength(25);
    const ids1 = new Set(page1.body.data.items.map((i: { id: string }) => i.id));
    for (const item of page2.body.data.items) expect(ids1.has(item.id)).toBe(false);
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/portfolio/assets?status=SUSPENDED');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(22);
    for (const item of res.body.data.items) expect(item.status).toBe('SUSPENDED');
  });

  it('filters by city', async () => {
    const res = await request(app).get('/api/portfolio/assets?city=Lagos');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(215);
  });

  it('filters by business', async () => {
    const res = await request(app).get('/api/portfolio/assets?businessId=biz_adaeze_frozen');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].id).toBe('ast_biz_adaeze_frozen');
  });

  it('returns an empty page for a business with no assets', async () => {
    const res = await request(app).get('/api/portfolio/assets?businessId=biz_nope');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [], total: 0 });
  });

  it('sits behind the auth boundary in live mode', async () => {
    // The bank's whole book is role-scoped; without a bearer token live mode
    // fails closed before the role gate is ever consulted.
    const { app: liveApp } = createTestApp({ demoMode: false });
    for (const path of ['/api/portfolio/stats', '/api/portfolio/assets']) {
      const res = await request(liveApp).get(path);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns the export envelope', async () => {
    const res = await request(app).post('/api/portfolio/export');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toMatchObject({
      url: '/exports/lastgen-portfolio-2026-08-19.csv',
      generatedAt: '2026-08-19T09:00:00.000Z',
    });
  });
});
