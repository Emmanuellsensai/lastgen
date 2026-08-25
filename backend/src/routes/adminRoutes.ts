import { Router } from 'express';
import type { Env } from '../config/env.js';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { makeRequireRole } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import type { KycStatus, LoanStatus } from '../types/api.js';

// The bank/admin credit desk.
//
// Every route here sits behind makeRequireRole('bank', 'admin'): demo mode
// is permissive like the rest of the demo surface, live mode demands the
// server-assigned role claim. Behaviour source: handlers.ts adminHandlers +
// kycHandlers (lines 844–1004), hardened where the mock is loose — power
// control routes through the asset state machine so OWNED assets and
// medical-flagged businesses are protected, and payment approval settles
// through the atomic payLoan path instead of a hand-rolled ledger write.

const KYC_STATUSES: readonly KycStatus[] = ['unverified', 'pending', 'approved', 'rejected'];
const LOAN_STATUSES: readonly LoanStatus[] = ['ACTIVE', 'DELINQUENT'];

function parseKycStatus(raw: unknown): KycStatus | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (!KYC_STATUSES.includes(String(raw) as KycStatus)) {
    throw new ApiError('VALIDATION', `status must be one of ${KYC_STATUSES.join(', ')}`, 400);
  }
  return String(raw) as KycStatus;
}

function parseLoanStatus(raw: unknown): LoanStatus | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (!LOAN_STATUSES.includes(String(raw) as LoanStatus)) {
    throw new ApiError('VALIDATION', 'status must be ACTIVE or DELINQUENT', 400);
  }
  return String(raw) as LoanStatus;
}

export function createAdminRouter(repo: Repository, env: Env): Router {
  const router = Router();
  router.use(makeRequireRole(env, 'bank', 'admin'));

  // GET /admin/users — Users tab projection.
  router.get('/admin/users', (_req, res, next) => {
    void (async () => {
      res.json(ok({ items: await repo.listAdminUsers() }));
    })().catch(next);
  });

  // GET /admin/kyc?status= — review queue.
  router.get('/admin/kyc', (req, res, next) => {
    void (async () => {
      const items = await repo.listKycSubmissions(parseKycStatus(req.query.status));
      res.json(ok({ items }));
    })().catch(next);
  });

  // POST /admin/kyc/:id/approve — clear a pending submission.
  router.post('/admin/kyc/:id/approve', (req, res, next) => {
    void (async () => {
      res.json(ok(await repo.reviewKyc(String(req.params.id), 'approve')));
    })().catch(next);
  });

  // POST /admin/kyc/:id/reject — reject with a mandatory reason.
  router.post('/admin/kyc/:id/reject', (req, res, next) => {
    void (async () => {
      const reason = String((req.body ?? {}).reason ?? '').trim();
      if (!reason) {
        throw new ApiError('VALIDATION', 'reason is required to reject a submission', 400);
      }
      res.json(ok(await repo.reviewKyc(String(req.params.id), 'reject', reason)));
    })().catch(next);
  });

  // POST /admin/assets/:id/toggle-power — suspend/restore via the state machine.
  router.post('/admin/assets/:id/toggle-power', (req, res, next) => {
    void (async () => {
      const asset = await repo.getAsset(String(req.params.id));
      if (!asset) throw new ApiError('NOT_FOUND', 'Asset not found', 404);
      if (asset.status === 'OWNED') {
        throw new ApiError('INVALID_TRANSITION', 'An owned asset cannot be suspended', 409);
      }

      // Delegating to the repository keeps every frozen invariant intact:
      // medical-flagged businesses throw MEDICAL_FLAG and owned assets
      // refuse suspension with INVALID_TRANSITION.
      const next =
        asset.status === 'ACTIVE'
          ? await repo.suspendAsset(asset.id, 'admin-toggle')
          : await repo.restoreAsset(asset.id);
      res.json(ok({ id: next.id, status: next.status }));
    })().catch(next);
  });

  // GET /admin/orders?status= — active loans with business/asset context.
  router.get('/admin/orders', (req, res, next) => {
    void (async () => {
      const items = await repo.listAdminOrders(parseLoanStatus(req.query.status));
      res.json(ok({ items }));
    })().catch(next);
  });

  // POST /admin/loans/:id/approve-payment — settle one installment manually.
  router.post('/admin/loans/:id/approve-payment', (req, res, next) => {
    void (async () => {
      const loan = await repo.getLoan(String(req.params.id));
      if (!loan) throw new ApiError('NOT_FOUND', 'Loan not found', 404);
      if (loan.status === 'CLOSED') {
        throw new ApiError('INVALID_TRANSITION', 'This loan is already closed', 409);
      }

      // Atomic settlement: loan + asset + installment + ledger + audit move
      // together, exactly like every other payment entry path.
      const settlement = await repo.payLoan(
        loan.id,
        loan.monthlyPaymentKobo,
        'SIMULATED',
        `ADMIN-${Date.now()}`,
      );
      res.json(ok({ paymentId: settlement.payment.id, status: settlement.payment.status }));
    })().catch(next);
  });

  return router;
}
