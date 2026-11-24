import { sum } from './rounding';

/**
 * Split `total` across `weights` proportionally so that the parts sum to
 * exactly `total` (largest-remainder / Hamilton method).
 *
 * Each part first receives floor(total * w / W). The leftover units are
 * handed out one at a time to the parts with the largest fractional
 * remainder; ties go to the larger weight, then to the earlier index, which
 * makes the result deterministic. O(n log n).
 */
export function apportion(total: bigint, weights: readonly bigint[]): bigint[] {
  if (weights.length === 0) throw new RangeError('apportion requires at least one weight');
  if (weights.some((w) => w < 0n)) throw new RangeError('weights must be non-negative');
  const weightSum = sum(weights);
  if (weightSum === 0n) throw new RangeError('weights must not all be zero');
  const negative = total < 0n;
  const magnitude = negative ? -total : total;

  const floors = weights.map((w) => (magnitude * w) / weightSum);
  const remainders = weights.map((w) => (magnitude * w) % weightSum);
  let leftover = magnitude - sum(floors);

  const order = weights
    .map((w, index) => ({ index, weight: w, remainder: remainders[index] ?? 0n }))
    .sort((a, b) => {
      if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
      if (a.weight !== b.weight) return a.weight > b.weight ? -1 : 1;
      return a.index - b.index;
    });

  const parts = [...floors];
  for (const entry of order) {
    if (leftover === 0n) break;
    parts[entry.index] = (parts[entry.index] ?? 0n) + 1n;
    leftover -= 1n;
  }
  return negative ? parts.map((p) => -p) : parts;
}
