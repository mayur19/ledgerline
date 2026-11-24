import { formatMinor, JOURNAL_STATUSES, journalEntryInputSchema } from '@ledgerline/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../../deps';
import { requirePermission } from '../../http/guards';
import { badRequest, notFound } from '../../lib/errors';
import { paginationSchema } from '../../lib/pagination';
import { sendData } from '../../lib/reply';
import { parse } from '../../lib/validate';
import { getEntity } from '../entities/entity.repository';
import { toEntryDetail, toEntrySummary } from './journal.mapper';
import { findEntry, findLines, listEntries } from './journal.repository';
import { createJournal, postDraft, previewJournal } from './posting.service';

const entityParams = z.object({ entityId: z.string() });
const entryParams = z.object({ entityId: z.string(), journalId: z.string().uuid() });
const createBody = journalEntryInputSchema.extend({ post: z.boolean().default(false) });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const listQuery = paginationSchema.extend({
  status: z.enum(JOURNAL_STATUSES).optional(),
  from: date.optional(),
  to: date.optional(),
});
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,100}$/;

function idempotencyKey(request: FastifyRequest): string | null {
  const raw = request.headers['idempotency-key'];
  if (raw === undefined) return null;
  if (typeof raw !== 'string' || !IDEMPOTENCY_KEY.test(raw)) {
    throw badRequest('Idempotency-Key must be 8-100 characters of [A-Za-z0-9_.:-]');
  }
  return raw;
}

const meta = (request: FastifyRequest) => ({ requestId: request.id, ip: request.ip });

export function registerJournalRoutes(app: FastifyInstance, { db }: AppDeps): void {
  const base = '/api/v1/entities/:entityId/journals';

  app.get(base, { preHandler: requirePermission('entity.view') }, async (request, reply) => {
    const { entityId } = parse(entityParams, request.params);
    const filter = parse(listQuery, request.query);
    const orgId = request.auth!.organizationId;
    const entity = await getEntity(db, orgId, entityId);
    const { rows, total } = await listEntries(db, orgId, entity.id, filter);
    return sendData(request, reply, rows.map(toEntrySummary), 200, {
      total,
      limit: filter.limit,
      offset: filter.offset,
    });
  });

  app.get(
    `${base}/:journalId`,
    { preHandler: requirePermission('entity.view') },
    async (request, reply) => {
      const { entityId, journalId } = parse(entryParams, request.params);
      const orgId = request.auth!.organizationId;
      const entity = await getEntity(db, orgId, entityId);
      const row = await findEntry(db, orgId, entity.id, journalId);
      if (!row) throw notFound('Journal entry');
      return sendData(request, reply, toEntryDetail(row, await findLines(db, journalId)));
    },
  );

  app.post(base, { preHandler: requirePermission('journal.create') }, async (request, reply) => {
    const { entityId } = parse(entityParams, request.params);
    const { post, ...input } = parse(createBody, request.body);
    const auth = request.auth!;
    if (post && !auth.permissions.includes('journal.post')) {
      throw badRequest('You may save drafts but not post; omit "post" or ask a poster');
    }
    const entity = await getEntity(db, auth.organizationId, entityId);
    const result = await createJournal(db, auth, entity, input, {
      post,
      idempotencyKey: idempotencyKey(request),
      meta: meta(request),
    });
    if (result.replayed) reply.header('Idempotent-Replayed', 'true');
    return sendData(request, reply, result.entry, result.replayed ? 200 : 201);
  });

  app.post(
    `${base}/preview`,
    { preHandler: requirePermission('journal.create') },
    async (request, reply) => {
      const { entityId } = parse(entityParams, request.params);
      const input = parse(journalEntryInputSchema, request.body);
      const auth = request.auth!;
      const entity = await getEntity(db, auth.organizationId, entityId);
      const { period, prepared } = await previewJournal(db, auth, entity, input);
      const fn = entity.functionalCurrency;
      return sendData(request, reply, {
        period: { id: period.id, name: period.name, status: period.status },
        functionalCurrency: fn,
        totalDebit: formatMinor(prepared.totalDebitFunctional, fn),
        totalCredit: formatMinor(prepared.totalCreditFunctional, fn),
        roundingAdjustment: formatMinor(prepared.roundingAdjustmentMinor, fn),
        lines: prepared.lines.map((l) => ({
          lineNumber: l.lineNumber,
          accountId: l.accountId,
          side: l.side,
          currency: l.currency,
          amount: formatMinor(l.amountMinor, l.currency),
          rate: l.rate,
          functionalAmount: formatMinor(l.functionalMinor, fn),
          memo: l.memo,
          isRoundingAdjustment: l.isRoundingAdjustment,
        })),
      });
    },
  );

  app.post(
    `${base}/:journalId/post`,
    { preHandler: requirePermission('journal.post') },
    async (request, reply) => {
      const { entityId, journalId } = parse(entryParams, request.params);
      const auth = request.auth!;
      const entity = await getEntity(db, auth.organizationId, entityId);
      return sendData(request, reply, await postDraft(db, auth, entity, journalId, meta(request)));
    },
  );
}
