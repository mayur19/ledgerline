import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import pino from 'pino';
import { loadEnv, type Env } from '../src/config/env';
import type { Db } from '../src/db/pool';
import { buildApp } from '../src/http/app';
import { AuthThrottle } from '../src/http/login-throttle';

export const silentLogger = pino({ level: 'silent' });

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    APP_ORIGIN: 'http://localhost:5101',
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://localhost/unused',
    SESSION_SECRET: 'test-secret-test-secret-test-secret-0123456789',
    LOG_LEVEL: 'silent',
    AUTH_RATE_LIMIT_MAX: '10000',
    AUTH_IP_RATE_LIMIT_MAX: '10000',
    AUTH_EMAILS_PER_IP_MAX: '10000',
    REGISTER_RATE_LIMIT_MAX: '10000',
    ...overrides,
  });
}

export async function testApp(
  db: Db,
  overrides: Record<string, string> = {},
): Promise<FastifyInstance> {
  const env = testEnv(overrides);
  return buildApp({
    env,
    logger: silentLogger,
    db,
    version: 'test',
    throttle: new AuthThrottle(env),
  });
}

/** Database stand-in for HTTP tests that never reach a real session or query. */
export function fakeDb({ healthy = true } = {}): Db {
  return {
    query: async (sql: string) => {
      if (!healthy) throw new Error('connection refused');
      if (sql === 'SELECT 1') return { rows: [{ '?column?': 1 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    connect: async () => {
      throw new Error('not available in fake db');
    },
    end: async () => undefined,
  } as unknown as Db;
}

export function body<T = Record<string, unknown>>(res: LightMyRequestResponse): T {
  return res.json() as T;
}
