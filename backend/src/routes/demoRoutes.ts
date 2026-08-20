import { Router } from 'express';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import type { AdvanceTimeBody, MissPaymentBody } from '../types/api.js';

// Demo controls: reset the demo clock, roll it forward, and simulate a missed
// payment. These drive the real state machine (overdue roll-forward honours the
// medical-flag guard) and exist only in demo mode — the router is only mounted
// when DEMO_MODE=true, so live deployments never expose them.

export function createDemoRouter(repo: Repository): Router {
  const router = Router();

  router.post('/demo/reset', (_req, res) => {
    repo.reset();
    res.json(ok({ ok: true }));
  });

  router.post('/demo/advance-time', (req, res) => {
    const body = (req.body ?? {}) as AdvanceTimeBody;
    repo.advanceTime(body.days);
    res.json(ok({ ok: true }));
  });

  router.post('/demo/miss-payment', (req, res) => {
    const body = (req.body ?? {}) as MissPaymentBody;
    res.json(ok(repo.missPayment(body.loanId)));
  });

  return router;
}
