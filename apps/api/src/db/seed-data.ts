import type { JournalEntryInput, Role } from '@ledgerline/shared';

/**
 * DEVELOPMENT-ONLY demo data. Credentials are public (README) and must never
 * exist in a production database; the seed refuses to run in production.
 */
export const DEMO_PASSWORD = 'Ledgerline!Demo2026';
export const DEMO_ORG = 'Northwind Holdings';

export const DEMO_USERS: readonly { email: string; displayName: string; role: Role }[] = [
  { email: 'owner@northwind.example', displayName: 'Priya Raman', role: 'owner' },
  { email: 'controller@northwind.example', displayName: 'Marcus Lee', role: 'controller' },
  { email: 'accountant@northwind.example', displayName: 'Sofia Alvarez', role: 'accountant' },
  { email: 'auditor@northwind.example', displayName: 'Daniel Okafor', role: 'auditor' },
];

export const DEMO_RATES = [
  { fromCurrency: 'EUR', toCurrency: 'USD', rateDate: '2025-12-31', rate: '1.0420' },
  { fromCurrency: 'EUR', toCurrency: 'USD', rateDate: '2026-01-02', rate: '1.0350' },
  { fromCurrency: 'EUR', toCurrency: 'USD', rateDate: '2026-02-02', rate: '1.0410' },
  { fromCurrency: 'EUR', toCurrency: 'USD', rateDate: '2026-03-02', rate: '1.0480' },
  { fromCurrency: 'GBP', toCurrency: 'USD', rateDate: '2026-01-02', rate: '1.2710' },
  { fromCurrency: 'GBP', toCurrency: 'EUR', rateDate: '2026-01-02', rate: '1.2280' },
  // Quoted the other way round on purpose: the engine inverts it exactly.
  { fromCurrency: 'USD', toCurrency: 'JPY', rateDate: '2026-01-02', rate: '149.20' },
] as const;

type Line = [code: string, side: 'debit' | 'credit', amount: string, currency?: string];

export interface DemoJournal {
  readonly entryDate: string;
  readonly memo: string;
  readonly reference?: string;
  readonly lines: readonly Line[];
  readonly post: boolean;
}

export const US_JOURNALS: readonly DemoJournal[] = [
  {
    entryDate: '2025-06-30',
    memo: 'Initial share capital',
    post: true,
    lines: [
      ['1110', 'debit', '500000.00'],
      ['3100', 'credit', '500000.00'],
    ],
  },
  {
    entryDate: '2025-09-30',
    memo: 'Q3 consulting revenue',
    reference: 'INV-2025-031',
    post: true,
    lines: [
      ['1200', 'debit', '120000.00'],
      ['4200', 'credit', '120000.00'],
    ],
  },
  {
    entryDate: '2025-11-30',
    memo: 'Payroll and rent, November',
    post: true,
    lines: [
      ['6100', 'debit', '45000.00'],
      ['6200', 'debit', '12000.00'],
      ['1110', 'credit', '57000.00'],
    ],
  },
  {
    entryDate: '2025-12-15',
    memo: 'Customer receipt',
    post: true,
    lines: [
      ['1110', 'debit', '100000.00'],
      ['1200', 'credit', '100000.00'],
    ],
  },
  {
    entryDate: '2026-01-05',
    memo: 'January office rent',
    reference: 'LEASE-01',
    post: true,
    lines: [
      ['6200', 'debit', '4000.00'],
      ['1110', 'credit', '4000.00'],
    ],
  },
  {
    entryDate: '2026-01-15',
    memo: 'EUR product sale received into EUR account',
    reference: 'INV-2026-004',
    post: true,
    lines: [
      ['1115', 'debit', '25000.00', 'EUR'],
      ['4100', 'credit', '25000.00', 'EUR'],
    ],
  },
  {
    entryDate: '2026-01-31',
    memo: 'January payroll accrual',
    post: true,
    lines: [
      ['6100', 'debit', '38500.00'],
      ['2200', 'credit', '38500.00'],
    ],
  },
  {
    entryDate: '2026-02-03',
    memo: 'Accounting software subscription',
    post: true,
    lines: [
      ['6300', 'debit', '1249.99'],
      ['2100', 'credit', '1249.99'],
    ],
  },
  {
    entryDate: '2026-02-10',
    memo: 'London client visit (GBP card)',
    post: true,
    lines: [
      ['6400', 'debit', '812.40', 'GBP'],
      ['2100', 'credit', '812.40', 'GBP'],
    ],
  },
  {
    entryDate: '2026-02-20',
    memo: 'Design tool licence billed in JPY, paid from USD account',
    post: true,
    lines: [
      ['6300', 'debit', '150000', 'JPY'],
      ['1110', 'credit', '1005.36'],
    ],
  },
  {
    entryDate: '2026-03-02',
    memo: 'Bonus accrual (awaiting review)',
    post: false,
    lines: [
      ['6100', 'debit', '2000.00'],
      ['2200', 'credit', '2000.00'],
    ],
  },
];

export const DE_JOURNALS: readonly DemoJournal[] = [
  {
    entryDate: '2026-01-02',
    memo: 'Stammkapital paid in',
    post: true,
    lines: [
      ['1110', 'debit', '200000.00'],
      ['3100', 'credit', '200000.00'],
    ],
  },
  {
    entryDate: '2026-01-20',
    memo: 'Services invoiced to Berlin client',
    post: true,
    lines: [
      ['1200', 'debit', '48000.00'],
      ['4200', 'credit', '48000.00'],
    ],
  },
  {
    entryDate: '2026-02-05',
    memo: 'Office rent February',
    post: true,
    lines: [
      ['6200', 'debit', '6500.00'],
      ['1110', 'credit', '6500.00'],
    ],
  },
];

export function toInput(
  journal: DemoJournal,
  accountIds: ReadonlyMap<string, string>,
  functional: string,
): JournalEntryInput {
  return {
    entryDate: journal.entryDate,
    memo: journal.memo,
    ...(journal.reference ? { reference: journal.reference } : {}),
    lines: journal.lines.map(([code, side, amount, currency]) => {
      const accountId = accountIds.get(code);
      if (!accountId) throw new Error(`Seed references unknown account ${code}`);
      return { accountId, side, amount, currency: currency ?? functional };
    }),
  };
}
