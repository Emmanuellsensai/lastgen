import { Router } from 'express';
import type { Env } from '../config/env.js';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import { ApiError } from '../middleware/errorHandler.js';
import { extractReceipt } from '../services/visionService.js';
import type { CreateBusinessBody, CreateFuelLogBody } from '../types/api.js';
import { asyncHandler, singleFile } from './helpers.js';

// Businesses: create, read, receipt upload, manual fuel logs, burn profile.
//
// Validation and 404 handling live in the repository (ApiError with
// contract-exact codes and messages); these handlers stay thin.

export function createBusinessRouter(repo: Repository, env: Env): Router {
  const router = Router();

  router.post('/businesses', (req, res, next) => {
    void (async () => {
      const ownerId = req.user?.id ?? null;
      const business = await repo.createBusiness(req.body as CreateBusinessBody, ownerId);
      res.status(201).json(ok(business));
    })().catch(next);
  });

  router.get('/businesses/:id', (req, res, next) => {
    void (async () => {
      const business = await repo.getBusiness(req.params.id);
      if (!business) throw new ApiError('NOT_FOUND', 'Business not found', 404);
      res.json(ok(business));
    })().catch(next);
  });

  router.post(
    '/businesses/:id/receipts',
    singleFile('file'),
    asyncHandler(async (req, res) => {
      const businessId = req.params.id;
      if (!(await repo.getBusiness(businessId))) {
        throw new ApiError('NOT_FOUND', 'Business not found', 404);
      }
      const extraction = await extractReceipt({
        buffer: req.file?.buffer,
        mimeType: req.file?.mimetype,
        geminiApiKey: env.geminiApiKey,
      });
      const log = await repo.addReceiptLog(businessId, extraction, '/img/receipts/uploaded.jpg');
      res.status(201).json(ok(log));
    }),
  );

  router.post('/businesses/:id/fuel-logs', (req, res, next) => {
    void (async () => {
      const businessId = req.params.id;
      if (!(await repo.getBusiness(businessId))) {
        throw new ApiError('NOT_FOUND', 'Business not found', 404);
      }
      const log = await repo.addFuelLog(businessId, req.body as CreateFuelLogBody);
      res.status(201).json(ok(log));
    })().catch(next);
  });

  router.get('/businesses/:id/fuel-logs', (req, res, next) => {
    void (async () => {
      const businessId = req.params.id;
      if (!(await repo.getBusiness(businessId))) {
        throw new ApiError('NOT_FOUND', 'Business not found', 404);
      }
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      const logs = await repo.fuelLogsFor(businessId, limit);
      res.json(ok({ items: logs, total: logs.length }));
    })().catch(next);
  });

  router.get('/businesses/:id/summary', (req, res, next) => {
    void (async () => {
      res.json(ok(await repo.businessSummary(req.params.id)));
    })().catch(next);
  });

  router.get('/businesses/:id/application', (req, res, next) => {
    void (async () => {
      res.json(ok(await repo.applicationFor(req.params.id)));
    })().catch(next);
  });

  router.delete('/businesses/:id/fuel-logs/:logId', (req, res, next) => {
    void (async () => {
      await repo.deleteFuelLog(req.params.id, req.params.logId);
      res.json(ok({ ok: true }));
    })().catch(next);
  });

  router.get('/businesses/:id/burn', (req, res, next) => {
    void (async () => {
      const profile = await repo.burnProfileFor(req.params.id);
      if (!profile) throw new ApiError('NOT_FOUND', 'Burn profile not found', 404);
      res.json(ok(profile));
    })().catch(next);
  });

  router.get('/businesses/:id/summary', (req, res, next) => {
    void (async () => {
      if (!(await repo.getBusiness(req.params.id))) {
        throw new ApiError('NOT_FOUND', 'Business not found', 404);
      }
      const summary = await repo.businessSummary(req.params.id);
      res.json(ok(summary));
    })().catch(next);
  });

  router.delete('/businesses/:id/fuel-logs/:logId', (req, res, next) => {
    void (async () => {
      await repo.deleteFuelLog(req.params.id, req.params.logId);
      res.json(ok({ ok: true as const }));
    })().catch(next);
  });

  router.get('/businesses/:id/application', (req, res, next) => {
    void (async () => {
      if (!(await repo.getBusiness(req.params.id))) {
        throw new ApiError('NOT_FOUND', 'Business not found', 404);
      }
      const cf = await repo.creditFileForBusiness(req.params.id);
      res.json(ok(cf));
    })().catch(next);
  });

  return router;
}
