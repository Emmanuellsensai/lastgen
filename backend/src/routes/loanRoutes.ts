import { Router } from 'express';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';

// Loans: read-only in Phase 3. Payment settlement (POST /loans/:id/pay) and
// the ALAT webhook arrive with the payment work in Phase 4.

export function createLoanRouter(repo: Repository): Router {
  const router = Router();

  router.get('/loans/:id', (req, res) => {
    const loan = repo.getLoan(req.params.id);
    if (!loan) throw new ApiError('NOT_FOUND', 'Loan not found', 404);
    res.json(ok(loan));
  });

  router.get('/loans/:id/schedule', (req, res) => {
    const items = repo.scheduleFor(req.params.id);
    if (items.length === 0) throw new ApiError('NOT_FOUND', 'Schedule not found', 404);
    res.json(ok({ items }));
  });

  return router;
}