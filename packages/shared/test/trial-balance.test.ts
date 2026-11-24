import { describe, expect, it } from 'vitest';
import {
  computeTrialBalance,
  UNALLOCATED_EARNINGS_ID,
  type AccountActivity,
} from '../src/ledger/trial-balance';
import { account } from './fixtures';

const assets = account('1000', 'asset', { isPostable: false });
const cash = account('1010', 'asset', { parentId: assets.id });
const bank = account('1020', 'asset', { parentId: assets.id });
const payables = account('2000', 'liability');
const retained = account('3200', 'equity');
const revenue = account('4000', 'revenue');
const rent = account('6100', 'expense');
const chart = [revenue, rent, assets, bank, cash, payables, retained];

const dc = (debit: bigint, credit: bigint) => ({ debit, credit });
const zero = dc(0n, 0n);

function activity(
  accountId: string,
  priorYears = zero,
  yearToDateBefore = zero,
  period = zero,
): AccountActivity {
  return { accountId, priorYears, yearToDateBefore, period };
}

describe('computeTrialBalance', () => {
  const data = [
    // Prior year: sold 1,000 for cash, paid 300 rent -> 700 profit carried to equity.
    activity(cash.id, dc(100000n, 30000n), dc(5000n, 0n), dc(20000n, 2500n)),
    activity(revenue.id, dc(0n, 100000n), dc(0n, 5000n), dc(0n, 20000n)),
    activity(rent.id, dc(30000n, 0n), zero, dc(2500n, 0n)),
  ];

  it('balances and rolls prior-year P&L into retained earnings', () => {
    const tb = computeTrialBalance(chart, data, { retainedEarningsAccountId: retained.id });
    expect(tb.isBalanced).toBe(true);
    expect(tb.priorYearEarnings).toBe(70000n);
    const row = (id: string) => tb.rows.find((r) => r.accountId === id);
    expect(row(cash.id)).toMatchObject({ opening: 75000n, closing: 92500n, closingDebit: 92500n });
    expect(row(revenue.id)).toMatchObject({
      opening: -5000n,
      closing: -25000n,
      closingCredit: 25000n,
    });
    expect(row(rent.id)).toMatchObject({ opening: 0n, closing: 2500n });
    expect(row(retained.id)).toMatchObject({ opening: -70000n, closingCredit: 70000n });
    expect(tb.totals).toEqual({
      openingDebit: 75000n,
      openingCredit: 75000n,
      periodDebit: 22500n,
      periodCredit: 22500n,
      closingDebit: 95000n,
      closingCredit: 95000n,
    });
  });

  it('rolls header accounts up without double counting', () => {
    const tb = computeTrialBalance(
      chart,
      [
        ...data,
        activity(bank.id, zero, zero, dc(1000n, 0n)),
        activity(payables.id, zero, zero, dc(0n, 1000n)),
      ],
      {
        retainedEarningsAccountId: retained.id,
      },
    );
    const header = tb.rows.find((r) => r.accountId === assets.id);
    expect(header).toMatchObject({ isHeader: true, depth: 0, closing: 93500n });
    expect(tb.totals.closingDebit).toBe(96000n);
    expect(tb.isBalanced).toBe(true);
  });

  it('orders rows depth-first by code with headers before children', () => {
    const tb = computeTrialBalance(chart, data, {
      retainedEarningsAccountId: retained.id,
      includeZeroBalances: true,
    });
    expect(tb.rows.map((r) => r.code)).toEqual([
      '1000',
      '1010',
      '1020',
      '2000',
      '3200',
      '4000',
      '6100',
    ]);
    expect(tb.rows.find((r) => r.code === '1010')?.depth).toBe(1);
  });

  it('hides zero rows by default', () => {
    const tb = computeTrialBalance(chart, data, { retainedEarningsAccountId: retained.id });
    expect(tb.rows.map((r) => r.code)).not.toContain('2000');
    expect(tb.rows.map((r) => r.code)).not.toContain('1020');
  });

  it('uses a synthetic equity row when no retained earnings account is configured', () => {
    const tb = computeTrialBalance(chart, data);
    const synthetic = tb.rows.find((r) => r.accountId === UNALLOCATED_EARNINGS_ID);
    expect(synthetic).toMatchObject({ opening: -70000n, type: 'equity' });
    expect(tb.isBalanced).toBe(true);
  });

  it('ignores a retained earnings id that is not a postable account', () => {
    const tb = computeTrialBalance(chart, data, { retainedEarningsAccountId: assets.id });
    expect(tb.rows.some((r) => r.accountId === UNALLOCATED_EARNINGS_ID)).toBe(true);
  });

  it('flags an unbalanced data set', () => {
    const tb = computeTrialBalance(chart, [activity(cash.id, zero, zero, dc(100n, 0n))]);
    expect(tb.isBalanced).toBe(false);
  });

  it('returns empty totals for an empty ledger', () => {
    const tb = computeTrialBalance(chart, []);
    expect(tb.rows).toEqual([]);
    expect(tb.isBalanced).toBe(true);
    expect(tb.priorYearEarnings).toBe(0n);
  });
});
