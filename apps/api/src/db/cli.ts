import { loadEnv } from '../config/env';
import { createLogger } from '../lib/logger';
import { runMigrations } from './migrate';
import { createPool } from './pool';
import { seed } from './seed';

/** Database maintenance CLI: migrate | seed | reset. */
async function main(command: string | undefined): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const db = createPool(env);
  try {
    if (command === 'migrate') {
      const applied = await runMigrations(db, logger);
      logger.info({ applied: applied.length }, 'migrations complete');
    } else if (command === 'seed') {
      await seed(db, logger);
    } else if (command === 'reset') {
      if (env.NODE_ENV === 'production') throw new Error('Refusing to reset a production database');
      await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      await runMigrations(db, logger);
      await seed(db, logger);
      logger.info('database reset');
    } else {
      throw new Error('Usage: cli.ts <migrate|seed|reset>');
    }
  } finally {
    await db.end();
  }
}

main(process.argv[2]).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
