import { BoundedStore } from './bounded-store';

/**
 * Authentication throttling (ADR-0011, docs/security/threat-model.md §4).
 *
 * Independent limiters, never a combined ip|email key:
 *  - IP limiter: fixed window over *all* login attempts from one normalised
 *    address (IPv4-mapped -> IPv4, IPv6 -> /64). Catches password spraying.
 *  - Email limiter: consecutive failures for one account across all IPs; past a
 *    free budget the account is locked with exponential backoff (capped).
 *  - Distinct-email cap: one IP may only touch N different emails per window,
 *    so it cannot flood the email store to evict real lockouts.
 * Registration has its own IP limiter.
 *
 * Attempts are *reserved synchronously* (counted before any await) and the
 * email counter is reset on success, so parallel requests cannot all slip past.
 *
 * State is in-process, which is only correct for a single API instance. Moving
 * the counters to Postgres is a prerequisite for running more than one (LL-100).
 */
export interface ThrottleDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

const ALLOW: ThrottleDecision = { allowed: true, retryAfterSeconds: 0 };
export const DEFAULT_MAX_KEYS = 10_000;

const deny = (ms: number): ThrottleDecision => ({
  allowed: false,
  retryAfterSeconds: Math.max(1, Math.ceil(ms / 1000)),
});

export interface StoreLimits {
  readonly maxKeys?: number;
  readonly onEvict?: (store: string, key: string) => void;
}

interface Window {
  readonly count: number;
  readonly resetAt: number;
}

/** Fixed-window counter keyed by an arbitrary string. */
export class FixedWindowLimiter {
  private readonly store: BoundedStore<Window>;

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    limits: StoreLimits & { readonly name?: string } = {},
  ) {
    this.store = new BoundedStore<Window>({
      maxKeys: limits.maxKeys ?? DEFAULT_MAX_KEYS,
      expiresAt: (w) => w.resetAt,
      timeLeft: (w, t) => w.resetAt - t,
      now,
      onEvict: (key) => limits.onEvict?.(limits.name ?? 'window', key),
    });
  }

  /** Count an attempt and decide. Synchronous by design. */
  hit(key: string): ThrottleDecision {
    const time = this.now();
    const current = this.store.get(key);
    const base =
      !current || current.resetAt <= time ? { count: 0, resetAt: time + this.windowMs } : current;
    const updated = { count: base.count + 1, resetAt: base.resetAt };
    this.store.set(key, updated);
    return updated.count <= this.max ? ALLOW : deny(updated.resetAt - time);
  }

  get size(): number {
    return this.store.size;
  }
}

interface FailureState {
  readonly failures: number;
  readonly lockedUntil: number;
  readonly lastFailureAt: number;
}

export interface BackoffOptions extends StoreLimits {
  /** Failures allowed before the first lockout. */
  readonly freeAttempts: number;
  readonly baseLockMs: number;
  readonly maxLockMs: number;
  /** Failure history is forgotten after this much quiet time. */
  readonly forgetAfterMs: number;
}

/** Per-account consecutive-failure counter with exponential lockout. */
export class ProgressiveBackoff {
  private readonly store: BoundedStore<FailureState>;

  constructor(
    private readonly options: BackoffOptions,
    private readonly now: () => number = Date.now,
  ) {
    this.store = new BoundedStore<FailureState>({
      maxKeys: options.maxKeys ?? DEFAULT_MAX_KEYS,
      expiresAt: (s) => Math.max(s.lockedUntil, s.lastFailureAt + options.forgetAfterMs),
      // Unlocked entries (lockedUntil in the past) are evicted before active lockouts.
      timeLeft: (s, t) => s.lockedUntil - t,
      now,
      onEvict: (key) => options.onEvict?.('login-email', key),
    });
  }

  check(key: string): ThrottleDecision {
    const state = this.live(key);
    const time = this.now();
    if (!state || state.lockedUntil <= time) return ALLOW;
    return deny(state.lockedUntil - time);
  }

  /** Check and, if allowed, count this attempt as a failure right away (reset by recordSuccess). */
  reserve(key: string): ThrottleDecision {
    const decision = this.check(key);
    if (decision.allowed) this.recordFailure(key);
    return decision;
  }

  /** Lock duration after the n-th failure: 0 within budget, then base * 2^(n - free - 1), capped. */
  lockDurationMs(failures: number): number {
    const over = failures - this.options.freeAttempts;
    if (over <= 0) return 0;
    return Math.min(this.options.baseLockMs * 2 ** Math.min(over - 1, 30), this.options.maxLockMs);
  }

  recordFailure(key: string): void {
    const time = this.now();
    const failures = (this.live(key)?.failures ?? 0) + 1;
    this.store.set(key, {
      failures,
      lockedUntil: time + this.lockDurationMs(failures),
      lastFailureAt: time,
    });
  }

  recordSuccess(key: string): void {
    this.store.delete(key);
  }

  get size(): number {
    return this.store.size;
  }

  private live(key: string): FailureState | undefined {
    const state = this.store.get(key);
    return state && state.lastFailureAt + this.options.forgetAfterMs > this.now()
      ? state
      : undefined;
  }
}

interface EmailSet {
  readonly emails: ReadonlySet<string>;
  readonly resetAt: number;
}

/** Caps how many distinct keys (emails) one IP may introduce per window. */
export class DistinctKeyLimiter {
  private readonly store: BoundedStore<EmailSet>;

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    limits: StoreLimits = {},
  ) {
    this.store = new BoundedStore<EmailSet>({
      maxKeys: limits.maxKeys ?? DEFAULT_MAX_KEYS,
      expiresAt: (s) => s.resetAt,
      timeLeft: (s, t) => s.resetAt - t,
      now,
      onEvict: (key) => limits.onEvict?.('emails-per-ip', key),
    });
  }

  hit(ip: string, email: string): ThrottleDecision {
    const time = this.now();
    const current = this.store.get(ip);
    const base =
      !current || current.resetAt <= time
        ? { emails: new Set<string>(), resetAt: time + this.windowMs }
        : current;
    if (base.emails.has(email)) return ALLOW;
    if (base.emails.size >= this.max) return deny(base.resetAt - time);
    this.store.set(ip, { emails: new Set([...base.emails, email]), resetAt: base.resetAt });
    return ALLOW;
  }
}

export interface AuthThrottleConfig {
  readonly AUTH_RATE_LIMIT_MAX: number;
  readonly AUTH_RATE_LIMIT_WINDOW_MS: number;
  readonly AUTH_IP_RATE_LIMIT_MAX: number;
  readonly AUTH_EMAILS_PER_IP_MAX: number;
  readonly REGISTER_RATE_LIMIT_MAX: number;
}

/** Bundle of the limiters the auth service uses. */
export class AuthThrottle {
  readonly loginByIp: FixedWindowLimiter;
  readonly loginByEmail: ProgressiveBackoff;
  readonly emailsPerIp: DistinctKeyLimiter;
  readonly registerByIp: FixedWindowLimiter;

  constructor(config: AuthThrottleConfig, now: () => number = Date.now, limits: StoreLimits = {}) {
    const windowMs = config.AUTH_RATE_LIMIT_WINDOW_MS;
    this.loginByIp = new FixedWindowLimiter(config.AUTH_IP_RATE_LIMIT_MAX, windowMs, now, {
      ...limits,
      name: 'login-ip',
    });
    this.registerByIp = new FixedWindowLimiter(config.REGISTER_RATE_LIMIT_MAX, windowMs, now, {
      ...limits,
      name: 'register-ip',
    });
    this.emailsPerIp = new DistinctKeyLimiter(config.AUTH_EMAILS_PER_IP_MAX, windowMs, now, limits);
    this.loginByEmail = new ProgressiveBackoff(
      {
        freeAttempts: config.AUTH_RATE_LIMIT_MAX,
        baseLockMs: 30_000,
        maxLockMs: 60 * 60_000,
        forgetAfterMs: 24 * 60 * 60_000,
        ...limits,
      },
      now,
    );
  }
}
