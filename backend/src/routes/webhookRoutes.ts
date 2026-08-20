import { Router } from 'express';
import type { PaymentAdapter } from '../adapters/paymentAdapter.js';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';

// ALAT Transaction Notification webhook. Replay-safe: settleAlatWebhook ignores
// a transactionReference it has already seen. The signature header (HMAC-SHA512
// over the raw body) is verified against the configured ALAT API key; with no
// key configured the backend is in demo mode and unsigned notifications pass.

interface AlatNotification {
  transactionReference?: string;
  amount?: number;
  narration?: string;
  accountNumber?: string;
}

export function createWebhookRouter(repo: Repository, adapter: PaymentAdapter): Router {
  const router = Router();

  router.post('/webhooks/alat', (req, res) => {
    const body = (req.body ?? {}) as AlatNotification;
    const reference = body.transactionReference;
    if (!reference) {
      throw new ApiError('VALIDATION', 'transactionReference is required', 400);
    }

    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body));
    const signature = String(req.header('signature') ?? '');
    if (!adapter.verifyWebhookSignature({ rawBody, signature })) {
      throw new ApiError('UNAUTHORIZED', 'Invalid webhook signature', 401);
    }

    const amountKobo = Math.round((body.amount ?? 0) * 100);
    repo.settleAlatWebhook(reference, amountKobo, body.narration ?? '');
    res.json(ok({ ok: true as const }));
  });

  return router;
}
