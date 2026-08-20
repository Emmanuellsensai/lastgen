import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: demo controls
// Reset, advance-time and miss-payment drive the real state machine through
// the demo clock. They are unauthenticated but only mounted in demo mode; a
// live-mode app must not expose them (contract: "unauthenticated, demo only").

describe('demo contract', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp());
  });

  it('advances the clock and rolls the asset state machine forward', async () => {
    const res = await request(app).post('/api/demo/advance-time').send({ days: 30 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: { ok: true } });

    const wuse = (await repo.getAsset('ast_biz_wuse_press'))!;
    expect(wuse.status).toBe('SUSPENDED');
    expect((await repo.getLoan('loan_biz_adaeze_frozen'))!.status).toBe('ACTIVE');
  });

  it('keeps a medical-flagged business in GRACE instead of suspending it', async () => {
    await request(app).post('/api/demo/advance-time').send({ days: 90 });
    const flagged = (await repo.getAsset('ast_biz_gwarinpa_mart'))!;
    expect(flagged.status).toBe('GRACE');
    expect((await repo.getBusiness('biz_gwarinpa_mart'))!.medicalFlag).toBe(true);
  });

  it('resets the clock and restores the pristine seed', async () => {
    await request(app).post('/api/demo/advance-time').send({ days: 90 });
    const res = await request(app).post('/api/demo/reset');
    expect(res.status).toBe(200);
    expect((await repo.now()).toISOString()).toBe('2026-08-19T09:00:00.000Z');
    expect((await repo.getAsset('ast_biz_adaeze_frozen'))!.status).toBe('ACTIVE');
    expect((await repo.getAsset('ast_biz_wuse_press'))!.status).toBe('GRACE');
  });

  it('rejects a non-positive days value', async () => {
    const res = await request(app).post('/api/demo/advance-time').send({ days: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION',
      message: 'days must be a non zero number',
    });
  });

  it('simulates a missed payment through the state machine', async () => {
    const res = await request(app)
      .post('/api/demo/miss-payment')
      .send({ loanId: 'loan_biz_adaeze_frozen' });
    expect(res.status).toBe(200);
    expect(res.body.data.loan.status).toBe('DELINQUENT');
    expect(res.body.data.asset.status).toBe('GRACE');
  });

  it('returns the contract 404 for an unknown loan', async () => {
    const res = await request(app).post('/api/demo/miss-payment').send({ loanId: 'nope' });
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Loan not found' });
  });

  it('rejects missing a closed loan', async () => {
    const res = await request(app).post('/api/demo/miss-payment').send({ loanId: 'loan_p000' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('is not reachable in live mode without a bearer token', async () => {
    const { app: liveApp } = createTestApp({ demoMode: false });
    for (const [method, path] of [
      ['post', '/api/demo/reset'],
      ['post', '/api/demo/advance-time'],
      ['post', '/api/demo/miss-payment'],
    ] as const) {
      const res = await request(liveApp)[method](path).send({});
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({
        code: 'UNAUTHORIZED',
        message: 'A valid bearer token is required',
      });
    }
  });
});
