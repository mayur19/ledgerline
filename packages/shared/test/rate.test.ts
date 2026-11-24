import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  convertMinor,
  formatRate,
  invertRate,
  normalizeRate,
  parseRate,
  ratesEqual,
} from '../src/money/rate';

describe('parseRate', () => {
  it('parses decimals into reduced rationals', () => {
    expect(parseRate('1.0845')).toEqual({ numerator: 2169n, denominator: 2000n });
    expect(parseRate('2')).toEqual({ numerator: 2n, denominator: 1n });
    expect(parseRate('0.0067')).toEqual({ numerator: 67n, denominator: 10000n });
  });

  it.each(['0', '0.0000', '-1', 'abc', '1.12345678901', '', '1.'])('rejects %j', (input) => {
    expect(parseRate(input)).toBeNull();
  });
});

describe('rate helpers', () => {
  it('inverts and compares exactly', () => {
    const rate = parseRate('1.25')!;
    expect(invertRate(rate)).toEqual({ numerator: 4n, denominator: 5n });
    expect(ratesEqual(rate, { numerator: 10n, denominator: 8n })).toBe(true);
    expect(ratesEqual(rate, parseRate('1.2500001')!)).toBe(false);
  });

  it('normalizes', () => {
    expect(normalizeRate({ numerator: 50n, denominator: 100n })).toEqual({
      numerator: 1n,
      denominator: 2n,
    });
  });

  it('formats with banker rounding and trims zeros', () => {
    expect(formatRate(parseRate('1.0845')!)).toBe('1.0845');
    expect(formatRate({ numerator: 1n, denominator: 3n }, 4)).toBe('0.3333');
    expect(formatRate({ numerator: 2n, denominator: 1n })).toBe('2');
    expect(formatRate({ numerator: 5n, denominator: 1000n }, 2)).toBe('0');
    expect(formatRate({ numerator: 15n, denominator: 1000n }, 2)).toBe('0.02');
  });
});

describe('convertMinor', () => {
  it('converts EUR to USD', () => {
    expect(convertMinor(10000n, 'EUR', 'USD', parseRate('1.0845')!)).toBe(10845n);
  });

  it('applies banker rounding on exact halves', () => {
    // 0.25 EUR * 1.1 = 0.275 -> 0.28 (8 is even); 0.35 * 1.1 = 0.385 -> 0.38
    expect(convertMinor(25n, 'EUR', 'USD', parseRate('1.1')!)).toBe(28n);
    expect(convertMinor(35n, 'EUR', 'USD', parseRate('1.1')!)).toBe(38n);
  });

  it('handles currencies with different exponents', () => {
    expect(convertMinor(15000n, 'JPY', 'USD', parseRate('0.0067')!)).toBe(10050n);
    expect(convertMinor(10000n, 'USD', 'JPY', parseRate('149.25')!)).toBe(14925n);
    expect(convertMinor(1000n, 'KWD', 'USD', parseRate('3.2531')!)).toBe(325n);
  });

  it('converting with a rate and its inverse returns within one unit (property)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 10n ** 12n }),
        fc.integer({ min: 5000, max: 20000 }),
        (amount, basis) => {
          const rate = parseRate((basis / 10000).toFixed(4))!;
          const there = convertMinor(amount, 'EUR', 'USD', rate);
          const back = convertMinor(there, 'USD', 'EUR', invertRate(rate));
          const drift = back - amount;
          expect(drift >= -1n && drift <= 1n).toBe(true);
        },
      ),
    );
  });
});
