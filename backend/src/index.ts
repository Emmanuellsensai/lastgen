import pino from 'pino';
import { loadEnv } from './config/env.js';
import { createApp } from './app.js';
import { InMemoryRepository } from './data/inMemoryRepository.js';

const env = loadEnv();
const logger = pino({ level: env.logLevel });

const app = createApp(env, logger, new InMemoryRepository());

const server = app.listen(env.port, () => {
  logger.info({ port: env.port }, 'lastgen api listening');
});

// Close cleanly on SIGINT/SIGTERM so in-flight requests finish and the process
// does not leave dangling sockets behind (Render sends SIGTERM on redeploys).
function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'error while shutting down');
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app };
