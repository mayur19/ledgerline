import { createAccountSchema, updateAccountSchema } from '@ledgerline/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../../deps';
import { withTransaction } from '../../db/pool';
import { requirePermission } from '../../http/guards';
import { notFound } from '../../lib/errors';
import { sendData } from '../../lib/reply';
import { parse } from '../../lib/validate';
import { auditContext, recordAudit } from '../audit/audit.service';
import { getEntity } from '../entities/entity.repository';
import { findAccount, listAccounts } from './account.repository';
import { createAccount, patchAccount } from './account.service';

const entityParams = z.object({ entityId: z.string() });
const accountParams = z.object({ entityId: z.string(), accountId: z.string().uuid() });
const listQuery = z.object({ includeInactive: z.enum(['true', 'false']).default('true') });

export function registerAccountRoutes(app: FastifyInstance, { db }: AppDeps): void {
  const base = '/api/v1/entities/:entityId/accounts';

  app.get(base, { preHandler: requirePermission('entity.view') }, async (request, reply) => {
    const { entityId } = parse(entityParams, request.params);
    const { includeInactive } = parse(listQuery, request.query);
    const orgId = request.auth!.organizationId;
    const entity = await getEntity(db, orgId, entityId);
    return sendData(
      request,
      reply,
      await listAccounts(db, orgId, entity.id, includeInactive === 'true'),
    );
  });

  app.get(
    `${base}/:accountId`,
    { preHandler: requirePermission('entity.view') },
    async (request, reply) => {
      const { entityId, accountId } = parse(accountParams, request.params);
      const orgId = request.auth!.organizationId;
      const entity = await getEntity(db, orgId, entityId);
      const account = await findAccount(db, orgId, entity.id, accountId);
      if (!account) throw notFound('Account');
      return sendData(request, reply, account);
    },
  );

  app.post(base, { preHandler: requirePermission('account.manage') }, async (request, reply) => {
    const { entityId } = parse(entityParams, request.params);
    const input = parse(createAccountSchema, request.body);
    const orgId = request.auth!.organizationId;
    const account = await withTransaction(db, async (tx) => {
      const entity = await getEntity(tx, orgId, entityId, 'update');
      const created = await createAccount(tx, orgId, entity.id, input);
      await recordAudit(tx, {
        ...auditContext(request),
        action: 'account.created',
        targetType: 'account',
        targetId: created.id,
        entityId: entity.id,
        metadata: { code: created.code, type: created.type },
      });
      return created;
    });
    return sendData(request, reply, account, 201);
  });

  app.patch(
    `${base}/:accountId`,
    { preHandler: requirePermission('account.manage') },
    async (request, reply) => {
      const { entityId, accountId } = parse(accountParams, request.params);
      const patch = parse(updateAccountSchema, request.body);
      const orgId = request.auth!.organizationId;
      const account = await withTransaction(db, async (tx) => {
        const entity = await getEntity(tx, orgId, entityId, 'update');
        const { before, after } = await patchAccount(tx, orgId, entity.id, accountId, patch);
        await recordAudit(tx, {
          ...auditContext(request),
          action: 'account.updated',
          targetType: 'account',
          targetId: accountId,
          entityId: entity.id,
          metadata: {
            before: { name: before.name, isActive: before.isActive, parentId: before.parentId },
            changes: patch,
          },
        });
        return after;
      });
      return sendData(request, reply, account);
    },
  );
}
