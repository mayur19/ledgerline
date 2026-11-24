import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Db } from '../src/db/pool';
import { PENDING_ROUTES } from '../src/modules/pending/pending-routes';
import { describeDb, entityByCode, freshDatabase, signIn, type Client } from './db-setup';

describeDb('planned endpoints', () => {
  let db: Db;
  let owner: Client;
  let entityId: string;

  beforeAll(async () => {
    db = await freshDatabase();
    owner = await signIn(db, 'owner@northwind.example');
    entityId = (await entityByCode(owner, 'NW-US')).id;
  });
  afterAll(async () => db?.end());

  it('answers every pending route with 501 and its backlog ticket', async () => {
    for (const route of PENDING_ROUTES) {
      const url = route.url
        .replace(':entityId', entityId)
        .replace(/:[A-Za-z]+/g, '00000000-0000-4000-8000-000000000001');
      const res = await owner.request({
        method: route.method,
        url,
        payload: route.method === 'GET' || route.method === 'DELETE' ? undefined : {},
      });
      expect(res.statusCode, `${route.method} ${route.url}`).toBe(501);
      expect(res.json().error).toMatchObject({
        code: 'NOT_IMPLEMENTED',
        details: { ticket: route.ticket },
      });
    }
  });
});
