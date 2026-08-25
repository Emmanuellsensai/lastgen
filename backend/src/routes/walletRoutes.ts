import { Router, type Request } from 'express';
import { DEMO_WALLET_FUNDING_KOBO } from '../config/constants.js';
import type { Env } from '../config/env.js';
import { DEMO_BUSINESS_ID } from '../data/seed.js';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';
import type { CreateWalletBody } from '../types/api.js';

// Business cash wallets. The wallet is a KYC'd virtual account (bank code 035);
// creating it in demo mode opens it pre-funded so the audience can demo a
// wallet payment immediately. Live wallets open at zero and are funded by
// external transfer to the account number.
//
// Authz invariant: balance/statement resolve the business from req.user (demo
// maps demo-user to the seeded demo business; live resolves the owner_id), and
// create requires ownership of the target business — no cross-user access.

async function resolveBusinessId(req: Request, repo: Repository, env: Env): Promise<string> {
  if (env.demoMode) return DEMO_BUSINESS_ID;
  const business = await repo.businessForOwner(req.user?.id ?? '');
  if (!business) throw new ApiError('NOT_FOUND', 'No business is linked to this user', 404);
  return business.id;
}

export function createWalletRouter(repo: Repository, env: Env): Router {
  const router = Router();

  router.post('/wallets/create', (req, res, next) => {
    void (async () => {
      const body = (req.body ?? {}) as CreateWalletBody;
      if (!body.businessId) {
        throw new ApiError('VALIDATION', 'businessId is required', 400);
      }
      // Live mode enforces ownership; demo mode trusts the single demo owner.
      if (!env.demoMode) {
        const owned = await repo.businessForOwner(req.user?.id ?? '');
        if (owned?.id !== body.businessId) {
          throw new ApiError('FORBIDDEN', 'You do not own this business', 403);
        }
      }

      const wallet = await repo.createWallet(body.businessId, body);
      if (env.demoMode) {
        await repo.creditWallet(
          wallet.id,
          DEMO_WALLET_FUNDING_KOBO,
          'Demo wallet opening credit',
          `WLT-FUND-${Date.now()}`,
          'funding',
        );
      }
      const fresh = await repo.walletForBusiness(wallet.businessId);
      res.json(ok(fresh ?? wallet));
    })().catch(next);
  });

  router.get('/wallets/balance', (req, res, next) => {
    void (async () => {
      const businessId = await resolveBusinessId(req, repo, env);
      const wallet = await repo.walletForBusiness(businessId);
      if (!wallet) throw new ApiError('NOT_FOUND', 'Wallet not found', 404);
      res.json(ok(wallet));
    })().catch(next);
  });

  router.post('/wallets/fund', (req, res, next) => {
    void (async () => {
      const businessId = await resolveBusinessId(req, repo, env);
      const wallet = await repo.walletForBusiness(businessId);
      if (!wallet) throw new ApiError('NOT_FOUND', 'Wallet not found', 404);

      const body = (req.body ?? {}) as { amountKobo?: number };
      const amount = Math.round(body.amountKobo ?? 0);
      if (amount <= 0) {
        throw new ApiError('VALIDATION', 'amountKobo must be greater than zero', 400);
      }
      if (amount > 50_000_000) {
        throw new ApiError('VALIDATION', 'Maximum single funding is ₦500,000', 400);
      }

      // Simulate a bank transfer: credit the wallet with an IN transaction.
      const reference = `TRF-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const funded = await repo.creditWallet(
        wallet.id,
        amount,
        `Bank transfer from ${wallet.accountNumber}`,
        reference,
        'funding',
      );
      res.json(ok(funded));
    })().catch(next);
  });

  router.get('/wallets/statement', (req, res, next) => {
    void (async () => {
      const businessId = await resolveBusinessId(req, repo, env);
      const wallet = await repo.walletForBusiness(businessId);
      if (!wallet) throw new ApiError('NOT_FOUND', 'Wallet not found', 404);

      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const before = typeof req.query.before === 'string' ? req.query.before : undefined;
      const items = await repo.walletStatement(wallet.id, { limit, before });
      res.json(ok({ items }));
    })().catch(next);
  });

  return router;
}
