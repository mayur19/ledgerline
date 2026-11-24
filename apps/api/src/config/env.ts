import { isIP } from 'node:net';
import { z } from 'zod';

const CIDR = /^(.+)\/(\d{1,3})$/;

function isIpOrCidr(value: string): boolean {
  const match = CIDR.exec(value);
  if (!match) return isIP(value) !== 0;
  const version = isIP(match[1] ?? '');
  const bits = Number(match[2]);
  return (version === 4 && bits <= 32) || (version === 6 && bits <= 128);
}

/**
 * TRUST_PROXY (ADR-0011): `false` (default) trusts no proxy, a positive integer
 * trusts that many hops, or a comma-separated list of proxy IPs/CIDRs. A blanket
 * `true` is rejected on purpose: it lets any client spoof X-Forwarded-For and
 * defeat IP-based login throttling.
 */
export type TrustProxy = false | number | string[];

const trustProxy = z
  .string()
  .default('false')
  .transform((raw, ctx): TrustProxy => {
    const value = raw.trim();
    if (value === '' || value === 'false' || value === '0') return false;
    if (/^\d+$/.test(value)) return Number(value);
    const list = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (list.length > 0 && list.every(isIpOrCidr)) return list;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'TRUST_PROXY must be false, a hop count, or a comma-separated list of proxy IPs/CIDRs',
    });
    return z.NEVER;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4101),
  APP_ORIGIN: z.string().url().default('http://localhost:5101'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(15 * 60 * 1000),
  /** Attempts per IP per window for login (password spraying guard). */
  AUTH_IP_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(50),
  /** Distinct emails one IP may try per window (stops store flooding). */
  AUTH_EMAILS_PER_IP_MAX: z.coerce.number().int().min(1).default(20),
  /** Registrations per IP per window. */
  REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(5),
  TRUST_PROXY: trustProxy,
});

export type Env = z.infer<typeof envSchema>;

/** Parse and validate the process environment. Fails fast with every problem listed. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${problems}`);
  }
  if (parsed.data.NODE_ENV === 'production' && (source.TRUST_PROXY ?? '').trim() === '') {
    throw new Error(
      'Invalid environment configuration: TRUST_PROXY must be set explicitly in production (false, a hop count, or proxy IPs/CIDRs)',
    );
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.SESSION_SECRET.includes('replace-me')) {
    throw new Error(
      'Invalid environment configuration: SESSION_SECRET still has the placeholder value',
    );
  }
  return parsed.data;
}
