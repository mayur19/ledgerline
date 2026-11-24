import {
  computeTrialBalance,
  formatMinor,
  type AccountActivity,
  type CurrencyCode,
} from '@ledgerline/shared';
import { withTransaction, type Db, type Queryable } from '../../db/pool';
import { unprocessable } from '../../lib/errors';
import { listAccounts } from '../accounts/account.repository';
import type { EntityRecord } from '../entities/entity.repository';

interface ActivityRow {
  account_id: string;
  prior_debit: string;
  prior_credit: string;
  ytd_debit: string;
  ytd_credit: string;
  period_debit: string;
  period_credit: string;
}

/** First day of the fiscal year whose periods contain `date`. */
async function fiscalYearStart(
  tx: Queryable,
  entityId: string,
  date: string,
): Promise<{ start: string; fiscalYear: number }> {
  const { rows } = await tx.query<{ start: string; fiscal_year: number }>(
    `SELECT min(p2.start_date)::text AS start, p.fiscal_year
       FROM accounting_periods p
       JOIN accounting_periods p2 ON p2.entity_id = p.entity_id AND p2.fiscal_year = p.fiscal_year
      WHERE p.entity_id = $1 AND $2::date BETWEEN p.start_date AND p.end_date
      GROUP BY p.fiscal_year`,
    [entityId, date],
  );
  const row = rows[0];
  if (!row) throw unprocessable('PERIOD_NOT_FOUND', `No accounting period covers ${date}`);
  return { start: row.start, fiscalYear: row.fiscal_year };
}

/**
 * One pass over the entity's posted lines up to `to`, bucketed with FILTER
 * clauses into prior-years / year-to-date-before-from / in-range activity.
 */
async function loadActivity(
  tx: Queryable,
  entityId: string,
  fyStart: string,
  from: string,
  to: string,
) {
  const { rows } = await tx.query<ActivityRow>(
    `SELECT l.account_id,
        coalesce(sum(l.functional_minor) FILTER (WHERE l.side = 'debit'  AND e.entry_date < $2), 0)  AS prior_debit,
        coalesce(sum(l.functional_minor) FILTER (WHERE l.side = 'credit' AND e.entry_date < $2), 0)  AS prior_credit,
        coalesce(sum(l.functional_minor) FILTER (WHERE l.side = 'debit'  AND e.entry_date >= $2 AND e.entry_date < $3), 0) AS ytd_debit,
        coalesce(sum(l.functional_minor) FILTER (WHERE l.side = 'credit' AND e.entry_date >= $2 AND e.entry_date < $3), 0) AS ytd_credit,
        coalesce(sum(l.functional_minor) FILTER (WHERE l.side = 'debit'  AND e.entry_date >= $3), 0) AS period_debit,
        coalesce(sum(l.functional_minor) FILTER (WHERE l.side = 'credit' AND e.entry_date >= $3), 0) AS period_credit
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id
      WHERE e.entity_id = $1 AND e.status IN ('posted', 'reversed') AND e.entry_date <= $4
      GROUP BY l.account_id`,
    [entityId, fyStart, from, to],
  );
  return rows.map((r): AccountActivity => ({
    accountId: r.account_id,
    priorYears: { debit: BigInt(r.prior_debit), credit: BigInt(r.prior_credit) },
    yearToDateBefore: { debit: BigInt(r.ytd_debit), credit: BigInt(r.ytd_credit) },
    period: { debit: BigInt(r.period_debit), credit: BigInt(r.period_credit) },
  }));
}

export interface TrialBalanceQuery {
  readonly from?: string | undefined;
  readonly to: string;
  readonly includeZero: boolean;
}

export async function buildTrialBalance(
  db: Db,
  organizationId: string,
  entity: EntityRecord,
  query: TrialBalanceQuery,
) {
  // REPEATABLE READ READ ONLY: accounts and balances come from one consistent snapshot.
  return withTransaction(
    db,
    async (tx) => {
      const fy = await fiscalYearStart(tx, entity.id, query.from ?? query.to);
      const from = query.from ?? fy.start;
      if (from > query.to) throw unprocessable('INVALID_RANGE', '"from" must not be after "to"');
      if (
        query.from !== undefined &&
        (await fiscalYearStart(tx, entity.id, query.to)).fiscalYear !== fy.fiscalYear
      ) {
        throw unprocessable(
          'RANGE_SPANS_FISCAL_YEARS',
          'A trial balance range must stay within one fiscal year',
        );
      }
      const [accounts, activity] = await Promise.all([
        listAccounts(tx, organizationId, entity.id),
        loadActivity(tx, entity.id, fy.start, from, query.to),
      ]);
      const tb = computeTrialBalance(accounts, activity, {
        includeZeroBalances: query.includeZero,
        retainedEarningsAccountId: entity.retainedEarningsAccountId,
      });
      return toDto(tb, entity.functionalCurrency, {
        from,
        to: query.to,
        fiscalYear: fy.fiscalYear,
        fiscalYearStart: fy.start,
      });
    },
    { isolation: 'REPEATABLE READ', readOnly: true },
  );
}

function toDto(
  tb: ReturnType<typeof computeTrialBalance>,
  currency: CurrencyCode,
  range: { from: string; to: string; fiscalYear: number; fiscalYearStart: string },
) {
  const m = (v: bigint) => formatMinor(v, currency);
  return {
    ...range,
    currency,
    isBalanced: tb.isBalanced,
    priorYearEarnings: m(tb.priorYearEarnings),
    rows: tb.rows.map((r) => ({
      accountId: r.accountId,
      code: r.code,
      name: r.name,
      type: r.type,
      depth: r.depth,
      isHeader: r.isHeader,
      opening: m(r.opening),
      periodDebit: m(r.periodDebit),
      periodCredit: m(r.periodCredit),
      closing: m(r.closing),
      closingDebit: m(r.closingDebit),
      closingCredit: m(r.closingCredit),
    })),
    totals: {
      openingDebit: m(tb.totals.openingDebit),
      openingCredit: m(tb.totals.openingCredit),
      periodDebit: m(tb.totals.periodDebit),
      periodCredit: m(tb.totals.periodCredit),
      closingDebit: m(tb.totals.closingDebit),
      closingCredit: m(tb.totals.closingCredit),
    },
  };
}
