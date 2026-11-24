import pg from 'pg';

// DATE columns are calendar dates, not instants: keep them as YYYY-MM-DD strings.
pg.types.setTypeParser(1082, (value: string) => value);

export interface Queryable {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<pg.QueryResult<R>>;
}

export interface Db extends Queryable {
  connect(): Promise<pg.PoolClient>;
  end(): Promise<void>;
}

export function createPool(config: { DATABASE_URL: string; DATABASE_POOL_MAX: number }): Db {
  return new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: config.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'ledgerline-api',
  }) as unknown as Db;
}

export type IsolationLevel = 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

export interface TransactionOptions {
  readonly isolation?: IsolationLevel;
  readonly readOnly?: boolean;
}

/** Run `work` inside a transaction on a dedicated client; rolls back on any error. */
export async function withTransaction<T>(
  db: Db,
  work: (tx: Queryable) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const client = await db.connect();
  const mode = `ISOLATION LEVEL ${options.isolation ?? 'READ COMMITTED'}${options.readOnly ? ' READ ONLY' : ''}`;
  try {
    await client.query(`BEGIN ${mode}`);
    const result = await work(client as unknown as Queryable);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Postgres SQLSTATE helpers. */
export const isUniqueViolation = (error: unknown, constraint?: string): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === '23505' &&
  (constraint === undefined || (error as { constraint?: string }).constraint === constraint);

export const isExclusionViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === '23P01';
