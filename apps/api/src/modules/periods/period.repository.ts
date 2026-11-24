import type { PeriodDraft, PeriodStatus } from '@ledgerline/shared';
import type { Queryable } from '../../db/pool';

export interface PeriodRecord {
  readonly id: string;
  readonly entityId: string;
  readonly fiscalYear: number;
  readonly periodNumber: number;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: PeriodStatus;
  readonly statusChangedAt: string;
}

interface PeriodRow {
  id: string;
  entity_id: string;
  fiscal_year: number;
  period_number: number;
  name: string;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  status_changed_at: Date;
}

const COLUMNS =
  'id, entity_id, fiscal_year, period_number, name, start_date, end_date, status, status_changed_at';

const toPeriod = (row: PeriodRow): PeriodRecord => ({
  id: row.id,
  entityId: row.entity_id,
  fiscalYear: row.fiscal_year,
  periodNumber: row.period_number,
  name: row.name,
  startDate: row.start_date,
  endDate: row.end_date,
  status: row.status,
  statusChangedAt: row.status_changed_at.toISOString(),
});

export async function listPeriods(
  db: Queryable,
  organizationId: string,
  entityId: string,
  fiscalYear?: number,
): Promise<PeriodRecord[]> {
  const { rows } = await db.query<PeriodRow>(
    `SELECT ${COLUMNS} FROM accounting_periods
      WHERE organization_id = $1 AND entity_id = $2 AND ($3::int IS NULL OR fiscal_year = $3)
      ORDER BY start_date`,
    [organizationId, entityId, fiscalYear ?? null],
  );
  return rows.map(toPeriod);
}

/**
 * Period containing `date`. `share` takes FOR SHARE so concurrent postings
 * proceed in parallel while a status change (FOR UPDATE) waits for them, and
 * vice versa (docs/design/system-design.md §5).
 */
export async function findPeriodForDate(
  db: Queryable,
  entityId: string,
  date: string,
  lock: 'none' | 'share' = 'none',
): Promise<PeriodRecord | null> {
  const { rows } = await db.query<PeriodRow>(
    `SELECT ${COLUMNS} FROM accounting_periods
      WHERE entity_id = $1 AND $2::date BETWEEN start_date AND end_date
      ${lock === 'share' ? 'FOR SHARE' : ''}`,
    [entityId, date],
  );
  return rows[0] ? toPeriod(rows[0]) : null;
}

export async function lockPeriod(
  db: Queryable,
  organizationId: string,
  entityId: string,
  periodId: string,
): Promise<PeriodRecord | null> {
  const { rows } = await db.query<PeriodRow>(
    `SELECT ${COLUMNS} FROM accounting_periods
      WHERE organization_id = $1 AND entity_id = $2 AND id = $3 FOR UPDATE`,
    [organizationId, entityId, periodId],
  );
  return rows[0] ? toPeriod(rows[0]) : null;
}

export async function insertPeriods(
  db: Queryable,
  organizationId: string,
  entityId: string,
  drafts: readonly PeriodDraft[],
): Promise<PeriodRecord[]> {
  const { rows } = await db.query<PeriodRow>(
    `INSERT INTO accounting_periods (organization_id, entity_id, fiscal_year, period_number, name, start_date, end_date)
     SELECT $1, $2, t.fiscal_year, t.period_number, t.name, t.start_date, t.end_date
       FROM unnest($3::int[], $4::smallint[], $5::text[], $6::date[], $7::date[])
         AS t(fiscal_year, period_number, name, start_date, end_date)
     RETURNING ${COLUMNS}`,
    [
      organizationId,
      entityId,
      drafts.map((d) => d.fiscalYear),
      drafts.map((d) => d.periodNumber),
      drafts.map((d) => d.name),
      drafts.map((d) => d.startDate),
      drafts.map((d) => d.endDate),
    ],
  );
  return rows.map(toPeriod).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function ensureSequence(
  db: Queryable,
  entityId: string,
  fiscalYear: number,
): Promise<void> {
  await db.query(
    'INSERT INTO journal_sequences (entity_id, fiscal_year) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [entityId, fiscalYear],
  );
}

export async function setPeriodStatus(
  db: Queryable,
  periodId: string,
  status: PeriodStatus,
  userId: string,
): Promise<PeriodRecord> {
  const { rows } = await db.query<PeriodRow>(
    `UPDATE accounting_periods SET status = $2, status_changed_at = now(), status_changed_by = $3
      WHERE id = $1 RETURNING ${COLUMNS}`,
    [periodId, status, userId],
  );
  return toPeriod(rows[0]!);
}

export async function countDrafts(db: Queryable, periodId: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT count(*) AS n FROM journal_entries WHERE period_id = $1 AND status = 'draft'`,
    [periodId],
  );
  return Number(rows[0]?.n ?? 0);
}
