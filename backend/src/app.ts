import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Env } from './config/env.js';
import type { Repository } from './data/repository.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';

// createApp assembles the Express application from a typed environment and the
// active repository.
//
// It is a factory on purpose: index.ts wires the real runtime dependencies and
// listens, while tests can build an isolated app instance (supertest) without
// starting a server or touching root configuration.

export function createApp(env: Env, logger: Logger, repository: Repository): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins }));

  // Logging first so request-scoped logging exists before body parsing runs.
  // A malformed or oversized JSON body throws inside express.json; if that
  // middleware ran first, the error handler would find no req.log.
  app.use(pinoHttp({ logger }));

  app.use(
    express.json({
      // Preserve the raw body so the ALAT webhook can verify its HMAC-SHA512
      // signature over the exact bytes the provider signed.
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', apiRouter(repository, env));

  app.use(errorHandler);

  return app;
}
