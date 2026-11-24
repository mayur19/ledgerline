import { apportion } from '../money/apportion';
import type { CurrencyCode } from '../money/currency';
import { convertMinor, type Rate } from '../money/rate';
import { sum } from '../money/rounding';
import type { Side } from './account';

export interface ResolvedLine {
  readonly index: number;
  readonly accountId: string;
  readonly side: Side;
  readonly currency: CurrencyCode;
  readonly amountMinor: bigint;
  readonly memo: string | null;
}

export interface ConvertedLine extends ResolvedLine {
  readonly rate: Rate;
  readonly functionalMinor: bigint;
}

export interface ConversionResult {
  readonly lines: readonly ConvertedLine[];
  /** Number of non-functional (currency, side) totals that were rounded. */
  readonly roundedSides: number;
}

/**
 * Convert lines to the functional currency group-wise.
 *
 * For every (currency, side) group the *total* is converted once with banker's
 * rounding and then apportioned back to the lines by largest remainder. This
 * guarantees that a group which balances in transaction currency also balances
 * in functional currency, no matter how many lines it has, and bounds the
 * cross-currency rounding residue by half a minor unit per group side.
 * Complexity: O(n log n) for n lines (sorting inside apportion).
 */
export function convertGroups(
  lines: readonly ResolvedLine[],
  rates: ReadonlyMap<CurrencyCode, Rate>,
  functional: CurrencyCode,
): ConversionResult {
  const functionalByIndex = new Map<number, bigint>();
  let roundedSides = 0;
  const groups = new Map<string, ResolvedLine[]>();
  for (const line of lines) {
    const key = `${line.currency}:${line.side}`;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const rate = rates.get(first.currency);
    if (!rate) throw new Error(`No rate resolved for ${first.currency}`);
    const weights = group.map((line) => line.amountMinor);
    const total = convertMinor(sum(weights), first.currency, functional, rate);
    if (first.currency !== functional) roundedSides += 1;
    const parts = apportion(total, weights);
    group.forEach((line, i) => functionalByIndex.set(line.index, parts[i] ?? 0n));
  }
  const converted = lines.map((line) => ({
    ...line,
    rate: rates.get(line.currency) as Rate,
    functionalMinor: functionalByIndex.get(line.index) ?? 0n,
  }));
  return { lines: converted, roundedSides };
}
