import { invertRate, parseRate, type CurrencyCode, type Rate } from '@ledgerline/shared';
import type { Queryable } from '../../db/pool';

export interface FxRateRecord {
  readonly id: string;
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly rateType: string;
  readonly rateDate: string;
  readonly rate: string;
  readonly createdAt: string;
}

interface FxRow {
  id: string;
  from_currency: string;
  to_currency: string;
  rate_type: string;
  rate_date: string;
  rate: string;
  created_at: Date;
}

/** numeric(24,10) arrives as "1.0845000000"; present it without trailing zeros. */
const trimRate = (value: string): string =>
  value.includes('.') ? value.replace(/\.?0+$/, '') : value;

const toRecord = (row: FxRow): FxRateRecord => ({
  id: row.id,
  fromCurrency: row.from_currency,
  toCurrency: row.to_currency,
  rateType: row.rate_type,
  rateDate: row.rate_date,
  rate: trimRate(row.rate),
  createdAt: row.created_at.toISOString(),
});

const COLUMNS = 'id, from_currency, to_currency, rate_type, rate_date, rate, created_at';

export async function listRates(
  db: Queryable,
  organizationId: string,
  filter: { fromCurrency?: string; toCurrency?: string; limit: number; offset: number },
): Promise<FxRateRecord[]> {
  const { rows } = await db.query<FxRow>(
    `SELECT ${COLUMNS} FROM fx_rates
      WHERE organization_id = $1 AND ($2::text IS NULL OR from_currency = $2) AND ($3::text IS NULL OR to_currency = $3)
      ORDER BY rate_date DESC, from_currency, to_currency
      LIMIT $4 OFFSET $5`,
    [
      organizationId,
      filter.fromCurrency ?? null,
      filter.toCurrency ?? null,
      filter.limit,
      filter.offset,
    ],
  );
  return rows.map(toRecord);
}

export async function insertRate(
  db: Queryable,
  organizationId: string,
  userId: string,
  input: {
    fromCurrency: string;
    toCurrency: string;
    rateType: string;
    rateDate: string;
    rate: string;
  },
): Promise<FxRateRecord> {
  const { rows } = await db.query<FxRow>(
    `INSERT INTO fx_rates (organization_id, from_currency, to_currency, rate_type, rate_date, rate, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
    [
      organizationId,
      input.fromCurrency,
      input.toCurrency,
      input.rateType,
      input.rateDate,
      input.rate,
      userId,
    ],
  );
  return toRecord(rows[0]!);
}

/**
 * Latest spot rate on or before `date` converting `from` into `to`. A quote in
 * the opposite direction is inverted exactly (rational arithmetic). The most
 * recent quote wins; on the same date the direct quote is preferred.
 */
export async function findSpotRate(
  db: Queryable,
  organizationId: string,
  from: CurrencyCode,
  to: CurrencyCode,
  date: string,
): Promise<Rate | undefined> {
  const { rows } = await db.query<{ from_currency: string; rate: string }>(
    `SELECT from_currency, rate FROM fx_rates
      WHERE organization_id = $1 AND rate_type = 'spot' AND rate_date <= $4::date
        AND ((from_currency = $2 AND to_currency = $3) OR (from_currency = $3 AND to_currency = $2))
      ORDER BY rate_date DESC, (from_currency = $2) DESC
      LIMIT 1`,
    [organizationId, from, to, date],
  );
  const row = rows[0];
  if (!row) return undefined;
  const rate = parseRate(trimRate(row.rate));
  if (!rate) return undefined;
  return row.from_currency === from ? rate : invertRate(rate);
}
