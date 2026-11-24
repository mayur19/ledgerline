import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool';
import {
  accountIds,
  describeDb,
  entityByCode,
  freshDatabase,
  signInRoles,
  type Client,
  type EntityRef,
} from './db-setup';

describeDb('journal posting engine over HTTP', () => {
  let db: Db;
  let controller: Client;
  let accountant: Client;
  let auditor: Client;
  let us: EntityRef;
  let ids: Record<string, string>;
  let url: string;

  const line = (
    code: string,
    side: 'debit' | 'credit',
    amount: string,
    currency = 'USD',
    extra = {},
  ) => ({
    accountId: ids[code],
    side,
    amount,
    currency,
    ...extra,
  });

  beforeAll(async () => {
    db = await freshDatabase();
    [controller, accountant, auditor] = await signInRoles(db, [
      'controller',
      'accountant',
      'auditor',
    ] as const);
    us = await entityByCode(controller, 'NW-US');
    ids = await accountIds(controller, us.id);
    url = `/api/v1/entities/${us.id}/journals`;
  });
  afterAll(async () => db?.end());

  describe('creating and posting', () => {
    it('posts a balanced entry with the next gapless number', async () => {
      const res = await accountant.post(url, {
        entryDate: '2026-02-25',
        memo: 'Office supplies',
        reference: 'PO-77',
        post: true,
        lines: [
          line('6300', 'debit', '310.25', 'USD', { memo: 'Toner' }),
          line('2100', 'credit', '310.25'),
        ],
      });
      expect(res.statusCode).toBe(201);
      const entry = res.json().data;
      expect(entry).toMatchObject({
        status: 'posted',
        entryNumber: 'NW-US-2026-000007',
        totalDebit: '310.25',
        totalCredit: '310.25',
        fiscalYear: 2026,
      });
      expect(entry.lines[0]).toMatchObject({
        accountCode: '6300',
        amount: '310.25',
        rate: '1',
        memo: 'Toner',
      });
      expect(entry.postedBy.displayName).toBe('Sofia Alvarez');
    });

    it('returns every engine error for an invalid entry', async () => {
      const res = await accountant.post(url, {
        entryDate: '2026-02-25',
        memo: 'Broken',
        post: true,
        lines: [
          line('6300', 'debit', '100.00'),
          line('1000', 'credit', '100.005'),
          line('2100', 'credit', '99.99'),
        ],
      });
      expect(res.statusCode).toBe(422);
      const errors = res.json().error.details.errors.map((e: { code: string }) => e.code);
      expect(errors).toEqual(['EXCESS_PRECISION', 'ACCOUNT_NOT_POSTABLE']);
      expect(res.json().error.details.errors[0].line).toBe(2);
    });

    it('rejects unbalanced entries with the functional difference', async () => {
      const res = await accountant.post(url, {
        entryDate: '2026-02-25',
        memo: 'Off by a cent',
        post: true,
        lines: [line('6300', 'debit', '100.00'), line('2100', 'credit', '99.99')],
      });
      expect(res.json().error.details.errors[0]).toMatchObject({
        code: 'UNBALANCED',
        details: { difference: '0.01' },
      });
    });

    it('converts foreign lines with the latest rate on or before the entry date', async () => {
      const res = await accountant.post(url, {
        entryDate: '2026-02-27',
        memo: 'EUR receipt',
        post: true,
        lines: [line('1115', 'debit', '1000.00', 'EUR'), line('4100', 'credit', '1000.00', 'EUR')],
      });
      expect(res.statusCode).toBe(201);
      const lines = res.json().data.lines;
      expect(lines[0]).toMatchObject({
        rate: '1.041',
        functionalAmount: '1041.00',
        amount: '1000.00',
        currency: 'EUR',
      });
    });

    it('inverts an opposite-direction quote exactly', async () => {
      const res = await accountant.post(url, {
        entryDate: '2026-02-27',
        memo: 'JPY expense',
        post: true,
        lines: [line('6400', 'debit', '7460', 'JPY'), line('1110', 'credit', '50.00')],
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.lines[0].functionalAmount).toBe('50.00');
    });

    it('reports a missing rate', async () => {
      const res = await accountant.post(url, {
        entryDate: '2026-02-27',
        memo: 'AUD',
        lines: [line('6400', 'debit', '10', 'AUD'), line('1110', 'credit', '7')],
      });
      expect(res.json().error.details.errors[0].code).toBe('RATE_MISSING');
    });

    it('requires a period and refuses closed periods', async () => {
      const none = await accountant.post(url, {
        entryDate: '2030-01-01',
        memo: 'x',
        post: true,
        lines: [line('6300', 'debit', '1'), line('2100', 'credit', '1')],
      });
      expect(none.json().error.code).toBe('PERIOD_NOT_FOUND');
      const closed = await controller.post(url, {
        entryDate: '2025-12-31',
        memo: 'x',
        post: true,
        lines: [line('6300', 'debit', '1'), line('2100', 'credit', '1')],
      });
      expect(closed.statusCode).toBe(409);
      expect(closed.json().error.code).toBe('PERIOD_CLOSED');
    });

    it('lets only controllers post into a soft-closed period', async () => {
      const body = {
        entryDate: '2026-01-31',
        memo: 'Late accrual',
        post: true,
        lines: [line('6300', 'debit', '5'), line('2100', 'credit', '5')],
      };
      const denied = await accountant.post(url, body);
      expect(denied.statusCode).toBe(403);
      expect(denied.json().error.code).toBe('PERIOD_SOFT_CLOSED');
      const allowed = await controller.post(url, body);
      expect(allowed.statusCode).toBe(201);
      expect(allowed.json().data.status).toBe('posted');
    });

    it('enforces journal permissions', async () => {
      const body = {
        entryDate: '2026-02-25',
        memo: 'x',
        lines: [line('6300', 'debit', '1'), line('2100', 'credit', '1')],
      };
      expect((await auditor.post(url, body)).statusCode).toBe(403);
      expect((await auditor.get(url)).statusCode).toBe(200);
    });
  });

  describe('drafts', () => {
    it('saves a draft without a number and posts it later', async () => {
      const draft = await accountant.post(url, {
        entryDate: '2026-02-26',
        memo: 'Prepaid insurance',
        lines: [line('1400', 'debit', '1200.00'), line('1110', 'credit', '1200.00')],
      });
      expect(draft.statusCode).toBe(201);
      expect(draft.json().data).toMatchObject({
        status: 'draft',
        entryNumber: null,
        postedAt: null,
      });
      const posted = await accountant.post(`${url}/${draft.json().data.id}/post`);
      expect(posted.statusCode).toBe(200);
      expect(posted.json().data.status).toBe('posted');
      expect(posted.json().data.entryNumber).toMatch(/^NW-US-2026-\d{6}$/);
      const again = await accountant.post(`${url}/${draft.json().data.id}/post`);
      expect(again.json().error.code).toBe('JOURNAL_NOT_DRAFT');
    });

    it('re-validates a draft at posting time', async () => {
      const draft = await accountant.post(url, {
        entryDate: '2026-02-26',
        memo: 'Travel',
        lines: [line('6400', 'debit', '80.00'), line('1110', 'credit', '80.00')],
      });
      await controller.patch(`/api/v1/entities/${us.id}/accounts/${ids['6400']}`, {
        isActive: false,
      });
      const res = await accountant.post(`${url}/${draft.json().data.id}/post`);
      expect(res.statusCode).toBe(422);
      expect(res.json().error.details.errors[0].code).toBe('ACCOUNT_INACTIVE');
      await controller.patch(`/api/v1/entities/${us.id}/accounts/${ids['6400']}`, {
        isActive: true,
      });
    });

    it('returns 404 for unknown entries', async () => {
      expect(
        (await accountant.post(`${url}/00000000-0000-4000-8000-000000000000/post`)).statusCode,
      ).toBe(404);
      expect((await accountant.get(`${url}/00000000-0000-4000-8000-000000000000`)).statusCode).toBe(
        404,
      );
    });
  });

  describe('idempotency', () => {
    const body = () => ({
      entryDate: '2026-02-26',
      memo: 'Idempotent',
      post: true,
      lines: [line('6300', 'debit', '42.00'), line('2100', 'credit', '42.00')],
    });

    it('replays the original entry for a repeated key', async () => {
      const first = await accountant.post(url, body(), { 'idempotency-key': 'retry-key-0001' });
      const second = await accountant.post(url, body(), { 'idempotency-key': 'retry-key-0001' });
      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(200);
      expect(second.headers['idempotent-replayed']).toBe('true');
      expect(second.json().data.id).toBe(first.json().data.id);
    });

    it('rejects key reuse with a different payload and malformed keys', async () => {
      const changed = { ...body(), memo: 'Different' };
      const res = await accountant.post(url, changed, { 'idempotency-key': 'retry-key-0001' });
      expect(res.json().error.code).toBe('IDEMPOTENCY_KEY_REUSED');
      expect(
        (await accountant.post(url, body(), { 'idempotency-key': 'bad key' })).statusCode,
      ).toBe(400);
    });

    it('creates exactly one entry under concurrent retries', async () => {
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          accountant.post(url, body(), { 'idempotency-key': 'retry-key-race' }),
        ),
      );
      const ids = new Set(results.map((r) => r.json().data.id));
      expect(ids.size).toBe(1);
      expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
    });
  });

  describe('reading', () => {
    it('previews without persisting', async () => {
      const before = (await accountant.get(`${url}?limit=1`)).json().meta.total;
      const res = await accountant.post(`${url}/preview`, {
        entryDate: '2026-02-27',
        memo: 'Preview',
        lines: [
          line('1115', 'debit', '0.05', 'EUR', { rate: '1.1' }),
          line('6400', 'debit', '0.05', 'GBP', { rate: '1.1' }),
          line('1110', 'credit', '0.11'),
        ],
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({
        totalDebit: '0.12',
        roundingAdjustment: '0.01',
        period: { name: 'FY2026-P02' },
      });
      expect(res.json().data.lines.at(-1).isRoundingAdjustment).toBe(true);
      expect((await accountant.get(`${url}?limit=1`)).json().meta.total).toBe(before);
    });

    it('lists with filters and pagination, and fetches detail', async () => {
      const drafts = await accountant.get(`${url}?status=draft`);
      expect(drafts.json().data.every((e: { status: string }) => e.status === 'draft')).toBe(true);
      const page = await accountant.get(`${url}?from=2026-01-01&to=2026-01-31&limit=2&offset=0`);
      expect(page.json().data).toHaveLength(2);
      expect(page.json().meta).toMatchObject({ limit: 2, offset: 0 });
      expect(page.json().meta.total).toBeGreaterThanOrEqual(3);
      const detail = await accountant.get(`${url}/${page.json().data[0].id}`);
      expect(detail.json().data.lines.length).toBeGreaterThanOrEqual(2);
    });
  });
});
