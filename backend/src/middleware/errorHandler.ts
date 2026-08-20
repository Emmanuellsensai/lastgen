import type { ErrorRequestHandler } from 'express';
import { fail } from '../lib/envelope.js';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

/** Maps body-parser failures (bad or oversized JSON) onto contract errors. */
function bodyParserError(
  error: BodyParserError,
): { code: string; message: string; status: number } | undefined {
  if (error.type === 'entity.parse.failed') {
    return { code: 'VALIDATION', message: 'Invalid JSON body', status: 400 };
  }
  if (error.type === 'entity.too.large') {
    return {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body exceeds the 100kb limit',
      status: 413,
    };
  }
  return undefined;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  req.log?.error({ err: error, requestId: req.id }, 'request failed');

  if (error instanceof ApiError) {
    res.status(error.httpStatus).json(fail(error.code, error.message));
    return;
  }

  const mapped = bodyParserError(error);
  if (mapped) {
    res.status(mapped.status).json(fail(mapped.code, mapped.message));
    return;
  }

  res.status(500).json(fail('INTERNAL_ERROR', 'An unexpected error occurred'));
};
