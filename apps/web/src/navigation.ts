export interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly planned?: {
    readonly ticket: string;
    readonly milestone: string;
    readonly summary: string;
  };
}

export interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

/** Sidebar: implemented screens plus planned sections (rendered with a "Planned" badge). */
export const NAVIGATION: readonly NavSection[] = [
  {
    title: 'Ledger',
    items: [
      { path: '/journals', label: 'Journals' },
      { path: '/journals/new', label: 'New journal' },
      { path: '/accounts', label: 'Chart of accounts' },
      {
        path: '/planned/recurring',
        label: 'Recurring journals',
        planned: {
          ticket: 'LL-085',
          milestone: 'M3',
          summary: 'Templates with schedules, catch-up generation and auto-reversal.',
        },
      },
    ],
  },
  {
    title: 'Close',
    items: [
      { path: '/periods', label: 'Periods' },
      {
        path: '/planned/close',
        label: 'Close checklist',
        planned: {
          ticket: 'LL-041',
          milestone: 'M4',
          summary: 'Per-period tasks, owners, sign-off and hard close.',
        },
      },
      {
        path: '/planned/approvals',
        label: 'Approvals',
        planned: {
          ticket: 'LL-081',
          milestone: 'M4',
          summary: 'Policy-driven approval with segregation of duties.',
        },
      },
      {
        path: '/planned/revaluation',
        label: 'FX revaluation',
        planned: {
          ticket: 'LL-052',
          milestone: 'M3',
          summary: 'Period-end unrealized gain/loss on monetary balances.',
        },
      },
    ],
  },
  {
    title: 'Group',
    items: [
      {
        path: '/planned/intercompany',
        label: 'Intercompany',
        planned: {
          ticket: 'LL-060',
          milestone: 'M5',
          summary: 'Paired due-to/due-from entries and mismatch report.',
        },
      },
      {
        path: '/planned/consolidation',
        label: 'Consolidation',
        planned: {
          ticket: 'LL-062',
          milestone: 'M5',
          summary: 'Entity hierarchy roll-up with eliminations and minority interest.',
        },
      },
    ],
  },
  {
    title: 'Cash',
    items: [
      {
        path: '/planned/reconciliation',
        label: 'Bank reconciliation',
        planned: {
          ticket: 'LL-073',
          milestone: 'M6',
          summary: 'CSV/OFX import and a scoring match engine.',
        },
      },
    ],
  },
  {
    title: 'Reports',
    items: [
      { path: '/reports/trial-balance', label: 'Trial balance' },
      {
        path: '/planned/statements',
        label: 'Financial statements',
        planned: {
          ticket: 'LL-091',
          milestone: 'M2',
          summary: 'Income statement, balance sheet and indirect cash flow.',
        },
      },
    ],
  },
];

export function findNavItem(path: string): NavItem | undefined {
  return NAVIGATION.flatMap((s) => s.items).find((item) => item.path === path);
}
