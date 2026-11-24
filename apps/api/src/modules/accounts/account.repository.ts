import type { AccountRecord, AccountType } from '@ledgerline/shared';
import type { Queryable } from '../../db/pool';

export interface AccountDto extends AccountRecord {
  readonly description: string | null;
}

interface AccountRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: AccountType;
  parent_id: string | null;
  is_postable: boolean;
  is_active: boolean;
  currency: string | null;
}

const COLUMNS = 'id, code, name, description, type, parent_id, is_postable, is_active, currency';

const toAccount = (row: AccountRow): AccountDto => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description,
  type: row.type,
  parentId: row.parent_id,
  isPostable: row.is_postable,
  isActive: row.is_active,
  currency: row.currency,
});

export async function listAccounts(
  db: Queryable,
  organizationId: string,
  entityId: string,
  includeInactive = true,
): Promise<AccountDto[]> {
  const { rows } = await db.query<AccountRow>(
    `SELECT ${COLUMNS} FROM accounts
      WHERE organization_id = $1 AND entity_id = $2 AND ($3 OR is_active)
      ORDER BY code`,
    [organizationId, entityId, includeInactive],
  );
  return rows.map(toAccount);
}

export async function findAccountsByIds(
  db: Queryable,
  organizationId: string,
  entityId: string,
  ids: readonly string[],
): Promise<AccountDto[]> {
  if (ids.length === 0) return [];
  const { rows } = await db.query<AccountRow>(
    `SELECT ${COLUMNS} FROM accounts WHERE organization_id = $1 AND entity_id = $2 AND id = ANY($3::uuid[])`,
    [organizationId, entityId, ids],
  );
  return rows.map(toAccount);
}

export async function findAccount(
  db: Queryable,
  organizationId: string,
  entityId: string,
  accountId: string,
): Promise<AccountDto | null> {
  const [account] = await findAccountsByIds(db, organizationId, entityId, [accountId]);
  return account ?? null;
}

export interface NewAccount {
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
  readonly parentId: string | null;
  readonly isPostable: boolean;
  readonly currency: string | null;
  readonly description?: string | undefined;
}

export async function insertAccount(
  db: Queryable,
  organizationId: string,
  entityId: string,
  input: NewAccount,
): Promise<AccountDto> {
  const { rows } = await db.query<AccountRow>(
    `INSERT INTO accounts (organization_id, entity_id, code, name, description, type, parent_id, is_postable, currency)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${COLUMNS}`,
    [
      organizationId,
      entityId,
      input.code,
      input.name,
      input.description ?? null,
      input.type,
      input.parentId,
      input.isPostable,
      input.currency,
    ],
  );
  return toAccount(rows[0]!);
}

export async function updateAccount(
  db: Queryable,
  accountId: string,
  patch: { name?: string; isActive?: boolean; parentId?: string | null; description?: string },
): Promise<AccountDto> {
  const { rows } = await db.query<AccountRow>(
    `UPDATE accounts SET
       name = coalesce($2, name),
       is_active = coalesce($3, is_active),
       parent_id = CASE WHEN $4 THEN $5::uuid ELSE parent_id END,
       description = coalesce($6, description),
       updated_at = now()
     WHERE id = $1 RETURNING ${COLUMNS}`,
    [
      accountId,
      patch.name ?? null,
      patch.isActive ?? null,
      patch.parentId !== undefined,
      patch.parentId ?? null,
      patch.description ?? null,
    ],
  );
  return toAccount(rows[0]!);
}
