import type { AccountRecord, AccountType } from '../src/ledger/account';

let counter = 0;

export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

export function account(
  code: string,
  type: AccountType,
  overrides: Partial<AccountRecord> = {},
): AccountRecord {
  counter += 1;
  return {
    id: uuid(1000 + counter),
    code,
    name: `Account ${code}`,
    type,
    parentId: null,
    isPostable: true,
    isActive: true,
    currency: null,
    ...overrides,
  };
}
