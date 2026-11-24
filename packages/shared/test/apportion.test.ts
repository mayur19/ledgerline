import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { apportion } from '../src/money/apportion';

describe('apportion', () => {
  it('splits exactly with largest remainder', () => {
    expect(apportion(100n, [1n, 1n, 1n])).toEqual([34n, 33n, 33n]);
    expect(apportion(10n, [3n, 3n, 4n])).toEqual([3n, 3n, 4n]);
    expect(apportion(1000n, [500n])).toEqual([1000n]);
  });

  it('breaks remainder ties by larger weight, then earlier index', () => {
    expect(apportion(5n, [1n, 3n])).toEqual([1n, 4n]);
    expect(apportion(2n, [1n, 1n, 1n])).toEqual([1n, 1n, 0n]);
  });

  it('supports zero weights and negative totals', () => {
    expect(apportion(10n, [0n, 5n])).toEqual([0n, 10n]);
    expect(apportion(-100n, [1n, 1n, 1n])).toEqual([-34n, -33n, -33n]);
  });

  it('validates input', () => {
    expect(() => apportion(1n, [])).toThrow(RangeError);
    expect(() => apportion(1n, [-1n, 2n])).toThrow(RangeError);
    expect(() => apportion(1n, [0n, 0n])).toThrow(RangeError);
  });

  it('always sums to the total and each part is within one unit of its quota (property)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n }),
        fc.array(fc.bigInt({ min: 1n, max: 10n ** 9n }), { minLength: 1, maxLength: 40 }),
        (total, weights) => {
          const parts = apportion(total, weights);
          expect(parts.reduce((a, b) => a + b, 0n)).toBe(total);
          const weightSum = weights.reduce((a, b) => a + b, 0n);
          parts.forEach((part, i) => {
            const exactTimesW = total * weights[i]!;
            const diff = part * weightSum - exactTimesW;
            const abs = diff < 0n ? -diff : diff;
            expect(abs < weightSum).toBe(true);
          });
        },
      ),
    );
  });
});
