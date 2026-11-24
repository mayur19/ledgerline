import {
  STANDARD_CHART,
  validateParentAssignment,
  type CreateAccountInput,
  type UpdateAccountInput,
} from '@ledgerline/shared';
import type { Queryable } from '../../db/pool';
import { isUniqueViolation } from '../../db/pool';
import { conflict, notFound, unprocessable } from '../../lib/errors';
import {
  findAccount,
  insertAccount,
  listAccounts,
  updateAccount,
  type AccountDto,
} from './account.repository';

async function assertValidParent(
  tx: Queryable,
  organizationId: string,
  entityId: string,
  child: { id: string; type: AccountDto['type'] },
  parentId: string | null,
): Promise<void> {
  const accounts = await listAccounts(tx, organizationId, entityId);
  const error = validateParentAssignment(
    new Map(accounts.map((a) => [a.id, a] as const)),
    child,
    parentId,
  );
  if (error) throw unprocessable(`ACCOUNT_${error.code}`, error.message);
}

/** Create an account. Caller holds the entity row lock so hierarchy checks are race-free. */
export async function createAccount(
  tx: Queryable,
  organizationId: string,
  entityId: string,
  input: CreateAccountInput,
): Promise<AccountDto> {
  await assertValidParent(
    tx,
    organizationId,
    entityId,
    { id: 'new', type: input.type },
    input.parentId,
  );
  try {
    return await insertAccount(tx, organizationId, entityId, input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(
        'ACCOUNT_CODE_TAKEN',
        `Account code ${input.code} already exists in this entity`,
      );
    }
    throw error;
  }
}

export async function patchAccount(
  tx: Queryable,
  organizationId: string,
  entityId: string,
  accountId: string,
  patch: UpdateAccountInput,
): Promise<{ before: AccountDto; after: AccountDto }> {
  const before = await findAccount(tx, organizationId, entityId, accountId);
  if (!before) throw notFound('Account');
  if (patch.parentId !== undefined) {
    await assertValidParent(tx, organizationId, entityId, before, patch.parentId);
  }
  const after = await updateAccount(tx, accountId, patch);
  return { before, after };
}

/** Insert the standard chart and return code -> id for settings wiring. */
export async function applyStandardChart(
  tx: Queryable,
  organizationId: string,
  entityId: string,
): Promise<ReadonlyMap<string, string>> {
  const ids = new Map<string, string>();
  for (const template of STANDARD_CHART) {
    const parentId = template.parentCode === null ? null : (ids.get(template.parentCode) ?? null);
    const account = await insertAccount(tx, organizationId, entityId, {
      code: template.code,
      name: template.name,
      type: template.type,
      parentId,
      isPostable: template.isPostable,
      currency: null,
    });
    ids.set(template.code, account.id);
  }
  return ids;
}
