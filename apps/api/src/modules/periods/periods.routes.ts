import {
  canTransitionPeriod,
  createFiscalYearSchema,
  generateMonthlyPeriods,
  periodTransitionSchema,
} from '@ledgerline/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../../deps';
import { isExclusionViolation, isUniqueViolation, withTransaction } from '../../db/pool';
import { requirePermission } from '../../http/guards';
import { conflict, notFound } from '../../lib/errors';
import { sendData } from '../../lib/reply';
import { parse } from '../../lib/validate';
import { auditContext, recordAudit } from '../audit/audit.service';
import { getEntity } from '../entities/entity.repository';
import {
  countDrafts,
  ensureSequence,
  insertPeriods,
  listPeriods,
  lockPeriod,
  setPeriodStatus,
} from './period.repository';

const entityParams = z.object({ entityId: z.string() });
const periodParams = z.object({ entityId: z.string(), periodId: z.string().uuid() });
const listQuery = z.object({ fiscalYear: z.coerce.number().int().min(1900).max(9999).optional() });

export function registerPeriodRoutes(app: FastifyInstance, { db }: AppDeps): void {
  app.get(
    '/api/v1/entities/:entityId/periods',
    { preHandler: requirePermission('entity.view') },
    async (request, reply) => {
      const { entityId } = parse(entityParams, request.params);
      const { fiscalYear } = parse(listQuery, request.query);
      const orgId = request.auth!.organizationId;
      const entity = await getEntity(db, orgId, entityId);
      return sendData(request, reply, await listPeriods(db, orgId, entity.id, fiscalYear));
    },
  );

  app.post(
    '/api/v1/entities/:entityId/fiscal-years',
    { preHandler: requirePermission('period.manage') },
    async (request, reply) => {
      const { entityId } = parse(entityParams, request.params);
      const input = parse(createFiscalYearSchema, request.body);
      const orgId = request.auth!.organizationId;
      const drafts = generateMonthlyPeriods(input.startMonth, input.periods);
      const periods = await withTransaction(db, async (tx) => {
        const entity = await getEntity(tx, orgId, entityId, 'update');
        const created = await insertPeriods(tx, orgId, entity.id, drafts).catch(
          (error: unknown) => {
            if (isExclusionViolation(error) || isUniqueViolation(error)) {
              throw conflict(
                'PERIOD_OVERLAP',
                'These periods overlap existing periods of the entity',
              );
            }
            throw error;
          },
        );
        await ensureSequence(tx, entity.id, drafts[0]!.fiscalYear);
        await recordAudit(tx, {
          ...auditContext(request),
          action: 'fiscal_year.created',
          targetType: 'entity',
          targetId: entity.id,
          entityId: entity.id,
          metadata: {
            fiscalYear: drafts[0]!.fiscalYear,
            periods: drafts.length,
            startMonth: input.startMonth,
          },
        });
        return created;
      });
      return sendData(request, reply, periods, 201);
    },
  );

  app.post(
    '/api/v1/entities/:entityId/periods/:periodId/transition',
    { preHandler: requirePermission('period.manage') },
    async (request, reply) => {
      const { entityId, periodId } = parse(periodParams, request.params);
      const { to, reason } = parse(periodTransitionSchema, request.body);
      const orgId = request.auth!.organizationId;
      const period = await withTransaction(db, async (tx) => {
        const entity = await getEntity(tx, orgId, entityId);
        const current = await lockPeriod(tx, orgId, entity.id, periodId);
        if (!current) throw notFound('Period');
        if (!canTransitionPeriod(current.status, to)) {
          throw conflict(
            'INVALID_PERIOD_TRANSITION',
            `Cannot move a period from ${current.status} to ${to}`,
            {
              from: current.status,
              to,
            },
          );
        }
        if (to === 'closed') {
          const drafts = await countDrafts(tx, current.id);
          if (drafts > 0) {
            throw conflict(
              'PERIOD_HAS_DRAFTS',
              `Post or discard ${drafts} draft entries before closing`,
              { drafts },
            );
          }
        }
        const updated = await setPeriodStatus(tx, current.id, to, request.auth!.userId);
        await recordAudit(tx, {
          ...auditContext(request),
          action: 'period.status_changed',
          targetType: 'period',
          targetId: current.id,
          entityId: entity.id,
          metadata: { from: current.status, to, reason: reason ?? null, period: current.name },
        });
        return updated;
      });
      return sendData(request, reply, period);
    },
  );
}
