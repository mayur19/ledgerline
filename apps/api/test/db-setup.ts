import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { describe } from 'vitest';
import { runMigrations } from '../src/db/migrate';
import { createPool, type Db } from '../src/db/pool';
import { DEMO_PASSWORD, seed } from '../src/db/seed';
import { silentLogger, testApp } from './helpers';

export const testDatabaseUrl = process.env.TEST_DATABASE_URL;
export const describeDb = testDatabaseUrl ? describe : describe.skip;

/** Drop and rebuild the test schema, then apply migrations and the demo seed. */
export async function freshDatabase(options: { seed?: boolean } = {}): Promise<Db> {
  const db = createPool({ DATABASE_URL: testDatabaseUrl!, DATABASE_POOL_MAX: 20 });
  await db.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await runMigrations(db, silentLogger);
  if (options.seed !== false) await seed(db, silentLogger);
  return db;
}

/** A logged-in HTTP client bound to one app instance: carries cookies and CSRF header. */
export interface Client {
  readonly app: FastifyInstance;
  readonly csrf: string;
  readonly cookies: Record<string, string>;
  request(options: InjectOptions): Promise<LightMyRequestResponse>;
  get(url: string): Promise<LightMyRequestResponse>;
  post(
    url: string,
    payload?: unknown,
    headers?: Record<string, string>,
  ): Promise<LightMyRequestResponse>;
  patch(url: string, payload?: unknown): Promise<LightMyRequestResponse>;
}

export function clientFrom(app: FastifyInstance, res: LightMyRequestResponse): Client {
  const cookies = Object.fromEntries(res.cookies.map((c) => [c.name, c.value]));
  const csrf = cookies.ll_csrf ?? '';
  const request = (options: InjectOptions) =>
    app.inject({
      ...options,
      cookies: { ...cookies, ...(options.cookies ?? {}) },
      headers: { 'x-csrf-token': csrf, ...(options.headers ?? {}) },
    });
  return {
    app,
    csrf,
    cookies,
    request,
    get: (url) => request({ method: 'GET', url }),
    post: (url, payload, headers) =>
      request({ method: 'POST', url, payload: payload as object, headers }),
    patch: (url, payload) => request({ method: 'PATCH', url, payload: payload as object }),
  };
}

export async function login(
  app: FastifyInstance,
  email: string,
  password = DEMO_PASSWORD,
): Promise<Client> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
  if (res.statusCode !== 200)
    throw new Error(`login failed for ${email}: ${res.statusCode} ${res.body}`);
  return clientFrom(app, res);
}

export async function signIn(db: Db, email: string): Promise<Client> {
  return login(await testApp(db), email);
}

export interface EntityRef {
  id: string;
  code: string;
  roundingAccountId: string | null;
  retainedEarningsAccountId: string | null;
}

export async function entityByCode(client: Client, code: string): Promise<EntityRef> {
  const res = await client.get('/api/v1/entities');
  const entity = (res.json().data as EntityRef[]).find((e) => e.code === code);
  if (!entity) throw new Error(`entity ${code} not found`);
  return entity;
}

export async function accountIds(
  client: Client,
  entityId: string,
): Promise<Record<string, string>> {
  const res = await client.get(`/api/v1/entities/${entityId}/accounts`);
  return Object.fromEntries(
    (res.json().data as { code: string; id: string }[]).map((a) => [a.code, a.id]),
  );
}

/** Sign in several demo roles at once, preserving tuple types. */
export async function signInRoles<const T extends readonly string[]>(
  db: Db,
  roles: T,
): Promise<{ [K in keyof T]: Client }> {
  const clients = await Promise.all(roles.map((role) => signIn(db, `${role}@northwind.example`)));
  return clients as { [K in keyof T]: Client };
}
