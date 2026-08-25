import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../../src/data/seed.js';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: admin surface (handlers.ts adminHandlers + kycHandlers
// lines 844–1004). Every route demands the bank/admin role — demo mode is
// permissive, live mode is covered by the bank-auth suite's mount guard.

const SELFIE = Buffer.from('selfie-bytes');
const SLIP = Buffer.from('slip-bytes');

function submitKyc(app: TestApp['app'], businessId = 'biz_adaeze_frozen') {
  return request(app)
    .post(`/api/businesses/${businessId}/kyc/submit`)
    .field('ninNumber', '12345678901')
    .attach('selfie', SELFIE, { filename: 'selfie.png', contentType: 'image/png' })
    .attach('bankSlip', SLIP, { filename: 'slip.pdf', contentType: 'application/pdf' });
}

describe('admin users contract', () => {
  let app: TestApp['app'];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it('projects every business with asset, loan and kyc state', async () => {
    const res = await request(app).get('/api/admin/users');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(8);

    const adeze = res.body.data.items.find(
      (u: { id: string }) => u.id === 'biz_adaeze_frozen',
    );
    expect(adeze).toMatchObject({
      name: 'Adaeze Frozen Foods',
      city: 'Lagos',
      kycStatus: 'unverified',
      assetStatus: 'ACTIVE',
      assetId: 'ast_biz_adaeze_frozen',
      loanId: 'loan_biz_adaeze_frozen',
    });
    expect(typeof adeze.loanBalanceKobo).toBe('number');
  });

  it('reflects a pending submission in the projection', async () => {
    await submitKyc(app);
    const res = await request(app).get('/api/admin/users');

    const adeze = res.body.data.items.find(
      (u: { id: string }) => u.id === 'biz_adaeze_frozen',
    );
    expect(adeze.kycStatus).toBe('pending');
  });
});

describe('admin kyc review contract', () => {
  let app: TestApp['app'];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it('lists submissions joined with business names and filters by status', async () => {
    const empty = await request(app).get('/api/admin/kyc');
    expect(empty.status).toBe(200);
    expect(empty.body.data.items).toEqual([]);

    await submitKyc(app);

    const all = await request(app).get('/api/admin/kyc');
    expect(all.status).toBe(200);
    expect(all.body.data.items).toHaveLength(1);
    expect(all.body.data.items[0]).toMatchObject({
      id: 'kyc_biz_adaeze_frozen',
      businessName: 'Adaeze Frozen Foods',
      status: 'pending',
    });

    const rejectedOnly = await request(app).get('/api/admin/kyc?status=rejected');
    expect(rejectedOnly.body.data.items).toEqual([]);
  });

  it('rejects an unknown status filter', async () => {
    const res = await request(app).get('/api/admin/kyc?status=bogus');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  it('approves a pending submission once and guards re-review', async () => {
    await submitKyc(app);

    const approve = await request(app).post('/api/admin/kyc/kyc_biz_adaeze_frozen/approve');
    expect(approve.status).toBe(200);
    expect(approve.body.ok).toBe(true);
    expect(approve.body.data).toMatchObject({
      id: 'kyc_biz_adaeze_frozen',
      status: 'approved',
    });
    expect(approve.body.data.reviewedAt).toBeTruthy();

    const again = await request(app).post('/api/admin/kyc/kyc_biz_adaeze_frozen/approve');
    expect(again.status).toBe(409);
    expect(again.body.error).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'KYC is approved; only pending submissions can be reviewed',
    });
  });

  it('requires a reason to reject and records it on the record', async () => {
    await submitKyc(app);

    const noReason = await request(app)
      .post('/api/admin/kyc/kyc_biz_adaeze_frozen/reject')
      .send({});
    expect(noReason.status).toBe(400);
    expect(noReason.body.error).toEqual({
      code: 'VALIDATION',
      message: 'reason is required to reject a submission',
    });

    const reject = await request(app)
      .post('/api/admin/kyc/kyc_biz_adaeze_frozen/reject')
      .send({ reason: 'Blurry selfie' });
    expect(reject.status).toBe(200);
    expect(reject.body.data).toEqual({
      id: 'kyc_biz_adaeze_frozen',
      status: 'rejected',
      rejectionReason: 'Blurry selfie',
      reviewedAt: reject.body.data.reviewedAt,
    });

    // A rejection is recoverable: resubmission restarts the lifecycle.
    const resubmit = await submitKyc(app);
    expect(resubmit.status).toBe(201);
    expect(resubmit.body.data.status).toBe('pending');
  });

  it('returns 404 for unknown submission ids', async () => {
    const res = await request(app).post('/api/admin/kyc/kyc_nope/approve');

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'KYC submission not found' });
  });
});

describe('admin power control contract', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp());
  });

  it('suspends an active asset and restores a suspended one', async () => {
    const suspend = await request(app).post(
      '/api/admin/assets/ast_biz_adaeze_frozen/toggle-power',
    );
    expect(suspend.status).toBe(200);
    expect(suspend.body.data).toEqual({ id: 'ast_biz_adaeze_frozen', status: 'SUSPENDED' });

    const restore = await request(app).post(
      '/api/admin/assets/ast_biz_adaeze_frozen/toggle-power',
    );
    expect(restore.body.data).toEqual({ id: 'ast_biz_adaeze_frozen', status: 'ACTIVE' });
  });

  it('blocks suspension of a medical-flagged business with MEDICAL_FLAG', async () => {
    // The seed flags biz_gwarinpa_mart; flip it through the repo handle like
    // the assets suite does, then prove the guard survives the admin path.
    const business = (await repo.getBusiness('biz_gwarinpa_mart'))!;
    business.medicalFlag = true;

    const res = await request(app).post(
      '/api/admin/assets/ast_biz_gwarinpa_mart/toggle-power',
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MEDICAL_FLAG');
    expect(res.body.error.message).toContain('medical');
  });

  it('refuses to suspend an owned asset', async () => {
    const owned = buildSeed().assets.find((a) => a.status === 'OWNED')!;

    const res = await request(app).post(`/api/admin/assets/${owned.id}/toggle-power`);

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'An owned asset cannot be suspended',
    });
  });

  it('returns 404 for unknown assets', async () => {
    const res = await request(app).post('/api/admin/assets/ast_nope/toggle-power');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('admin orders contract', () => {
  let app: TestApp['app'];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it('projects non-closed loans with full context and filters by status', async () => {
    const res = await request(app).get('/api/admin/orders');

    expect(res.status).toBe(200);
    // The seed portfolio ships hundreds of loans; every projected row must
    // be an active receivable (CLOSED loans are history, not work items).
    expect(res.body.data.items.length).toBeGreaterThan(4);
    expect(
      res.body.data.items.every((o: { status: string }) => o.status !== 'CLOSED'),
    ).toBe(true);

    const frozen = res.body.data.items.find(
      (o: { loanId: string }) => o.loanId === 'loan_biz_adaeze_frozen',
    );
    expect(frozen).toMatchObject({
      businessName: 'Adaeze Frozen Foods',
      businessId: 'biz_adaeze_frozen',
      assetId: 'ast_biz_adaeze_frozen',
      status: 'ACTIVE',
    });

    const delinquentOnly = await request(app).get('/api/admin/orders?status=DELINQUENT');
    expect(delinquentOnly.body.data.items.every((o: { status: string }) => o.status === 'DELINQUENT')).toBe(true);

    const badFilter = await request(app).get('/api/admin/orders?status=CLOSED');
    expect(badFilter.status).toBe(400);
    expect(badFilter.body.error.code).toBe('VALIDATION');
  });

  it('settles one installment atomically through approve-payment', async () => {
    const before = (await request(app).get('/api/admin/orders')).body.data.items.find(
      (o: { loanId: string }) => o.loanId === 'loan_biz_adaeze_frozen',
    );

    const res = await request(app).post('/api/admin/loans/loan_biz_adaeze_frozen/approve-payment');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.paymentId).toBeTruthy();
    expect(res.body.data.status).toBe('SUCCESS');

    const after = (await request(app).get('/api/admin/orders')).body.data.items.find(
      (o: { loanId: string }) => o.loanId === 'loan_biz_adaeze_frozen',
    );
    expect(before.balanceKobo - after.balanceKobo).toBe(before.monthlyPaymentKobo);
  });

  it('returns 404 for unknown loans', async () => {
    const res = await request(app).post('/api/admin/loans/loan_nope/approve-payment');

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Loan not found' });
  });

  it('refuses to settle a closed loan', async () => {
    // Drive the frozen-foods loan to closure through repeated approvals.
    let orders = (await request(app).get('/api/admin/orders')).body.data.items;
    let loan = orders.find((o: { loanId: string }) => o.loanId === 'loan_biz_adaeze_frozen');
    while (loan && loan.status !== 'CLOSED') {
      await request(app).post(`/api/admin/loans/${loan.loanId}/approve-payment`);
      orders = (await request(app).get('/api/admin/orders')).body.data.items;
      loan = orders.find((o: { loanId: string }) => o.loanId === 'loan_biz_adaeze_frozen');
    }
    expect(loan?.balanceKobo ?? 0).toBeLessThanOrEqual(0);

    const res = await request(app).post('/api/admin/loans/loan_biz_adaeze_frozen/approve-payment');

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_TRANSITION',
      message: 'This loan is already closed',
    });
  });
});
