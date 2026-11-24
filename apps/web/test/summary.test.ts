import { describe, expect, it } from 'vitest';
import { emptyLine, summarizeDraft, type DraftLine } from '../src/journal/summary';

const l = (side: 'debit' | 'credit', amount: string, currency = 'USD'): DraftLine => ({
  ...emptyLine(currency, side),
  amount,
});

describe('summarizeDraft', () => {
  it('balances per currency with exact integer math', () => {
    const s = summarizeDraft([l('debit', '0.10'), l('debit', '0.20'), l('credit', '0.30')]);
    expect(s.totals).toEqual([
      { currency: 'USD', debit: '0.30', credit: '0.30', difference: '0.00', balanced: true },
    ]);
    expect(s.balancedPerCurrency).toBe(true);
  });

  it('reports differences, invalid lines and multiple currencies', () => {
    const s = summarizeDraft([
      l('debit', '100', 'EUR'),
      l('credit', '99.5', 'EUR'),
      l('debit', '1.005'),
      l('credit', ''),
      l('debit', '-1'),
    ]);
    expect(s.totals[0]).toMatchObject({ currency: 'EUR', difference: '0.50', balanced: false });
    expect(s.invalidLines).toEqual([3, 5]);
    expect(s.balancedPerCurrency).toBe(false);
  });

  it('is empty for blank lines', () => {
    expect(summarizeDraft([emptyLine('USD'), emptyLine('USD')])).toEqual({
      totals: [],
      invalidLines: [],
      balancedPerCurrency: false,
    });
  });
});
