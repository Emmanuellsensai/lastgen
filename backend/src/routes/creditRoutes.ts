import { Router } from 'express';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';
import type { CreditFileStatus, DeclineBody } from '../types/api.js';

// Credit applications: list, detail (with recent fuel logs and schedule
// preview), approve, decline.

export function createCreditRouter(repo: Repository): Router {
  const router = Router();

  router.get('/credit/applications', (req, res) => {
    const status = req.query.status as CreditFileStatus | undefined;
    res.json(ok({ items: repo.listCreditFiles(status) }));
  });

  router.get('/credit/applications/:id', (req, res) => {
    const file = repo.getCreditFile(req.params.id);
    if (!file) throw new ApiError('NOT_FOUND', 'Credit file not found', 404);
    res.json(ok(file));
  });

  router.post('/credit/applications/:id/approve', (req, res) => {
    const result = repo.approveCreditFile(req.params.id);
    res.status(201).json(ok(result));
  });

  router.post('/credit/applications/:id/decline', (req, res) => {
    const body = req.body as DeclineBody;
    const file = repo.declineCreditFile(req.params.id, body?.reason);
    res.json(ok(file));
  });

  return router;
}
