import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: payment lifecycle
// The bank_account path mirrors the ALAT dance: pay books a
// pending_authorisation payment, the provider consents (simulated in-process
// or via the ALAT webhook), and settlement updates loan + asset in one
// transaction. GET /payments/:reference/status is the frontend's 2s poll.

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('payment lifecycle contract', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp());
  });

  it('settles through the webhook when the consent is not instant', async () => {
    const { app: slowApp, repo: slowRepo } = createTestApp({
      env: { SETTLE_AFTER_MS: '60000' },
    });
    const loan = (await slowRepo.getLoan('loan_biz_adaeze_frozen'))!;
    const amountKobo = 36_654_539;
    const before = loan.balanceKobo;

    const pay = await request(slowApp)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ source: 'bank_account', amountKobo });

    expect(pay.body.data.status).toBe('pending_authorisation');
    const payment = (await slowRepo.paymentByRefOrId(pay.body.data.paymentId))!;
    expect(payment.status).toBe('pending_authorisation');

    const statusWhilePending = await request(slowApp).get(
      `/api/payments/${payment.reference}/status`,
    );
    expect(statusWhilePending.body.data.status).toBe('pending_authorisation');
    expect(statusWhilePending.body.data.payment.id).toBe(payment.id);

    // ALAT notifies; the webhook settles the booked payment by reference.
    const webhook = await request(slowApp)
      .post('/api/webhooks/alat')
      .send({
        transactionReference: payment.reference,
        amount: amountKobo / 100,
        narration: loan.id,
      });
    expect(webhook.status).toBe(200);

    const settled = await request(slowApp).get(`/api/payments/${payment.reference}/status`);
    expect(settled.body.data.status).toBe('SUCCESS');
    expect(settled.body.data.payment.id).toBe(payment.id);
    expect(loan.balanceKobo).toBe(before - amountKobo);
  });

  it('ignores a replayed webhook after settling by reference', async () => {
    const { app: slowApp, repo: slowRepo } = createTestApp({
      env: { SETTLE_AFTER_MS: '60000' },
    });
    const loan = (await slowRepo.getLoan('loan_biz_adaeze_frozen'))!;
    const amountKobo = 10_000_000;

    const pay = await request(slowApp)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ source: 'bank_account', amountKobo });
    const reference = (await slowRepo.paymentByRefOrId(pay.body.data.paymentId))!.reference;

    const payload = {
      transactionReference: reference,
      amount: amountKobo / 100,
      narration: loan.id,
    };
    await request(slowApp).post('/api/webhooks/alat').send(payload);
    const balanceAfterFirst = loan.balanceKobo;

    const replay = await request(slowApp).post('/api/webhooks/alat').send(payload);
    expect(replay.status).toBe(200);
    expect(loan.balanceKobo).toBe(balanceAfterFirst);
  });

  it('accepts paymentId as the status lookup key', async () => {
    const loan = (await repo.getLoan('loan_biz_adaeze_frozen'))!;
    const pay = await request(app)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ source: 'bank_account', amountKobo: 100_000 });

    const byId = await request(app).get(`/api/payments/${pay.body.data.paymentId}/status`);
    expect(byId.status).toBe(200);
    expect(byId.body.data.payment.id).toBe(pay.body.data.paymentId);
    expect(byId.body.data.status).toBe('SUCCESS');
  });

  it('returns the contract 404 for an unknown payment', async () => {
    const res = await request(app).get('/api/payments/does-not-exist/status');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Payment not found' });
  });

  it('fails a pending payment without touching the loan', async () => {
    const { app: slowApp, repo: slowRepo } = createTestApp({
      env: { SETTLE_AFTER_MS: '60000' },
    });
    const loan = (await slowRepo.getLoan('loan_biz_adaeze_frozen'))!;
    const before = loan.balanceKobo;

    const pay = await request(slowApp)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ source: 'bank_account', amountKobo: 5_000_000 });
    const reference = (await slowRepo.paymentByRefOrId(pay.body.data.paymentId))!.reference;

    await slowRepo.failPayment(reference);

    const res = await request(slowApp).get(`/api/payments/${reference}/status`);
    expect(res.body.data.status).toBe('FAILED');
    expect(loan.balanceKobo).toBe(before);
  });

  it('reconciles a stale pending payment against the real ALAT provider', async () => {
    // The alat adapter is active; the first pay POST books pending (no settle
    // callback for ALAT). The status poll then asks ALAT CheckTransactionStatus
    // and settles when the provider reports the consent went through.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const target = String(url);
        if (target.includes('transfer-fund-request')) {
          return jsonResponse({ platformTransactionReference: 'PLT-STALE' });
        }
        if (target.includes('CheckTransactionStatus')) {
          return jsonResponse({ status: 'SUCCESS' });
        }
        throw new Error(`unexpected fetch: ${target}`);
      }),
    );

    const { app: alatApp, repo: alatRepo } = createTestApp({
      paymentAdapter: 'alat',
      env: {
        ALAT_BASE_URL: 'https://alat.test',
        ALAT_CHANNEL_ID: 'chan',
        ALAT_API_KEY: 'key',
      },
    });
    const loan = (await alatRepo.getLoan('loan_biz_adaeze_frozen'))!;
    const amountKobo = 12_000_000;
    const before = loan.balanceKobo;

    const pay = await request(alatApp)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ source: 'bank_account', amountKobo });
    expect(pay.body.data.status).toBe('pending_authorisation');

    const res = await request(alatApp).get(`/api/payments/${pay.body.data.paymentId}/status`);
    expect(res.body.data.status).toBe('SUCCESS');
    expect(res.body.data.payment.platformTransactionReference).toBe('PLT-STALE');
    expect(loan.balanceKobo).toBe(before - amountKobo);
  });

  it('marks a pending payment EXPIRED when the provider reports the window elapsed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const target = String(url);
        if (target.includes('transfer-fund-request')) {
          return jsonResponse({ platformTransactionReference: 'PLT-EXPIRED' });
        }
        if (target.includes('CheckTransactionStatus')) {
          return jsonResponse({ status: 'EXPIRED' });
        }
        throw new Error(`unexpected fetch: ${target}`);
      }),
    );

    const { app: alatApp, repo: alatRepo } = createTestApp({
      paymentAdapter: 'alat',
      env: {
        ALAT_BASE_URL: 'https://alat.test',
        ALAT_CHANNEL_ID: 'chan',
        ALAT_API_KEY: 'key',
      },
    });
    const loan = (await alatRepo.getLoan('loan_biz_adaeze_frozen'))!;
    const before = loan.balanceKobo;

    const pay = await request(alatApp)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ source: 'bank_account', amountKobo: 3_000_000 });

    const res = await request(alatApp).get(`/api/payments/${pay.body.data.paymentId}/status`);
    expect(res.body.data.status).toBe('EXPIRED');
    expect(loan.balanceKobo).toBe(before);
  });
});
