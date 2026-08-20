import { Router } from 'express';
import type { PaymentAdapter } from '../adapters/paymentAdapter.js';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';
import type { PayBody, PayResult } from '../types/api.js';

// Payments: settle a loan instalment through the active payment adapter.
//
// source='bank_account' books a PENDING payment and asks the provider to
// collect; the frontend shows the "waiting for you to approve in the ALAT
// Authenticator" state and polls GET /payments/:reference/status until the
// webhook (or simulated consent) settles it. source='wallet' debits the
// business wallet directly and settles in one shot (wired in the wallet
// milestone).
//
// The response is deliberately slim — { paymentId, platformTransactionReference,
// status } — so the frontend can render the sheet and subscribe to the
// payment.status_changed realtime channel without receiving loan internals.

async function suggestedAmount(repo: Repository, loanId: string): Promise<number> {
  const schedule = await repo.scheduleFor(loanId);
  const nextUnpaid = schedule.find((i) => !i.paidAt);
  if (nextUnpaid) return nextUnpaid.principalKobo + nextUnpaid.interestKobo;
  const loan = await repo.getLoan(loanId);
  return loan?.monthlyPaymentKobo ?? 0;
}

export function createPaymentRouter(repo: Repository, adapter: PaymentAdapter): Router {
  const router = Router();

  router.post('/loans/:id/pay', (req, res, next) => {
    // Express 4 does not forward rejected promises from async handlers, so the
    // async adapter call is wrapped and its rejection routed to the error
    // handler instead of crashing the process.
    void (async () => {
      const body = (req.body ?? {}) as PayBody;
      if (body.source !== 'wallet' && body.source !== 'bank_account') {
        throw new ApiError('VALIDATION', "source must be 'wallet' or 'bank_account'", 400);
      }
      const amountKobo = body.amountKobo ?? (await suggestedAmount(repo, req.params.id));

      if (body.source === 'wallet') {
        // Direct debit: repo checks the 402 guard and settles loan + asset in
        // the same transaction as the wallet debit.
        const result = await repo.payFromWallet(req.params.id, amountKobo);
        const walletResult: PayResult = {
          paymentId: result.payment.id,
          platformTransactionReference: null,
          status: result.payment.status,
        };
        res.json(ok(walletResult));
        return;
      }

      const reference = adapter.makeReference();
      const payment = await repo.startPayment(
        req.params.id,
        amountKobo,
        adapter.name === 'alat' ? 'ALAT' : 'SIMULATED',
        reference,
      );

      // The provider's consent flow. For the simulated adapter with
      // settleAfterMs 0 the callback settles before collect() resolves.
      const collected = await adapter.collect({ amountKobo, reference, narration: req.params.id });
      if (collected.platformTransactionReference) {
        await repo.setPaymentPlatformReference(reference, collected.platformTransactionReference);
      }
      if (
        payment.status === 'pending_authorisation' &&
        (collected.status === 'SUCCESS' || collected.status === 'authorised')
      ) {
        await repo.settlePayment(reference);
      }

      const settled = (await repo.paymentByRefOrId(payment.id))!;
      const result: PayResult = {
        paymentId: settled.id,
        platformTransactionReference: settled.platformTransactionReference ?? null,
        status: settled.status,
      };
      res.json(ok(result));
    })().catch(next);
  });

  router.get('/payments/:reference/status', (req, res, next) => {
    // Accepts the transaction reference or the payment id so the frontend can
    // poll with whatever key the pay response gave it. A still-pending payment
    // is reconciled against the provider first: a missed webhook (or a poll
    // that beat the callback) is caught by asking ALAT what happened.
    void (async () => {
      let payment = await repo.paymentByRefOrId(req.params.reference);
      if (!payment) {
        throw new ApiError('NOT_FOUND', 'Payment not found', 404);
      }

      if (payment.status === 'pending_authorisation' && adapter.pollStatus) {
        const polled = await adapter.pollStatus({ reference: payment.reference });
        if (polled.status === 'SUCCESS' || polled.status === 'authorised') {
          await repo.settlePayment(payment.reference);
        } else if (polled.status === 'FAILED') {
          await repo.failPayment(payment.reference);
        } else if (polled.status === 'EXPIRED') {
          await repo.expirePayment(payment.reference);
        }
        payment = (await repo.paymentByRefOrId(payment.id))!;
      }

      res.json(ok({ status: payment.status, payment }));
    })().catch(next);
  });

  return router;
}
