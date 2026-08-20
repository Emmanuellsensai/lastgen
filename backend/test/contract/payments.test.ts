import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: payments
// POST /loans/:id/pay settles an instalment through the simulated adapter and
// returns { payment, loan, asset }. Paying the balance transfers ownership.

describe('payments contract', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp());
  });

  it('settles an instalment and returns payment, loan and asset', async () => {
    const loan = repo.getLoan('loan_biz_adaeze_frozen')!;
    const asset = repo.getAsset(loan.assetId)!;
    const amountKobo = 36_654_539;
    const before = loan.balanceKobo;
    const unpaidBefore = repo.scheduleFor(loan.id).filter((i) => !i.paidAt).length;

    const res = await request(app).post(`/api/loans/${loan.id}/pay`).send({ amountKobo });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.payment).toMatchObject({
      loanId: loan.id,
      amountKobo,
      source: 'SIMULATED',
    });
    expect(res.body.data.payment.reference).toMatch(/^SIM-/);
    expect(res.body.data.loan.id).toBe(loan.id);
    expect(res.body.data.loan.balanceKobo).toBe(before - amountKobo);
    expect(res.body.data.asset.id).toBe(asset.id);

    expect(loan.balanceKobo).toBe(before - amountKobo);
    expect(repo.scheduleFor(loan.id).filter((i) => !i.paidAt)).toHaveLength(unpaidBefore - 1);
  });

  it('transfers ownership when the balance is cleared', async () => {
    const loan = repo.getLoan('loan_biz_wuse_press')!;
    const asset = repo.getAsset(loan.assetId)!;
    const balanceKobo = loan.balanceKobo;

    const res = await request(app)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ amountKobo: balanceKobo });

    expect(res.status).toBe(200);
    expect(res.body.data.loan.status).toBe('CLOSED');
    expect(res.body.data.loan.balanceKobo).toBe(0);
    expect(res.body.data.asset.status).toBe('OWNED');
    expect(asset.status).toBe('OWNED');
    expect(loan.status).toBe('CLOSED');
  });

  it('records the ALAT source when the alat adapter is active', async () => {
    const { app: alatApp, repo: alatRepo } = createTestApp({
      paymentAdapter: 'alat',
      env: { ALAT_BASE_URL: 'https://alat.example.com' },
    });
    const loan = alatRepo.getLoan('loan_biz_adaeze_frozen')!;

    const res = await request(alatApp)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ amountKobo: 36_654_539 });

    expect(res.status).toBe(200);
    expect(res.body.data.payment.source).toBe('ALAT');
    expect(res.body.data.payment.reference).toMatch(/^ALAT-/);
  });

  it('returns the contract 404 for an unknown loan', async () => {
    const res = await request(app).post('/api/loans/nope/pay').send({ amountKobo: 100 });
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Loan not found' });
  });

  it('rejects a non-positive amount', async () => {
    const res = await request(app)
      .post('/api/loans/loan_biz_adaeze_frozen/pay')
      .send({ amountKobo: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.message).toBe('amountKobo must be a positive integer');
  });

  it('rejects paying a closed loan', async () => {
    const res = await request(app).post('/api/loans/loan_p000/pay').send({ amountKobo: 1000 });
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'This loan is already closed',
    });
  });
});
