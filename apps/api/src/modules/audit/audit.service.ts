import type { FastifyRequest } from 'fastify';
import type { Queryable } from '../../db/pool';

export interface AuditEvent {
  readonly organizationId: string;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly targetType: string;
  readonly targetId?: string | null;
  readonly entityId?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly requestId?: string | null;
  readonly ipAddress?: string | null;
}

/**
 * Append an audit event. Always called with the same transaction as the change
 * it describes, so the trail can never disagree with the data (ADR-0013).
 */
export async function recordAudit(tx: Queryable, event: AuditEvent): Promise<void> {
  await tx.query(
    `INSERT INTO audit_events
       (organization_id, actor_user_id, action, target_type, target_id, entity_id, metadata, request_id, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      event.organizationId,
      event.actorUserId,
      event.action,
      event.targetType,
      event.targetId ?? null,
      event.entityId ?? null,
      JSON.stringify(event.metadata ?? {}),
      event.requestId ?? null,
      event.ipAddress ?? null,
    ],
  );
}

/** Audit fields derived from the current authenticated request. */
export function auditContext(request: FastifyRequest) {
  return {
    organizationId: request.auth?.organizationId ?? '',
    actorUserId: request.auth?.userId ?? null,
    requestId: request.id,
    ipAddress: request.ip,
  };
}
