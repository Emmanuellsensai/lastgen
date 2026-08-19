import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

// createApp assembles the Express application from a typed environment.
//
// It is a factory on purpose: index.ts wires the real runtime dependencies and
// listens, while tests can build an isolated app instance (supertest) without
// starting a server or touching root configuration.

export function createApp(env: Env, logger: Logger): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Register API routers here as they are implemented.
  app.use('/api', express.Router());

  app.use(errorHandler);

  return app;
}