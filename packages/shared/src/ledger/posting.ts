import { formatMinor, parseAmount } from '../money/amount';
import { isCurrencyCode, type CurrencyCode } from '../money/currency';
import { ONE, formatRate, parseRate, ratesEqual, type Rate } from '../money/rate';
import { sum } from '../money/rounding';
import { fail, ok, type Result } from '../result';
import type { AccountRecord, Side } from './account';
import type { JournalLineInput } from './journal-schema';
import { lineError, type PostingError } from './posting-errors';
import { convertGroups, type ResolvedLine } from './posting-convert';

export interface PostingContext {
  readonly functionalCurrency: CurrencyCode;
  readonly accounts: ReadonlyMap<string, AccountRecord>;
  /** Rate table lookup: functional units per one unit of `currency` on the entry date. */
  readonly lookupRate: (currency: CurrencyCode) => Rate | undefined;
  /** Account that absorbs cross-currency rounding residue (entity setting). */
  readonly roundingAccountId: string | null;
}

export interface PreparedLine {
  readonly lineNumber: number;
  readonly accountId: string;
  readonly side: Side;
  readonly currency: CurrencyCode;
  readonly amountMinor: bigint;
  readonly rate: string;
  readonly functionalMinor: bigint;
  readonly memo: string | null;
  readonly isRoundingAdjustment: boolean;
}

export interface PreparedEntry {
  readonly lines: readonly PreparedLine[];
  readonly totalDebitFunctional: bigint;
  readonly totalCreditFunctional: bigint;
  readonly roundingAdjustmentMinor: bigint;
  readonly currencies: readonly CurrencyCode[];
}

export const MIN_JOURNAL_LINES = 2;

function resolveLine(
  input: JournalLineInput,
  index: number,
  ctx: PostingContext,
): { line?: ResolvedLine; errors: PostingError[] } {
  const n = index + 1;
  const currency = input.currency.toUpperCase();
  if (!isCurrencyCode(currency)) {
    return { errors: [lineError('UNKNOWN_CURRENCY', n, `unsupported currency ${currency}`)] };
  }
  const errors: PostingError[] = [];
  const parsed = parseAmount(input.amount, currency);
  if (!parsed.ok) {
    const message =
      parsed.error === 'EXCESS_PRECISION'
        ? `amount has more decimals than ${currency} allows`
        : 'amount is not a valid decimal';
    errors.push(lineError(parsed.error, n, message));
  } else if (parsed.minor <= 0n) {
    errors.push(lineError('NON_POSITIVE_AMOUNT', n, 'amount must be greater than zero'));
  }
  const account = ctx.accounts.get(input.accountId);
  if (!account) {
    errors.push(lineError('ACCOUNT_NOT_FOUND', n, 'account does not exist in this entity'));
  } else {
    if (!account.isActive)
      errors.push(lineError('ACCOUNT_INACTIVE', n, `account ${account.code} is inactive`));
    if (!account.isPostable) {
      errors.push(
        lineError('ACCOUNT_NOT_POSTABLE', n, `account ${account.code} is a header account`),
      );
    }
    if (account.currency !== null && account.currency !== currency) {
      errors.push(
        lineError(
          'ACCOUNT_CURRENCY_MISMATCH',
          n,
          `account ${account.code} only accepts ${account.currency}`,
        ),
      );
    }
  }
  if (errors.length > 0 || !parsed.ok) return { errors };
  return {
    errors,
    line: {
      index,
      accountId: input.accountId,
      side: input.side,
      currency,
      amountMinor: parsed.minor,
      memo: input.memo?.trim() || null,
    },
  };
}

/** Resolve exactly one rate per currency: explicit rates must agree, otherwise use the rate table. */
function resolveRates(
  inputs: readonly JournalLineInput[],
  lines: readonly ResolvedLine[],
  ctx: PostingContext,
): { rates: Map<CurrencyCode, Rate>; errors: PostingError[] } {
  const rates = new Map<CurrencyCode, Rate>();
  const errors: PostingError[] = [];
  const explicit = new Map<CurrencyCode, Rate>();
  for (const line of lines) {
    const raw = inputs[line.index]?.rate;
    if (raw === undefined || raw === '') continue;
    const n = line.index + 1;
    const rate = parseRate(raw);
    if (!rate) {
      errors.push(
        lineError('RATE_INVALID', n, 'rate must be a positive decimal with at most 10 places'),
      );
      continue;
    }
    if (line.currency === ctx.functionalCurrency && !ratesEqual(rate, ONE)) {
      errors.push(
        lineError('FUNCTIONAL_RATE_NOT_ONE', n, 'functional-currency lines must use rate 1'),
      );
      continue;
    }
    const existing = explicit.get(line.currency);
    if (existing && !ratesEqual(existing, rate)) {
      errors.push(lineError('RATE_CONFLICT', n, `conflicting rates supplied for ${line.currency}`));
      continue;
    }
    explicit.set(line.currency, rate);
  }
  for (const currency of new Set(lines.map((l) => l.currency))) {
    if (currency === ctx.functionalCurrency) {
      rates.set(currency, ONE);
      continue;
    }
    const rate = explicit.get(currency) ?? ctx.lookupRate(currency);
    if (!rate) {
      errors.push({
        code: 'RATE_MISSING',
        message: `No ${currency}/${ctx.functionalCurrency} rate on or before the entry date`,
        details: { currency, functionalCurrency: ctx.functionalCurrency },
      });
    } else {
      rates.set(currency, rate);
    }
  }
  return { rates, errors };
}

/**
 * The posting engine's pure core (docs/design/system-design.md §3).
 * Validates a journal entry and computes functional amounts. Returns every
 * problem found rather than stopping at the first, so the UI can show them all.
 */
export function prepareEntry(
  inputs: readonly JournalLineInput[],
  ctx: PostingContext,
): Result<PreparedEntry, PostingError> {
  if (inputs.length < MIN_JOURNAL_LINES) {
    return fail([{ code: 'TOO_FEW_LINES', message: 'A journal entry needs at least two lines' }]);
  }
  const resolved = inputs.map((input, i) => resolveLine(input, i, ctx));
  const lineErrors = resolved.flatMap((r) => r.errors);
  const lines = resolved.flatMap((r) => (r.line ? [r.line] : []));
  const { rates, errors: rateErrors } = resolveRates(inputs, lines, ctx);
  const errors = [...lineErrors, ...rateErrors];
  if (errors.length > 0) return fail(errors);

  const { lines: converted, roundedSides } = convertGroups(lines, rates, ctx.functionalCurrency);
  const debit = sum(converted.filter((l) => l.side === 'debit').map((l) => l.functionalMinor));
  const credit = sum(converted.filter((l) => l.side === 'credit').map((l) => l.functionalMinor));
  const difference = debit - credit;
  const magnitude = difference < 0n ? -difference : difference;
  const fn = ctx.functionalCurrency;

  if (magnitude !== 0n && magnitude * 2n > BigInt(roundedSides)) {
    return fail([
      {
        code: 'UNBALANCED',
        message: `Debits ${formatMinor(debit, fn)} and credits ${formatMinor(credit, fn)} differ by ${formatMinor(difference, fn)} ${fn}`,
        details: {
          debit: formatMinor(debit, fn),
          credit: formatMinor(credit, fn),
          difference: formatMinor(difference, fn),
          currency: fn,
        },
      },
    ]);
  }
  if (magnitude !== 0n && ctx.roundingAccountId === null) {
    return fail([
      {
        code: 'ROUNDING_ACCOUNT_REQUIRED',
        message: `A ${formatMinor(magnitude, fn)} ${fn} rounding difference needs an FX rounding account on the entity`,
      },
    ]);
  }

  const prepared: PreparedLine[] = converted.map((line) => ({
    lineNumber: line.index + 1,
    accountId: line.accountId,
    side: line.side,
    currency: line.currency,
    amountMinor: line.amountMinor,
    rate: formatRate(line.rate),
    functionalMinor: line.functionalMinor,
    memo: line.memo,
    isRoundingAdjustment: false,
  }));
  const rounding: PreparedLine[] =
    magnitude === 0n || ctx.roundingAccountId === null
      ? []
      : [
          {
            lineNumber: prepared.length + 1,
            accountId: ctx.roundingAccountId,
            side: difference > 0n ? 'credit' : 'debit',
            currency: fn,
            amountMinor: magnitude,
            rate: '1',
            functionalMinor: magnitude,
            memo: 'FX rounding adjustment',
            isRoundingAdjustment: true,
          },
        ];
  const total = difference > 0n ? debit : credit;
  return ok({
    lines: [...prepared, ...rounding],
    totalDebitFunctional: total,
    totalCreditFunctional: total,
    roundingAdjustmentMinor: difference,
    currencies: [...new Set(lines.map((l) => l.currency))],
  });
}
