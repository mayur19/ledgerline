import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Db } from '../src/db/pool';
import {
  describeDb,
  entityByCode,
  freshDatabase,
  signIn,
  type Client,
  type EntityRef,
} from './db-setup';

interface Row {
  code: string;
  opening: string;
  closing: string;
  periodDebit: string;
  periodCredit: string;
  isHeader: boolean;
}

describeDb('trial balance report', () => {
  let db: Db;
  let auditor: Client;
  let us: EntityRef;
  let url: string;

  beforeAll(async () => {
    db = await freshDatabase();
    auditor = await signIn(db, 'auditor@northwind.example');
    us = await entityByCode(auditor, 'NW-US');
    url = `/api/v1/entities/${us.id}/reports/trial-balance`;
  });
  afterAll(async () => db?.end());

  it('produces a balanced year-to-date trial balance with prior-year earnings in equity', async () => {
    const res = await auditor.get(`${url}?to=2026-02-28`);
    expect(res.statusCode).toBe(200);
    const tb = res.json().data;
    expect(tb).toMatchObject({
      from: '2026-01-01',
      to: '2026-02-28',
      fiscalYear: 2026,
      currency: 'USD',
      isBalanced: true,
    });
    expect(tb.priorYearEarnings).toBe('63000.00');
    expect(tb.totals).toMatchObject({
      openingDebit: '563000.00',
      openingCredit: '563000.00',
      periodDebit: '71662.91',
      periodCredit: '71662.91',
    });
    const row = (code: string) => tb.rows.find((r: Row) => r.code === code) as Row;
    expect(row('1110')).toMatchObject({ opening: '543000.00', closing: '537994.64' });
    expect(row('3200')).toMatchObject({ opening: '-63000.00' });
    expect(row('4200')).toBeUndefined();
    expect(row('6100')).toMatchObject({ opening: '0.00', periodDebit: '38500.00' });
    expect(row('1100')).toMatchObject({ isHeader: true, closing: '563869.64' });
  });

  it('splits opening and period activity for a sub-range', async () => {
    const tb = (await auditor.get(`${url}?from=2026-02-01&to=2026-02-28`)).json().data;
    const rent = tb.rows.find((r: Row) => r.code === '6200');
    expect(rent).toMatchObject({ opening: '4000.00', periodDebit: '0.00', closing: '4000.00' });
    expect(tb.isBalanced).toBe(true);
  });

  it('excludes drafts and can include zero-balance accounts', async () => {
    const tb = (await auditor.get(`${url}?to=2026-03-31&includeZero=true`)).json().data;
    const bonusAccrualRow = tb.rows.find((r: Row) => r.code === '6100');
    expect(bonusAccrualRow.periodDebit).toBe('38500.00');
    expect(tb.rows.some((r: Row) => r.code === '1590')).toBe(true);
  });

  it('validates the requested range', async () => {
    expect((await auditor.get(`${url}?to=2031-01-01`)).json().error.code).toBe('PERIOD_NOT_FOUND');
    expect((await auditor.get(`${url}?from=2026-03-01&to=2026-02-01`)).json().error.code).toBe(
      'INVALID_RANGE',
    );
    expect((await auditor.get(`${url}?from=2025-12-01&to=2026-01-31`)).json().error.code).toBe(
      'RANGE_SPANS_FISCAL_YEARS',
    );
    expect((await auditor.get(`${url}?to=2026-02-30`)).statusCode).toBe(400);
  });

  it('reports in each entity’s own functional currency', async () => {
    const de = await entityByCode(auditor, 'NW-DE');
    const tb = (
      await auditor.get(`/api/v1/entities/${de.id}/reports/trial-balance?to=2026-12-31`)
    ).json().data;
    expect(tb).toMatchObject({ currency: 'EUR', isBalanced: true, priorYearEarnings: '0.00' });
    expect(tb.totals.periodDebit).toBe('254500.00');
  });
});
