import type { AccountRecord } from './account';

export type HierarchyErrorCode =
  'PARENT_NOT_FOUND' | 'PARENT_NOT_HEADER' | 'PARENT_TYPE_MISMATCH' | 'CYCLE' | 'SELF_PARENT';

export interface HierarchyError {
  readonly code: HierarchyErrorCode;
  readonly accountId: string;
  readonly message: string;
}

type ParentRef = Pick<AccountRecord, 'id' | 'type' | 'parentId' | 'isPostable'>;

/**
 * Validate that giving `child` the parent `parentId` keeps the chart a forest:
 * the parent exists, is a header of the same type, and is not a descendant of
 * the child. Walks at most depth(parent) ancestors: O(depth).
 */
export function validateParentAssignment(
  accounts: ReadonlyMap<string, ParentRef>,
  child: Pick<AccountRecord, 'id' | 'type'>,
  parentId: string | null,
): HierarchyError | null {
  if (parentId === null) return null;
  if (parentId === child.id) {
    return {
      code: 'SELF_PARENT',
      accountId: child.id,
      message: 'An account cannot be its own parent',
    };
  }
  const parent = accounts.get(parentId);
  if (!parent) {
    return { code: 'PARENT_NOT_FOUND', accountId: child.id, message: 'Parent account not found' };
  }
  if (parent.isPostable) {
    return {
      code: 'PARENT_NOT_HEADER',
      accountId: child.id,
      message: 'Parent must be a header account',
    };
  }
  if (parent.type !== child.type) {
    return {
      code: 'PARENT_TYPE_MISMATCH',
      accountId: child.id,
      message: `Parent is ${parent.type} but account is ${child.type}`,
    };
  }
  const seen = new Set<string>();
  let cursor: ParentRef | undefined = parent;
  while (cursor) {
    if (cursor.id === child.id || seen.has(cursor.id)) {
      return { code: 'CYCLE', accountId: child.id, message: 'Assignment would create a cycle' };
    }
    seen.add(cursor.id);
    cursor = cursor.parentId === null ? undefined : accounts.get(cursor.parentId);
  }
  return null;
}

/**
 * Return the ancestor chain of every account (nearest first). Throws on cycles
 * so corrupted data can never produce an infinite rollup. O(n * depth).
 */
export function ancestorChains(
  accounts: readonly Pick<AccountRecord, 'id' | 'parentId'>[],
): ReadonlyMap<string, readonly string[]> {
  const byId = new Map(accounts.map((a) => [a.id, a] as const));
  const chains = new Map<string, readonly string[]>();
  for (const account of accounts) {
    const chain: string[] = [];
    const seen = new Set<string>([account.id]);
    let parentId = account.parentId;
    while (parentId !== null) {
      if (seen.has(parentId)) throw new Error(`Account hierarchy cycle detected at ${parentId}`);
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      chain.push(parent.id);
      parentId = parent.parentId;
    }
    chains.set(account.id, chain);
  }
  return chains;
}

/** Depth of each account in the forest (roots are 0). */
export function accountDepths(
  accounts: readonly Pick<AccountRecord, 'id' | 'parentId'>[],
): ReadonlyMap<string, number> {
  const chains = ancestorChains(accounts);
  return new Map([...chains].map(([id, chain]) => [id, chain.length] as const));
}
