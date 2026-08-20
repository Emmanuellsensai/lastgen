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

function resolveBusinessId(req: Request, repo: Repository, env: Env): string {
  if (env.demoMode) return DEMO_BUSINESS_ID;
  const business = repo.businessForOwner(req.user?.id ?? '');
  if (!business) throw new ApiError('NOT_FOUND', 'No business is linked to this user', 404);
  return business.id;
}

export function createWalletRouter(repo: Repository, env: Env): Router {
  const router = Router();

  router.post('/wallets/create', (req, res) => {
    const body = (req.body ?? {}) as CreateWalletBody;
    if (!body.businessId) {
      throw new ApiError('VALIDATION', 'businessId is required', 400);
    }
    // Live mode enforces ownership; demo mode trusts the single demo owner.
    if (!env.demoMode) {
      const owned = repo.businessForOwner(req.user?.id ?? '');
      if (owned?.id !== body.businessId) {
        throw new ApiError('FORBIDDEN', 'You do not own this business', 403);
      }
    }

    const wallet = repo.createWallet(body.businessId, body);
    if (env.demoMode) {
      repo.creditWallet(
        wallet.id,
        DEMO_WALLET_FUNDING_KOBO,
        'Demo wallet opening credit',
        `WLT-FUND-${Date.now()}`,
        'funding',
      );
    }
    res.json(ok({ wallet: repo.walletForBusiness(wallet.businessId) ?? wallet }));
  });

  router.get('/wallets/balance', (req, res) => {
    const businessId = resolveBusinessId(req, repo, env);
    const wallet = repo.walletForBusiness(businessId);
    if (!wallet) throw new ApiError('NOT_FOUND', 'Wallet not found', 404);
    res.json(ok(wallet));
  });

  router.get('/wallets/statement', (req, res) => {
    const businessId = resolveBusinessId(req, repo, env);
    const wallet = repo.walletForBusiness(businessId);
    if (!wallet) throw new ApiError('NOT_FOUND', 'Wallet not found', 404);

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const items = repo.walletStatement(wallet.id, { limit, before });
    res.json(ok({ items }));
  });

  return router;
}
