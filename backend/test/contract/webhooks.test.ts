import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: webhooks
// ALAT Transaction Notifications must be replay-safe on transactionReference,
// reject a missing reference, and settle the loan named in the narration.

describe('webhooks contract', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp());
  });

  it('settles a notification and returns the contract payload', async () => {
    const loan = repo.getLoan('loan_biz_adaeze_frozen')!;
    const before = loan.balanceKobo;

    const res = await request(app)
      .post('/api/webhooks/alat')
      .send({ transactionReference: 'ALAT-REF-001', amount: 1000, narration: loan.id });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: { ok: true } });
    expect(loan.balanceKobo).toBe(before - 100_000);
  });

  it('ignores a replayed transactionReference', async () => {
    const loan = repo.getLoan('loan_biz_adaeze_frozen')!;
    const payload = { transactionReference: 'ALAT-REF-002', amount: 500, narration: loan.id };

    const first = await request(app).post('/api/webhooks/alat').send(payload);
    expect(first.status).toBe(200);
    const balanceAfterFirst = loan.balanceKobo;

    const replay = await request(app).post('/api/webhooks/alat').send(payload);
    expect(replay.status).toBe(200);
    expect(loan.balanceKobo).toBe(balanceAfterFirst);
  });

  it('settles the loan named in the narration', async () => {
    const target = repo.getLoan('loan_biz_wuse_press')!;
    const other = repo.getLoan('loan_biz_adaeze_frozen')!;
    const targetBefore = target.balanceKobo;
    const otherBefore = other.balanceKobo;

    await request(app)
      .post('/api/webhooks/alat')
      .send({ transactionReference: 'ALAT-REF-003', amount: 300, narration: target.id });

    expect(target.balanceKobo).toBe(targetBefore - 30_000);
    expect(other.balanceKobo).toBe(otherBefore);
  });

  it('requires transactionReference', async () => {
    const res = await request(app)
      .post('/api/webhooks/alat')
      .send({ amount: 1000, narration: 'loan_biz_adaeze_frozen' });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION',
      message: 'transactionReference is required',
    });
  });
});