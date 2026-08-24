import { Router } from 'express';
import type { Env } from '../config/env.js';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';
import type { BankLoginBody, BankRegisterBody, BankAuthResult } from '../types/api.js';

// Bank (credit desk) authentication.
//
// Mounted BEFORE the auth boundary in routes/index.ts: a caller cannot
// present a Lastgen bearer token it does not have yet — same rationale as
// webhooks. Unlike the demo /auth/login|register shims (which 404 in live
// mode because the frontend talks to Supabase directly), these routes work
// in both modes: the repository owns credential verification either way.
//
// Behaviour source: frontend/src/mocks/handlers.ts bankAuthHandlers
// (lines 975–1004), hardened for production — unknown credentials fail
// closed with 401 instead of succeeding like the mock does.

export function createBankAuthRouter(repo: Repository, _env: Env): Router {
  const router = Router();

  // POST /auth/bank/register — create a credit-desk identity.
  router.post('/auth/bank/register', (req, res, next) => {
    void (async () => {
      const body = (req.body ?? {}) as Partial<BankRegisterBody>;
      if (!body.bankName || !body.bankId || !body.password) {
        throw new ApiError('VALIDATION', 'Bank name, bank ID and password are required', 400);
      }
      if (body.password !== body.confirmPassword) {
        throw new ApiError('VALIDATION', 'Passwords do not match', 400);
      }

      const session = await repo.registerBank({
        bankName: body.bankName,
        bankId: body.bankId,
        password: body.password,
      });

      const result: BankAuthResult = {
        user: {
          id: session.user.id,
          bankId: session.user.bankId,
          bankName: session.user.bankName,
        },
        role: 'bank',
        accessToken: session.accessToken,
      };
      res.status(201).json(ok(result));
    })().catch(next);
  });

  // POST /auth/bank/login — verify bank credentials and mint a token.
  router.post('/auth/bank/login', (req, res, next) => {
    void (async () => {
      const body = (req.body ?? {}) as Partial<BankLoginBody>;
      if (!body.bankId || !body.password) {
        throw new ApiError('VALIDATION', 'Bank ID and password are required', 400);
      }

      const session = await repo.authenticateBank(body.bankId, body.password);

      const result: BankAuthResult = {
        user: {
          id: session.user.id,
          bankId: session.user.bankId,
          bankName: session.user.bankName,
        },
        role: 'bank',
        accessToken: session.accessToken,
      };
      res.json(ok(result));
    })().catch(next);
  });

  return router;
}
