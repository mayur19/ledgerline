import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env';

const base = { DATABASE_URL: 'postgres:///x?host=/tmp', SESSION_SECRET: 'x'.repeat(40) };

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(base);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      API_PORT: 4101,
      SESSION_TTL_HOURS: 12,
      TRUST_PROXY: false,
    });
  });

  it('coerces numbers', () => {
    const env = loadEnv({ ...base, API_PORT: '9000', TRUST_PROXY: '2', DATABASE_POOL_MAX: '3' });
    expect(env.API_PORT).toBe(9000);
    expect(env.TRUST_PROXY).toBe(2);
    expect(env.DATABASE_POOL_MAX).toBe(3);
  });

  it('lists every problem at once', () => {
    expect(() => loadEnv({ SESSION_SECRET: 'short', API_PORT: '0' })).toThrow(
      /DATABASE_URL.*SESSION_SECRET|SESSION_SECRET.*DATABASE_URL/,
    );
  });

  it('parses TRUST_PROXY as false, a hop count or an IP/CIDR list', () => {
    expect(loadEnv(base).TRUST_PROXY).toBe(false);
    expect(loadEnv({ ...base, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(false);
    expect(loadEnv({ ...base, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
    expect(loadEnv({ ...base, TRUST_PROXY: '10.0.0.0/8, 192.168.1.10,::1' }).TRUST_PROXY).toEqual([
      '10.0.0.0/8',
      '192.168.1.10',
      '::1',
    ]);
  });

  it.each(['true', 'yes', '10.0.0.0/33', 'proxy.local', '1.2.3.4,nonsense'])(
    'rejects unsafe TRUST_PROXY value %j',
    (value) => {
      expect(() => loadEnv({ ...base, TRUST_PROXY: value })).toThrow(/TRUST_PROXY/);
    },
  );

  it('requires TRUST_PROXY to be set explicitly in production', () => {
    const prod = { ...base, NODE_ENV: 'production' };
    expect(() => loadEnv(prod)).toThrow(/TRUST_PROXY must be set explicitly/);
    expect(() => loadEnv({ ...prod, TRUST_PROXY: '' })).toThrow(/TRUST_PROXY/);
    expect(loadEnv({ ...prod, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(false);
    expect(loadEnv({ ...prod, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
  });

  it('refuses the placeholder secret in production', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'production',
        TRUST_PROXY: '1',
        SESSION_SECRET: 'replace-me-with-a-long-random-local-only-value',
      }),
    ).toThrow(/placeholder/);
  });
});
