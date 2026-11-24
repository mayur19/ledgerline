import { loginSchema, permissionsFor, registerSchema, type Role } from '@ledgerline/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppDeps } from '../../deps';
import { clearAuthCookies, setAuthCookies } from '../../http/cookies';
import { requireAuth } from '../../http/guards';
import { sendData } from '../../lib/reply';
import { parse } from '../../lib/validate';
import { findActiveSession } from './session.repository';
import {
  login,
  logout,
  register,
  REGISTRATION_ACCEPTED_MESSAGE,
  type ClientInfo,
} from './auth.service';
import { hashToken } from '../../security/tokens';

const clientInfo = (request: FastifyRequest): ClientInfo => ({
  ip: request.ip,
  userAgent: request.headers['user-agent'] ?? null,
  requestId: request.id,
});

function profile(row: {
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  role: Role;
}) {
  return {
    user: { id: row.userId, email: row.email, displayName: row.displayName },
    organization: { id: row.organizationId, name: row.organizationName },
    role: row.role,
    permissions: permissionsFor(row.role),
  };
}

export function registerAuthRoutes(app: FastifyInstance, deps: AppDeps): void {
  const sessionProfile = async (token: string) => {
    const row = await findActiveSession(deps.db, hashToken(token, deps.env.SESSION_SECRET));
    if (!row) throw new Error('Session vanished immediately after creation');
    return profile({
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      role: row.role,
    });
  };

  app.post('/api/v1/auth/register', async (request, reply) => {
    const input = parse(registerSchema, request.body);
    await register(deps, input, clientInfo(request));
    return sendData(request, reply, { message: REGISTRATION_ACCEPTED_MESSAGE }, 202);
  });

  app.post('/api/v1/auth/login', async (request, reply) => {
    const input = parse(loginSchema, request.body);
    const session = await login(deps, input, clientInfo(request));
    setAuthCookies(reply, deps.env, session.sessionToken, session.csrfToken);
    return sendData(request, reply, {
      ...(await sessionProfile(session.sessionToken)),
      csrfToken: session.csrfToken,
    });
  });

  app.post('/api/v1/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
    await logout(deps, request.auth!.sessionId);
    clearAuthCookies(reply);
    return sendData(request, reply, { loggedOut: true });
  });

  app.get('/api/v1/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    return sendData(request, reply, profile(request.auth!));
  });
}
