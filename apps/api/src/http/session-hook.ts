import { permissionsFor } from '@ledgerline/shared';
import type { FastifyRequest } from 'fastify';
import type { AppDeps } from '../deps';
import { AppError } from '../lib/errors';
import { findActiveSession, touchSession } from '../modules/auth/session.repository';
import { hashToken, safeEqual } from '../security/tokens';
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from './cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Resolve the session cookie into `request.auth` (or null). */
export function createSessionLoader({ db, env }: AppDeps) {
  return async function loadSession(request: FastifyRequest): Promise<void> {
    request.auth = null;
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return;
    const row = await findActiveSession(db, hashToken(token, env.SESSION_SECRET));
    if (!row) return;
    request.auth = {
      sessionId: row.session_id,
      userId: row.user_id,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      permissions: permissionsFor(row.role),
      csrfTokenHash: row.csrf_token_hash,
    };
    await touchSession(db, row.session_id);
  };
}

/**
 * Double-submit CSRF check for every unsafe request made with a session:
 * header must equal the csrf cookie AND hash to the value bound to the session.
 */
export function createCsrfCheck({ env }: AppDeps) {
  return async function checkCsrf(request: FastifyRequest): Promise<void> {
    if (SAFE_METHODS.has(request.method) || !request.auth) return;
    const header = request.headers[CSRF_HEADER];
    const cookie = request.cookies[CSRF_COOKIE];
    const valid =
      typeof header === 'string' &&
      typeof cookie === 'string' &&
      safeEqual(header, cookie) &&
      safeEqual(hashToken(header, env.SESSION_SECRET), request.auth.csrfTokenHash);
    if (!valid) throw new AppError(403, 'CSRF_INVALID', 'Missing or invalid CSRF token');
  };
}
