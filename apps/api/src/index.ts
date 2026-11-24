import { loadEnv } from './config/env';
import { createPool } from './db/pool';
import { buildApp } from './http/app';
import { AuthThrottle } from './http/login-throttle';
import { createLogger } from './lib/logger';

const VERSION = process.env.npm_package_version ?? '0.1.0';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const db = createPool(env);
  const throttle = new AuthThrottle(env, Date.now, {
    onEvict: (store, key) =>
      logger.warn(
        { store, key: key.slice(0, 8) },
        'throttle store full: evicted entry with least time left',
      ),
  });
  const app = await buildApp({ env, logger, db, version: VERSION, throttle });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    await app.close();
    await db.end();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: env.API_HOST, port: env.API_PORT });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
