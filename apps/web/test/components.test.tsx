import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Account, TrialBalance } from '../src/api/types';
import { BalanceBar } from '../src/journal/BalanceBar';
import { JournalLinesEditor } from '../src/journal/JournalLinesEditor';
import { emptyLine, summarizeDraft, type DraftLine } from '../src/journal/summary';
import { findNavItem, NAVIGATION } from '../src/navigation';
import { PlannedPage } from '../src/pages/PlannedPage';
import { TrialBalanceTable } from '../src/pages/TrialBalanceTable';

const accounts: Account[] = [
  {
    id: 'a1',
    code: '1110',
    name: 'Bank',
    type: 'asset',
    parentId: null,
    isPostable: true,
    isActive: true,
    currency: null,
  },
  {
    id: 'a2',
    code: '6200',
    name: 'Rent',
    type: 'expense',
    parentId: null,
    isPostable: true,
    isActive: true,
    currency: null,
  },
  {
    id: 'h',
    code: '1000',
    name: 'Assets',
    type: 'asset',
    parentId: null,
    isPostable: false,
    isActive: true,
    currency: null,
  },
];

function Harness() {
  const [lines, setLines] = useState<DraftLine[]>([
    emptyLine('USD', 'debit'),
    emptyLine('USD', 'credit'),
  ]);
  return (
    <>
      <JournalLinesEditor lines={lines} accounts={accounts} onChange={setLines} />
      <BalanceBar summary={summarizeDraft(lines)} />
    </>
  );
}

describe('journal editor', () => {
  it('shows a live balance as amounts are typed and hides header accounts', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('option', { name: /1000 Assets/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Amount line 1'), '250.00');
    expect(screen.getByTestId('balance-USD')).toHaveTextContent('Out by 250.00');
    await user.type(screen.getByLabelText('Amount line 2'), '250');
    expect(screen.getByTestId('balance-USD')).toHaveTextContent('Balanced');
  });

  it('prompts for amounts when empty', () => {
    render(<BalanceBar summary={summarizeDraft([])} />);
    expect(screen.getByText(/Enter amounts/)).toBeInTheDocument();
  });
});

describe('trial balance table', () => {
  it('renders rows, headers and totals', () => {
    const report: TrialBalance = {
      from: '2026-01-01',
      to: '2026-01-31',
      fiscalYear: 2026,
      currency: 'USD',
      isBalanced: true,
      priorYearEarnings: '0.00',
      rows: [
        {
          accountId: 'h',
          code: '1000',
          name: 'Assets',
          depth: 0,
          isHeader: true,
          opening: '0.00',
          periodDebit: '10.00',
          periodCredit: '0.00',
          closing: '10.00',
          closingDebit: '10.00',
          closingCredit: '0.00',
        },
        {
          accountId: 'a1',
          code: '1110',
          name: 'Bank',
          depth: 1,
          isHeader: false,
          opening: '0.00',
          periodDebit: '10.00',
          periodCredit: '0.00',
          closing: '10.00',
          closingDebit: '10.00',
          closingCredit: '0.00',
        },
      ],
      totals: {
        openingDebit: '0.00',
        openingCredit: '0.00',
        periodDebit: '10.00',
        periodCredit: '10.00',
        closingDebit: '10.00',
        closingCredit: '10.00',
      },
    };
    render(<TrialBalanceTable report={report} />);
    expect(screen.getByText('Bank')).toBeInTheDocument();
    expect(screen.getByText('Assets').closest('tr')).toHaveClass('header-row');
    expect(screen.getByText('Totals (USD)')).toBeInTheDocument();
  });
});

describe('navigation', () => {
  it('marks planned sections with a ticket', () => {
    const items = NAVIGATION.flatMap((s) => s.items);
    expect(items.filter((i) => !i.planned).map((i) => i.path)).toContain('/reports/trial-balance');
    expect(items.filter((i) => i.planned).every((i) => /^LL-\d{3}$/.test(i.planned!.ticket))).toBe(
      true,
    );
    expect(findNavItem('/nope')).toBeUndefined();
  });

  it('renders a planned page', () => {
    render(<PlannedPage item={findNavItem('/planned/consolidation')!} />);
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText(/LL-062/)).toBeInTheDocument();
  });
});
