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
