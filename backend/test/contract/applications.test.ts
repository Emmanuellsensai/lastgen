import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../../src/data/seed.js';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: application flow
// The endpoints the live owner dashboard resolves itself with — business
// summary, credit file lookup, quote accept, fuel log delete and the loan
// payment ledger (buildSummary.md "NEW endpoints" P0/P1).

const BIZ = 'biz_adaeze_frozen';

describe('application flow contract', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp());
  });

  describe('GET /businesses/:id/summary', () => {
    it('returns the live asset, loan and quote ids', async () => {
      const res = await request(app).get(`/api/businesses/${BIZ}/summary`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        assetId: `ast_${BIZ}`,
        loanId: `loan_${BIZ}`,
        quoteId: `q_${BIZ}`,
      });
    });

    it('nulls the ids a brand new business does not have yet', async () => {
      const created = await request(app)
        .post('/api/businesses')
        .send({ name: 'Fresh Co', type: 'salon', city: 'Lagos', generatorKva: 5, hoursPerDay: 8 });

      const res = await request(app).get(`/api/businesses/${created.body.data.id}/summary`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ assetId: null, loanId: null, quoteId: null });
    });

    it('returns the contract 404 for an unknown business', async () => {
      const res = await request(app).get('/api/businesses/nope/summary');
      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Business not found' });
    });
  });

  describe('GET /businesses/:id/application', () => {
    it('returns the credit file for the business', async () => {
      const res = await request(app).get(`/api/businesses/${BIZ}/application`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        businessId: BIZ,
        status: buildSeed().creditFiles.find((f) => f.businessId === BIZ)!.status,
      });
      expect(res.body.data.quote.id).toBe(`q_${BIZ}`);
    });

    it('returns null before the first quote', async () => {
      const created = await request(app)
        .post('/api/businesses')
        .send({ name: 'Fresh Co', type: 'salon', city: 'Lagos', generatorKva: 5, hoursPerDay: 8 });

      const res = await request(app).get(`/api/businesses/${created.body.data.id}/application`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('returns the contract 404 for an unknown business', async () => {
      const res = await request(app).get('/api/businesses/nope/application');
      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Business not found' });
    });
  });

  describe('POST /quotes/:id/accept', () => {
    it('submits the quote and stamps the credit file', async () => {
      const res = await request(app).post(`/api/quotes/q_${BIZ}/accept`);
      expect(res.status).toBe(201);
      expect(res.body.data.creditFileId).toBeTruthy();
      expect(res.body.data.status).toBeTruthy();

      const file = await request(app).get(`/api/businesses/${BIZ}/application`);
      expect(file.body.data.id).toBe(res.body.data.creditFileId);
      expect(file.body.data.submittedAt).toBe((await repo.now()).toISOString());
    });

    it('is idempotent — a repeat accept resolves to the same credit file', async () => {
      const first = await request(app).post(`/api/quotes/q_${BIZ}/accept`);
      const second = await request(app).post(`/api/quotes/q_${BIZ}/accept`);
      expect(second.status).toBe(201);
      expect(second.body.data.creditFileId).toBe(first.body.data.creditFileId);
    });

    it('accepts a freshly generated quote', async () => {
      const systems = await request(app).get('/api/systems');
      const system = systems.body.data.items[0];
      const quote = await request(app)
        .post(`/api/businesses/${BIZ}/quote`)
        .send({ systemId: system.id, tenorMonths: 24 });
      expect(quote.status).toBe(201);

      const res = await request(app).post(`/api/quotes/${quote.body.data.id}/accept`);
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
    });

    it('returns the contract 404 for an unknown quote', async () => {
      const res = await request(app).post('/api/quotes/nope/accept');
      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Quote not found' });
    });
  });

  describe('DELETE /businesses/:id/fuel-logs/:logId', () => {
    it('removes the log and recomputes the burn profile', async () => {
      const created = await request(app)
        .post(`/api/businesses/${BIZ}/fuel-logs`)
        .send({ litres: 40, amountKobo: 4_600_000, pricePerLitreKobo: 115_000 });
      const logId = created.body.data.id;

      const before = await request(app).get(`/api/businesses/${BIZ}/burn`);
      const res = await request(app).delete(`/api/businesses/${BIZ}/fuel-logs/${logId}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ ok: true });

      const list = await request(app).get(`/api/businesses/${BIZ}/fuel-logs?limit=100`);
      expect(list.body.data.items.some((l: { id: string }) => l.id === logId)).toBe(false);

      const after = await request(app).get(`/api/businesses/${BIZ}/burn`);
      expect(after.body.data.dailyKobo).toBeLessThan(before.body.data.dailyKobo);
    });

    it('returns the contract 404 for an unknown log', async () => {
      const res = await request(app).delete(`/api/businesses/${BIZ}/fuel-logs/nope`);
      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Fuel log not found' });
    });

    it('will not delete a log that belongs to another business', async () => {
      const seed = buildSeed();
      const other = seed.fuelLogs.find((l) => l.businessId !== BIZ)!;
      const res = await request(app).delete(`/api/businesses/${BIZ}/fuel-logs/${other.id}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns the contract 404 for an unknown business', async () => {
      const res = await request(app).delete('/api/businesses/nope/fuel-logs/fl_00001');
      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Business not found' });
    });
  });

  describe('GET /loans/:id/payments', () => {
    it('lists settled payments newest first', async () => {
      const res = await request(app).get(`/api/loans/loan_${BIZ}/payments`);
      expect(res.status).toBe(200);

      const items = res.body.data.items as { paidAt: string; loanId: string; status: string }[];
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.loanId).toBe(`loan_${BIZ}`);
        expect(item.status).toBe('SUCCESS');
      }
      const timestamps = items.map((i) => i.paidAt);
      expect(timestamps).toEqual([...timestamps].sort((a, b) => b.localeCompare(a)));
    });

    it('includes a payment made through the API', async () => {
      const before = await request(app).get(`/api/loans/loan_${BIZ}/payments`);
      const pay = await request(app)
        .post(`/api/loans/loan_${BIZ}/pay`)
        .send({ source: 'bank_account' });
      expect(pay.status).toBe(200);

      const after = await request(app).get(`/api/loans/loan_${BIZ}/payments`);
      expect(after.body.data.items.length).toBe(before.body.data.items.length + 1);
    });

    it('returns the contract 404 for an unknown loan', async () => {
      const res = await request(app).get('/api/loans/nope/payments');
      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Loan not found' });
    });
  });
});
