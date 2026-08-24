import { Router, type Request } from 'express';
import type { Env } from '../config/env.js';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';
import type { KycRecord } from '../types/api.js';
import type { KycStorage } from '../services/kycStorage.js';
import type { NinProvider } from '../services/ninVerification.js';
import { fileFields } from './helpers.js';

// Business identity verification (KYC).
//
// Lifecycle: unverified → pending → approved | rejected. Submission stores
// the NIN plus two documents (bank slip, selfie), verifies the NIN format
// through the provider seam, and parks the record in pending for the bank's
// admin desk (Phase 10 adds the review endpoints). An approved record is
// immutable — resubmission would silently reopen a reviewed identity.
//
// Authz: owners may only see and submit their own business's KYC. Demo mode
// trusts the single demo owner, matching the wallet router.

/** Synthesized pre-submission projection, MSW-parity (`handlers.ts` line 907). */
function unverifiedRecord(businessId: string): KycRecord {
  return {
    id: `kyc_${businessId}`,
    businessId,
    userId: '',
    status: 'unverified',
    submittedAt: null,
    reviewedAt: null,
    rejectionReason: null,
    selfieUrl: null,
    bankSlipUrl: null,
    ninNumber: null,
    ninVerified: false,
  };
}

async function requireOwnedBusiness(
  req: Request,
  repo: Repository,
  env: Env,
  businessId: string,
): Promise<void> {
  if (env.demoMode) return;
  const owned = await repo.businessForOwner(req.user?.id ?? '');
  if (!owned || owned.id !== businessId) {
    throw new ApiError('FORBIDDEN', 'You do not own this business', 403);
  }
}

export function createKycRouter(
  repo: Repository,
  env: Env,
  services: { ninProvider: NinProvider; kycStorage: KycStorage },
): Router {
  const router = Router();

  // GET /businesses/:id/kyc — current verification state.
  router.get('/businesses/:id/kyc', (req, res, next) => {
    void (async () => {
      await requireOwnedBusiness(req, repo, env, String(req.params.id));
      const record = await repo.kycRecordFor(String(req.params.id));
      res.json(ok(record ?? unverifiedRecord(String(req.params.id))));
    })().catch(next);
  });

  // POST /businesses/:id/kyc/submit — multipart: ninNumber + bankSlip + selfie.
  router.post(
    '/businesses/:id/kyc/submit',
    fileFields([
      { name: 'bankSlip', maxCount: 1 },
      { name: 'selfie', maxCount: 1 },
    ]),
    (req, res, next) => {
      void (async () => {
        const businessId = String(req.params.id);
        const ninNumber = String((req.body as { ninNumber?: string })?.ninNumber ?? '');

        const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
        const slip = files.bankSlip?.[0];
        const selfie = files.selfie?.[0];
        if (!slip || !selfie) {
          throw new ApiError('VALIDATION', 'bankSlip and selfie files are required', 400);
        }
        if (!/^image\//.test(selfie.mimetype)) {
          throw new ApiError('VALIDATION', 'selfie must be an image', 400);
        }
        if (!(/image\//.test(slip.mimetype) || slip.mimetype === 'application/pdf')) {
          throw new ApiError('VALIDATION', 'bankSlip must be an image or a PDF', 400);
        }

        await requireOwnedBusiness(req, repo, env, businessId);

        // Provider seam: throws VALIDATION on a malformed NIN; the simulated
        // provider passes after the format check until NIMC is wired.
        const verification = await services.ninProvider.verify(ninNumber);

        const bankSlipUrl = await services.kycStorage.store(businessId, {
          field: 'bankSlip',
          mimetype: slip.mimetype,
          buffer: slip.buffer,
        });
        const selfieUrl = await services.kycStorage.store(businessId, {
          field: 'selfie',
          mimetype: selfie.mimetype,
          buffer: selfie.buffer,
        });

        const record = await repo.submitKyc(businessId, {
          userId: req.user?.id,
          ninNumber,
          ninVerified: verification.verified,
          bankSlipUrl,
          selfieUrl,
        });
        res.status(201).json(ok(record));
      })().catch(next);
    },
  );

  return router;
}
