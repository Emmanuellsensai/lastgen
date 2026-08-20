import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../../src/data/seed.js';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: loans
// Read-only surface in Phase 3: loan lookup and repayment schedule. Payment
// settlement is covered by the Phase 4 payment work.

describe('loans contract', () => {
  let app: TestApp['app'];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it('reads a loan by id', async () => {
    const res = await request(app).get('/api/loans/loan_biz_adaeze_frozen');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 'loan_biz_adaeze_frozen',
      assetId: 'ast_biz_adaeze_frozen',
      status: 'ACTIVE',
      principalKobo: 667_800_000,
      balanceKobo: 361_725_000,
    });
  });

  it('returns the contract 404 for an unknown loan', async () => {
    const res = await request(app).get('/api/loans/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Loan not found' });
  });

  it('returns the full repayment schedule for a financed loan', async () => {
    const seed = buildSeed();
    const loan = seed.loans.find((l) => l.id === 'loan_biz_adaeze_frozen')!;

    const res = await request(app).get(`/api/loans/${loan.id}/schedule`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(loan.tenorMonths);
    const [first] = res.body.data.items;
    expect(first.n).toBe(1);
    expect(first.principalKobo).toBeGreaterThan(0);
    expect(first.interestKobo).toBeGreaterThan(0);
    expect(first.balanceKobo).toBeGreaterThan(0);
    expect(first.paidAt).toBeTruthy();
  });

  it('returns the contract 404 for a loan without a schedule', async () => {
    const res = await request(app).get('/api/loans/loan_p000/schedule');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Schedule not found' });
  });
});
