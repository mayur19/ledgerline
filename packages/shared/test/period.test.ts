import { describe, expect, it } from 'vitest';
import {
  canTransitionPeriod,
  createFiscalYearSchema,
  generateMonthlyPeriods,
  isIsoDate,
  periodPostingRule,
  periodTransitionSchema,
} from '../src/ledger/period';

describe('period lifecycle', () => {
  it.each([
    ['open', 'soft_closed', true],
    ['soft_closed', 'open', true],
    ['soft_closed', 'closed', true],
    ['open', 'closed', false],
    ['closed', 'open', false],
    ['closed', 'soft_closed', false],
    ['open', 'open', false],
  ] as const)('%s -> %s allowed=%s', (from, to, allowed) => {
    expect(canTransitionPeriod(from, to)).toBe(allowed);
  });

  it('maps status to posting rule', () => {
    expect(periodPostingRule('open')).toBe('allowed');
    expect(periodPostingRule('soft_closed')).toBe('requires_override');
    expect(periodPostingRule('closed')).toBe('blocked');
  });
});

describe('generateMonthlyPeriods', () => {
  it('generates a calendar fiscal year', () => {
    const periods = generateMonthlyPeriods('2026-01');
    expect(periods).toHaveLength(12);
    expect(periods[0]).toEqual({
      name: 'FY2026-P01',
      fiscalYear: 2026,
      periodNumber: 1,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    expect(periods[1]?.endDate).toBe('2026-02-28');
    expect(periods[11]?.endDate).toBe('2026-12-31');
  });

  it('labels a non-calendar fiscal year by its ending year and handles leap years', () => {
    const periods = generateMonthlyPeriods('2027-07');
    expect(periods[0]?.name).toBe('FY2028-P01');
    expect(periods[7]).toMatchObject({ startDate: '2028-02-01', endDate: '2028-02-29' });
    expect(periods[11]?.endDate).toBe('2028-06-30');
  });

  it('periods are contiguous with no gaps or overlaps', () => {
    const periods = generateMonthlyPeriods('2025-04', 13);
    for (let i = 1; i < periods.length; i += 1) {
      const prevEnd = new Date(`${periods[i - 1]!.endDate}T00:00:00Z`);
      const start = new Date(`${periods[i]!.startDate}T00:00:00Z`);
      expect(start.getTime() - prevEnd.getTime()).toBe(86_400_000);
    }
  });

  it.each([['2026-13'], ['2026-1'], ['abc']])('rejects bad start month %s', (month) => {
    expect(() => generateMonthlyPeriods(month)).toThrow(RangeError);
  });

  it('rejects bad counts', () => {
    expect(() => generateMonthlyPeriods('2026-01', 0)).toThrow(RangeError);
    expect(() => generateMonthlyPeriods('2026-01', 14)).toThrow(RangeError);
  });
});

describe('date and schema helpers', () => {
  it('validates ISO dates strictly', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-2-3')).toBe(false);
  });

  it('parses fiscal year and transition payloads', () => {
    expect(createFiscalYearSchema.parse({ startMonth: '2026-01' })).toEqual({
      startMonth: '2026-01',
      periods: 12,
    });
    expect(createFiscalYearSchema.safeParse({ startMonth: '2026-00' }).success).toBe(false);
    expect(periodTransitionSchema.safeParse({ to: 'closed' }).success).toBe(true);
    expect(periodTransitionSchema.safeParse({ to: 'locked' }).success).toBe(false);
  });
});
