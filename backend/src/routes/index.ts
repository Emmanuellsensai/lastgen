import { Router } from 'express';
import type { Env } from '../config/env.js';
import type { Repository } from '../data/repository.js';
import { makeRequireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { createAssetRouter } from './assetRoutes.js';
import { createBusinessRouter } from './businessRoutes.js';
import { createCreditRouter } from './creditRoutes.js';
import { createLoanRouter } from './loanRoutes.js';
import { createQuoteRouter } from './quoteRoutes.js';
import { createSystemRouter } from './systemRoutes.js';

// Assembles the /api surface from the domain routers. Mounted by createApp;
// every phase adds its routers here in dependency order.

export function apiRouter(repo: Repository, env: Env): Router {
  const router = Router();

  router.use(makeRequireAuth(env));
  router.use(createBusinessRouter(repo, env));
  router.use(createSystemRouter(repo));
  router.use(createQuoteRouter(repo));
  router.use(createCreditRouter(repo));
  router.use(createAssetRouter(repo));
  router.use(createLoanRouter(repo));

  // Contract JSON 404 instead of Express's HTML fallback.
  router.use((_req, _res, next) => next(new ApiError('NOT_FOUND', 'Route not found', 404)));

  return router;
}