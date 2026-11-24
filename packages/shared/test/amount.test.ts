import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatMinor, formatMinorGrouped, parseAmount } from '../src/money/amount';
import { CURRENCY_CODES, currencyExponent, isCurrencyCode } from '../src/money/currency';

describe('parseAmount', () => {
  it.each([
    ['1234.56', 'USD', 123456n],
    ['0.01', 'USD', 1n],
    ['10', 'USD', 1000n],
    ['10.5', 'EUR', 1050n],
    ['10.50', 'EUR', 1050n],
    ['10.500', 'EUR', 1050n],
    ['  7.25 ', 'GBP', 725n],
    ['1500', 'JPY', 1500n],
    ['1500.0', 'JPY', 1500n],
    ['1.234', 'KWD', 1234n],
    ['-3.10', 'USD', -310n],
    ['999999999999999.99', 'USD', 99999999999999999n],
  ] as const)('parses %s %s', (input, currency, expected) => {
    expect(parseAmount(input, currency)).toEqual({ ok: true, minor: expected });
  });

  it.each(['', 'abc', '1,000.00', '1e5', '.5', '1.', '--1', '1234567890123456'])(
    'rejects malformed input %j',
    (input) => {
      expect(parseAmount(input, 'USD')).toEqual({ ok: false, error: 'INVALID_AMOUNT' });
    },
  );

  it('rejects more decimals than the currency allows instead of rounding', () => {
    expect(parseAmount('1.005', 'USD')).toEqual({ ok: false, error: 'EXCESS_PRECISION' });
    expect(parseAmount('1.5', 'JPY')).toEqual({ ok: false, error: 'EXCESS_PRECISION' });
    expect(parseAmount('1.2345', 'BHD')).toEqual({ ok: false, error: 'EXCESS_PRECISION' });
  });
});

describe('formatMinor', () => {
  it.each([
    [123456n, 'USD', '1234.56'],
    [5n, 'USD', '0.05'],
    [0n, 'USD', '0.00'],
    [-5n, 'EUR', '-0.05'],
    [1500n, 'JPY', '1500'],
    [1n, 'KWD', '0.001'],
  ] as const)('formats %s %s as %s', (minor, currency, expected) => {
    expect(formatMinor(minor, currency)).toBe(expected);
  });

  it('groups thousands for display', () => {
    expect(formatMinorGrouped(123456789n, 'USD')).toBe('1,234,567.89');
    expect(formatMinorGrouped(-100000000n, 'USD')).toBe('-1,000,000.00');
    expect(formatMinorGrouped(1234567n, 'JPY')).toBe('1,234,567');
    expect(formatMinorGrouped(99n, 'USD')).toBe('0.99');
  });

  it('round-trips through parseAmount for every currency (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CURRENCY_CODES),
        fc.bigInt({ min: -(10n ** 14n), max: 10n ** 14n }),
        (currency, minor) => {
          expect(parseAmount(formatMinor(minor, currency), currency)).toEqual({ ok: true, minor });
        },
      ),
    );
  });
});

describe('currency table', () => {
  it('knows exponents', () => {
    expect(currencyExponent('USD')).toBe(2);
    expect(currencyExponent('JPY')).toBe(0);
    expect(currencyExponent('KWD')).toBe(3);
  });

  it('guards currency codes', () => {
    expect(isCurrencyCode('EUR')).toBe(true);
    expect(isCurrencyCode('XXX')).toBe(false);
    expect(isCurrencyCode('toString')).toBe(false);
  });
});
