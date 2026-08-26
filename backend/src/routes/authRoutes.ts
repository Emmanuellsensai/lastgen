import { Router } from 'express';
import type { Env } from '../config/env.js';
import { DEMO_BUSINESS_ID } from '../data/seed.js';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { getSupabaseAuthOnly } from '../lib/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';

// Auth routes. In demo mode these are thin shims that return hardcoded
// responses so the frontend auth flow works without Supabase. In live mode
// the backend proxies Supabase auth so the frontend keeps using the same
// API contract regardless of mode.

// Public (pre-auth-boundary) router: login and register do not require a
// bearer token — they are the endpoints that produce one.
export function createPublicAuthRouter(repo: Repository, env: Env): Router {
  const router = Router();

  // POST /auth/login — demo shim or live Supabase password grant.
  router.post('/auth/login', (req, res, next) => {
    void (async () => {
      const body = (req.body ?? {}) as { email?: string; password?: string };
      if (!body.email || !body.password) {
        throw new ApiError('VALIDATION', 'Email and password are required', 400);
      }

      if (env.demoMode) {
        const business = await repo.businessForOwner('demo-user');
        res.json(
          ok({
            user: { id: 'demo-user', email: body.email, fullName: 'Adaeze Okafor' },
            role: 'owner' as const,
            businessId: business?.id ?? DEMO_BUSINESS_ID,
            accessToken: 'demo-token-xxx',
          }),
        );
        return;
      }

      // Live mode: real Supabase password grant via the auth-only client
      // (signInWithPassword must not pollute the service-role client).
      const { data, error } = await getSupabaseAuthOnly().auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });
      if (error || !data.session) {
        throw new ApiError('UNAUTHORIZED', 'Invalid email or password', 401);
      }

      let business = await repo.businessForOwner(data.user.id);
      // Recover orphaned accounts: auth user exists but DB business was never
      // written (e.g. a previous register attempt 500'd mid-flight). Create it
      // silently so the owner can continue instead of landing on a blank dashboard.
      if (!business) {
        const fullName = (data.user.user_metadata?.fullName as string) ?? data.user.email ?? '';
        business = await repo.createBusiness(
          { name: `${fullName}'s Business`, type: 'Business', city: 'Lagos' },
          data.user.id,
        ).catch(() => undefined);
      }

      res.json(
        ok({
          user: {
            id: data.user.id,
            email: data.user.email ?? body.email,
            fullName: (data.user.user_metadata?.fullName as string) ?? data.user.email ?? '',
          },
          role: 'owner' as const,
          businessId: business?.id ?? null,
          accessToken: data.session.access_token,
        }),
      );
    })().catch(next);
  });

  // POST /auth/register — demo shim or live Supabase user creation.
  router.post('/auth/register', (req, res, next) => {
    void (async () => {
      const body = (req.body ?? {}) as {
        email?: string;
        password?: string;
        fullName?: string;
        phone?: string;
      };
      if (!body.email || !body.password || !body.fullName) {
        throw new ApiError('VALIDATION', 'All fields are required', 400);
      }

      if (env.demoMode) {
        const business = await repo.businessForOwner('demo-user');
        res.json(
          ok({
            user: { id: 'demo-user-new', email: body.email, fullName: body.fullName },
            role: 'owner' as const,
            businessId: business?.id ?? DEMO_BUSINESS_ID,
            accessToken: 'demo-token-xxx',
          }),
        );
        return;
      }

      // Live mode: create a Supabase auth user, provision a business, mint
      // a real JWT. The auth-only client keeps signInWithPassword away from
      // the service-role client used for all database queries.
      const auth = getSupabaseAuthOnly();

      const { data: created, error: createErr } = await auth.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { fullName: body.fullName, phone: body.phone ?? '' },
      });
      if (createErr || !created.user) {
        const msg = createErr?.message ?? 'Registration failed';
        // GoTrue returns a generic 422 on duplicate email — map to our contract.
        if (msg.toLowerCase().includes('already')) {
          throw new ApiError('VALIDATION', 'Email already registered', 400);
        }
        throw new ApiError('DATABASE_ERROR', msg, 500);
      }

      // Create a business linked to the new owner.
      // If this fails, delete the orphaned Supabase auth user so the person
      // can retry with the same email instead of getting stuck on 400.
      let business;
      try {
        business = await repo.createBusiness(
          {
            name: `${body.fullName}'s Business`,
            type: 'Business',
            city: 'Lagos',
          },
          created.user.id,
        );
      } catch (bizErr) {
        await auth.auth.admin.deleteUser(created.user.id).catch(() => {});
        throw bizErr;
      }

      // Mint a real access token through the Supabase auth grant.
      // If sign-in fails (e.g. email confirmation still pending), return
      // success anyway so the user can log in on the next screen.
      const { data: session } = await auth.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });

      res.status(201).json(
        ok({
          user: {
            id: created.user.id,
            email: created.user.email ?? body.email,
            fullName: body.fullName,
          },
          role: 'owner' as const,
          businessId: business.id,
          accessToken: session?.session?.access_token ?? '',
        }),
      );
    })().catch(next);
  });

  return router;
}

// Authenticated router: routes that require a valid bearer token.
export function createAuthRouter(repo: Repository, _env: Env): Router {
  const router = Router();

  // POST /auth/verify-nin — KYC verification shim.
  router.post('/auth/verify-nin', (req, res, next) => {
    void (async () => {
      await new Promise((r) => setTimeout(r, 1500));
      const body = (req.body ?? {}) as { nin?: string };
      if (!body.nin || body.nin.length !== 11) {
        throw new ApiError('VALIDATION', 'NIN must be 11 digits', 400);
      }
      res.json(
        ok({
          verified: true,
          owner: {
            firstName: 'Adaeze',
            lastName: 'Okafor',
            dateOfBirth: '1988-04-12',
            phone: '+2348012345678',
          },
        }),
      );
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

      res.json(
        ok({
          role: role === 'bank' ? 'bank' : 'owner',
          businessId: business?.id ?? null,
          name: req.user?.email ?? 'User',
        }),
      );
    })().catch(next);
  });

  return router;
}
