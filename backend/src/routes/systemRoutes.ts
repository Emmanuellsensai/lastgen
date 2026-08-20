import { Router } from 'express';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import type { SystemsQuery } from '../types/api.js';

// Solar systems catalogue, filterable by minimum capacity and maximum price.

export function createSystemRouter(repo: Repository): Router {
  const router = Router();

  router.get('/systems', (req, res, next) => {
    void (async () => {
      const query = req.query;
      const minKw = query.minKw === undefined ? undefined : Number(query.minKw);
      const maxPriceKobo =
        query.maxPriceKobo === undefined ? undefined : Number(query.maxPriceKobo);
      const items = await repo.listSystems({ minKw, maxPriceKobo } satisfies SystemsQuery);
      res.json(ok({ items }));
    })().catch(next);
  });

  return router;
}
