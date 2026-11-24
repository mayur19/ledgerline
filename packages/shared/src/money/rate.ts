import { currencyExponent, type CurrencyCode } from './currency';
import { divideHalfEven, pow10 } from './rounding';

/**
 * Exchange rates are exact rationals (numerator / denominator) so that a quoted
 * decimal such as 1.0845 or its inverse never loses precision before the single
 * final rounding step (ADR-0007).
 */
export interface Rate {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export const MAX_RATE_DECIMALS = 10;

const RATE_PATTERN = /^(\d{1,9})(?:\.(\d{1,10}))?$/;

export const ONE: Rate = { numerator: 1n, denominator: 1n };

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

export function normalizeRate(rate: Rate): Rate {
  const divisor = gcd(rate.numerator, rate.denominator);
  return { numerator: rate.numerator / divisor, denominator: rate.denominator / divisor };
}

/** Parse a positive decimal rate string with at most 10 decimals. Returns null when invalid. */
export function parseRate(input: string): Rate | null {
  const match = RATE_PATTERN.exec(input.trim());
  if (!match) return null;
  const [, whole = '0', fraction = ''] = match;
  const numerator = BigInt(whole + fraction);
  if (numerator === 0n) return null;
  return normalizeRate({ numerator, denominator: pow10(fraction.length) });
}

export function invertRate(rate: Rate): Rate {
  return { numerator: rate.denominator, denominator: rate.numerator };
}

export function ratesEqual(a: Rate, b: Rate): boolean {
  return a.numerator * b.denominator === b.numerator * a.denominator;
}

/** Render a rate as a decimal string rounded half-even to `decimals` places. */
export function formatRate(rate: Rate, decimals = MAX_RATE_DECIMALS): string {
  const scaled = divideHalfEven(rate.numerator * pow10(decimals), rate.denominator);
  const digits = scaled.toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '');
  return fraction === '' ? whole : `${whole}.${fraction}`;
}

/**
 * Convert `amount` minor units of `from` into minor units of `to` at `rate`
 * (units of `to` per one unit of `from`), with a single banker's rounding step.
 */
export function convertMinor(
  amount: bigint,
  from: CurrencyCode,
  to: CurrencyCode,
  rate: Rate,
): bigint {
  const numerator = amount * rate.numerator * pow10(currencyExponent(to));
  const denominator = rate.denominator * pow10(currencyExponent(from));
  return divideHalfEven(numerator, denominator);
}
