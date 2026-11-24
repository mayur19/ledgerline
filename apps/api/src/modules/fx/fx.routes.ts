import { createFxRateSchema, CURRENCY_CODES } from '@ledgerline/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../../deps';
import { isUniqueViolation, withTransaction } from '../../db/pool';
import { requirePermission } from '../../http/guards';
import { conflict } from '../../lib/errors';
import { paginationSchema } from '../../lib/pagination';
import { sendData } from '../../lib/reply';
import { parse } from '../../lib/validate';
import { auditContext, recordAudit } from '../audit/audit.service';
import { insertRate, listRates } from './fx.repository';

const currency = z.enum(CURRENCY_CODES as [string, ...string[]]);
const listQuery = paginationSchema.extend({
  fromCurrency: currency.optional(),
  toCurrency: currency.optional(),
});

export function registerFxRoutes(app: FastifyInstance, { db }: AppDeps): void {
  app.get(
    '/api/v1/fx-rates',
    { preHandler: requirePermission('entity.view') },
    async (request, reply) => {
      const query = parse(listQuery, request.query);
      const rates = await listRates(db, request.auth!.organizationId, query);
      return sendData(request, reply, rates, 200, { limit: query.limit, offset: query.offset });
    },
  );

  app.post(
    '/api/v1/fx-rates',
    { preHandler: requirePermission('fx.manage') },
    async (request, reply) => {
      const input = parse(createFxRateSchema, request.body);
      const auth = request.auth!;
      const rate = await withTransaction(db, async (tx) => {
        const created = await insertRate(tx, auth.organizationId, auth.userId, input).catch(
          (error: unknown) => {
            if (isUniqueViolation(error)) {
              throw conflict(
                'FX_RATE_EXISTS',
                'A rate for this pair, type and date already exists',
              );
            }
            throw error;
          },
        );
        await recordAudit(tx, {
          ...auditContext(request),
          action: 'fx_rate.created',
          targetType: 'fx_rate',
          targetId: created.id,
          metadata: {
            pair: `${created.fromCurrency}/${created.toCurrency}`,
            rate: created.rate,
            date: created.rateDate,
          },
        });
        return created;
      });
      return sendData(request, reply, rate, 201);
    },
  );
}
