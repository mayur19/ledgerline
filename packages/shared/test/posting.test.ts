import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CurrencyCode } from '../src/money/currency';
import { parseRate, type Rate } from '../src/money/rate';
import type { JournalLineInput } from '../src/ledger/journal-schema';
import { prepareEntry, type PostingContext } from '../src/ledger/posting';
import { account } from './fixtures';

const cash = account('1000', 'asset');
const eurBank = account('1010', 'asset', { currency: 'EUR' });
const receivables = account('1200', 'asset');
const header = account('1900', 'asset', { isPostable: false });
const dormant = account('1950', 'asset', { isActive: false });
const payables = account('2000', 'liability');
const revenue = account('4000', 'revenue');
const expense = account('6000', 'expense');
const rounding = account('7990', 'expense');

const accounts = new Map(
  [cash, eurBank, receivables, header, dormant, payables, revenue, expense, rounding].map(
    (a) => [a.id, a] as const,
  ),
);

const rateTable: Partial<Record<CurrencyCode, string>> = {
  EUR: '1.0845',
  GBP: '1.2710',
  JPY: '0.0067',
};

function context(overrides: Partial<PostingContext> = {}): PostingContext {
  return {
    functionalCurrency: 'USD',
    accounts,
    lookupRate: (c) => {
      const raw = rateTable[c];
      return raw ? (parseRate(raw) ?? undefined) : undefined;
    },
    roundingAccountId: rounding.id,
    ...overrides,
  };
}

const line = (
  accountId: string,
  side: 'debit' | 'credit',
  amount: string,
  currency = 'USD',
  extra: Partial<JournalLineInput> = {},
): JournalLineInput => ({ accountId, side, amount, currency, ...extra });

function expectOk(result: ReturnType<typeof prepareEntry>) {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

function codes(result: ReturnType<typeof prepareEntry>) {
  if (result.ok) throw new Error('expected failure');
  return result.errors.map((e) => e.code);
}

describe('prepareEntry: single currency', () => {
  it('accepts a balanced functional-currency entry', () => {
    const entry = expectOk(
      prepareEntry(
        [line(expense.id, 'debit', '250.00'), line(cash.id, 'credit', '250')],
        context(),
      ),
    );
    expect(entry.totalDebitFunctional).toBe(25000n);
    expect(entry.totalCreditFunctional).toBe(25000n);
    expect(entry.roundingAdjustmentMinor).toBe(0n);
    expect(entry.lines.map((l) => l.functionalMinor)).toEqual([25000n, 25000n]);
    expect(entry.lines.every((l) => l.rate === '1')).toBe(true);
    expect(entry.currencies).toEqual(['USD']);
  });

  it('rejects an unbalanced entry with the difference', () => {
    const result = prepareEntry(
      [line(expense.id, 'debit', '100.00'), line(cash.id, 'credit', '99.99')],
      context(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatchObject({
        code: 'UNBALANCED',
        details: { debit: '100.00', credit: '99.99', difference: '0.01', currency: 'USD' },
      });
    }
  });

  it('never tolerates a one-cent difference in a pure functional entry', () => {
    const result = prepareEntry(
      [line(expense.id, 'debit', '0.01'), line(cash.id, 'credit', '0.02')],
      context(),
    );
    expect(codes(result)).toEqual(['UNBALANCED']);
  });

  it('requires at least two lines', () => {
    expect(codes(prepareEntry([line(cash.id, 'debit', '1')], context()))).toEqual([
      'TOO_FEW_LINES',
    ]);
  });

  it('reports every line problem at once', () => {
    const result = prepareEntry(
      [
        line(header.id, 'debit', '10'),
        line(dormant.id, 'debit', '10'),
        line('00000000-0000-4000-8000-ffffffffffff', 'debit', '10'),
        line(cash.id, 'credit', '0'),
        line(cash.id, 'credit', 'ten'),
        line(cash.id, 'credit', '1.001'),
        line(cash.id, 'credit', '-5'),
        line(cash.id, 'credit', '5', 'XYZ'),
      ],
      context(),
    );
    expect(codes(result)).toEqual([
      'ACCOUNT_NOT_POSTABLE',
      'ACCOUNT_INACTIVE',
      'ACCOUNT_NOT_FOUND',
      'NON_POSITIVE_AMOUNT',
      'INVALID_AMOUNT',
      'EXCESS_PRECISION',
      'NON_POSITIVE_AMOUNT',
      'UNKNOWN_CURRENCY',
    ]);
    if (!result.ok) expect(result.errors[0]?.line).toBe(1);
  });

  it('enforces account currency restrictions', () => {
    const result = prepareEntry(
      [line(eurBank.id, 'debit', '10.00', 'USD'), line(cash.id, 'credit', '10.00')],
      context(),
    );
    expect(codes(result)).toEqual(['ACCOUNT_CURRENCY_MISMATCH']);
  });

  it('keeps memos and trims blanks to null', () => {
    const entry = expectOk(
      prepareEntry(
        [
          line(expense.id, 'debit', '5', 'USD', { memo: ' Taxi ' }),
          line(cash.id, 'credit', '5', 'USD', { memo: '  ' }),
        ],
        context(),
      ),
    );
    expect(entry.lines.map((l) => l.memo)).toEqual(['Taxi', null]);
  });
});

describe('prepareEntry: multi-currency', () => {
  it('converts a foreign entry using the rate table', () => {
    const entry = expectOk(
      prepareEntry(
        [line(eurBank.id, 'debit', '1000.00', 'EUR'), line(revenue.id, 'credit', '1000.00', 'EUR')],
        context(),
      ),
    );
    expect(entry.lines.map((l) => l.functionalMinor)).toEqual([108450n, 108450n]);
    expect(entry.lines[0]?.rate).toBe('1.0845');
    expect(entry.currencies).toEqual(['EUR']);
  });

  it('keeps a balanced foreign group balanced in functional currency despite rounding', () => {
    // Three 0.01 EUR debits at 1.5 would each round to 0.02 USD (0.06 total) on a
    // per-line basis, while the 0.03 EUR credit converts to 0.04/0.05 USD.
    const entry = expectOk(
      prepareEntry(
        [
          line(expense.id, 'debit', '0.01', 'EUR', { rate: '1.5' }),
          line(expense.id, 'debit', '0.01', 'EUR', { rate: '1.5' }),
          line(expense.id, 'debit', '0.01', 'EUR', { rate: '1.5' }),
          line(payables.id, 'credit', '0.03', 'EUR', { rate: '1.5' }),
        ],
        context(),
      ),
    );
    const debits = entry.lines.filter((l) => l.side === 'debit').map((l) => l.functionalMinor);
    expect(debits.reduce((a, b) => a + b, 0n)).toBe(4n);
    expect(entry.lines.find((l) => l.side === 'credit')?.functionalMinor).toBe(4n);
    expect(entry.roundingAdjustmentMinor).toBe(0n);
  });

  it('balances a cross-currency transfer whose functional side matches the rounded amount', () => {
    const entry = expectOk(
      prepareEntry(
        [
          line(eurBank.id, 'debit', '33.33', 'EUR', { rate: '1.08451' }),
          line(cash.id, 'credit', '36.15'),
        ],
        context(),
      ),
    );
    expect(entry.lines.map((l) => l.functionalMinor)).toEqual([3615n, 3615n]);
  });

  it('posts a rounding line when two foreign sides leave a sub-unit residue', () => {
    // 0.05 EUR @1.1 = 0.055 -> 0.06 (half-even) ; 0.05 GBP @1.1 = 0.055 -> 0.06
    // Debit 0.06 + 0.06 = 0.12 vs credit 0.11 USD -> 0.01 residue within tolerance (2 sides).
    const entry = expectOk(
      prepareEntry(
        [
          line(expense.id, 'debit', '0.05', 'EUR', { rate: '1.1' }),
          line(expense.id, 'debit', '0.05', 'GBP', { rate: '1.1' }),
          line(cash.id, 'credit', '0.11'),
        ],
        context(),
      ),
    );
    expect(entry.roundingAdjustmentMinor).toBe(1n);
    const adj = entry.lines.at(-1);
    expect(adj).toMatchObject({
      accountId: rounding.id,
      side: 'credit',
      amountMinor: 1n,
      functionalMinor: 1n,
      isRoundingAdjustment: true,
      lineNumber: 4,
    });
    expect(entry.totalDebitFunctional).toBe(entry.totalCreditFunctional);
    expect(entry.totalDebitFunctional).toBe(12n);
  });

  it('adds a debit rounding line when credits exceed debits by a residue', () => {
    const entry = expectOk(
      prepareEntry(
        [
          line(cash.id, 'debit', '0.11'),
          line(revenue.id, 'credit', '0.05', 'EUR', { rate: '1.1' }),
          line(revenue.id, 'credit', '0.05', 'GBP', { rate: '1.1' }),
        ],
        context(),
      ),
    );
    expect(entry.roundingAdjustmentMinor).toBe(-1n);
    expect(entry.lines.at(-1)?.side).toBe('debit');
    expect(entry.totalCreditFunctional).toBe(12n);
  });

  it('requires a rounding account for a residue', () => {
    const result = prepareEntry(
      [
        line(expense.id, 'debit', '0.05', 'EUR', { rate: '1.1' }),
        line(expense.id, 'debit', '0.05', 'GBP', { rate: '1.1' }),
        line(cash.id, 'credit', '0.11'),
      ],
      context({ roundingAccountId: null }),
    );
    expect(codes(result)).toEqual(['ROUNDING_ACCOUNT_REQUIRED']);
  });

  it('treats residues beyond the rounding tolerance as unbalanced', () => {
    const result = prepareEntry(
      [line(eurBank.id, 'debit', '100.00', 'EUR'), line(cash.id, 'credit', '108.44')],
      context(),
    );
    expect(codes(result)).toEqual(['UNBALANCED']);
  });

  it('converts zero-decimal currencies', () => {
    const entry = expectOk(
      prepareEntry(
        [line(expense.id, 'debit', '15000', 'JPY'), line(cash.id, 'credit', '100.50')],
        context(),
      ),
    );
    expect(entry.lines[0]?.functionalMinor).toBe(10050n);
  });

  it('reports a missing rate', () => {
    const result = prepareEntry(
      [line(expense.id, 'debit', '10', 'CHF'), line(cash.id, 'credit', '10')],
      context(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors[0]).toMatchObject({
        code: 'RATE_MISSING',
        details: { currency: 'CHF' },
      });
  });

  it('rejects invalid, conflicting and non-unit functional rates', () => {
    const result = prepareEntry(
      [
        line(expense.id, 'debit', '10', 'EUR', { rate: '1.1' }),
        line(expense.id, 'debit', '10', 'EUR', { rate: '1.2' }),
        line(expense.id, 'debit', '10', 'GBP', { rate: 'abc' }),
        line(cash.id, 'credit', '10', 'USD', { rate: '1.01' }),
      ],
      context(),
    );
    expect(codes(result)).toEqual(['RATE_CONFLICT', 'RATE_INVALID', 'FUNCTIONAL_RATE_NOT_ONE']);
  });

  it('accepts an explicit functional rate of exactly one and blank rates', () => {
    const entry = expectOk(
      prepareEntry(
        [
          line(expense.id, 'debit', '10', 'USD', { rate: '1.000' }),
          line(cash.id, 'credit', '10', 'USD', { rate: '' }),
        ],
        context(),
      ),
    );
    expect(entry.lines).toHaveLength(2);
  });

  it('prefers explicit rates over the rate table', () => {
    const entry = expectOk(
      prepareEntry(
        [line(eurBank.id, 'debit', '100', 'EUR', { rate: '1.2' }), line(cash.id, 'credit', '120')],
        context(),
      ),
    );
    expect(entry.lines[0]?.rate).toBe('1.2');
  });

  it('is a pure function: inputs are not mutated', () => {
    const inputs = Object.freeze([
      Object.freeze(line(expense.id, 'debit', '1')),
      Object.freeze(line(cash.id, 'credit', '1')),
    ]);
    expect(() => prepareEntry(inputs, context())).not.toThrow();
  });
});

describe('prepareEntry: properties', () => {
  const foreign: CurrencyCode[] = ['EUR', 'GBP', 'JPY', 'KWD'];
  const rateFor: Record<string, Rate> = {
    EUR: parseRate('1.0845')!,
    GBP: parseRate('1.271')!,
    JPY: parseRate('0.0067')!,
    KWD: parseRate('3.2531')!,
  };

  it('any entry balanced per currency posts with equal functional totals and no rounding line', () => {
    const group = fc.record({
      currency: fc.constantFrom<CurrencyCode>('USD', ...foreign),
      debits: fc.array(fc.integer({ min: 1, max: 10_000_000 }), { minLength: 1, maxLength: 6 }),
      creditParts: fc.integer({ min: 1, max: 6 }),
    });
    fc.assert(
      fc.property(fc.array(group, { minLength: 1, maxLength: 4 }), (groups) => {
        const inputs: JournalLineInput[] = [];
        for (const g of groups) {
          const exp = g.currency === 'JPY' ? 0 : g.currency === 'KWD' ? 3 : 2;
          const fmt = (n: bigint) => {
            const s = n.toString().padStart(exp + 1, '0');
            return exp === 0 ? s : `${s.slice(0, -exp)}.${s.slice(-exp)}`;
          };
          const total = g.debits.reduce((a, b) => a + BigInt(b), 0n);
          g.debits.forEach((d) =>
            inputs.push(line(expense.id, 'debit', fmt(BigInt(d)), g.currency)),
          );
          const parts = Math.min(g.creditParts, Number(total));
          const base = total / BigInt(parts);
          for (let i = 0; i < parts; i += 1) {
            const amount = i === parts - 1 ? total - base * BigInt(parts - 1) : base;
            inputs.push(line(payables.id, 'credit', fmt(amount), g.currency));
          }
        }
        const result = prepareEntry(inputs, context({ lookupRate: (c) => rateFor[c] }));
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.roundingAdjustmentMinor).toBe(0n);
          const d = result.value.lines
            .filter((l) => l.side === 'debit')
            .reduce((a, l) => a + l.functionalMinor, 0n);
          const c = result.value.lines
            .filter((l) => l.side === 'credit')
            .reduce((a, l) => a + l.functionalMinor, 0n);
          expect(d).toBe(c);
          expect(result.value.lines).toHaveLength(inputs.length);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('any functional-currency entry with unequal sides is rejected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        fc.integer({ min: 1, max: 10_000_000 }),
        (a, b) => {
          fc.pre(a !== b);
          const result = prepareEntry(
            [
              line(expense.id, 'debit', (a / 100).toFixed(2)),
              line(cash.id, 'credit', (b / 100).toFixed(2)),
            ],
            context(),
          );
          expect(result.ok).toBe(false);
        },
      ),
    );
  });
});
