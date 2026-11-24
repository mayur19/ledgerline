import { describe, expect, it } from 'vitest';
import { BoundedStore } from '../src/http/bounded-store';
import { limiterIpKey } from '../src/http/client-ip';
import {
  AuthThrottle,
  DistinctKeyLimiter,
  FixedWindowLimiter,
  ProgressiveBackoff,
} from '../src/http/login-throttle';
import { hashPassword, verifyPassword } from '../src/security/password';
import { hashToken, randomToken, safeEqual } from '../src/security/tokens';

describe('password hashing', () => {
  it('hashes with a random salt and verifies', async () => {
    const a = await hashPassword('correct horse battery staple');
    const b = await hashPassword('correct horse battery staple');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', a)).toBe(true);
    expect(await verifyPassword('wrong', a)).toBe(false);
  });

  it('rejects malformed hashes', async () => {
    expect(await verifyPassword('x', 'bcrypt$abc')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$1$2$3$$')).toBe(false);
  });
});

describe('tokens', () => {
  it('generates url-safe 256-bit tokens', () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(token);
  });

  it('keys the hash with the server secret', () => {
    expect(hashToken('t', 'secret-a')).not.toBe(hashToken('t', 'secret-b'));
    expect(hashToken('t', 'secret-a')).toHaveLength(64);
  });

  it('compares in constant time and handles length mismatch', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('FixedWindowLimiter', () => {
  it('blocks after the budget and resets after the window', () => {
    let now = 1_000_000;
    const limiter = new FixedWindowLimiter(2, 60_000, () => now);
    expect(limiter.hit('ip:1').allowed).toBe(true);
    expect(limiter.hit('ip:1').allowed).toBe(true);
    expect(limiter.hit('ip:1')).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(limiter.hit('ip:2').allowed).toBe(true);
    now += 60_001;
    expect(limiter.hit('ip:1').allowed).toBe(true);
  });

  it('stays bounded and never refuses a new key just because the store is full', () => {
    let now = 0;
    const limiter = new FixedWindowLimiter(1, 1_000, () => now, { maxKeys: 50 });
    for (let i = 0; i < 50; i += 1) limiter.hit(`ip:${i}`);
    expect(limiter.size).toBe(50);
    expect(limiter.hit('ip:new').allowed).toBe(true);
    expect(limiter.size).toBe(50);
    now = 5_000;
    for (let i = 0; i < 10; i += 1) limiter.hit(`late:${i}`);
    expect(limiter.size).toBeLessThanOrEqual(50);
  });
});

describe('BoundedStore', () => {
  interface Entry {
    until: number;
  }
  const make = (maxKeys: number, now: () => number, evicted: string[] = [], sweepBudget = 2) =>
    new BoundedStore<Entry>({
      maxKeys,
      expiresAt: (e) => e.until,
      timeLeft: (e, t) => e.until - t,
      now,
      onEvict: (key) => evicted.push(key),
      sweepBudget,
    });

  it('reclaims expired entries incrementally with a cursor that covers the whole map', () => {
    let now = 0;
    const store = make(1_000, () => now);
    for (let i = 0; i < 10; i += 1) store.set(`k${i}`, { until: 100 });
    now = 200;
    for (let i = 0; i < 10; i += 1) store.set(`fresh${i}`, { until: 10_000 });
    for (let i = 0; i < 10; i += 1) expect(store.get(`k${i}`)).toBeUndefined();
    expect(store.size).toBe(10);
  });

  it('prefers sweeping expired entries over evicting active ones', () => {
    let now = 0;
    const evicted: string[] = [];
    const store = make(3, () => now, evicted, 0);
    store.set('a', { until: 50 });
    store.set('b', { until: 500 });
    store.set('c', { until: 900 });
    now = 100;
    store.set('d', { until: 1_000 });
    expect(store.get('a')).toBeUndefined();
    expect(evicted).toEqual([]);
  });

  it('evicts the active entry with the least time left and reports it', () => {
    const evicted: string[] = [];
    const store = make(3, () => 0, evicted, 0);
    store.set('long', { until: 900 });
    store.set('short', { until: 100 });
    store.set('mid', { until: 500 });
    store.set('new', { until: 1_000 });
    expect(evicted).toEqual(['short']);
    expect(store.get('long')).toBeDefined();
    expect(store.get('new')).toBeDefined();
    store.delete('new');
    expect(store.size).toBe(2);
  });
});

describe('ProgressiveBackoff', () => {
  const options = {
    freeAttempts: 3,
    baseLockMs: 30_000,
    maxLockMs: 3_600_000,
    forgetAfterMs: 86_400_000,
  };

  it('locks out with exponentially growing durations, capped', () => {
    const backoff = new ProgressiveBackoff(options, () => 0);
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => backoff.lockDurationMs(n))).toEqual([
      0, 0, 0, 30_000, 60_000, 120_000, 240_000,
    ]);
    expect(backoff.lockDurationMs(40)).toBe(3_600_000);
  });

  it('reserves attempts synchronously so a burst cannot exceed the budget', () => {
    const backoff = new ProgressiveBackoff(options, () => 0);
    const decisions = Array.from({ length: 10 }, () => backoff.reserve('email:a'));
    expect(decisions.filter((d) => d.allowed)).toHaveLength(4);
    expect(decisions.at(-1)).toEqual({ allowed: false, retryAfterSeconds: 30 });
  });

  it('blocks until the lock expires, doubling each time, and clears on success', () => {
    let now = 0;
    const backoff = new ProgressiveBackoff(options, () => now);
    for (let i = 0; i < 4; i += 1) backoff.reserve('email:a');
    expect(backoff.check('email:a').retryAfterSeconds).toBe(30);
    now += 30_000;
    expect(backoff.reserve('email:a').allowed).toBe(true);
    expect(backoff.check('email:a').retryAfterSeconds).toBe(60);
    backoff.recordSuccess('email:a');
    expect(backoff.check('email:a').allowed).toBe(true);
    expect(backoff.check('email:b').allowed).toBe(true);
  });

  it('forgets after a quiet period', () => {
    let now = 0;
    const backoff = new ProgressiveBackoff(options, () => now);
    for (let i = 0; i < 5; i += 1) backoff.recordFailure('email:b');
    now += 86_400_001;
    expect(backoff.check('email:b').allowed).toBe(true);
    backoff.recordFailure('email:b');
    expect(backoff.check('email:b').allowed).toBe(true);
  });

  it('under store pressure evicts unlocked entries before active lockouts', () => {
    const evicted: string[] = [];
    const backoff = new ProgressiveBackoff(
      { ...options, freeAttempts: 1, maxKeys: 2, onEvict: (_store, key) => evicted.push(key) },
      () => 0,
    );
    backoff.recordFailure('email:locked');
    backoff.recordFailure('email:locked');
    backoff.recordFailure('email:unlocked');
    backoff.recordFailure('email:new');
    expect(evicted).toEqual(['email:unlocked']);
    expect(backoff.check('email:locked').allowed).toBe(false);
    expect(backoff.size).toBe(2);
  });
});

describe('DistinctKeyLimiter', () => {
  it('caps distinct emails per IP per window but allows repeats', () => {
    let now = 0;
    const limiter = new DistinctKeyLimiter(2, 60_000, () => now);
    expect(limiter.hit('1.1.1.1', 'a').allowed).toBe(true);
    expect(limiter.hit('1.1.1.1', 'b').allowed).toBe(true);
    expect(limiter.hit('1.1.1.1', 'a').allowed).toBe(true);
    expect(limiter.hit('1.1.1.1', 'c')).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(limiter.hit('2.2.2.2', 'c').allowed).toBe(true);
    now = 60_000;
    expect(limiter.hit('1.1.1.1', 'c').allowed).toBe(true);
  });
});

describe('AuthThrottle', () => {
  it('keeps IP, email, distinct-email and registration limiters independent', () => {
    const throttle = new AuthThrottle(
      {
        AUTH_RATE_LIMIT_MAX: 1,
        AUTH_RATE_LIMIT_WINDOW_MS: 60_000,
        AUTH_IP_RATE_LIMIT_MAX: 2,
        AUTH_EMAILS_PER_IP_MAX: 1,
        REGISTER_RATE_LIMIT_MAX: 1,
      },
      () => 0,
    );
    expect(throttle.loginByIp.hit('ip:1').allowed).toBe(true);
    expect(throttle.loginByIp.hit('ip:1').allowed).toBe(true);
    expect(throttle.loginByIp.hit('ip:1').allowed).toBe(false);
    expect(throttle.registerByIp.hit('register-ip:1').allowed).toBe(true);
    expect(throttle.registerByIp.hit('register-ip:1').allowed).toBe(false);
    expect(throttle.emailsPerIp.hit('1', 'x').allowed).toBe(true);
    expect(throttle.emailsPerIp.hit('1', 'y').allowed).toBe(false);
    throttle.loginByEmail.reserve('email:x');
    throttle.loginByEmail.reserve('email:x');
    expect(throttle.loginByEmail.check('email:x').allowed).toBe(false);
  });
});

describe('limiterIpKey', () => {
  it.each([
    ['203.0.113.9', '203.0.113.9'],
    ['::ffff:203.0.113.9', '203.0.113.9'],
    ['::FFFF:10.0.0.1', '10.0.0.1'],
    ['2001:db8:abcd:12:1:2:3:4', '2001:db8:abcd:12::/64'],
    ['2001:db8:abcd:12::99', '2001:db8:abcd:12::/64'],
    ['2001:0db8:abcd:0012:ffff::1', '2001:db8:abcd:12::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['64:ff9b::192.0.2.33', '64:ff9b:0:0::/64'],
    ['', 'unknown'],
  ])('%s -> %s', (input, expected) => {
    expect(limiterIpKey(input)).toBe(expected);
  });

  it('puts every address of one /64 under one key', () => {
    const keys = new Set(
      ['2001:db8:1:2::1', '2001:db8:1:2:ffff:ffff:ffff:ffff', '2001:db8:1:2:a::b'].map(
        limiterIpKey,
      ),
    );
    expect(keys.size).toBe(1);
  });
});
