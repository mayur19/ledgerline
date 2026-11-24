import { cp, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { defaultMigrationsDir, loadMigrations, runMigrations } from '../src/db/migrate';
import type { Db } from '../src/db/pool';
import { seed } from '../src/db/seed';
import { describeDb, freshDatabase } from './db-setup';
import { silentLogger } from './helpers';

describeDb('migration runner and seed', () => {
  let db: Db;
  beforeAll(async () => {
    db = await freshDatabase({ seed: false });
  });
  afterAll(async () => db?.end());

  it('is idempotent once applied', async () => {
    expect(await runMigrations(db, silentLogger)).toEqual([]);
    const files = await loadMigrations(defaultMigrationsDir());
    expect(files.map((f) => f.name)).toEqual(['0001_foundation.sql', '0002_ledger_core.sql']);
  });

  it('refuses to run when an applied migration was edited', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'll-migrations-'));
    await cp(defaultMigrationsDir(), dir, { recursive: true });
    await writeFile(path.join(dir, '0001_foundation.sql'), '-- tampered\nSELECT 1;');
    await expect(runMigrations(db, silentLogger, dir)).rejects.toThrow(
      /modified after being applied/,
    );
  });

  it('applies new migrations in order', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'll-migrations-'));
    await cp(defaultMigrationsDir(), dir, { recursive: true });
    await writeFile(path.join(dir, '0003_probe.sql'), 'CREATE TABLE migration_probe (id int);');
    await writeFile(path.join(dir, 'notes.txt'), 'ignored');
    expect(await runMigrations(db, silentLogger, dir)).toEqual(['0003_probe.sql']);
  });

  it('rolls back a failing migration', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'll-migrations-'));
    await cp(defaultMigrationsDir(), dir, { recursive: true });
    await writeFile(path.join(dir, '0003_probe.sql'), 'CREATE TABLE migration_probe (id int);');
    await writeFile(
      path.join(dir, '0004_broken.sql'),
      'CREATE TABLE half_done (id int); SELECT * FROM missing_table;',
    );
    await expect(runMigrations(db, silentLogger, dir)).rejects.toThrow();
    const { rows } = await db.query<{ t: string | null }>(`SELECT to_regclass('half_done') AS t`);
    expect(rows[0]!.t).toBeNull();
  });

  it('seeds idempotently', async () => {
    await seed(db, silentLogger);
    await seed(db, silentLogger);
    const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM organizations`);
    expect(rows[0]!.n).toBe(1);
  });
});
