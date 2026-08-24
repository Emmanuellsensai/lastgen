import { Router } from 'express';
import { paymentAdapterFor } from '../adapters/factory.js';
import type { Env } from '../config/env.js';
import type { Repository } from '../data/repository.js';
import { getSupabase } from '../lib/supabase.js';
import { makeRequireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { kycStorageFor } from '../services/kycStorage.js';
import { ninProviderFor } from '../services/ninVerification.js';
import { createAuthRouter } from './authRoutes.js';
import { createAssetRouter } from './assetRoutes.js';
import { createBankAuthRouter } from './bankAuthRoutes.js';
import { createBusinessRouter } from './businessRoutes.js';
import { createCreditRouter } from './creditRoutes.js';
import { createDemoRouter } from './demoRoutes.js';
import { createImpactRouter } from './impactRoutes.js';
import { createKycRouter } from './kycRoutes.js';
import { createLoanRouter } from './loanRoutes.js';
import { createPaymentRouter } from './paymentRoutes.js';
import { createPortfolioRouter } from './portfolioRoutes.js';
import { createQuoteRouter } from './quoteRoutes.js';
import { createSystemRouter } from './systemRoutes.js';
import { createWalletRouter } from './walletRoutes.js';
import { createWebhookRouter } from './webhookRoutes.js';

// Assembles the /api surface from the domain routers. Mounted by createApp;
// every phase adds its routers here in dependency order.

export function apiRouter(repo: Repository, env: Env): Router {
  const router = Router();
  const adapter = paymentAdapterFor(env, {
    // The simulated adapter's in-process consent completes through the same
    // repository settle path the ALAT webhook uses.
    settle: async (reference) => {
      await repo.settlePayment(reference);
    },
  });

  // Provider callbacks run BEFORE the auth boundary: ALAT signs its own
  // notifications and is never asked for a Lastgen bearer token.
  router.use(createWebhookRouter(repo, adapter));

  // Bank registration and login also run BEFORE the auth boundary: a caller
  // cannot present a bearer token it does not have yet.
  router.use(createBankAuthRouter(repo, env));

  // Demo controls are unauthenticated (per the contract) but only exist in
  // demo mode; live deployments simply never mount this router.
  if (env.demoMode) {
    router.use(createDemoRouter(repo));
  }

  router.use(makeRequireAuth(env));
  router.use(createAuthRouter(repo, env));
  router.use(createBusinessRouter(repo, env));
  // KYC needs the NIN provider and document storage seams; the Supabase
  // client resolves lazily per upload so composition stays credential-free.
  router.use(
    createKycRouter(repo, env, {
      ninProvider: ninProviderFor(env.ninProvider),
      kycStorage: kycStorageFor(env, () => getSupabase()),
    }),
  );
  router.use(createSystemRouter(repo));
  router.use(createQuoteRouter(repo));
  router.use(createCreditRouter(repo));
  router.use(createAssetRouter(repo));
  router.use(createLoanRouter(repo));
  router.use(createPaymentRouter(repo, adapter, env));
  router.use(createWalletRouter(repo, env));
  router.use(createPortfolioRouter(repo));
  router.use(createImpactRouter(repo));

  // Contract JSON 404 instead of Express's HTML fallback.
  router.use((_req, _res, next) => next(new ApiError('NOT_FOUND', 'Route not found', 404)));

  return router;
}
