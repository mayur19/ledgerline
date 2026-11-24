import type { AccountType } from './account';

export interface TemplateAccount {
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
  readonly parentCode: string | null;
  readonly isPostable: boolean;
}

const h = (
  code: string,
  name: string,
  type: AccountType,
  parentCode: string | null = null,
): TemplateAccount => ({
  code,
  name,
  type,
  parentCode,
  isPostable: false,
});
const a = (code: string, name: string, type: AccountType, parentCode: string): TemplateAccount => ({
  code,
  name,
  type,
  parentCode,
  isPostable: true,
});

/**
 * Standard mid-market chart applied to new entities (LL-022). Parents always
 * precede children so the list can be inserted in order.
 */
export const STANDARD_CHART: readonly TemplateAccount[] = [
  h('1000', 'Assets', 'asset'),
  h('1100', 'Cash and Cash Equivalents', 'asset', '1000'),
  a('1110', 'Operating Bank Account', 'asset', '1100'),
  a('1120', 'Petty Cash', 'asset', '1100'),
  a('1200', 'Accounts Receivable', 'asset', '1000'),
  a('1300', 'Intercompany Receivable', 'asset', '1000'),
  a('1400', 'Prepaid Expenses', 'asset', '1000'),
  a('1500', 'Property and Equipment', 'asset', '1000'),
  a('1590', 'Accumulated Depreciation', 'asset', '1000'),
  h('2000', 'Liabilities', 'liability'),
  a('2100', 'Accounts Payable', 'liability', '2000'),
  a('2200', 'Accrued Liabilities', 'liability', '2000'),
  a('2300', 'Intercompany Payable', 'liability', '2000'),
  a('2400', 'Sales Tax Payable', 'liability', '2000'),
  a('2500', 'Long-term Debt', 'liability', '2000'),
  h('3000', 'Equity', 'equity'),
  a('3100', 'Share Capital', 'equity', '3000'),
  a('3200', 'Retained Earnings', 'equity', '3000'),
  h('4000', 'Revenue', 'revenue'),
  a('4100', 'Product Revenue', 'revenue', '4000'),
  a('4200', 'Service Revenue', 'revenue', '4000'),
  a('4900', 'Intercompany Revenue', 'revenue', '4000'),
  h('5000', 'Cost of Sales', 'expense'),
  a('5100', 'Cost of Goods Sold', 'expense', '5000'),
  h('6000', 'Operating Expenses', 'expense'),
  a('6100', 'Salaries and Wages', 'expense', '6000'),
  a('6200', 'Rent', 'expense', '6000'),
  a('6300', 'Software Subscriptions', 'expense', '6000'),
  a('6400', 'Travel', 'expense', '6000'),
  a('6500', 'Depreciation Expense', 'expense', '6000'),
  h('7000', 'Other Income and Expense', 'expense'),
  a('7100', 'Interest Expense', 'expense', '7000'),
  a('7900', 'Realized FX Gain/Loss', 'expense', '7000'),
  a('7910', 'Unrealized FX Gain/Loss', 'expense', '7000'),
  a('7990', 'FX Rounding Differences', 'expense', '7000'),
];

export const STANDARD_ROUNDING_CODE = '7990';
export const STANDARD_RETAINED_EARNINGS_CODE = '3200';
