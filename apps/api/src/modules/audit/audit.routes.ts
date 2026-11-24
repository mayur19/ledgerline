import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../../deps';
import { requirePermission } from '../../http/guards';
import { paginationSchema } from '../../lib/pagination';
import { sendData } from '../../lib/reply';
import { parse } from '../../lib/validate';

const querySchema = paginationSchema.extend({
  action: z.string().max(80).optional(),
  targetType: z.string().max(80).optional(),
  targetId: z.string().max(80).optional(),
});

interface AuditRow {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  actor_user_id: string | null;
  actor_name: string | null;
  request_id: string | null;
  created_at: Date;
  total: string;
}

export function registerAuditRoutes(app: FastifyInstance, { db }: AppDeps): void {
  app.get(
    '/api/v1/audit-events',
    { preHandler: requirePermission('audit.view') },
    async (request, reply) => {
      const q = parse(querySchema, request.query);
      const { rows } = await db.query<AuditRow>(
        `SELECT a.id, a.action, a.target_type, a.target_id, a.entity_id, a.metadata, a.actor_user_id,
              u.display_name AS actor_name, a.request_id, a.created_at, count(*) OVER () AS total
         FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE a.organization_id = $1
          AND ($2::text IS NULL OR a.action = $2)
          AND ($3::text IS NULL OR a.target_type = $3)
          AND ($4::text IS NULL OR a.target_id = $4)
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $5 OFFSET $6`,
        [
          request.auth!.organizationId,
          q.action ?? null,
          q.targetType ?? null,
          q.targetId ?? null,
          q.limit,
          q.offset,
        ],
      );
      const data = rows.map((r) => ({
        id: r.id,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        entityId: r.entity_id,
        metadata: r.metadata,
        actor: r.actor_user_id ? { id: r.actor_user_id, displayName: r.actor_name } : null,
        requestId: r.request_id,
        createdAt: r.created_at.toISOString(),
      }));
      return sendData(request, reply, data, 200, {
        total: Number(rows[0]?.total ?? 0),
        limit: q.limit,
        offset: q.offset,
      });
    },
  );
}
