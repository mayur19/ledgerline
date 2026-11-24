import { isIsoDate } from '@ledgerline/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../../deps';
import { requirePermission } from '../../http/guards';
import { sendData } from '../../lib/reply';
import { parse } from '../../lib/validate';
import { getEntity } from '../entities/entity.repository';
import { buildTrialBalance } from './trial-balance.service';

const params = z.object({ entityId: z.string() });
const isoDate = z.string().refine(isIsoDate, 'must be YYYY-MM-DD');
const query = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  includeZero: z.enum(['true', 'false']).default('false'),
});

export function registerReportRoutes(app: FastifyInstance, { db }: AppDeps): void {
  app.get(
    '/api/v1/entities/:entityId/reports/trial-balance',
    { preHandler: requirePermission('report.view') },
    async (request, reply) => {
      const { entityId } = parse(params, request.params);
      const q = parse(query, request.query);
      const orgId = request.auth!.organizationId;
      const entity = await getEntity(db, orgId, entityId);
      const to = q.to ?? new Date().toISOString().slice(0, 10);
      const report = await buildTrialBalance(db, orgId, entity, {
        from: q.from,
        to,
        includeZero: q.includeZero === 'true',
      });
      return sendData(request, reply, report);
    },
  );
}
