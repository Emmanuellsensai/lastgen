import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import pino from 'pino';
import { loadEnv } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

const env = loadEnv();
const logger = pino({ level: env.logLevel });

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

app.listen(env.port, () => {
  logger.info({ port: env.port }, 'lastgen api listening');
});

export { app };
