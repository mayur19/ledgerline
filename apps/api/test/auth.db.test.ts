import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Db } from '../src/db/pool';
import { DEMO_PASSWORD } from '../src/db/seed';
import { REGISTRATION_ACCEPTED_MESSAGE } from '../src/modules/auth/auth.service';
import { clientFrom, describeDb, freshDatabase, login } from './db-setup';
import { testApp } from './helpers';

describeDb('authentication and sessions', () => {
  let db: Db;
  beforeAll(async () => {
    db = await freshDatabase();
  });
  afterAll(async () => db?.end());

  const registration = (email: string) => ({
    organizationName: 'Acme Group',
    displayName: 'Ada Acme',
    email,
    password: 'a-very-long-password-1',
  });

  it('registers an organization owner without starting a session', async () => {
    const app = await testApp(db);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: registration('ada@acme.example'),
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().data).toEqual({ message: REGISTRATION_ACCEPTED_MESSAGE });
    expect(res.cookies).toHaveLength(0);
    const client = await login(app, 'ada@acme.example', 'a-very-long-password-1');
    const me = await client.get('/api/v1/auth/me');
    expect(me.json().data).toMatchObject({ role: 'owner', organization: { name: 'Acme Group' } });
  });

  it('does not reveal whether an email is already registered', async () => {
    const app = await testApp(db);
    const fresh = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: registration('new@acme.example'),
    });
    const taken = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: registration('owner@northwind.example'),
    });
    expect(taken.statusCode).toBe(fresh.statusCode);
    expect(taken.json().data).toEqual(fresh.json().data);
    // The existing account is untouched: its original password still works.
    await expect(login(app, 'owner@northwind.example')).resolves.toBeDefined();
    const orgs = await db.query(
      `SELECT count(*)::int AS n FROM organizations WHERE name = 'Acme Group'`,
    );
    expect(orgs.rows[0]!.n).toBe(2);
  });

  it('rate-limits registration per IP', async () => {
    const app = await testApp(db, { REGISTER_RATE_LIMIT_MAX: '2' });
    const send = (i: number) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: registration(`r${i}@limit.example`),
      });
    expect((await send(1)).statusCode).toBe(202);
    expect((await send(2)).statusCode).toBe(202);
    const limited = await send(3);
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('logs in, exposes the profile and permissions, and logs out', async () => {
    const app = await testApp(db);
    const client = await login(app, 'accountant@northwind.example');
    expect(client.cookies.ll_session).toBeDefined();
    const me = await client.get('/api/v1/auth/me');
    expect(me.json().data.permissions).toContain('journal.post');
    expect(me.json().data.permissions).not.toContain('period.manage');
    expect((await client.post('/api/v1/auth/logout')).statusCode).toBe(200);
    expect((await client.get('/api/v1/auth/me')).statusCode).toBe(401);
  });

  it('rejects wrong passwords and unknown users with the same error', async () => {
    const app = await testApp(db);
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'owner@northwind.example', password: 'nope' },
    });
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'ghost@northwind.example', password: 'nope' },
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.json().error).toEqual(wrong.json().error);
  });

  it('locks an email out with progressive backoff regardless of source IP', async () => {
    const app = await testApp(db, { AUTH_RATE_LIMIT_MAX: '2' });
    const attempt = (password: string, ip: string) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: ip,
        payload: { email: 'auditor@northwind.example', password },
      });
    expect((await attempt('bad', '10.0.0.1')).statusCode).toBe(401);
    expect((await attempt('bad', '10.0.0.2')).statusCode).toBe(401);
    expect((await attempt('bad', '10.0.0.3')).statusCode).toBe(401);
    const locked = await attempt(DEMO_PASSWORD, '10.0.0.4');
    expect(locked.statusCode).toBe(429);
    expect(Number(locked.headers['retry-after'])).toBeGreaterThanOrEqual(29);
    // Other accounts are unaffected.
    await expect(login(app, 'controller@northwind.example')).resolves.toBeDefined();
  });

  it('lets only the free budget through when bad logins arrive in parallel', async () => {
    const app = await testApp(db, { AUTH_RATE_LIMIT_MAX: '2' });
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          remoteAddress: `10.1.0.${i + 1}`,
          payload: { email: 'controller@northwind.example', password: 'wrong-password' },
        }),
      ),
    );
    const statuses = results.map((r) => r.statusCode);
    // Two free attempts plus the one that triggers the lock reach password checking.
    expect(statuses.filter((s) => s === 401)).toHaveLength(3);
    expect(statuses.filter((s) => s === 429)).toHaveLength(9);
  });

  it('caps how many distinct emails one IP may try', async () => {
    const app = await testApp(db, { AUTH_EMAILS_PER_IP_MAX: '2' });
    const tryEmail = (email: string, ip = '192.0.2.50') =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: ip,
        payload: { email, password: 'x' },
      });
    expect((await tryEmail('one@x.example')).statusCode).toBe(401);
    expect((await tryEmail('two@x.example')).statusCode).toBe(401);
    expect((await tryEmail('three@x.example')).statusCode).toBe(429);
    expect((await tryEmail('one@x.example')).statusCode).toBe(401);
    // IPv4-mapped IPv6 is the same client.
    expect((await tryEmail('four@x.example', '::ffff:192.0.2.50')).statusCode).toBe(429);
  });

  it('blocks password spraying from one IP across many emails', async () => {
    const app = await testApp(db, { AUTH_IP_RATE_LIMIT_MAX: '3' });
    const spray = (email: string) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: '198.51.100.7',
        payload: { email, password: 'Spring2026!' },
      });
    for (const email of ['a@x.example', 'b@x.example', 'c@x.example']) {
      expect((await spray(email)).statusCode).toBe(401);
    }
    expect((await spray('owner@northwind.example')).statusCode).toBe(429);
    const elsewhere = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: '198.51.100.8',
      payload: { email: 'owner@northwind.example', password: DEMO_PASSWORD },
    });
    expect(elsewhere.statusCode).toBe(200);
  });

  it('enforces the CSRF double-submit token on mutating requests', async () => {
    const app = await testApp(db);
    const client = await login(app, 'owner@northwind.example');
    const noHeader = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: client.cookies,
    });
    expect(noHeader.statusCode).toBe(403);
    expect(noHeader.json().error.code).toBe('CSRF_INVALID');
    const forged = await client.request({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { 'x-csrf-token': 'forged' },
    });
    expect(forged.statusCode).toBe(403);
    const otherSession = await login(app, 'controller@northwind.example');
    const swapped = await client.request({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { 'x-csrf-token': otherSession.csrf },
      cookies: { ll_csrf: otherSession.csrf },
    });
    expect(swapped.statusCode).toBe(403);
  });

  it('issues HttpOnly SameSite=Lax session cookies', async () => {
    const app = await testApp(db);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'owner@northwind.example', password: DEMO_PASSWORD },
    });
    const session = res.cookies.find((c) => c.name === 'll_session')!;
    expect(session.httpOnly).toBe(true);
    expect(session.sameSite).toBe('Lax');
    expect(res.cookies.find((c) => c.name === 'll_csrf')!.httpOnly).toBeFalsy();
    expect(clientFrom(app, res).csrf).toBe(res.json().data.csrfToken);
  });

  it('stores only keyed hashes of session tokens', async () => {
    const app = await testApp(db);
    const client = await login(app, 'owner@northwind.example');
    const { rows } = await db.query<{ token_hash: string }>('SELECT token_hash FROM sessions');
    expect(rows.some((r) => r.token_hash === client.cookies.ll_session)).toBe(false);
  });

  it('records login and failure events in the audit trail', async () => {
    const app = await testApp(db);
    const client = await login(app, 'owner@northwind.example');
    const res = await client.get('/api/v1/audit-events?targetType=user&limit=100');
    const actions = (res.json().data as { action: string }[]).map((e) => e.action);
    expect(actions).toContain('auth.login');
    expect(actions).toContain('auth.login_failed');
    expect(actions).toContain('auth.register_existing_email');
  });
});
