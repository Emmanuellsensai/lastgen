import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../../src/data/seed.js';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: credit
// Applications list/detail/approve/decline, matching the frontend credit api
// and the MSW creditHandlers (PENDING-only transitions, QUOTE_NOT_VIABLE guard).

describe('credit contract', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp());
  });

  it('lists all applications and filters by status', async () => {
    const all = await request(app).get('/api/credit/applications');
    expect(all.status).toBe(200);
    expect(all.body.data.items).toHaveLength(6);

    const approved = await request(app).get('/api/credit/applications?status=APPROVED');
    expect(approved.body.data.items).toHaveLength(3);
    for (const item of approved.body.data.items) expect(item.status).toBe('APPROVED');

    const pending = await request(app).get('/api/credit/applications?status=PENDING');
    expect(pending.body.data.items).toHaveLength(3);
  });

  it('returns the detail projection (recent fuel logs + schedule preview)', async () => {
    const seed = buildSeed();
    const file = seed.creditFiles[0];
    const res = await request(app).get(`/api/credit/applications/${file.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: file.id,
      businessId: file.businessId,
      status: file.status,
      affordabilityRatio: file.affordabilityRatio,
      loadProfileScore: file.loadProfileScore,
    });
    expect(res.body.data.business.id).toBe(file.businessId);
    expect(res.body.data.burn.businessId).toBe(file.businessId);
    expect(res.body.data.quote.system.id).toBe(file.quote.system.id);
    expect(res.body.data.fuelLogs.length).toBeLessThanOrEqual(24);
    expect(res.body.data.schedulePreview.length).toBe(6);
  });

  it('returns the contract 404 for an unknown application', async () => {
    const res = await request(app).get('/api/credit/applications/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Credit file not found' });
  });

  it('approves a pending application into a loan and an asset', async () => {
    const seed = buildSeed();
    const file = seed.creditFiles.find((f) => f.status === 'PENDING')!;

    const res = await request(app).post(`/api/credit/applications/${file.id}/approve`);
    expect(res.status).toBe(201);

    const { loan, asset } = res.body.data;
    expect(asset).toMatchObject({
      businessId: file.businessId,
      systemId: file.quote.system.id,
      status: 'ACTIVE',
      installedAt: repo.now().toISOString(),
    });
    expect(asset.serial).toMatch(/^LG-\d{5}$/);
    expect(asset.controllerId).toMatch(/^CTL-\d{5}$/);

    expect(loan).toMatchObject({
      assetId: asset.id,
      principalKobo: file.quote.system.priceKobo - file.quote.depositKobo,
      tenorMonths: file.quote.tenorMonths,
      monthlyPaymentKobo: file.quote.monthlyPaymentKobo,
      balanceKobo: file.quote.system.priceKobo - file.quote.depositKobo,
      status: 'ACTIVE',
    });
    expect(loan.nextDueAt).toBe(new Date(repo.now().getTime() + 30 * 86_400_000).toISOString());

    const assetRes = await request(app).get(`/api/assets/${asset.id}`);
    expect(assetRes.status).toBe(200);
    const scheduleRes = await request(app).get(`/api/loans/${loan.id}/schedule`);
    expect(scheduleRes.status).toBe(200);
    expect(scheduleRes.body.data.items).toHaveLength(file.quote.tenorMonths);
  });

  it('rejects approving a non-pending application', async () => {
    const seed = buildSeed();
    const approved = seed.creditFiles.find((f) => f.status === 'APPROVED')!;

    const res = await request(app).post(`/api/credit/applications/${approved.id}/approve`);
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'Credit file is already APPROVED',
    });
  });

  it('rejects approving an unknown application', async () => {
    const res = await request(app).post('/api/credit/applications/nope/approve');
    expect(res.status).toBe(404);
  });

  it('declines a pending application', async () => {
    const seed = buildSeed();
    const pending = seed.creditFiles.find((f) => f.status === 'PENDING')!;

    const res = await request(app)
      .post(`/api/credit/applications/${pending.id}/decline`)
      .send({ reason: 'Insufficient verification' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DECLINED');
  });

  it('requires a decline reason', async () => {
    const seed = buildSeed();
    const pending = seed.creditFiles.find((f) => f.status === 'PENDING')!;

    const res = await request(app).post(`/api/credit/applications/${pending.id}/decline`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION', message: 'reason is required' });
  });

  it('rejects declining a non-pending application', async () => {
    const seed = buildSeed();
    const approved = seed.creditFiles.find((f) => f.status === 'APPROVED')!;

    const res = await request(app)
      .post(`/api/credit/applications/${approved.id}/decline`)
      .send({ reason: 'Nope' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Credit file is already APPROVED');
  });
});
