import type { JournalStatus, PreparedLine } from '@ledgerline/shared';
import type { Queryable } from '../../db/pool';

export interface EntryRow {
  id: string;
  entity_id: string;
  period_id: string;
  fiscal_year: number;
  sequence_number: string | null;
  entry_number: string | null;
  entry_date: string;
  memo: string;
  reference: string | null;
  status: JournalStatus;
  source: string;
  functional_currency: string;
  total_debit_functional: string;
  total_credit_functional: string;
  idempotency_fingerprint: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: Date;
  posted_by: string | null;
  posted_by_name: string | null;
  posted_at: Date | null;
}

export interface LineRow {
  line_number: number;
  account_id: string;
  account_code: string;
  account_name: string;
  side: 'debit' | 'credit';
  currency: string;
  amount_minor: string;
  rate: string;
  functional_minor: string;
  memo: string | null;
  is_rounding_adjustment: boolean;
}

const ENTRY_COLUMNS = `e.id, e.entity_id, e.period_id, e.fiscal_year, e.sequence_number, e.entry_number, e.entry_date,
  e.memo, e.reference, e.status, e.source, e.functional_currency, e.total_debit_functional, e.total_credit_functional,
  e.idempotency_fingerprint, e.created_by, cu.display_name AS created_by_name, e.created_at,
  e.posted_by, pu.display_name AS posted_by_name, e.posted_at`;

const ENTRY_FROM = `journal_entries e
  LEFT JOIN users cu ON cu.id = e.created_by
  LEFT JOIN users pu ON pu.id = e.posted_by`;

export async function findEntry(
  db: Queryable,
  organizationId: string,
  entityId: string,
  entryId: string,
  lock: 'none' | 'update' = 'none',
): Promise<EntryRow | null> {
  const { rows } = await db.query<EntryRow>(
    `SELECT ${ENTRY_COLUMNS} FROM ${ENTRY_FROM}
      WHERE e.organization_id = $1 AND e.entity_id = $2 AND e.id = $3
      ${lock === 'update' ? 'FOR UPDATE OF e' : ''}`,
    [organizationId, entityId, entryId],
  );
  return rows[0] ?? null;
}

export async function findEntryByIdempotencyKey(
  db: Queryable,
  entityId: string,
  key: string,
): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    'SELECT id FROM journal_entries WHERE entity_id = $1 AND idempotency_key = $2',
    [entityId, key],
  );
  return rows[0]?.id ?? null;
}

export async function findLines(db: Queryable, entryId: string): Promise<LineRow[]> {
  const { rows } = await db.query<LineRow>(
    `SELECT l.line_number, l.account_id, a.code AS account_code, a.name AS account_name, l.side, l.currency,
            l.amount_minor, l.rate, l.functional_minor, l.memo, l.is_rounding_adjustment
       FROM journal_lines l JOIN accounts a ON a.id = l.account_id
      WHERE l.entry_id = $1 ORDER BY l.line_number`,
    [entryId],
  );
  return rows;
}

export interface ListFilter {
  readonly status?: JournalStatus | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly limit: number;
  readonly offset: number;
}

export async function listEntries(
  db: Queryable,
  organizationId: string,
  entityId: string,
  filter: ListFilter,
): Promise<{ rows: EntryRow[]; total: number }> {
  const { rows } = await db.query<EntryRow & { total: string }>(
    `SELECT ${ENTRY_COLUMNS}, count(*) OVER () AS total FROM ${ENTRY_FROM}
      WHERE e.organization_id = $1 AND e.entity_id = $2
        AND ($3::text IS NULL OR e.status = $3)
        AND ($4::date IS NULL OR e.entry_date >= $4)
        AND ($5::date IS NULL OR e.entry_date <= $5)
      ORDER BY e.entry_date DESC, e.sequence_number DESC NULLS FIRST, e.created_at DESC
      LIMIT $6 OFFSET $7`,
    [
      organizationId,
      entityId,
      filter.status ?? null,
      filter.from ?? null,
      filter.to ?? null,
      filter.limit,
      filter.offset,
    ],
  );
  return { rows, total: Number(rows[0]?.total ?? 0) };
}

export interface NewEntry {
  readonly organizationId: string;
  readonly entityId: string;
  readonly periodId: string;
  readonly fiscalYear: number;
  readonly entryDate: string;
  readonly memo: string;
  readonly reference: string | null;
  readonly functionalCurrency: string;
  readonly idempotencyKey: string | null;
  readonly idempotencyFingerprint: string | null;
  readonly createdBy: string;
}

/** Entries are always born as drafts; posting is a separate state transition. */
export async function insertDraft(db: Queryable, entry: NewEntry): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO journal_entries (organization_id, entity_id, period_id, fiscal_year, entry_date, memo, reference,
                                  functional_currency, idempotency_key, idempotency_fingerprint, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [
      entry.organizationId,
      entry.entityId,
      entry.periodId,
      entry.fiscalYear,
      entry.entryDate,
      entry.memo,
      entry.reference,
      entry.functionalCurrency,
      entry.idempotencyKey,
      entry.idempotencyFingerprint,
      entry.createdBy,
    ],
  );
  return rows[0]!.id;
}

/** Bulk insert lines in one round trip with unnest (500 lines max per entry). */
export async function insertLines(
  db: Queryable,
  entryId: string,
  entityId: string,
  lines: readonly PreparedLine[],
): Promise<void> {
  await db.query(
    `INSERT INTO journal_lines (entry_id, entity_id, line_number, account_id, side, currency, amount_minor, rate,
                                functional_minor, memo, is_rounding_adjustment)
     SELECT $1, $2, t.* FROM unnest($3::int[], $4::uuid[], $5::text[], $6::char(3)[], $7::bigint[], $8::numeric[],
                                    $9::bigint[], $10::text[], $11::boolean[])
       AS t(line_number, account_id, side, currency, amount_minor, rate, functional_minor, memo, is_rounding_adjustment)`,
    [
      entryId,
      entityId,
      lines.map((l) => l.lineNumber),
      lines.map((l) => l.accountId),
      lines.map((l) => l.side),
      lines.map((l) => l.currency),
      lines.map((l) => l.amountMinor.toString()),
      lines.map((l) => l.rate),
      lines.map((l) => l.functionalMinor.toString()),
      lines.map((l) => l.memo),
      lines.map((l) => l.isRoundingAdjustment),
    ],
  );
}

export async function deleteLines(db: Queryable, entryId: string): Promise<void> {
  await db.query('DELETE FROM journal_lines WHERE entry_id = $1', [entryId]);
}

export async function setDraftTotals(db: Queryable, entryId: string, total: bigint): Promise<void> {
  await db.query(
    'UPDATE journal_entries SET total_debit_functional = $2, total_credit_functional = $2 WHERE id = $1',
    [entryId, total.toString()],
  );
}

/**
 * Take the next gapless number for (entity, fiscal year). The UPDATE row-locks
 * the counter until commit, so concurrent posters queue here and a rollback
 * returns the number: no gaps, no duplicates (ADR-0008).
 */
export async function nextSequenceNumber(
  db: Queryable,
  entityId: string,
  fiscalYear: number,
): Promise<bigint> {
  await db.query(
    'INSERT INTO journal_sequences (entity_id, fiscal_year) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [entityId, fiscalYear],
  );
  const { rows } = await db.query<{ value: string }>(
    `UPDATE journal_sequences SET next_value = next_value + 1
      WHERE entity_id = $1 AND fiscal_year = $2 RETURNING next_value - 1 AS value`,
    [entityId, fiscalYear],
  );
  return BigInt(rows[0]!.value);
}

export async function markPosted(
  db: Queryable,
  entryId: string,
  posting: { sequenceNumber: bigint; entryNumber: string; total: bigint; postedBy: string },
): Promise<void> {
  await db.query(
    `UPDATE journal_entries
        SET status = 'posted', sequence_number = $2, entry_number = $3,
            total_debit_functional = $4, total_credit_functional = $4, posted_by = $5, posted_at = now()
      WHERE id = $1 AND status = 'draft'`,
    [
      entryId,
      posting.sequenceNumber.toString(),
      posting.entryNumber,
      posting.total.toString(),
      posting.postedBy,
    ],
  );
}
