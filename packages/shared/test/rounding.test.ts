import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { divideHalfEven, pow10, sum } from '../src/money/rounding';

describe('divideHalfEven', () => {
  it.each([
    [5n, 2n, 2n],
    [7n, 2n, 4n],
    [15n, 10n, 2n],
    [25n, 10n, 2n],
    [35n, 10n, 4n],
    [26n, 10n, 3n],
    [24n, 10n, 2n],
    [-5n, 2n, -2n],
    [-7n, 2n, -4n],
    [5n, -2n, -2n],
    [-25n, -10n, 2n],
    [0n, 7n, 0n],
    [1n, 3n, 0n],
    [2n, 3n, 1n],
  ])('%s / %s rounds to %s', (n, d, expected) => {
    expect(divideHalfEven(n, d)).toBe(expected);
  });

  it('rejects division by zero', () => {
    expect(() => divideHalfEven(1n, 0n)).toThrow(RangeError);
  });

  it('is within half a unit of the exact quotient (property)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 18n), max: 10n ** 18n }),
        fc.bigInt({ min: 1n, max: 10n ** 9n }),
        (n, d) => {
          const q = divideHalfEven(n, d);
          const error = q * d - n;
          const abs = error < 0n ? -error : error;
          expect(abs * 2n <= d).toBe(true);
        },
      ),
    );
  });

  it('is symmetric around zero (property)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 15n }),
        fc.bigInt({ min: 1n, max: 1000n }),
        (n, d) => {
          expect(divideHalfEven(-n, d)).toBe(-divideHalfEven(n, d));
        },
      ),
    );
  });
});

describe('pow10 and sum', () => {
  it('computes powers of ten', () => {
    expect(pow10(0)).toBe(1n);
    expect(pow10(3)).toBe(1000n);
  });

  it('rejects negative or fractional exponents', () => {
    expect(() => pow10(-1)).toThrow(RangeError);
    expect(() => pow10(1.5)).toThrow(RangeError);
  });

  it('sums bigints', () => {
    expect(sum([])).toBe(0n);
    expect(sum([1n, 2n, -3n, 10n])).toBe(10n);
  });
});
