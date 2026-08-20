import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';
import {
  DEMO_WALLET_FUNDING_KOBO,
  WALLET_BANK_CODE,
  WALLET_CURRENCY,
} from '../../src/config/constants.js';

// Contract suite: wallets
// POST /wallets/create opens a KYC'd virtual account (pre-funded in demo mode),
// GET /wallets/balance and /statement are scoped to the user's business, and
// source='wallet' payments debit the wallet then settle loan + asset together.

describe('wallets contract', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp());
  });

  it('creates a pre-funded wallet for the demo business', async () => {
    const res = await request(app).post('/api/wallets/create').send({
      businessId: 'biz_adaeze_frozen',
      nin: '12345678901',
      firstName: 'Adaeze',
      lastName: 'Okonkwo',
      phone: '+2348012345678',
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.wallet).toMatchObject({
      businessId: 'biz_adaeze_frozen',
      bankCode: WALLET_BANK_CODE,
      currency: WALLET_CURRENCY,
      balanceKobo: DEMO_WALLET_FUNDING_KOBO,
    });
    expect(res.body.data.wallet.accountNumber).toMatch(/^\d{10}$/);
  });

  it('is idempotent per business', async () => {
    const body = {
      businessId: 'biz_adaeze_frozen',
      nin: '12345678901',
      firstName: 'Adaeze',
      lastName: 'Okonkwo',
      phone: '+2348012345678',
    };
    const first = await request(app).post('/api/wallets/create').send(body);
    const second = await request(app).post('/api/wallets/create').send(body);

    expect(second.body.data.wallet.id).toBe(first.body.data.wallet.id);
    expect(second.body.data.wallet.accountNumber).toBe(first.body.data.wallet.accountNumber);
  });

  it('requires the KYC fields', async () => {
    const res = await request(app)
      .post('/api/wallets/create')
      .send({ businessId: 'biz_adaeze_frozen' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.message).toBe('nin, firstName, lastName and phone are required');
  });

  it('rejects creating a wallet for an unknown business', async () => {
    const res = await request(app).post('/api/wallets/create').send({
      businessId: 'nope',
      nin: '12345678901',
      firstName: 'A',
      lastName: 'B',
      phone: '+2348',
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Business not found' });
  });

  it('returns the wallet balance for the user business', async () => {
    await request(app).post('/api/wallets/create').send({
      businessId: 'biz_adaeze_frozen',
      nin: '12345678901',
      firstName: 'Adaeze',
      lastName: 'Okonkwo',
      phone: '+2348012345678',
    });

    const res = await request(app).get('/api/wallets/balance');
    expect(res.status).toBe(200);
    expect(res.body.data.businessId).toBe('biz_adaeze_frozen');
    expect(res.body.data.balanceKobo).toBe(DEMO_WALLET_FUNDING_KOBO);
  });

  it('returns 404 balance when no wallet exists', async () => {
    const res = await request(app).get('/api/wallets/balance');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Wallet not found' });
  });

  it('returns the statement with the funding credit first', async () => {
    await request(app).post('/api/wallets/create').send({
      businessId: 'biz_adaeze_frozen',
      nin: '12345678901',
      firstName: 'Adaeze',
      lastName: 'Okonkwo',
      phone: '+2348012345678',
    });

    const res = await request(app).get('/api/wallets/statement');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({
      direction: 'IN',
      amountKobo: DEMO_WALLET_FUNDING_KOBO,
      category: 'funding',
    });
  });

  it('settles a wallet payment and debits the balance in one transaction', async () => {
    await request(app).post('/api/wallets/create').send({
      businessId: 'biz_adaeze_frozen',
      nin: '12345678901',
      firstName: 'Adaeze',
      lastName: 'Okonkwo',
      phone: '+2348012345678',
    });
    const loan = repo.getLoan('loan_biz_adaeze_frozen')!;
    const before = loan.balanceKobo;
    const amountKobo = 3_000_000;

    const pay = await request(app)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ source: 'wallet', amountKobo });

    expect(pay.status).toBe(200);
    expect(pay.body.data).toMatchObject({
      status: 'SUCCESS',
      platformTransactionReference: null,
    });

    const payment = repo.paymentByRefOrId(pay.body.data.paymentId)!;
    expect(payment).toMatchObject({ source: 'WALLET', amountKobo });
    expect(payment.reference).toMatch(/^WLT-/);
    expect(loan.balanceKobo).toBe(before - amountKobo);

    const balance = await request(app).get('/api/wallets/balance');
    expect(balance.body.data.balanceKobo).toBe(DEMO_WALLET_FUNDING_KOBO - amountKobo);

    const statement = await request(app).get('/api/wallets/statement');
    expect(statement.body.data.items).toHaveLength(2);
    expect(statement.body.data.items[0]).toMatchObject({
      direction: 'OUT',
      amountKobo,
      category: 'loan_payment',
    });
  });

  it('rejects a wallet payment when the balance is insufficient', async () => {
    await request(app).post('/api/wallets/create').send({
      businessId: 'biz_adaeze_frozen',
      nin: '12345678901',
      firstName: 'Adaeze',
      lastName: 'Okonkwo',
      phone: '+2348012345678',
    });
    const loan = repo.getLoan('loan_biz_adaeze_frozen')!;
    const before = loan.balanceKobo;

    const res = await request(app)
      .post(`/api/loans/${loan.id}/pay`)
      .send({ source: 'wallet', amountKobo: DEMO_WALLET_FUNDING_KOBO + 1 });

    expect(res.status).toBe(402);
    expect(res.body.error).toEqual({
      code: 'PAYMENT_REQUIRED',
      message: 'Insufficient wallet balance',
    });
    expect(loan.balanceKobo).toBe(before);
  });

  it('keeps wallet endpoints behind the auth boundary in live mode', async () => {
    const { app: liveApp } = createTestApp({ demoMode: false });

    const create = await request(liveApp).post('/api/wallets/create').send({
      businessId: 'biz_adaeze_frozen',
      nin: '12345678901',
      firstName: 'Adaeze',
      lastName: 'Okonkwo',
      phone: '+2348012345678',
    });
    // No bearer token: the auth boundary fires before ownership is even
    // consulted — cross-user access is impossible.
    expect(create.status).toBe(401);
    expect(create.body.error.code).toBe('UNAUTHORIZED');

    const balance = await request(liveApp).get('/api/wallets/balance');
    expect(balance.status).toBe(401);
  });
});
