import type { User } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { ApiError } from './errorHandler.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    next(new ApiError('UNAUTHORIZED', 'A valid bearer token is required', 401));
    return;
  }

  const { data, error } = await getSupabase().auth.getUser(token);
  if (error || !data.user) {
    next(new ApiError('UNAUTHORIZED', 'A valid bearer token is required', 401));
    return;
  }

  req.user = data.user;
  next();
}