import { Router } from 'express';
import type { PaymentAdapter } from '../adapters/paymentAdapter.js';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import type { PayBody } from '../types/api.js';

// Payments: settle a loan instalment through the active payment adapter. The
// repository applies the pure state machine atomically (loan + asset + next
// unpaid installment + payment ledger + audit) and throws the contract errors.

export function createPaymentRouter(repo: Repository, adapter: PaymentAdapter): Router {
  const router = Router();

  router.post('/loans/:id/pay', (req, res) => {
    const body = (req.body ?? {}) as PayBody;
    const result = repo.payLoan(
      req.params.id,
      body.amountKobo,
      'SIMULATED',
      adapter.makeReference(),
    );
    res.json(ok(result));
  });

  return router;
}