import pino from 'pino';
import { loadEnv } from './config/env.js';
import { createApp } from './app.js';

const env = loadEnv();
const logger = pino({ level: env.logLevel });

const app = createApp(env, logger);

app.listen(env.port, () => {
  logger.info({ port: env.port }, 'lastgen api listening');
});

export { app };