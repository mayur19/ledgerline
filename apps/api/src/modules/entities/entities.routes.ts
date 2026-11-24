import {
  createEntitySchema,
  STANDARD_RETAINED_EARNINGS_CODE,
  STANDARD_ROUNDING_CODE,
  updateEntitySettingsSchema,
} from '@ledgerline/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../../deps';
import { isUniqueViolation, withTransaction, type Queryable } from '../../db/pool';
import { requirePermission } from '../../http/guards';
import { conflict, unprocessable } from '../../lib/errors';
import { sendData } from '../../lib/reply';
import { parse } from '../../lib/validate';
import { findAccount } from '../accounts/account.repository';
import { applyStandardChart } from '../accounts/account.service';
import { auditContext, recordAudit } from '../audit/audit.service';
import { getEntity, insertEntity, listEntities, updateEntitySettings } from './entity.repository';

const createBody = createEntitySchema.extend({
  chartTemplate: z.enum(['standard', 'empty']).default('standard'),
});
const params = z.object({ entityId: z.string() });

async function assertSettingAccount(
  tx: Queryable,
  orgId: string,
  entityId: string,
  accountId: string | null | undefined,
  requiredType: 'equity' | null,
  label: string,
): Promise<void> {
  if (accountId === undefined || accountId === null) return;
  const account = await findAccount(tx, orgId, entityId, accountId);
  if (!account || !account.isPostable || !account.isActive) {
    throw unprocessable(
      'INVALID_SETTING_ACCOUNT',
      `${label} must be an active postable account of this entity`,
    );
  }
  if (requiredType && account.type !== requiredType) {
    throw unprocessable('INVALID_SETTING_ACCOUNT', `${label} must be an ${requiredType} account`);
  }
}

export function registerEntityRoutes(app: FastifyInstance, { db }: AppDeps): void {
  app.get(
    '/api/v1/entities',
    { preHandler: requirePermission('entity.view') },
    async (request, reply) =>
      sendData(request, reply, await listEntities(db, request.auth!.organizationId)),
  );

  app.get(
    '/api/v1/entities/:entityId',
    { preHandler: requirePermission('entity.view') },
    async (request, reply) => {
      const { entityId } = parse(params, request.params);
      return sendData(request, reply, await getEntity(db, request.auth!.organizationId, entityId));
    },
  );

  app.post(
    '/api/v1/entities',
    { preHandler: requirePermission('entity.manage') },
    async (request, reply) => {
      const input = parse(createBody, request.body);
      const orgId = request.auth!.organizationId;
      const entity = await withTransaction(db, async (tx) => {
        const created = await insertEntity(tx, {
          ...input,
          organizationId: orgId,
          countryCode: input.countryCode ?? null,
        }).catch((error: unknown) => {
          if (isUniqueViolation(error))
            throw conflict('ENTITY_CODE_TAKEN', `Entity code ${input.code} is already used`);
          throw error;
        });
        if (input.chartTemplate === 'standard') {
          const ids = await applyStandardChart(tx, orgId, created.id);
          await updateEntitySettings(tx, created.id, {
            roundingAccountId: ids.get(STANDARD_ROUNDING_CODE) ?? null,
            retainedEarningsAccountId: ids.get(STANDARD_RETAINED_EARNINGS_CODE) ?? null,
          });
        }
        await recordAudit(tx, {
          ...auditContext(request),
          action: 'entity.created',
          targetType: 'entity',
          targetId: created.id,
          entityId: created.id,
          metadata: {
            code: created.code,
            functionalCurrency: created.functionalCurrency,
            chartTemplate: input.chartTemplate,
          },
        });
        return getEntity(tx, orgId, created.id);
      });
      return sendData(request, reply, entity, 201);
    },
  );

  app.patch(
    '/api/v1/entities/:entityId/settings',
    { preHandler: requirePermission('entity.manage') },
    async (request, reply) => {
      const { entityId } = parse(params, request.params);
      const settings = parse(updateEntitySettingsSchema, request.body);
      const orgId = request.auth!.organizationId;
      const entity = await withTransaction(db, async (tx) => {
        const current = await getEntity(tx, orgId, entityId, 'update');
        await assertSettingAccount(
          tx,
          orgId,
          current.id,
          settings.roundingAccountId,
          null,
          'Rounding account',
        );
        await assertSettingAccount(
          tx,
          orgId,
          current.id,
          settings.retainedEarningsAccountId,
          'equity',
          'Retained earnings account',
        );
        await updateEntitySettings(tx, current.id, settings);
        await recordAudit(tx, {
          ...auditContext(request),
          action: 'entity.settings_updated',
          targetType: 'entity',
          targetId: current.id,
          entityId: current.id,
          metadata: { changes: settings },
        });
        return getEntity(tx, orgId, current.id);
      });
      return sendData(request, reply, entity);
    },
  );
}
