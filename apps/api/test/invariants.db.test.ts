import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Db } from '../src/db/pool';
import { withTransaction } from '../src/db/pool';
import { describeDb, freshDatabase } from './db-setup';

describeDb('database-enforced ledger invariants', () => {
  let db: Db;
  let posted: { id: string; entity_id: string; period_id: string; organization_id: string };

  beforeAll(async () => {
    db = await freshDatabase();
    const { rows } = await db.query(
      `SELECT id, entity_id, period_id, organization_id FROM journal_entries WHERE status = 'posted' LIMIT 1`,
    );
    posted = rows[0] as typeof posted;
  });
  afterAll(async () => db?.end());

  const sqlstate = async (work: Promise<unknown>) => {
    try {
      await work;
      return 'none';
    } catch (error) {
      return (error as { code?: string }).code;
    }
  };

  it('forbids changing or deleting posted lines', async () => {
    expect(
      await sqlstate(
        db.query('UPDATE journal_lines SET amount_minor = 1 WHERE entry_id = $1', [posted.id]),
      ),
    ).toBe('LL002');
    expect(
      await sqlstate(db.query('DELETE FROM journal_lines WHERE entry_id = $1', [posted.id])),
    ).toBe('LL002');
  });

  it('forbids editing or deleting a posted entry', async () => {
    expect(
      await sqlstate(
        db.query(`UPDATE journal_entries SET memo = 'edited' WHERE id = $1`, [posted.id]),
      ),
    ).toBe('LL002');
    expect(await sqlstate(db.query('DELETE FROM journal_entries WHERE id = $1', [posted.id]))).toBe(
      'LL002',
    );
  });

  it('rejects an unbalanced posted entry at commit even if the application is bypassed', async () => {
    const attempt = withTransaction(db, async (tx) => {
      const entity = await tx.query(
        'SELECT e.id, e.code, e.functional_currency FROM entities e WHERE id = $1',
        [posted.entity_id],
      );
      const { rows: accts } = await tx.query<Record<string, string>>(
        `SELECT id FROM accounts WHERE entity_id = $1 AND is_postable LIMIT 2`,
        [posted.entity_id],
      );
      const { rows } = await tx.query<Record<string, string>>(
        `INSERT INTO journal_entries (organization_id, entity_id, period_id, fiscal_year, entry_date, memo, functional_currency)
         SELECT $1, $2, id, fiscal_year, start_date, 'rogue', $3 FROM accounting_periods WHERE id = $4 RETURNING id`,
        [
          posted.organization_id,
          posted.entity_id,
          entity.rows[0]!.functional_currency,
          posted.period_id,
        ],
      );
      const id = rows[0]!.id;
      await tx.query(
        `INSERT INTO journal_lines (entry_id, entity_id, line_number, account_id, side, currency, amount_minor, rate, functional_minor)
         VALUES ($1, $2, 1, $3, 'debit', $5, 100, 1, 100), ($1, $2, 2, $4, 'credit', $5, 99, 1, 99)`,
        [id, posted.entity_id, accts[0]!.id, accts[1]!.id, entity.rows[0]!.functional_currency],
      );
      await tx.query(
        `UPDATE journal_entries SET status = 'posted', sequence_number = 999999, entry_number = 'ROGUE', posted_at = now(),
                total_debit_functional = 100, total_credit_functional = 100 WHERE id = $1`,
        [id],
      );
    });
    expect(await sqlstate(attempt)).toBe('LL003');
  });

  it('keeps the audit trail append-only', async () => {
    expect(await sqlstate(db.query(`UPDATE audit_events SET action = 'x'`))).toBe('LL001');
    expect(await sqlstate(db.query('DELETE FROM audit_events'))).toBe('LL001');
  });

  it('rejects lines that point at another entity’s account', async () => {
    const { rows } = await db.query<Record<string, string>>(
      `SELECT id FROM accounts WHERE entity_id <> $1 LIMIT 1`,
      [posted.entity_id],
    );
    const draft = await db.query<Record<string, string>>(
      `INSERT INTO journal_entries (organization_id, entity_id, period_id, fiscal_year, entry_date, memo, functional_currency)
       SELECT $1, $2, id, fiscal_year, start_date, 'draft', 'USD' FROM accounting_periods WHERE id = $3 RETURNING id`,
      [posted.organization_id, posted.entity_id, posted.period_id],
    );
    const result = await sqlstate(
      db.query(
        `INSERT INTO journal_lines (entry_id, entity_id, line_number, account_id, side, currency, amount_minor, rate, functional_minor)
         VALUES ($1, $2, 1, $3, 'debit', 'USD', 1, 1, 1)`,
        [draft.rows[0]!.id, posted.entity_id, rows[0]!.id],
      ),
    );
    expect(result).toBe('23503');
  });

  it('rejects overlapping periods at the database level', async () => {
    const result = await sqlstate(
      db.query(
        `INSERT INTO accounting_periods (organization_id, entity_id, fiscal_year, period_number, name, start_date, end_date)
         VALUES ($1, $2, 2099, 1, 'overlap', '2026-01-15', '2026-02-14')`,
        [posted.organization_id, posted.entity_id],
      ),
    );
    expect(result).toBe('23P01');
  });
});
