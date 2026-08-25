import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../helpers.js';
import { createTestApp } from '../helpers.js';

// Contract suite: bank authentication
// POST /auth/bank/register and POST /auth/bank/login back the credit-desk
// pages. Both mount BEFORE the auth boundary, validate exactly like the MSW
// reference (handlers.ts bankAuthHandlers), and harden where the mock is
// loose: unknown credentials fail closed with UNAUTHORIZED instead of
// succeeding.

const REGISTER_BODY = {
  bankName: 'Wema Bank',
  bankId: 'wema-credit-01',
  password: 's3cure-Pass',
  confirmPassword: 's3cure-Pass',
};

describe('bank auth contract', () => {
  let app: TestApp['app'];
  let repo: TestApp['repo'];

  beforeEach(() => {
    ({ app, repo } = createTestApp());
  });

  describe('POST /auth/bank/register', () => {
    it('creates a credit-desk identity and returns a bank session', async () => {
      const res = await request(app).post('/api/auth/bank/register').send(REGISTER_BODY);

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toEqual({
        user: { id: 'bank_wema-credit-01', bankId: 'wema-credit-01', bankName: 'Wema Bank' },
        role: 'bank',
        accessToken: 'tok_bank_wema-credit-01',
      });
    });

    it('requires bank name, bank ID and password', async () => {
      const res = await request(app)
        .post('/api/auth/bank/register')
        .send({ bankId: 'wema-credit-01', password: 's3cure-Pass' });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toEqual({
        code: 'VALIDATION',
        message: 'Bank name, bank ID and password are required',
      });
    });

    it('rejects mismatched passwords', async () => {
      const res = await request(app)
        .post('/api/auth/bank/register')
        .send({
          ...REGISTER_BODY,
          confirmPassword: 'different',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toEqual({ code: 'VALIDATION', message: 'Passwords do not match' });
    });

    it('rejects a duplicate bank ID', async () => {
      await request(app).post('/api/auth/bank/register').send(REGISTER_BODY);
      const res = await request(app)
        .post('/api/auth/bank/register')
        .send({ ...REGISTER_BODY, bankName: 'Other Bank' });

      expect(res.status).toBe(400);
      expect(res.body.error).toEqual({
        code: 'VALIDATION',
        message: 'Bank ID already registered',
      });
    });
  });

  describe('POST /auth/bank/login', () => {
    it('signs in a registered bank and returns a fresh session', async () => {
      await request(app).post('/api/auth/bank/register').send(REGISTER_BODY);

      const res = await request(app).post('/api/auth/bank/login').send({
        bankId: REGISTER_BODY.bankId,
        password: REGISTER_BODY.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.user.bankId).toBe(REGISTER_BODY.bankId);
      expect(res.body.data.role).toBe('bank');
      expect(res.body.data.accessToken).toBe('tok_bank_wema-credit-01');
    });

    it('fails closed for an unregistered bank ID', async () => {
      const res = await request(app)
        .post('/api/auth/bank/login')
        .send({ bankId: 'ghost-bank', password: 'whatever' });

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toEqual({
        code: 'UNAUTHORIZED',
        message: 'Invalid bank ID or password',
      });
    });

    it('fails closed on a wrong password without revealing which field was wrong', async () => {
      await request(app).post('/api/auth/bank/register').send(REGISTER_BODY);

      const wrongPassword = await request(app)
        .post('/api/auth/bank/login')
        .send({ bankId: REGISTER_BODY.bankId, password: 'nope' });
      const unknownBank = await request(app)
        .post('/api/auth/bank/login')
        .send({ bankId: 'ghost-bank', password: 'nope' });

      expect(wrongPassword.status).toBe(401);
      expect(wrongPassword.body.error).toEqual(unknownBank.body.error);
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/auth/bank/login')
        .send({ bankId: 'wema-credit-01' });

      expect(res.status).toBe(400);
      expect(res.body.error).toEqual({
        code: 'VALIDATION',
        message: 'Bank ID and password are required',
      });
    });
  });

  describe('mounting order', () => {
    it('keeps bank auth reachable without a bearer when live mode fails closed', async () => {
      // Live mode (demoMode: false) enforces bearer tokens everywhere except
      // the pre-boundary routers. Without Supabase credentials requireAuth
      // fails closed with the contract 401 - proving bank auth sits outside
      // that boundary.
      const live = createTestApp({ demoMode: false });

      const register = await request(live.app).post('/api/auth/bank/register').send(REGISTER_BODY);
      expect(register.status).toBe(201);

      const guarded = await request(live.app).get('/api/me/session');
      expect(guarded.status).toBe(401);
      expect(guarded.body.error).toEqual({
        code: 'UNAUTHORIZED',
        message: 'A valid bearer token is required',
      });
    });
  });

  describe('demo reset hygiene', () => {
    it('clears bank identities on repository reset', async () => {
      await request(app).post('/api/auth/bank/register').send(REGISTER_BODY);
      await repo.reset();

      const res = await request(app)
        .post('/api/auth/bank/login')
        .send({ bankId: REGISTER_BODY.bankId, password: REGISTER_BODY.password });

      expect(res.status).toBe(401);
    });
  });
});
