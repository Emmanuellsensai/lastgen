import type { User } from '@supabase/supabase-js';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Env } from '../config/env.js';
import { getSupabase } from '../lib/supabase.js';
import { ApiError } from './errorHandler.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      /** Raw JSON body, captured by the express.json verify hook for webhook signing. */
      rawBody?: Buffer;
    }
  }
}

const DEMO_USER = { id: 'demo-user', email: 'demo@lastgen.local' } as User;

/** API roles, mirroring UserRole in types/api.ts. */
export type Role = 'owner' | 'bank' | 'admin';

/**
 * Authentication boundary. In demo mode the whole API is unauthenticated so
 * the frontend can run the full flow without signing in; in live mode a valid
 * Supabase bearer token is required.
 */
export function makeRequireAuth(env: Pick<Env, 'demoMode'>): RequestHandler {
  if (env.demoMode) {
    return (req, _res, next) => {
      req.user = DEMO_USER;
      next();
    };
  }
  return requireAuth;
}

async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    next(new ApiError('UNAUTHORIZED', 'A valid bearer token is required', 401));
    return;
  }

  try {
    const { data, error } = await getSupabase().auth.getUser(token);
    if (error || !data.user) {
      next(new ApiError('UNAUTHORIZED', 'A valid bearer token is required', 401));
      return;
    }
    req.user = data.user;
    next();
  } catch {
    // Missing or expired Supabase credentials: live auth is not yet wired.
    // Fail closed with the same contract error instead of hanging the request
    // (Express 4 does not forward rejected promises) or leaking internals.
    next(new ApiError('UNAUTHORIZED', 'A valid bearer token is required', 401));
  }
}

/**
 * Authorization gate for role-scoped surfaces (the bank/admin desk).
 *
 * Demo mode permits every caller — consistent with the demo philosophy that
 * the whole API runs unauthenticated so the full flow works without Supabase.
 * Live mode requires an authenticated user whose Supabase app_metadata.role
 * is one of the allowed roles; app_metadata is server-only, so a client
 * cannot escalate itself by editing user metadata.
 *
 * FORBIDDEN (403) is an additive extension of the contract error table:
 * UNAUTHORIZED would be wrong — the caller IS authenticated, just not allowed.
 */
export function makeRequireRole(env: Pick<Env, 'demoMode'>, ...allowed: Role[]): RequestHandler {
  if (env.demoMode) {
    return (_req, _res, next) => next();
  }
  return (req, _res, next) => {
    if (!req.user) {
      // Only reachable if mounted before requireAuth — fail closed loudly.
      next(new ApiError('UNAUTHORIZED', 'A valid bearer token is required', 401));
      return;
    }
    const role = req.user.app_metadata?.role as Role | undefined;
    if (!role || !allowed.includes(role)) {
      next(new ApiError('FORBIDDEN', 'You do not have access to this resource', 403));
      return;
    }
    next();
  };
}
