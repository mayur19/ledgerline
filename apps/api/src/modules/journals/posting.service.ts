import { createHash } from 'node:crypto';
import {
  hasPermission,
  isCurrencyCode,
  periodPostingRule,
  prepareEntry,
  type CurrencyCode,
  type JournalEntryInput,
  type JournalLineInput,
  type PreparedEntry,
  type Rate,
} from '@ledgerline/shared';
import { isUniqueViolation, withTransaction, type Db, type Queryable } from '../../db/pool';
import { AppError, conflict, forbidden, notFound, unprocessable } from '../../lib/errors';
import type { AuthContext } from '../../types';
import { recordAudit } from '../audit/audit.service';
import { findAccountsByIds } from '../accounts/account.repository';
import type { EntityRecord } from '../entities/entity.repository';
import { findSpotRate } from '../fx/fx.repository';
import { findPeriodForDate, type PeriodRecord } from '../periods/period.repository';
import { linesToInput, toEntryDetail } from './journal.mapper';
import {
  deleteLines,
  findEntry,
  findEntryByIdempotencyKey,
  findLines,
  insertDraft,
  insertLines,
  markPosted,
  nextSequenceNumber,
  setDraftTotals,
} from './journal.repository';

export type PostingMode = 'draft' | 'post' | 'preview';

export interface RequestMeta {
  readonly requestId: string;
  readonly ip: string;
}

/** Enforce period status rules (docs/design/system-design.md §2). */
function assertPeriodAllows(
  period: PeriodRecord | null,
  mode: PostingMode,
  auth: AuthContext,
  date: string,
): PeriodRecord {
  if (!period) {
    throw unprocessable(
      'PERIOD_NOT_FOUND',
      `No accounting period covers ${date}; create the fiscal year first`,
    );
  }
  const rule = periodPostingRule(period.status);
  if (rule === 'blocked') {
    throw conflict('PERIOD_CLOSED', `Period ${period.name} is closed`, { periodId: period.id });
  }
  if (
    mode === 'post' &&
    rule === 'requires_override' &&
    !hasPermission(auth.role, 'journal.post_soft_closed')
  ) {
    throw new AppError(
      403,
      'PERIOD_SOFT_CLOSED',
      `Period ${period.name} is soft-closed; a controller must post`,
      {
        periodId: period.id,
      },
    );
  }
  return period;
}

async function loadRates(
  tx: Queryable,
  orgId: string,
  functional: CurrencyCode,
  lines: readonly JournalLineInput[],
  date: string,
): Promise<ReadonlyMap<CurrencyCode, Rate>> {
  const foreign = [...new Set(lines.map((l) => l.currency.toUpperCase()))].filter(
    (c): c is CurrencyCode => isCurrencyCode(c) && c !== functional,
  );
  const entries = await Promise.all(
    foreign.map(
      async (currency) =>
        [currency, await findSpotRate(tx, orgId, currency, functional, date)] as const,
    ),
  );
  return new Map(entries.filter((e): e is readonly [CurrencyCode, Rate] => e[1] !== undefined));
}

/** Gather everything the pure engine needs, inside the caller's transaction, then run it. */
async function prepareInTx(
  tx: Queryable,
  auth: AuthContext,
  entity: EntityRecord,
  input: Pick<JournalEntryInput, 'entryDate' | 'lines'>,
  mode: PostingMode,
): Promise<{ period: PeriodRecord; prepared: PreparedEntry }> {
  const lock = mode === 'preview' ? 'none' : 'share';
  const period = assertPeriodAllows(
    await findPeriodForDate(tx, entity.id, input.entryDate, lock),
    mode,
    auth,
    input.entryDate,
  );
  const accountIds = [...new Set(input.lines.map((l) => l.accountId))];
  const accounts = await findAccountsByIds(tx, auth.organizationId, entity.id, accountIds);
  const rates = await loadRates(
    tx,
    auth.organizationId,
    entity.functionalCurrency,
    input.lines,
    input.entryDate,
  );
  const result = prepareEntry(input.lines, {
    functionalCurrency: entity.functionalCurrency,
    accounts: new Map(accounts.map((a) => [a.id, a] as const)),
    lookupRate: (currency) => rates.get(currency),
    roundingAccountId: entity.roundingAccountId,
  });
  if (!result.ok) {
    throw unprocessable('JOURNAL_INVALID', 'The journal entry is not valid', {
      errors: result.errors,
    });
  }
  return { period, prepared: result.value };
}

const entryNumber = (entity: EntityRecord, fiscalYear: number, sequence: bigint): string =>
  `${entity.code}-${fiscalYear}-${sequence.toString().padStart(6, '0')}`;

async function postWithinTx(
  tx: Queryable,
  auth: AuthContext,
  entity: EntityRecord,
  entryId: string,
  period: PeriodRecord,
  prepared: PreparedEntry,
): Promise<string> {
  const sequence = await nextSequenceNumber(tx, entity.id, period.fiscalYear);
  const number = entryNumber(entity, period.fiscalYear, sequence);
  await markPosted(tx, entryId, {
    sequenceNumber: sequence,
    entryNumber: number,
    total: prepared.totalDebitFunctional,
    postedBy: auth.userId,
  });
  return number;
}

export function fingerprint(input: JournalEntryInput, post: boolean): string {
  return createHash('sha256').update(JSON.stringify({ input, post })).digest('hex');
}

export interface CreateResult {
  readonly entry: ReturnType<typeof toEntryDetail>;
  readonly replayed: boolean;
}

async function replay(
  db: Queryable,
  auth: AuthContext,
  entity: EntityRecord,
  id: string,
  print: string,
): Promise<CreateResult> {
  const row = await findEntry(db, auth.organizationId, entity.id, id);
  if (!row) throw notFound('Journal entry');
  if (row.idempotency_fingerprint !== print) {
    throw unprocessable(
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was used with a different request',
    );
  }
  return { entry: toEntryDetail(row, await findLines(db, id)), replayed: true };
}

/**
 * Create a journal entry (draft, or draft + post in one transaction).
 * Safe to retry with the same Idempotency-Key.
 */
export async function createJournal(
  db: Db,
  auth: AuthContext,
  entity: EntityRecord,
  input: JournalEntryInput,
  options: { post: boolean; idempotencyKey: string | null; meta: RequestMeta },
): Promise<CreateResult> {
  const print = fingerprint(input, options.post);
  if (options.idempotencyKey) {
    const existing = await findEntryByIdempotencyKey(db, entity.id, options.idempotencyKey);
    if (existing) return replay(db, auth, entity, existing, print);
  }
  try {
    const id = await withTransaction(db, async (tx) => {
      const mode = options.post ? 'post' : 'draft';
      const { period, prepared } = await prepareInTx(tx, auth, entity, input, mode);
      const entryId = await insertDraft(tx, {
        organizationId: auth.organizationId,
        entityId: entity.id,
        periodId: period.id,
        fiscalYear: period.fiscalYear,
        entryDate: input.entryDate,
        memo: input.memo,
        reference: input.reference ?? null,
        functionalCurrency: entity.functionalCurrency,
        idempotencyKey: options.idempotencyKey,
        idempotencyFingerprint: options.idempotencyKey ? print : null,
        createdBy: auth.userId,
      });
      await insertLines(tx, entryId, entity.id, prepared.lines);
      await setDraftTotals(tx, entryId, prepared.totalDebitFunctional);
      const number = options.post
        ? await postWithinTx(tx, auth, entity, entryId, period, prepared)
        : null;
      await recordAudit(tx, {
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        action: options.post ? 'journal.posted' : 'journal.draft_created',
        targetType: 'journal_entry',
        targetId: entryId,
        entityId: entity.id,
        requestId: options.meta.requestId,
        ipAddress: options.meta.ip,
        metadata: {
          entryNumber: number,
          lines: prepared.lines.length,
          total: prepared.totalDebitFunctional.toString(),
        },
      });
      return entryId;
    });
    const row = await findEntry(db, auth.organizationId, entity.id, id);
    return { entry: toEntryDetail(row!, await findLines(db, id)), replayed: false };
  } catch (error) {
    if (options.idempotencyKey && isUniqueViolation(error)) {
      const existing = await findEntryByIdempotencyKey(db, entity.id, options.idempotencyKey);
      if (existing) return replay(db, auth, entity, existing, print);
    }
    throw error;
  }
}

/** Post an existing draft: lock it, re-validate against current accounts and period, number it. */
export async function postDraft(
  db: Db,
  auth: AuthContext,
  entity: EntityRecord,
  entryId: string,
  meta: RequestMeta,
): Promise<ReturnType<typeof toEntryDetail>> {
  await withTransaction(db, async (tx) => {
    const row = await findEntry(tx, auth.organizationId, entity.id, entryId, 'update');
    if (!row) throw notFound('Journal entry');
    if (row.status !== 'draft') {
      throw conflict('JOURNAL_NOT_DRAFT', `Entry is already ${row.status}`, { status: row.status });
    }
    const lines = linesToInput(await findLines(tx, entryId));
    const { period, prepared } = await prepareInTx(
      tx,
      auth,
      entity,
      { entryDate: row.entry_date, lines },
      'post',
    );
    await deleteLines(tx, entryId);
    await insertLines(tx, entryId, entity.id, prepared.lines);
    const number = await postWithinTx(tx, auth, entity, entryId, period, prepared);
    await recordAudit(tx, {
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      action: 'journal.posted',
      targetType: 'journal_entry',
      targetId: entryId,
      entityId: entity.id,
      requestId: meta.requestId,
      ipAddress: meta.ip,
      metadata: { entryNumber: number, fromDraft: true },
    });
  });
  const row = await findEntry(db, auth.organizationId, entity.id, entryId);
  return toEntryDetail(row!, await findLines(db, entryId));
}

/** Dry run: validate and compute functional amounts without persisting anything. */
export async function previewJournal(
  db: Db,
  auth: AuthContext,
  entity: EntityRecord,
  input: JournalEntryInput,
) {
  if (!hasPermission(auth.role, 'journal.create')) throw forbidden();
  const { period, prepared } = await prepareInTx(db, auth, entity, input, 'preview');
  return { period, prepared };
}
