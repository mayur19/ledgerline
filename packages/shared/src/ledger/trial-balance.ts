import { isBalanceSheetType, type AccountRecord, type AccountType } from './account';
import { ancestorChains } from './account-tree';

export interface DebitCredit {
  readonly debit: bigint;
  readonly credit: bigint;
}

/** Functional-currency activity per account, split by time bucket (computed in SQL). */
export interface AccountActivity {
  readonly accountId: string;
  /** Postings dated before the fiscal year containing `from`. */
  readonly priorYears: DebitCredit;
  /** Postings from fiscal-year start up to (excluding) `from`. */
  readonly yearToDateBefore: DebitCredit;
  /** Postings within [from, to]. */
  readonly period: DebitCredit;
}

export interface TrialBalanceRow {
  readonly accountId: string;
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
  readonly depth: number;
  readonly isHeader: boolean;
  /** Net opening balance, debit positive. */
  readonly opening: bigint;
  readonly periodDebit: bigint;
  readonly periodCredit: bigint;
  /** Net closing balance, debit positive. */
  readonly closing: bigint;
  readonly closingDebit: bigint;
  readonly closingCredit: bigint;
}

export interface TrialBalanceTotals {
  readonly openingDebit: bigint;
  readonly openingCredit: bigint;
  readonly periodDebit: bigint;
  readonly periodCredit: bigint;
  readonly closingDebit: bigint;
  readonly closingCredit: bigint;
}

export interface TrialBalance {
  readonly rows: readonly TrialBalanceRow[];
  readonly totals: TrialBalanceTotals;
  readonly isBalanced: boolean;
  /** Prior-year profit/loss rolled into opening equity (credit positive = profit). */
  readonly priorYearEarnings: bigint;
}

export interface TrialBalanceOptions {
  readonly includeZeroBalances?: boolean;
  /** Equity account receiving prior-year P&L; a synthetic row is used when absent. */
  readonly retainedEarningsAccountId?: string | null;
}

export const UNALLOCATED_EARNINGS_ID = 'prior-year-earnings';

const ZERO: DebitCredit = { debit: 0n, credit: 0n };
const net = (dc: DebitCredit): bigint => dc.debit - dc.credit;

interface Figures {
  readonly opening: bigint;
  readonly periodDebit: bigint;
  readonly periodCredit: bigint;
}

const addFigures = (a: Figures, b: Figures): Figures => ({
  opening: a.opening + b.opening,
  periodDebit: a.periodDebit + b.periodDebit,
  periodCredit: a.periodCredit + b.periodCredit,
});

const EMPTY: Figures = { opening: 0n, periodDebit: 0n, periodCredit: 0n };

/** Depth-first order with siblings sorted by account code, so headers precede children. */
function treeOrder(accounts: readonly AccountRecord[]): AccountRecord[] {
  const ids = new Set(accounts.map((a) => a.id));
  const children = new Map<string | null, AccountRecord[]>();
  for (const account of accounts) {
    const key = account.parentId !== null && ids.has(account.parentId) ? account.parentId : null;
    children.set(key, [...(children.get(key) ?? []), account]);
  }
  const ordered: AccountRecord[] = [];
  const visit = (parent: string | null): void => {
    const kids = [...(children.get(parent) ?? [])].sort((a, b) => a.code.localeCompare(b.code));
    for (const kid of kids) {
      ordered.push(kid);
      visit(kid.id);
    }
  };
  visit(null);
  return ordered;
}

function toRow(account: AccountRecord, depth: number, figures: Figures): TrialBalanceRow {
  const closing = figures.opening + figures.periodDebit - figures.periodCredit;
  return {
    accountId: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    depth,
    isHeader: !account.isPostable,
    opening: figures.opening,
    periodDebit: figures.periodDebit,
    periodCredit: figures.periodCredit,
    closing,
    closingDebit: closing > 0n ? closing : 0n,
    closingCredit: closing < 0n ? -closing : 0n,
  };
}

function leafFigures(account: AccountRecord, activity: AccountActivity | undefined): Figures {
  const a = activity ?? {
    accountId: account.id,
    priorYears: ZERO,
    yearToDateBefore: ZERO,
    period: ZERO,
  };
  const carried = isBalanceSheetType(account.type) ? net(a.priorYears) : 0n;
  return {
    opening: carried + net(a.yearToDateBefore),
    periodDebit: a.period.debit,
    periodCredit: a.period.credit,
  };
}

/**
 * Build a trial balance from per-account activity (docs/design/system-design.md §4).
 *
 * - Balance-sheet accounts carry all prior activity into the opening balance.
 * - Income-statement accounts restart at fiscal-year start; their prior-year
 *   net is rolled into retained earnings (or a synthetic equity row).
 * - Header accounts show the rollup of all descendants but are excluded from
 *   totals, so each posting is counted once.
 * Complexity: O(n * depth) for n accounts.
 */
export function computeTrialBalance(
  accounts: readonly AccountRecord[],
  activity: readonly AccountActivity[],
  options: TrialBalanceOptions = {},
): TrialBalance {
  const byAccount = new Map(activity.map((a) => [a.accountId, a] as const));
  const priorYearEarnings = -accounts
    .filter((a) => !isBalanceSheetType(a.type))
    .reduce((acc, a) => acc + net(byAccount.get(a.id)?.priorYears ?? ZERO), 0n);
  const reId = options.retainedEarningsAccountId ?? null;
  const reExists = reId !== null && accounts.some((a) => a.id === reId && a.isPostable);

  const figures = new Map<string, Figures>();
  for (const account of accounts) {
    if (!account.isPostable) continue;
    const base = leafFigures(account, byAccount.get(account.id));
    const adjust = reExists && account.id === reId ? -priorYearEarnings : 0n;
    figures.set(account.id, { ...base, opening: base.opening + adjust });
  }

  const chains = ancestorChains(accounts);
  const rollup = new Map<string, Figures>();
  for (const [id, fig] of figures) {
    for (const ancestor of chains.get(id) ?? []) {
      rollup.set(ancestor, addFigures(rollup.get(ancestor) ?? EMPTY, fig));
    }
  }

  const rows = treeOrder(accounts)
    .map((account) =>
      toRow(
        account,
        chains.get(account.id)?.length ?? 0,
        account.isPostable ? (figures.get(account.id) ?? EMPTY) : (rollup.get(account.id) ?? EMPTY),
      ),
    )
    .filter(
      (row) =>
        options.includeZeroBalances === true ||
        row.opening !== 0n ||
        row.periodDebit !== 0n ||
        row.periodCredit !== 0n,
    );

  const synthetic =
    !reExists && priorYearEarnings !== 0n
      ? [
          toRow(
            {
              id: UNALLOCATED_EARNINGS_ID,
              code: '—',
              name: 'Prior-year earnings (no retained earnings account set)',
              type: 'equity',
              parentId: null,
              isPostable: true,
              isActive: true,
              currency: null,
            },
            0,
            { opening: -priorYearEarnings, periodDebit: 0n, periodCredit: 0n },
          ),
        ]
      : [];

  const allRows = [...rows, ...synthetic];
  const leaves = allRows.filter((row) => !row.isHeader);
  const totals = leaves.reduce<TrialBalanceTotals>(
    (acc, row) => ({
      openingDebit: acc.openingDebit + (row.opening > 0n ? row.opening : 0n),
      openingCredit: acc.openingCredit + (row.opening < 0n ? -row.opening : 0n),
      periodDebit: acc.periodDebit + row.periodDebit,
      periodCredit: acc.periodCredit + row.periodCredit,
      closingDebit: acc.closingDebit + row.closingDebit,
      closingCredit: acc.closingCredit + row.closingCredit,
    }),
    {
      openingDebit: 0n,
      openingCredit: 0n,
      periodDebit: 0n,
      periodCredit: 0n,
      closingDebit: 0n,
      closingCredit: 0n,
    },
  );
  return {
    rows: allRows,
    totals,
    isBalanced:
      totals.openingDebit === totals.openingCredit &&
      totals.periodDebit === totals.periodCredit &&
      totals.closingDebit === totals.closingCredit,
    priorYearEarnings,
  };
}
