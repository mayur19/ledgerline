import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Db } from '../src/db/pool';
import {
  accountIds,
  describeDb,
  entityByCode,
  freshDatabase,
  signIn,
  type Client,
  type EntityRef,
} from './db-setup';

describeDb('posting under concurrency', () => {
  let db: Db;
  let controller: Client;
  let de: EntityRef;
  let ids: Record<string, string>;

  beforeAll(async () => {
    db = await freshDatabase();
    controller = await signIn(db, 'controller@northwind.example');
    de = await entityByCode(controller, 'NW-DE');
    ids = await accountIds(controller, de.id);
  });
  afterAll(async () => db?.end());

  const entry = (date: string, n: number) => ({
    entryDate: date,
    memo: `Concurrent ${n}`,
    post: true,
    lines: [
      { accountId: ids['6300'], side: 'debit', amount: `${n}.00`, currency: 'EUR' },
      { accountId: ids['2100'], side: 'credit', amount: `${n}.00`, currency: 'EUR' },
    ],
  });

  it('hands out gapless, unique sequence numbers to parallel posters', async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        controller.post(`/api/v1/entities/${de.id}/journals`, entry('2026-03-10', i + 1)),
      ),
    );
    expect(results.every((r) => r.statusCode === 201)).toBe(true);
    const { rows } = await db.query<{ sequence_number: string }>(
      `SELECT sequence_number FROM journal_entries WHERE entity_id = $1 AND fiscal_year = 2026 AND status = 'posted' ORDER BY 1`,
      [de.id],
    );
    const numbers = rows.map((r) => Number(r.sequence_number));
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, i) => i + 1));
  });

  it('never leaves a posted entry in a period that a concurrent close sealed', async () => {
    const periods = (
      await controller.get(`/api/v1/entities/${de.id}/periods?fiscalYear=2026`)
    ).json().data;
    const april = periods.find((p: { periodNumber: number }) => p.periodNumber === 4);
    const transition = (to: string) =>
      controller.post(`/api/v1/entities/${de.id}/periods/${april.id}/transition`, { to });
    await transition('soft_closed');
    const posts = Array.from({ length: 20 }, (_, i) =>
      controller.post(`/api/v1/entities/${de.id}/journals`, entry('2026-04-15', i + 1)),
    );
    const close = transition('closed');
    const results = await Promise.all([...posts, close]);
    const closeResult = results.at(-1)!;
    expect(closeResult.statusCode).toBe(200);
    const outcomes = results.slice(0, -1).map((r) => r.statusCode);
    expect(outcomes.every((s) => s === 201 || s === 409)).toBe(true);
    const rejected = results.slice(0, -1).filter((r) => r.statusCode === 409);
    expect(rejected.every((r) => r.json().error.code === 'PERIOD_CLOSED')).toBe(true);
    const after = await controller.post(
      `/api/v1/entities/${de.id}/journals`,
      entry('2026-04-16', 1),
    );
    expect(after.json().error.code).toBe('PERIOD_CLOSED');
    const posted = outcomes.filter((s) => s === 201).length;
    const { rows: count } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM journal_entries WHERE period_id = $1 AND status = 'posted'`,
      [april.id],
    );
    expect(Number(count[0]!.n)).toBe(posted);
  });
});
