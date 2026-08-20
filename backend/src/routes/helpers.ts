import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { ApiError } from '../middleware/errorHandler.js';

// Small Express helpers shared by the domain routers.

/**
 * Express 4 does not forward rejected promises to the error handler, so any
 * async route (vision extraction, later the payment/webhook routes) must wrap
 * its handler here to surface ApiError the normal way.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * Single-file multipart upload bound to a field name. Multer failures (wrong
 * field, oversize file) are mapped to a contract-style VALIDATION error.
 */
export function singleFile(field: string): RequestHandler {
  const middleware = upload.single(field);
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) next(new ApiError('VALIDATION', err.message, 400));
      else next();
    });
  };
}
