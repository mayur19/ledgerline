import { currencyExponent, type CurrencyCode } from './currency';
import { pow10 } from './rounding';

const DECIMAL = /^(-)?(\d{1,15})(?:\.(\d+))?$/;

export type AmountParseError = 'INVALID_AMOUNT' | 'EXCESS_PRECISION';

export type AmountParseResult =
  | { readonly ok: true; readonly minor: bigint }
  | { readonly ok: false; readonly error: AmountParseError };

/**
 * Parse a decimal string ("1234.5") into integer minor units for `currency`.
 * Never goes through floating point. More decimals than the currency allows is
 * rejected rather than rounded, so user input is never silently changed.
 */
export function parseAmount(input: string, currency: CurrencyCode): AmountParseResult {
  const match = DECIMAL.exec(input.trim());
  if (!match) return { ok: false, error: 'INVALID_AMOUNT' };
  const [, sign, whole = '0', fraction = ''] = match;
  const exponent = currencyExponent(currency);
  const significant = fraction.replace(/0+$/, '');
  if (significant.length > exponent) return { ok: false, error: 'EXCESS_PRECISION' };
  const padded = significant.padEnd(exponent, '0');
  const minor = BigInt(whole) * pow10(exponent) + (padded === '' ? 0n : BigInt(padded));
  return { ok: true, minor: sign ? -minor : minor };
}

/** Format minor units as a plain decimal string, e.g. 123456n USD -> "1234.56". */
export function formatMinor(minor: bigint, currency: CurrencyCode): string {
  const exponent = currencyExponent(currency);
  const negative = minor < 0n;
  const digits = (negative ? -minor : minor).toString().padStart(exponent + 1, '0');
  const whole = exponent === 0 ? digits : digits.slice(0, -exponent);
  const fraction = exponent === 0 ? '' : `.${digits.slice(-exponent)}`;
  return `${negative ? '-' : ''}${whole}${fraction}`;
}

/** Format with thousands separators for display, e.g. "1,234.56". */
export function formatMinorGrouped(minor: bigint, currency: CurrencyCode): string {
  const plain = formatMinor(minor, currency);
  const negative = plain.startsWith('-');
  const unsigned = negative ? plain.slice(1) : plain;
  const [whole = '0', fraction] = unsigned.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction === undefined ? '' : `.${fraction}`}`;
}
