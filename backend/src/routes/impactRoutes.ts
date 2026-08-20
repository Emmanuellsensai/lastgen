import { Router } from 'express';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';
import { computeWrapped } from '../services/impactEngine.js';
import type { ImpactPeriod } from '../types/api.js';

// Impact: per-business climate and savings figures and the "wrapped" year
// report. Both endpoints are fed by the single impact engine through the
// repository, so they can never disagree (impact parity review gate).

export function createImpactRouter(repo: Repository): Router {
  const router = Router();

  router.get('/businesses/:id/impact', (req, res, next) => {
    void (async () => {
      if (!(await repo.getBusiness(req.params.id))) {
        throw new ApiError('NOT_FOUND', 'Business not found', 404);
      }
      const rawPeriod = req.query.period;
      if (rawPeriod !== undefined && !['month', 'year', 'all'].includes(String(rawPeriod))) {
        throw new ApiError('VALIDATION', 'period must be month, year, or all', 400);
      }
      const period = (String(rawPeriod ?? 'month') || 'month') as ImpactPeriod;
      res.json(ok(await repo.impactFor(req.params.id, period)));
    })().catch(next);
  });

  router.get('/businesses/:id/wrapped', (req, res, next) => {
    void (async () => {
      if (!(await repo.getBusiness(req.params.id))) {
        throw new ApiError('NOT_FOUND', 'Business not found', 404);
      }
      let year: number | undefined;
      if (req.query.year !== undefined) {
        year = Number(req.query.year);
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
          throw new ApiError('VALIDATION', 'year must be a 4-digit integer year', 400);
        }
      }
      res.json(
        ok(
          computeWrapped({
            year,
            impact: await repo.impactFor(req.params.id, 'year'),
            now: await repo.now(),
          }),
        ),
      );
    })().catch(next);
  });

  return router;
}
