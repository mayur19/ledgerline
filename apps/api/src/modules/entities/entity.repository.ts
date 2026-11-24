import type { CurrencyCode } from '@ledgerline/shared';
import type { Queryable } from '../../db/pool';
import { notFound } from '../../lib/errors';

export interface EntityRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly functionalCurrency: CurrencyCode;
  readonly countryCode: string | null;
  /** Canonical IANA zone used for period cut-offs and scheduled jobs. */
  readonly timezone: string;
  readonly roundingAccountId: string | null;
  readonly retainedEarningsAccountId: string | null;
  readonly createdAt: string;
}

interface EntityRow {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  functional_currency: string;
  country_code: string | null;
  timezone: string;
  rounding_account_id: string | null;
  retained_earnings_account_id: string | null;
  created_at: Date;
}

const COLUMNS = `id, organization_id, code, name, functional_currency, country_code, timezone,
  rounding_account_id, retained_earnings_account_id, created_at`;

const toEntity = (row: EntityRow): EntityRecord => ({
  id: row.id,
  organizationId: row.organization_id,
  code: row.code,
  name: row.name,
  functionalCurrency: row.functional_currency as CurrencyCode,
  countryCode: row.country_code,
  timezone: row.timezone,
  roundingAccountId: row.rounding_account_id,
  retainedEarningsAccountId: row.retained_earnings_account_id,
  createdAt: row.created_at.toISOString(),
});

export async function listEntities(db: Queryable, organizationId: string): Promise<EntityRecord[]> {
  const { rows } = await db.query<EntityRow>(
    `SELECT ${COLUMNS} FROM entities WHERE organization_id = $1 ORDER BY code`,
    [organizationId],
  );
  return rows.map(toEntity);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tenant gate for every entity-scoped route: the entity must belong to the
 * caller's organization, otherwise it does not exist (404, never 403).
 */
export async function getEntity(
  db: Queryable,
  organizationId: string,
  entityId: string,
  lock: 'none' | 'update' = 'none',
): Promise<EntityRecord> {
  if (!UUID.test(entityId)) throw notFound('Entity');
  const { rows } = await db.query<EntityRow>(
    `SELECT ${COLUMNS} FROM entities WHERE organization_id = $1 AND id = $2 ${lock === 'update' ? 'FOR UPDATE' : ''}`,
    [organizationId, entityId],
  );
  const row = rows[0];
  if (!row) throw notFound('Entity');
  return toEntity(row);
}

export async function insertEntity(
  db: Queryable,
  input: {
    organizationId: string;
    code: string;
    name: string;
    functionalCurrency: string;
    countryCode: string | null;
    timezone: string;
  },
): Promise<EntityRecord> {
  const { rows } = await db.query<EntityRow>(
    `INSERT INTO entities (organization_id, code, name, functional_currency, country_code, timezone)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
    [
      input.organizationId,
      input.code,
      input.name,
      input.functionalCurrency,
      input.countryCode,
      input.timezone,
    ],
  );
  return toEntity(rows[0]!);
}

export async function updateEntitySettings(
  db: Queryable,
  entityId: string,
  settings: { roundingAccountId?: string | null; retainedEarningsAccountId?: string | null },
): Promise<void> {
  await db.query(
    `UPDATE entities SET
       rounding_account_id = CASE WHEN $2 THEN $3::uuid ELSE rounding_account_id END,
       retained_earnings_account_id = CASE WHEN $4 THEN $5::uuid ELSE retained_earnings_account_id END,
       updated_at = now()
     WHERE id = $1`,
    [
      entityId,
      settings.roundingAccountId !== undefined,
      settings.roundingAccountId ?? null,
      settings.retainedEarningsAccountId !== undefined,
      settings.retainedEarningsAccountId ?? null,
    ],
  );
}
