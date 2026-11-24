import type { AccountType, Permission, Role } from '@ledgerline/shared';

export interface Profile {
  user: { id: string; email: string; displayName: string };
  organization: { id: string; name: string };
  role: Role;
  permissions: Permission[];
}

export interface Entity {
  id: string;
  code: string;
  name: string;
  functionalCurrency: string;
  timezone: string;
  roundingAccountId: string | null;
  retainedEarningsAccountId: string | null;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  isPostable: boolean;
  isActive: boolean;
  currency: string | null;
}

export interface JournalSummary {
  id: string;
  entryNumber: string | null;
  status: 'draft' | 'posted' | 'reversed';
  entryDate: string;
  memo: string;
  reference: string | null;
  totalDebit: string;
  functionalCurrency: string;
  createdBy: { displayName: string } | null;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  depth: number;
  isHeader: boolean;
  opening: string;
  periodDebit: string;
  periodCredit: string;
  closing: string;
  closingDebit: string;
  closingCredit: string;
}

export interface TrialBalance {
  from: string;
  to: string;
  fiscalYear: number;
  currency: string;
  isBalanced: boolean;
  priorYearEarnings: string;
  rows: TrialBalanceRow[];
  totals: Record<
    | 'openingDebit'
    | 'openingCredit'
    | 'periodDebit'
    | 'periodCredit'
    | 'closingDebit'
    | 'closingCredit',
    string
  >;
}
