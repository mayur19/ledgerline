/**
 * ISO 4217 currencies supported out of the box with their minor-unit exponent.
 * The exponent decides how many decimal places an amount may carry and how
 * converted amounts are rounded. Extending the list is a data change only.
 */
export const CURRENCIES = {
  USD: { exponent: 2, name: 'US Dollar' },
  EUR: { exponent: 2, name: 'Euro' },
  GBP: { exponent: 2, name: 'Pound Sterling' },
  CHF: { exponent: 2, name: 'Swiss Franc' },
  CAD: { exponent: 2, name: 'Canadian Dollar' },
  AUD: { exponent: 2, name: 'Australian Dollar' },
  SGD: { exponent: 2, name: 'Singapore Dollar' },
  INR: { exponent: 2, name: 'Indian Rupee' },
  MXN: { exponent: 2, name: 'Mexican Peso' },
  JPY: { exponent: 0, name: 'Japanese Yen' },
  KRW: { exponent: 0, name: 'South Korean Won' },
  KWD: { exponent: 3, name: 'Kuwaiti Dinar' },
  BHD: { exponent: 3, name: 'Bahraini Dinar' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as readonly CurrencyCode[];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

export function currencyExponent(code: CurrencyCode): number {
  return CURRENCIES[code].exponent;
}
