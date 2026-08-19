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
      assetsFinanced: 523,
      portfolioValueKobo: 256_396_630_000,
      repaymentRatePct: 87.8,
      parPct: 12.2,
      suspendedCount: 21,
      litresDisplaced: 395388,
      co2TonnesAvoided: 913.3,
      byCity: [
        { city: 'Lagos', count: 215 },
        { city: 'Abuja', count: 100 },
        { city: 'Ibadan', count: 78 },
        { city: 'Port Harcourt', count: 58 },
        { city: 'Kano', count: 41 },
        { city: 'Benin City', count: 31 },
      ],
    });
  });

  it('pages the asset ledger 25 per page', async () => {
    const page1 = await request(app).get('/api/portfolio/assets');
    expect(page1.status).toBe(200);
    expect(page1.body.data.items).toHaveLength(25);
    expect(page1.body.data.total).toBe(523);

    const page2 = await request(app).get('/api/portfolio/assets?page=2');
    expect(page2.body.data.items).toHaveLength(25);
    const ids1 = new Set(page1.body.data.items.map((i: { id: string }) => i.id));
    for (const item of page2.body.data.items) expect(ids1.has(item.id)).toBe(false);
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/portfolio/assets?status=SUSPENDED');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(21);
    for (const item of res.body.data.items) expect(item.status).toBe('SUSPENDED');
  });

  it('filters by city', async () => {
    const res = await request(app).get('/api/portfolio/assets?city=Lagos');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(215);
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