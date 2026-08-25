import { Router } from 'express';
import type { Env } from '../config/env.js';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';
import { makeRequireRole } from '../middleware/auth.js';
import type { CreditFileStatus, DeclineBody } from '../types/api.js';

// Credit applications: list, detail (with recent fuel logs and schedule
// preview), approve, decline.
//
// The whole surface is the credit desk's: it reads and decides on every
// business's file. An owner asking after their own application uses
// GET /businesses/:id/application instead, which is scoped to one business.

export function createCreditRouter(repo: Repository, env: Env): Router {
  const router = Router();

  router.use(makeRequireRole(env, 'bank', 'admin'));

  router.get('/credit/applications', (req, res, next) => {
    void (async () => {
      const rawStatus = req.query.status;
      if (
        rawStatus !== undefined &&
        !['PENDING', 'APPROVED', 'DECLINED'].includes(String(rawStatus))
      ) {
        throw new ApiError('VALIDATION', 'status must be PENDING, APPROVED, or DECLINED', 400);
      }
      const status = rawStatus as CreditFileStatus | undefined;
      res.json(ok({ items: await repo.listCreditFiles(status) }));
    })().catch(next);
  });

  router.get('/credit/applications/:id', (req, res, next) => {
    void (async () => {
      const file = await repo.getCreditFile(req.params.id);
      if (!file) throw new ApiError('NOT_FOUND', 'Credit file not found', 404);
      res.json(ok(file));
    })().catch(next);
  });

  router.post('/credit/applications/:id/approve', (req, res, next) => {
    void (async () => {
      const result = await repo.approveCreditFile(req.params.id);
      res.status(201).json(ok(result));
    })().catch(next);
  });

  router.post('/credit/applications/:id/decline', (req, res, next) => {
    void (async () => {
      const body = req.body as DeclineBody;
      const file = await repo.declineCreditFile(req.params.id, body?.reason);
      res.json(ok(file));
    })().catch(next);
  });

  return router;
}
