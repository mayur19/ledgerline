import { formatMinor, isCurrencyCode, parseAmount, type CurrencyCode } from '@ledgerline/shared';

export interface DraftLine {
  readonly key: string;
  readonly accountId: string;
  readonly side: 'debit' | 'credit';
  readonly amount: string;
  readonly currency: string;
  readonly rate: string;
  readonly memo: string;
}

export interface CurrencyTotals {
  readonly currency: string;
  readonly debit: string;
  readonly credit: string;
  readonly difference: string;
  readonly balanced: boolean;
}

export interface DraftSummary {
  readonly totals: readonly CurrencyTotals[];
  readonly invalidLines: readonly number[];
  /** True when every currency balances on its own (the common case). */
  readonly balancedPerCurrency: boolean;
}

/**
 * Live, client-side balance check per transaction currency, using the same
 * integer money parser as the server. Cross-currency entries are confirmed with
 * the server preview, which applies the rate table.
 */
export function summarizeDraft(lines: readonly DraftLine[]): DraftSummary {
  const sums = new Map<CurrencyCode, { debit: bigint; credit: bigint }>();
  const invalidLines: number[] = [];
  lines.forEach((line, index) => {
    if (line.amount.trim() === '') return;
    const currency = line.currency.toUpperCase();
    const parsed = isCurrencyCode(currency) ? parseAmount(line.amount, currency) : null;
    if (!parsed || !parsed.ok || parsed.minor <= 0n || !isCurrencyCode(currency)) {
      invalidLines.push(index + 1);
      return;
    }
    const current = sums.get(currency) ?? { debit: 0n, credit: 0n };
    sums.set(currency, {
      debit: current.debit + (line.side === 'debit' ? parsed.minor : 0n),
      credit: current.credit + (line.side === 'credit' ? parsed.minor : 0n),
    });
  });
  const totals = [...sums].map(([currency, s]) => ({
    currency,
    debit: formatMinor(s.debit, currency),
    credit: formatMinor(s.credit, currency),
    difference: formatMinor(s.debit - s.credit, currency),
    balanced: s.debit === s.credit,
  }));
  return {
    totals,
    invalidLines,
    balancedPerCurrency: totals.length > 0 && totals.every((t) => t.balanced),
  };
}

let counter = 0;
export function emptyLine(currency: string, side: 'debit' | 'credit' = 'debit'): DraftLine {
  counter += 1;
  return { key: `line-${counter}`, accountId: '', side, amount: '', currency, rate: '', memo: '' };
}
