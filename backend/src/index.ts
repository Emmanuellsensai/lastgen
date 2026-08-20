import pino from 'pino';
import { loadEnv } from './config/env.js';
import { createApp } from './app.js';
import { repositoryFor } from './data/repositoryFor.js';

// Honor a local .env (backend/.env) so the documented setup works as-is:
//   cp .env.example .env
// Node loads it into process.env before loadEnv() reads it. Older runtimes
// without loadEnvFile simply fall back to ambient environment variables.
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file present — ambient env / documented defaults apply.
  }
}

const env = loadEnv();
const logger = pino({ level: env.logLevel });

const app = createApp(env, logger, repositoryFor(env));

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
