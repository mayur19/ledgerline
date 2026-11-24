import type { Permission, Role } from '@ledgerline/shared';

export interface AuthContext {
  readonly sessionId: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: Role;
  readonly permissions: readonly Permission[];
  readonly csrfTokenHash: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}
