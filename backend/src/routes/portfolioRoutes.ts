import { Router } from 'express';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import type { AssetStatus, PortfolioAssetsQuery } from '../types/api.js';

// Portfolio: portfolio-level stats, the paginated asset ledger and the CSV
// export. MSW parity — status/city filters, page-based pagination (25/page),
// and an export envelope that only promises the URL, not a file.

export function createPortfolioRouter(repo: Repository): Router {
  const router = Router();

  router.get('/portfolio/stats', (_req, res) => {
    res.json(ok(repo.portfolioStats()));
  });

  router.get('/portfolio/assets', (req, res) => {
    const query: PortfolioAssetsQuery = {};
    if (req.query.status !== undefined) query.status = String(req.query.status) as AssetStatus;
    if (req.query.city !== undefined) query.city = String(req.query.city);
    if (req.query.page !== undefined) query.page = Number(req.query.page);
    res.json(ok(repo.listPortfolioAssets(query)));
  });

  router.post('/portfolio/export', (_req, res) => {
    res.json(ok(repo.exportCsv()));
  });

  return router;
}
