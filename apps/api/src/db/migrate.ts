import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Logger } from 'pino';
import type { Db } from './pool';

/**
 * Forward-only SQL migration runner (ADR-0005).
 * Files: apps/api/migrations/NNNN_description.sql, applied in lexical order, each in
 * its own transaction. Checksums guard against editing applied migrations and a
 * session advisory lock stops two runners from racing during a deploy.
 */
export function defaultMigrationsDir(): string {
  return process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'migrations');
}

const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;
const MIGRATION_LOCK_KEY = 4101_0001;

export interface MigrationFile {
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
}

export async function loadMigrations(
  dir: string = defaultMigrationsDir(),
): Promise<readonly MigrationFile[]> {
  const entries = (await readdir(dir)).filter((file) => MIGRATION_FILE.test(file)).sort();
  return Promise.all(
    entries.map(async (name) => {
      const sql = await readFile(path.join(dir, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    }),
  );
}

export async function runMigrations(
  db: Db,
  logger: Logger,
  dir?: string,
): Promise<readonly string[]> {
  const migrations = await loadMigrations(dir);
  const client = await db.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        text PRIMARY KEY,
        checksum    text NOT NULL,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )`);
    const { rows } = await client.query<{ name: string; checksum: string }>(
      'SELECT name, checksum FROM schema_migrations',
    );
    const applied = new Map(rows.map((row) => [row.name, row.checksum] as const));
    const newlyApplied: string[] = [];
    for (const migration of migrations) {
      const existing = applied.get(migration.name);
      if (existing !== undefined) {
        if (existing !== migration.checksum) {
          throw new Error(
            `Migration ${migration.name} was modified after being applied; add a new migration instead`,
          );
        }
        continue;
      }
      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
          migration.name,
          migration.checksum,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      logger.info({ migration: migration.name }, 'migration applied');
      newlyApplied.push(migration.name);
    }
    return newlyApplied;
  } finally {
    await client
      .query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY])
      .catch(() => undefined);
    client.release();
  }
}
