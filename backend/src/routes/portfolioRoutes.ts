import { Router } from 'express';
import type { Repository } from '../data/repository.js';
import { ok } from '../lib/envelope.js';
import type { AssetStatus, PortfolioAssetsQuery } from '../types/api.js';

// Portfolio: portfolio-level stats, the paginated asset ledger and the CSV
// export. MSW parity — status/city filters, page-based pagination (25/page),
// and an export envelope that only promises the URL, not a file.

export function createPortfolioRouter(repo: Repository): Router {
  const router = Router();

  router.get('/portfolio/stats', (_req, res, next) => {
    void (async () => {
      res.json(ok(await repo.portfolioStats()));
    })().catch(next);
  });

  router.get('/portfolio/assets', (req, res, next) => {
    void (async () => {
      const query: PortfolioAssetsQuery = {};
      if (req.query.status !== undefined) query.status = String(req.query.status) as AssetStatus;
      if (req.query.city !== undefined) query.city = String(req.query.city);
      if (req.query.page !== undefined) query.page = Number(req.query.page);
      res.json(ok(await repo.listPortfolioAssets(query)));
    })().catch(next);
  });

  router.post('/portfolio/export', (_req, res, next) => {
    void (async () => {
      res.json(ok(await repo.exportCsv()));
    })().catch(next);
  });

  router.get('/exports/:filename', (req, res, next) => {
    void (async () => {
      const filename = req.params.filename;
      if (!filename.startsWith('lastgen-portfolio-') || !filename.endsWith('.csv')) {
        res.status(404).send('Export file not found');
        return;
      }
      const pageResult = await repo.listPortfolioAssets({ page: 1 });
      const assets = pageResult.items;
      const header = 'id,serial,controllerId,status,city,installedAt\n';
      const rows = assets
        .map(
          (a) =>
            `${a.id},${a.serial},${a.controllerId},${a.status},${a.city ?? ''},${a.installedAt}`,
        )
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(header + rows);
    })().catch(next);
  });

  return router;
}
