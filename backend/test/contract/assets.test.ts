import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../../src/data/seed.js';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: assets
// Read, meter readings, suspend and restore. Suspension must respect the
// medical-flag guard and reject invalid transitions with the contract codes.

describe('assets contract', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp());
  });

  it('reads an asset by id', async () => {
    const res = await request(app).get('/api/assets/ast_biz_adaeze_frozen');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 'ast_biz_adaeze_frozen',
      businessId: 'biz_adaeze_frozen',
      status: 'ACTIVE',
    });
  });

  it('returns the contract 404 for an unknown asset', async () => {
    const res = await request(app).get('/api/assets/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Asset not found' });
  });

  it('lists meter readings with optional from/to filters', async () => {
    const all = await request(app).get('/api/assets/ast_biz_adaeze_frozen/meter');
    expect(all.status).toBe(200);
    expect(all.body.data.items).toHaveLength(540);

    const from = all.body.data.items[100].ts;
    const filtered = await request(app).get(
      `/api/assets/ast_biz_adaeze_frozen/meter?from=${encodeURIComponent(from)}`,
    );
    expect(filtered.body.data.items.length).toBeGreaterThan(0);
    expect(filtered.body.data.items.length).toBeLessThan(540);
    for (const reading of filtered.body.data.items) expect(reading.ts >= from).toBe(true);

    const to = all.body.data.items[300].ts;
    const window = await request(app).get(
      `/api/assets/ast_biz_adaeze_frozen/meter?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    for (const reading of window.body.data.items) {
      expect(reading.ts >= from).toBe(true);
      expect(reading.ts <= to).toBe(true);
    }
  });

  it('suspends an active asset and restores it', async () => {
    const suspend = await request(app)
      .post('/api/assets/ast_biz_adaeze_frozen/suspend')
      .send({ reason: 'Repeated missed payments' });

    expect(suspend.status).toBe(200);
    expect(suspend.body.data).toMatchObject({
      status: 'SUSPENDED',
      suspendReason: 'Repeated missed payments',
      suspendedAt: (await repo.now()).toISOString(),
    });

    const restore = await request(app).post('/api/assets/ast_biz_adaeze_frozen/restore');
    expect(restore.status).toBe(200);
    expect(restore.body.data.status).toBe('ACTIVE');
    expect(restore.body.data.suspendedAt).toBeUndefined();
    expect(restore.body.data.suspendReason).toBeUndefined();
  });

  it('blocks suspension of a medical-flag business', async () => {
    // The seed flags biz_gwarinpa_mart (approved, no asset). To exercise the
    // guard end to end, approve a pending applicant, flag it, then suspend.
    const seed = buildSeed();
    const pending = seed.creditFiles.find((f) => f.status === 'PENDING')!;
    await request(app).post(`/api/credit/applications/${pending.id}/approve`).expect(201);

    const business = (await repo.getBusiness(pending.businessId))!;
    business.medicalFlag = true;
    const asset = (await repo.assetByBusiness(pending.businessId))!;

    const res = await request(app)
      .post(`/api/assets/${asset.id}/suspend`)
      .send({ reason: 'Overdue' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MEDICAL_FLAG');
    expect(res.body.error.message).toContain('medical');
  });

  it('rejects suspending an owned asset', async () => {
    // Find any OWNED asset from the seed portfolio
    const seed = buildSeed();
    const owned = seed.assets.find((a) => a.status === 'OWNED');
    expect(owned).toBeDefined();
    const res = await request(app)
      .post(`/api/assets/${owned!.id}/suspend`)
      .send({ reason: 'Overdue' });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'An owned asset cannot be suspended',
    });
  });

  it('rejects restoring an owned asset', async () => {
    const seed = buildSeed();
    const owned = seed.assets.find((a) => a.status === 'OWNED');
    expect(owned).toBeDefined();
    const res = await request(app).post(`/api/assets/${owned!.id}/restore`);
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'An owned asset is already unrestricted',
    });
  });

  it('requires a suspend reason', async () => {
    const res = await request(app).post('/api/assets/ast_biz_adaeze_frozen/suspend').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION', message: 'reason is required' });
  });

  it('returns the contract 404 when suspending an unknown asset', async () => {
    const res = await request(app).post('/api/assets/nope/suspend').send({ reason: 'Overdue' });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Asset not found');
  });
});
