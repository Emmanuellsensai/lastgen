import { Router } from 'express';
import type { PaymentAdapter } from '../adapters/paymentAdapter.js';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';

// ALAT Transaction Notification webhook. Replay-safe: settleAlatWebhook ignores
// a transactionReference it has already seen. The signature header (HMAC-SHA512
// over the raw body) is verified against the configured ALAT API key; the ALAT
// adapter is fail-closed, so a notification without a valid signature (or with
// no key configured) is rejected.
//
// The official ALAT callback nests its fields under `data`:
//   { title, message, data: { status, narration, transactionReference,
//     platformTransactionReference, transactionStan, ... }, request,
//     requestType }
// but the MSW fixture and the demo send them at the top level, so both shapes
// are read defensively (data first, top level as fallback).

interface AlatNotification {
  transactionReference?: string;
  amount?: number;
  narration?: string;
  accountNumber?: string;
}

export function createWebhookRouter(repo: Repository, adapter: PaymentAdapter): Router {
  const router = Router();

  router.post('/webhooks/alat', (req, res, next) => {
    void (async () => {
      const body = (req.body ?? {}) as AlatNotification & { data?: AlatNotification };
      const data = body.data ?? body;
      const reference = data.transactionReference;
      if (!reference) {
        throw new ApiError('VALIDATION', 'transactionReference is required', 400);
      }

      const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body));
      const signature = String(req.header('signature') ?? '');
      if (!adapter.verifyWebhookSignature({ rawBody, signature })) {
        throw new ApiError('UNAUTHORIZED', 'Invalid webhook signature', 401);
      }

      const amountKobo = Math.round((data.amount ?? body.amount ?? 0) * 100);
      await repo.settleAlatWebhook(reference, amountKobo, data.narration ?? body.narration ?? '');
      res.json(ok({ ok: true as const }));
    })().catch(next);
  });

  return router;
}
