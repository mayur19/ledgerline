import {
  formatMinor,
  isCurrencyCode,
  type CurrencyCode,
  type JournalLineInput,
} from '@ledgerline/shared';
import type { EntryRow, LineRow } from './journal.repository';

const money = (minor: string, currency: string): string =>
  isCurrencyCode(currency) ? formatMinor(BigInt(minor), currency) : minor;

const trimRate = (value: string): string =>
  value.includes('.') ? value.replace(/\.?0+$/, '') : value;

export function toEntrySummary(row: EntryRow) {
  return {
    id: row.id,
    entryNumber: row.entry_number,
    status: row.status,
    source: row.source,
    entryDate: row.entry_date,
    fiscalYear: row.fiscal_year,
    periodId: row.period_id,
    memo: row.memo,
    reference: row.reference,
    functionalCurrency: row.functional_currency,
    totalDebit: money(row.total_debit_functional, row.functional_currency),
    totalCredit: money(row.total_credit_functional, row.functional_currency),
    createdBy: row.created_by ? { id: row.created_by, displayName: row.created_by_name } : null,
    createdAt: row.created_at.toISOString(),
    postedBy: row.posted_by ? { id: row.posted_by, displayName: row.posted_by_name } : null,
    postedAt: row.posted_at ? row.posted_at.toISOString() : null,
  };
}

export function toLineDto(row: LineRow, functionalCurrency: string) {
  return {
    lineNumber: row.line_number,
    accountId: row.account_id,
    accountCode: row.account_code,
    accountName: row.account_name,
    side: row.side,
    currency: row.currency,
    amount: money(row.amount_minor, row.currency),
    amountMinor: row.amount_minor,
    rate: trimRate(row.rate),
    functionalAmount: money(row.functional_minor, functionalCurrency),
    functionalMinor: row.functional_minor,
    memo: row.memo,
    isRoundingAdjustment: row.is_rounding_adjustment,
  };
}

export function toEntryDetail(row: EntryRow, lines: readonly LineRow[]) {
  return { ...toEntrySummary(row), lines: lines.map((l) => toLineDto(l, row.functional_currency)) };
}

/** Rebuild engine input from stored draft lines so a draft is re-validated when posted. */
export function linesToInput(lines: readonly LineRow[]): JournalLineInput[] {
  return lines
    .filter((l) => !l.is_rounding_adjustment)
    .map((l) => ({
      accountId: l.account_id,
      side: l.side,
      amount: formatMinor(BigInt(l.amount_minor), l.currency as CurrencyCode),
      currency: l.currency,
      rate: trimRate(l.rate),
      ...(l.memo === null ? {} : { memo: l.memo }),
    }));
}
