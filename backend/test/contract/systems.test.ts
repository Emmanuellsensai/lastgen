import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: systems
// The catalogue is filterable by minKw and maxPriceKobo exactly as the
// frontend systems.list() expects.

describe('systems contract', () => {
  let app: TestApp['app'];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it('lists the full catalogue', async () => {
    const res = await request(app).get('/api/systems');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.items).toHaveLength(8);
    for (const item of res.body.data.items) {
      expect(item.id).toMatch(/^sys_/);
      expect(typeof item.capacityKw).toBe('number');
      expect(item.priceKobo).toBeGreaterThan(0);
      expect(item.panelW).toBeGreaterThan(0);
      expect(item.batteryKwh).toBeGreaterThan(0);
      expect(item.inverterKva).toBeGreaterThan(0);
    }
  });

  it('filters by minimum capacity', async () => {
    const res = await request(app).get('/api/systems?minKw=5');
    expect(res.body.data.items.length).toBeGreaterThan(0);
    for (const item of res.body.data.items) expect(item.capacityKw).toBeGreaterThanOrEqual(5);
  });

  it('filters by maximum price', async () => {
    const res = await request(app).get('/api/systems?maxPriceKobo=300000000');
    for (const item of res.body.data.items) expect(item.priceKobo).toBeLessThanOrEqual(300_000_000);
  });

  it('combines both filters', async () => {
    const res = await request(app).get('/api/systems?minKw=3.5&maxPriceKobo=600000000');
    for (const item of res.body.data.items) {
      expect(item.capacityKw).toBeGreaterThanOrEqual(3.5);
      expect(item.priceKobo).toBeLessThanOrEqual(600_000_000);
    }
  });
});