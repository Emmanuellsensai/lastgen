import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../src/data/seed.js';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: payments
// POST /loans/:id/pay books a payment through the active adapter and returns
// the slim { paymentId, platformTransactionReference, status } envelope. With
// the simulated adapter (settleAfterMs 0) the consent settles synchronously and
// status is SUCCESS; the ledger and loan/asset are updated in one transaction.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('payments contract', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp());
  });

  it('settles an instalment and returns the slim pay envelope', async () => {
    const loan = (await repo.getLoan('loan_biz_adaeze_frozen'))!;
    const asset = (await repo.getAsset(loan.assetId))!;
    const amountKobo = 36_654_539;
    const before = loan.balanceKobo;
    const unpaidBefore = (await repo.scheduleFor(loan.id)).filter((i) => !i.paidAt).length;

    const res = await request(app)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ source: 'bank_account', amountKobo });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toMatchObject({
      status: 'SUCCESS',
    });
    expect(res.body.data.paymentId).toMatch(/^pay_/);
    expect(res.body.data.platformTransactionReference).toMatch(/^SIM-PLT-/);

    const payment = (await repo.paymentByRefOrId(res.body.data.paymentId))!;
    expect(payment).toMatchObject({ loanId: loan.id, amountKobo, source: 'SIMULATED' });
    expect(payment.reference).toMatch(/^SIM-/);
    expect(loan.balanceKobo).toBe(before - amountKobo);
    expect(asset.id).toBe(asset.id);
    expect((await repo.scheduleFor(loan.id)).filter((i) => !i.paidAt)).toHaveLength(
      unpaidBefore - 1,
    );
  });

  it('transfers ownership when the balance is cleared', async () => {
    const loan = (await repo.getLoan('loan_biz_wuse_press'))!;
    const asset = (await repo.getAsset(loan.assetId))!;
    const balanceKobo = loan.balanceKobo;

    const res = await request(app)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ source: 'bank_account', amountKobo: balanceKobo });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUCCESS');
    expect(loan.status).toBe('CLOSED');
    expect(loan.balanceKobo).toBe(0);
    expect(asset.status).toBe('OWNED');
  });

  it('defaults the amount to the next unpaid installment', async () => {
    const loan = (await repo.getLoan('loan_biz_adaeze_frozen'))!;
    const nextUnpaid = (await repo.scheduleFor(loan.id)).find((i) => !i.paidAt)!;
    const expected = nextUnpaid.principalKobo + nextUnpaid.interestKobo;

    const res = await request(app)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ source: 'bank_account' });

    expect(res.status).toBe(200);
    const payment = (await repo.paymentByRefOrId(res.body.data.paymentId))!;
    expect(payment.amountKobo).toBe(expected);
  });

  it('books a pending payment when the alat adapter is active', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const target = String(url);
        if (target.includes('transfer-fund-request')) {
          return new Response(JSON.stringify({ platformTransactionReference: 'PLT-BOOKED' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (target.includes('CheckTransactionStatus')) {
          return new Response(JSON.stringify({ status: 'pending_authorisation' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        throw new Error(`unexpected fetch: ${target}`);
      }),
    );
    const { app: alatApp, repo: alatRepo } = createTestApp({
      paymentAdapter: 'alat',
      env: {
        ALAT_BASE_URL: 'https://alat.example.com',
        ALAT_CHANNEL_ID: 'chan',
        ALAT_API_KEY: 'key',
      },
    });
    const loan = (await alatRepo.getLoan('loan_biz_adaeze_frozen'))!;
    const before = loan.balanceKobo;

    const res = await request(alatApp)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ source: 'bank_account', amountKobo: 36_654_539 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending_authorisation');
    expect(res.body.data.platformTransactionReference).toBe('PLT-BOOKED');

    const payment = (await alatRepo.paymentByRefOrId(res.body.data.paymentId))!;
    expect(payment.source).toBe('ALAT');
    expect(payment.reference).toMatch(/^ALAT-/);
    expect(payment.status).toBe('pending_authorisation');
    expect(loan.balanceKobo).toBe(before);
  });

  it('requires a valid source', async () => {
    const res = await request(app)
      .post('/api/loans/loan_biz_adaeze_frozen/pay')
      .send({ amountKobo: 100 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.message).toBe("source must be 'wallet' or 'bank_account'");
  });

  it('returns the contract 404 for an unknown loan', async () => {
    const res = await request(app)
      .post('/api/loans/nope/pay')
      .send({ source: 'bank_account', amountKobo: 100 });
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Loan not found' });
  });

  it('rejects a non-positive amount', async () => {
    const res = await request(app)
      .post('/api/loans/loan_biz_adaeze_frozen/pay')
      .send({ source: 'bank_account', amountKobo: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.message).toBe('amountKobo must be a positive integer');
  });

  it('rejects paying a closed loan', async () => {
    const seed = buildSeed();
    const closed = seed.loans.find((l) => l.status === 'CLOSED');
    expect(closed).toBeDefined();
    const res = await request(app)
      .post(`/api/loans/${closed!.id}/pay`)
      .send({ source: 'bank_account', amountKobo: 1000 });
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'This loan is already closed',
    });
  });

  it('requires a wallet before a wallet payment can settle', async () => {
    const res = await request(app)
      .post('/api/loans/loan_biz_adaeze_frozen/pay')
      .send({ source: 'wallet', amountKobo: 1000 });

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Wallet not found' });
  });
});
