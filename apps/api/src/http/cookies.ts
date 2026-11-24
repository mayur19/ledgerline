import type { FastifyReply } from 'fastify';
import type { Env } from '../config/env';

export const SESSION_COOKIE = 'll_session';
export const CSRF_COOKIE = 'll_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function setAuthCookies(
  reply: FastifyReply,
  env: Env,
  sessionToken: string,
  csrfToken: string,
): void {
  const base = {
    path: '/',
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    maxAge: env.SESSION_TTL_HOURS * 3600,
  };
  reply.setCookie(SESSION_COOKIE, sessionToken, { ...base, httpOnly: true });
  // Readable by the SPA for the double-submit header; useless to a cross-site attacker.
  reply.setCookie(CSRF_COOKIE, csrfToken, { ...base, httpOnly: false });
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
  reply.clearCookie(CSRF_COOKIE, { path: '/' });
}
