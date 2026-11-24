import { describe, expect, it } from 'vitest';
import { PENDING_ROUTES } from '../src/modules/pending/pending-routes';
import { toFastifyTrustProxy } from '../src/http/app';
import { fakeDb, testApp } from './helpers';

describe('HTTP shell (no database)', () => {
  it('serves liveness without touching the database', async () => {
    const app = await testApp(fakeDb({ healthy: false }));
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ data: { status: 'ok', version: 'test' }, error: null });
  });

  it('reports readiness from the database', async () => {
    expect((await (await testApp(fakeDb())).inject({ url: '/api/v1/ready' })).statusCode).toBe(200);
    const down = await (await testApp(fakeDb({ healthy: false }))).inject({ url: '/api/v1/ready' });
    expect(down.statusCode).toBe(503);
    expect(down.json().error.code).toBe('NOT_READY');
  });

  it('sets security headers and echoes a safe request id', async () => {
    const app = await testApp(fakeDb());
    const res = await app.inject({
      url: '/api/v1/health',
      headers: { 'x-request-id': 'req-12345678' },
    });
    expect(res.headers['x-request-id']).toBe('req-12345678');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.json().meta.requestId).toBe('req-12345678');
    const unsafe = await app.inject({
      url: '/api/v1/health',
      headers: { 'x-request-id': 'bad id' },
    });
    expect(unsafe.headers['x-request-id']).not.toBe('bad id');
  });

  it('returns the envelope for unknown routes', async () => {
    const res = await (await testApp(fakeDb())).inject({ url: '/api/v1/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ data: null, error: { code: 'NOT_FOUND' } });
  });

  it('requires authentication for protected and pending routes', async () => {
    const app = await testApp(fakeDb());
    expect((await app.inject({ url: '/api/v1/entities' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/v1/auth/me' })).json().error.code).toBe(
      'UNAUTHENTICATED',
    );
    const pending = PENDING_ROUTES[0]!;
    expect((await app.inject({ method: pending.method, url: pending.url })).statusCode).toBe(401);
  });

  it('rejects malformed JSON and validation failures with 400', async () => {
    const app = await testApp(fakeDb());
    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{"email":',
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('BAD_REQUEST');
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'nope' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(Array.isArray(invalid.json().error.details)).toBe(true);
  });

  it('hides internal errors behind a generic 500', async () => {
    const app = await testApp(fakeDb());
    app.get('/api/v1/boom', async () => {
      throw new Error('secret internals');
    });
    const res = await app.inject({ url: '/api/v1/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('secret internals');
    expect(res.json().error.code).toBe('INTERNAL_ERROR');
  });

  it('honours TRUST_PROXY only for the configured number of hops', async () => {
    const forwarded = { 'x-forwarded-for': '203.0.113.9' };
    const untrusted = await testApp(fakeDb());
    untrusted.get('/api/v1/ip', async (request) => ({ ip: request.ip }));
    expect((await untrusted.inject({ url: '/api/v1/ip', headers: forwarded })).json().ip).toBe(
      '127.0.0.1',
    );
    const oneHop = await testApp(fakeDb(), { TRUST_PROXY: '1' });
    oneHop.get('/api/v1/ip', async (request) => ({ ip: request.ip }));
    expect((await oneHop.inject({ url: '/api/v1/ip', headers: forwarded })).json().ip).toBe(
      '203.0.113.9',
    );
    expect(toFastifyTrustProxy(['10.0.0.1'])).toEqual(['10.0.0.1']);
  });

  it('declares unique pending routes that reference backlog tickets', () => {
    const keys = PENDING_ROUTES.map((r) => `${r.method} ${r.url}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(PENDING_ROUTES.every((r) => /^LL-\d{3}$/.test(r.ticket))).toBe(true);
  });
});
