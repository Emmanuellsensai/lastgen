import { Router } from 'express';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';

// Loans: read-only lookups. Payment settlement (POST /loans/:id/pay) lives in
// paymentRoutes.ts and the ALAT webhook in webhookRoutes.ts.

export function createLoanRouter(repo: Repository): Router {
  const router = Router();

  router.get('/loans/:id', (req, res, next) => {
    void (async () => {
      const loan = await repo.getLoan(req.params.id);
      if (!loan) throw new ApiError('NOT_FOUND', 'Loan not found', 404);
      res.json(ok(loan));
    })().catch(next);
  });

  router.get('/loans/:id/schedule', (req, res, next) => {
    void (async () => {
      const items = await repo.scheduleFor(req.params.id);
      if (items.length === 0) throw new ApiError('NOT_FOUND', 'Schedule not found', 404);
      res.json(ok({ items }));
    })().catch(next);
  });

  router.get('/loans/:id/payments', (req, res, next) => {
    void (async () => {
      const loan = await repo.getLoan(req.params.id);
      if (!loan) throw new ApiError('NOT_FOUND', 'Loan not found', 404);
      const items = await repo.paymentsFor(req.params.id);
      res.json(ok({ items }));
    })().catch(next);
  });

  return router;
}
