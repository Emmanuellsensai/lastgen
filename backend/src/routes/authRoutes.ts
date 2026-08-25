import { Router } from 'express';
import type { Env } from '../config/env.js';
import { DEMO_BUSINESS_ID } from '../data/seed.js';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';

// Auth routes. In demo mode these are thin shims that return hardcoded
// responses so the frontend auth flow works without Supabase. In live mode
// the frontend uses Supabase directly for login/register; these routes are
// still mounted to provide /me/session for business resolution.

export function createAuthRouter(repo: Repository, env: Env): Router {
  const router = Router();

  // POST /auth/login — demo-only shim. Live mode uses Supabase directly.
  router.post('/auth/login', (req, res, next) => {
    void (async () => {
      if (!env.demoMode) {
        throw new ApiError('NOT_FOUND', 'Use Supabase for authentication in live mode', 404);
      }
      const body = (req.body ?? {}) as { email?: string; password?: string };
      if (!body.email || !body.password) {
        throw new ApiError('VALIDATION', 'Email and password are required', 400);
      }

      // In demo mode, resolve the business for the demo user
      const business = await repo.businessForOwner('demo-user');

      res.json(ok({
        user: { id: 'demo-user', email: body.email, fullName: 'Adaeze Okafor' },
        role: 'owner' as const,
        businessId: business?.id ?? DEMO_BUSINESS_ID,
        accessToken: 'demo-token-xxx',
      }));
    })().catch(next);
  });

  // POST /auth/register — demo-only shim.
  router.post('/auth/register', (req, res, next) => {
    void (async () => {
      if (!env.demoMode) {
        throw new ApiError('NOT_FOUND', 'Use Supabase for authentication in live mode', 404);
      }
      const body = (req.body ?? {}) as { email?: string; password?: string; fullName?: string; phone?: string };
      if (!body.email || !body.password || !body.fullName) {
        throw new ApiError('VALIDATION', 'All fields are required', 400);
      }

      const business = await repo.businessForOwner('demo-user');

      res.json(ok({
        user: { id: 'demo-user-new', email: body.email, fullName: body.fullName },
        role: 'owner' as const,
        businessId: business?.id ?? DEMO_BUSINESS_ID,
        accessToken: 'demo-token-xxx',
      }));
    })().catch(next);
  });

  // POST /auth/verify-nin — KYC verification shim.
  router.post('/auth/verify-nin', (req, res, next) => {
    void (async () => {
      await new Promise((r) => setTimeout(r, 1500));
      const body = (req.body ?? {}) as { nin?: string };
      if (!body.nin || body.nin.length !== 11) {
        throw new ApiError('VALIDATION', 'NIN must be 11 digits', 400);
      }
      res.json(ok({
        verified: true,
        owner: {
          firstName: 'Adaeze',
          lastName: 'Okafor',
          dateOfBirth: '1988-04-12',
          phone: '+2348012345678',
        },
      }));
    })().catch(next);
  });

  // GET /me/session — resolve the authenticated user to their business.
  // This is the key endpoint that bridges auth (Supabase) to data (business).
  router.get('/me/session', (req, res, next) => {
    void (async () => {
      const userId = req.user?.id;
      if (!userId) {
        throw new ApiError('UNAUTHORIZED', 'Not authenticated', 401);
      }

      const business = await repo.businessForOwner(userId);
      const role = (req.query.role as string) ?? 'owner';

      res.json(ok({
        role: role === 'bank' ? 'bank' : 'owner',
        businessId: business?.id ?? null,
        name: req.user?.email ?? 'User',
      }));
    })().catch(next);
  });

  return router;
}
