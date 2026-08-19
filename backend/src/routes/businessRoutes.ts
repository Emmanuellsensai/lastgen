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

  router.post('/businesses', (req, res) => {
    const business = repo.createBusiness(req.body as CreateBusinessBody);
    res.status(201).json(ok(business));
  });

  router.get('/businesses/:id', (req, res) => {
    const business = repo.getBusiness(req.params.id);
    if (!business) throw new ApiError('NOT_FOUND', 'Business not found', 404);
    res.json(ok(business));
  });

  router.post(
    '/businesses/:id/receipts',
    singleFile('file'),
    asyncHandler(async (req, res) => {
      const businessId = req.params.id;
      if (!repo.getBusiness(businessId)) {
        throw new ApiError('NOT_FOUND', 'Business not found', 404);
      }
      const extraction = await extractReceipt({
        buffer: req.file?.buffer,
        mimeType: req.file?.mimetype,
        geminiApiKey: env.geminiApiKey,
      });
      const log = repo.addReceiptLog(businessId, extraction, '/img/receipts/uploaded.jpg');
      res.status(201).json(ok(log));
    }),
  );

  router.post('/businesses/:id/fuel-logs', (req, res) => {
    const businessId = req.params.id;
    if (!repo.getBusiness(businessId)) {
      throw new ApiError('NOT_FOUND', 'Business not found', 404);
    }
    const log = repo.addFuelLog(businessId, req.body as CreateFuelLogBody);
    res.status(201).json(ok(log));
  });

  router.get('/businesses/:id/burn', (req, res) => {
    const profile = repo.burnProfileFor(req.params.id);
    if (!profile) throw new ApiError('NOT_FOUND', 'Burn profile not found', 404);
    res.json(ok(profile));
  });

  return router;
}