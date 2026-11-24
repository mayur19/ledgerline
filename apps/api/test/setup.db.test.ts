import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Db } from '../src/db/pool';
import {
  accountIds,
  describeDb,
  entityByCode,
  freshDatabase,
  signInRoles,
  type Client,
} from './db-setup';

describeDb('entities, chart of accounts, periods and FX rates', () => {
  let db: Db;
  let owner: Client;
  let controller: Client;
  let accountant: Client;
  let auditor: Client;

  beforeAll(async () => {
    db = await freshDatabase();
    [owner, controller, accountant, auditor] = await signInRoles(db, [
      'owner',
      'controller',
      'accountant',
      'auditor',
    ] as const);
  });
  afterAll(async () => db?.end());

  it('creates an entity with the standard chart and wired settings', async () => {
    const res = await controller.post('/api/v1/entities', {
      code: 'NW-UK',
      name: 'Northwind Ltd',
      functionalCurrency: 'GBP',
      timezone: 'europe/london',
    });
    expect(res.statusCode).toBe(201);
    const entity = res.json().data;
    expect(entity).toMatchObject({
      code: 'NW-UK',
      functionalCurrency: 'GBP',
      timezone: 'Europe/London',
    });
    expect(entity.roundingAccountId).not.toBeNull();
    const accounts = (await controller.get(`/api/v1/entities/${entity.id}/accounts`)).json().data;
    expect(accounts.length).toBeGreaterThan(30);
    expect(accounts.find((a: { code: string }) => a.code === '1000').isPostable).toBe(false);
  });

  it('rejects an unsupported time zone and a duplicate entity code', async () => {
    const tz = await controller.post('/api/v1/entities', {
      code: 'NW-XX',
      name: 'Bad',
      functionalCurrency: 'USD',
      timezone: 'Mars/Base',
    });
    expect(tz.statusCode).toBe(400);
    const dup = await controller.post('/api/v1/entities', {
      code: 'NW-US',
      name: 'Again',
      functionalCurrency: 'USD',
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('ENTITY_CODE_TAKEN');
  });

  it('can create an entity with an empty chart', async () => {
    const res = await owner.post('/api/v1/entities', {
      code: 'NW-SG',
      name: 'Northwind Pte',
      functionalCurrency: 'SGD',
      chartTemplate: 'empty',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.roundingAccountId).toBeNull();
    expect(
      (await owner.get(`/api/v1/entities/${res.json().data.id}/accounts`)).json().data,
    ).toEqual([]);
  });

  it('enforces RBAC on entity and account management', async () => {
    const us = await entityByCode(owner, 'NW-US');
    expect(
      (
        await accountant.post('/api/v1/entities', {
          code: 'NW-FR',
          name: 'x',
          functionalCurrency: 'EUR',
        })
      ).statusCode,
    ).toBe(403);
    const acct = await auditor.post(`/api/v1/entities/${us.id}/accounts`, {
      code: '6600',
      name: 'Training',
      type: 'expense',
    });
    expect(acct.statusCode).toBe(403);
    expect((await auditor.get(`/api/v1/entities/${us.id}/accounts`)).statusCode).toBe(200);
  });

  it('creates accounts under header parents and blocks invalid hierarchy', async () => {
    const us = await entityByCode(controller, 'NW-US');
    const ids = await accountIds(controller, us.id);
    const url = `/api/v1/entities/${us.id}/accounts`;
    const ok = await controller.post(url, {
      code: '6600',
      name: 'Training',
      type: 'expense',
      parentId: ids['6000'],
    });
    expect(ok.statusCode).toBe(201);
    expect(
      (await controller.post(url, { code: '6600', name: 'Again', type: 'expense' })).json().error
        .code,
    ).toBe('ACCOUNT_CODE_TAKEN');
    const wrongType = await controller.post(url, {
      code: '6610',
      name: 'x',
      type: 'asset',
      parentId: ids['6000'],
    });
    expect(wrongType.json().error.code).toBe('ACCOUNT_PARENT_TYPE_MISMATCH');
    const notHeader = await controller.post(url, {
      code: '6620',
      name: 'x',
      type: 'expense',
      parentId: ids['6100'],
    });
    expect(notHeader.json().error.code).toBe('ACCOUNT_PARENT_NOT_HEADER');
    const cycle = await controller.patch(`${url}/${ids['1000']}`, { parentId: ids['1100'] });
    expect(cycle.statusCode).toBe(422);
    expect(cycle.json().error.code).toBe('ACCOUNT_CYCLE');
  });

  it('renames and deactivates an account and audits the change', async () => {
    const us = await entityByCode(controller, 'NW-US');
    const ids = await accountIds(controller, us.id);
    const res = await controller.patch(`/api/v1/entities/${us.id}/accounts/${ids['1120']}`, {
      name: 'Petty Cash (closed)',
      isActive: false,
    });
    expect(res.json().data).toMatchObject({ name: 'Petty Cash (closed)', isActive: false });
    const active = (
      await controller.get(`/api/v1/entities/${us.id}/accounts?includeInactive=false`)
    ).json().data;
    expect(active.some((a: { id: string }) => a.id === ids['1120'])).toBe(false);
    const audit = (await controller.get(`/api/v1/audit-events?targetId=${ids['1120']}`)).json()
      .data;
    expect(audit[0].action).toBe('account.updated');
    expect(audit[0].metadata.before.name).toBe('Petty Cash');
  });

  it('hides other organizations entirely (404, not 403)', async () => {
    const us = await entityByCode(owner, 'NW-US');
    const app = owner.app;
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        organizationName: 'Rival Co',
        displayName: 'Rita',
        email: 'rita@rival.example',
        password: 'rival-password-123',
      },
    });
    const { login } = await import('./db-setup');
    const rival = await login(app, 'rita@rival.example', 'rival-password-123');
    expect((await rival.get(`/api/v1/entities/${us.id}`)).statusCode).toBe(404);
    expect((await rival.get(`/api/v1/entities/${us.id}/accounts`)).statusCode).toBe(404);
    expect((await rival.get('/api/v1/entities')).json().data).toEqual([]);
    expect((await rival.get('/api/v1/entities/not-a-uuid')).statusCode).toBe(404);
  });

  it('updates entity settings with validation', async () => {
    const us = await entityByCode(controller, 'NW-US');
    const ids = await accountIds(controller, us.id);
    const url = `/api/v1/entities/${us.id}/settings`;
    expect(
      (await controller.patch(url, { retainedEarningsAccountId: ids['1110'] })).statusCode,
    ).toBe(422);
    expect((await controller.patch(url, { roundingAccountId: ids['7000'] })).statusCode).toBe(422);
    const ok = await controller.patch(url, { roundingAccountId: ids['7900'] });
    expect(ok.json().data.roundingAccountId).toBe(ids['7900']);
    await controller.patch(url, { roundingAccountId: ids['7990'] });
  });

  it('generates fiscal years and rejects overlaps', async () => {
    const de = await entityByCode(controller, 'NW-DE');
    const url = `/api/v1/entities/${de.id}/fiscal-years`;
    const res = await controller.post(url, { startMonth: '2027-01' });
    expect(res.statusCode).toBe(201);
    expect(res.json().data).toHaveLength(12);
    expect(res.json().data[0]).toMatchObject({
      name: 'FY2027-P01',
      status: 'open',
      startDate: '2027-01-01',
    });
    const overlap = await controller.post(url, { startMonth: '2027-06' });
    expect(overlap.statusCode).toBe(409);
    expect(overlap.json().error.code).toBe('PERIOD_OVERLAP');
    expect((await accountant.post(url, { startMonth: '2028-01' })).statusCode).toBe(403);
    const list = (await auditor.get(`/api/v1/entities/${de.id}/periods?fiscalYear=2027`)).json()
      .data;
    expect(list).toHaveLength(12);
  });

  it('walks the period state machine and refuses invalid transitions', async () => {
    const de = await entityByCode(controller, 'NW-DE');
    const periods = (
      await controller.get(`/api/v1/entities/${de.id}/periods?fiscalYear=2027`)
    ).json().data;
    const url = `/api/v1/entities/${de.id}/periods/${periods[0].id}/transition`;
    const skip = await controller.post(url, { to: 'closed' });
    expect(skip.statusCode).toBe(409);
    expect(skip.json().error.code).toBe('INVALID_PERIOD_TRANSITION');
    expect(
      (await controller.post(url, { to: 'soft_closed', reason: 'Jan review' })).json().data.status,
    ).toBe('soft_closed');
    expect((await controller.post(url, { to: 'open' })).json().data.status).toBe('open');
    await controller.post(url, { to: 'soft_closed' });
    expect((await controller.post(url, { to: 'closed' })).json().data.status).toBe('closed');
    expect((await controller.post(url, { to: 'soft_closed' })).statusCode).toBe(409);
    const missing = await controller.post(
      `/api/v1/entities/${de.id}/periods/00000000-0000-4000-8000-000000000000/transition`,
      { to: 'open' },
    );
    expect(missing.statusCode).toBe(404);
  });

  it('refuses to close a period that still holds drafts', async () => {
    const us = await entityByCode(controller, 'NW-US');
    const periods = (
      await controller.get(`/api/v1/entities/${us.id}/periods?fiscalYear=2026`)
    ).json().data;
    const march = periods.find((p: { periodNumber: number }) => p.periodNumber === 3);
    const url = `/api/v1/entities/${us.id}/periods/${march.id}/transition`;
    await controller.post(url, { to: 'soft_closed' });
    const res = await controller.post(url, { to: 'closed' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatchObject({ code: 'PERIOD_HAS_DRAFTS', details: { drafts: 1 } });
    await controller.post(url, { to: 'open' });
  });

  it('maintains FX rates', async () => {
    const res = await accountant.post('/api/v1/fx-rates', {
      fromCurrency: 'CHF',
      toCurrency: 'USD',
      rateDate: '2026-02-01',
      rate: '1.1390',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data).toMatchObject({ rate: '1.139', rateType: 'spot' });
    const dup = await accountant.post('/api/v1/fx-rates', {
      fromCurrency: 'CHF',
      toCurrency: 'USD',
      rateDate: '2026-02-01',
      rate: '1.2',
    });
    expect(dup.json().error.code).toBe('FX_RATE_EXISTS');
    expect(
      (
        await accountant.post('/api/v1/fx-rates', {
          fromCurrency: 'CHF',
          toCurrency: 'CHF',
          rateDate: '2026-02-01',
          rate: '1',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await auditor.post('/api/v1/fx-rates', {
          fromCurrency: 'CAD',
          toCurrency: 'USD',
          rateDate: '2026-02-01',
          rate: '0.7',
        })
      ).statusCode,
    ).toBe(403);
    const list = (await auditor.get('/api/v1/fx-rates?fromCurrency=CHF')).json().data;
    expect(list).toHaveLength(1);
  });
});
