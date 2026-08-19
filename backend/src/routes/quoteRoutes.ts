import { Router } from 'express';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';
import type { CreateQuoteBody } from '../types/api.js';

// Quotes: generate a financing quote for a business, read a quote by id.

export function createQuoteRouter(repo: Repository): Router {
  const router = Router();

  router.post('/businesses/:id/quote', (req, res) => {
    const quote = repo.createQuote(req.params.id, req.body as CreateQuoteBody);
    res.status(201).json(ok(quote));
  });

  router.get('/quotes/:id', (req, res) => {
    const quote = repo.getQuote(req.params.id);
    if (!quote) throw new ApiError('NOT_FOUND', 'Quote not found', 404);
    res.json(ok(quote));
  });

  return router;
}