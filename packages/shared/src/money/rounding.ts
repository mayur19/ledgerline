/**
 * Integer arithmetic helpers. All money math in Ledgerline is done on bigint
 * minor units; the only place precision can be lost is a division, and every
 * division goes through `divideHalfEven` (banker's rounding, ADR-0006).
 */

export function pow10(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new RangeError(`pow10 expects a non-negative integer, received ${exponent}`);
  }
  return 10n ** BigInt(exponent);
}

const abs = (value: bigint): bigint => (value < 0n ? -value : value);

/**
 * Divide `numerator / denominator` and round to the nearest integer, resolving
 * exact halves to the nearest even integer. Works for any sign combination.
 */
export function divideHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError('Division by zero');
  const negative = numerator < 0n !== denominator < 0n;
  const n = abs(numerator);
  const d = abs(denominator);
  const quotient = n / d;
  const remainder = n % d;
  const twice = remainder * 2n;
  let rounded = quotient;
  if (twice > d || (twice === d && quotient % 2n === 1n)) {
    rounded = quotient + 1n;
  }
  return negative ? -rounded : rounded;
}

/** Sum a list of bigints. */
export function sum(values: readonly bigint[]): bigint {
  return values.reduce((acc, value) => acc + value, 0n);
}
