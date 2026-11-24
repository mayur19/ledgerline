import type { Permission } from '@ledgerline/shared';
import type { FastifyRequest } from 'fastify';
import { forbidden, unauthorized } from '../lib/errors';

export async function requireAuth(request: FastifyRequest): Promise<void> {
  if (!request.auth) throw unauthorized();
}

/** Route guard: authenticated and holding `permission` (RBAC matrix in @ledgerline/shared). */
export function requirePermission(permission: Permission) {
  return async function guard(request: FastifyRequest): Promise<void> {
    if (!request.auth) throw unauthorized();
    if (!request.auth.permissions.includes(permission)) throw forbidden();
  };
}
