import { z } from 'zod';

export const PERIOD_STATUSES = ['open', 'soft_closed', 'closed'] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

/**
 * Period lifecycle (docs/design/system-design.md §2):
 *   open -> soft_closed -> closed
 *   soft_closed -> open   (controller re-opens for adjustments)
 *   closed -> soft_closed (re-open of a hard-closed period: pending, LL-043)
 */
const TRANSITIONS: Readonly<Record<PeriodStatus, readonly PeriodStatus[]>> = {
  open: ['soft_closed'],
  soft_closed: ['open', 'closed'],
  closed: [],
};

export function canTransitionPeriod(from: PeriodStatus, to: PeriodStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export type PostingPermission = 'allowed' | 'requires_override' | 'blocked';

/** Who may post into a period with the given status. */
export function periodPostingRule(status: PeriodStatus): PostingPermission {
  if (status === 'open') return 'allowed';
  if (status === 'soft_closed') return 'requires_override';
  return 'blocked';
}

export interface PeriodDraft {
  readonly name: string;
  readonly fiscalYear: number;
  readonly periodNumber: number;
  readonly startDate: string;
  readonly endDate: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Generate `count` consecutive calendar-month periods starting on the first day
 * of `startMonth` (YYYY-MM). Calculated in UTC so DST never shifts boundaries.
 * The fiscal year label is the calendar year in which the fiscal year ends.
 */
export function generateMonthlyPeriods(startMonth: string, count = 12): PeriodDraft[] {
  const match = /^(\d{4})-(\d{2})$/.exec(startMonth);
  if (!match) throw new RangeError('startMonth must be YYYY-MM');
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) throw new RangeError('startMonth month must be 01-12');
  if (!Number.isInteger(count) || count < 1 || count > 13) {
    throw new RangeError('count must be between 1 and 13');
  }
  const fiscalYear = new Date(Date.UTC(year, month + count - 1, 1)).getUTCFullYear();
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(Date.UTC(year, month + index, 1));
    const end = new Date(Date.UTC(year, month + index + 1, 0));
    const periodNumber = index + 1;
    return {
      name: `FY${fiscalYear}-P${String(periodNumber).padStart(2, '0')}`,
      fiscalYear,
      periodNumber,
      startDate: toIso(start),
      endDate: toIso(end),
    };
  });
}

export const createFiscalYearSchema = z
  .object({
    startMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'startMonth must be YYYY-MM'),
    periods: z.number().int().min(1).max(13).default(12),
  })
  .strict();

export const periodTransitionSchema = z
  .object({ to: z.enum(PERIOD_STATUSES), reason: z.string().trim().max(500).optional() })
  .strict();
