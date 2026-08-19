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

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
	req.log.error({ err: error, requestId: req.id }, 'request failed');

	if (error instanceof ApiError) {
		res.status(error.httpStatus).json(fail(error.code, error.message));
		return;
	}

	res.status(500).json(fail('INTERNAL_ERROR', 'An unexpected error occurred'));
};
