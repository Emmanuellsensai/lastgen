import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ApiError } from './errorHandler.js';

function parse(schema: ZodSchema, value: unknown, source: string) {
	const result = schema.safeParse(value);
	if (!result.success) {
		const message = result.error.errors
			.map((issue) => `${source}.${issue.path.join('.') || 'value'}: ${issue.message}`)
			.join('; ');
		throw new ApiError('VALIDATION', message, 400);
	}

	return result.data;
}

export function validateBody(schema: ZodSchema): RequestHandler {
	return (req: Request, _res: Response, next: NextFunction) => {
		req.body = parse(schema, req.body, 'body');
		next();
	};
}

export function validateQuery(schema: ZodSchema): RequestHandler {
	return (req: Request, res: Response, next: NextFunction) => {
		res.locals.validatedQuery = parse(schema, req.query, 'query');
		next();
	};
}
