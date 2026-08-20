import { Router } from 'express';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';
import type { SuspendBody } from '../types/api.js';

// Assets: read, meter readings, suspend, restore. Suspension funnels through
// the asset state machine, which enforces the medical-flag guard and rejects
// invalid transitions with contract-exact codes.

export function createAssetRouter(repo: Repository): Router {
  const router = Router();

  router.get('/assets/:id', (req, res, next) => {
    void (async () => {
      const asset = await repo.getAsset(req.params.id);
      if (!asset) throw new ApiError('NOT_FOUND', 'Asset not found', 404);
      res.json(ok(asset));
    })().catch(next);
  });

  router.get('/assets/:id/meter', (req, res, next) => {
    void (async () => {
      const from = req.query.from === undefined ? undefined : String(req.query.from);
      const to = req.query.to === undefined ? undefined : String(req.query.to);
      if (from !== undefined && Number.isNaN(Date.parse(from))) {
        throw new ApiError('VALIDATION', 'from must be a valid ISO date string', 400);
      }
      if (to !== undefined && Number.isNaN(Date.parse(to))) {
        throw new ApiError('VALIDATION', 'to must be a valid ISO date string', 400);
      }
      res.json(ok({ items: await repo.meterReadingsFor(req.params.id, from, to) }));
    })().catch(next);
  });

  router.post('/assets/:id/suspend', (req, res, next) => {
    void (async () => {
      const body = req.body as SuspendBody;
      const asset = await repo.suspendAsset(req.params.id, body?.reason);
      res.json(ok(asset));
    })().catch(next);
  });

  router.post('/assets/:id/restore', (req, res, next) => {
    void (async () => {
      const asset = await repo.restoreAsset(req.params.id);
      res.json(ok(asset));
    })().catch(next);
  });

  return router;
}
