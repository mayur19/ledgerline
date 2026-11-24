import { generateMonthlyPeriods, permissionsFor, type CreateEntityInput } from '@ledgerline/shared';
import type { Logger } from 'pino';
import { STANDARD_RETAINED_EARNINGS_CODE, STANDARD_ROUNDING_CODE } from '@ledgerline/shared';
import { insertAccount, listAccounts } from '../modules/accounts/account.repository';
import { applyStandardChart } from '../modules/accounts/account.service';
import {
  getEntity,
  insertEntity,
  updateEntitySettings,
  type EntityRecord,
} from '../modules/entities/entity.repository';
import { insertRate } from '../modules/fx/fx.repository';
import { createJournal } from '../modules/journals/posting.service';
import {
  ensureSequence,
  insertPeriods,
  listPeriods,
  setPeriodStatus,
} from '../modules/periods/period.repository';
import { hashPassword } from '../security/password';
import type { AuthContext } from '../types';
import { withTransaction, type Db } from './pool';
import {
  DE_JOURNALS,
  DEMO_ORG,
  DEMO_PASSWORD,
  DEMO_RATES,
  DEMO_USERS,
  toInput,
  US_JOURNALS,
  type DemoJournal,
} from './seed-data';

export { DEMO_PASSWORD, DEMO_USERS } from './seed-data';

async function createOrgAndUsers(db: Db): Promise<{ orgId: string; ownerId: string }> {
  const hash = await hashPassword(DEMO_PASSWORD);
  return withTransaction(db, async (tx) => {
    const org = await tx.query<{ id: string }>(
      'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
      [DEMO_ORG],
    );
    const orgId = org.rows[0]!.id;
    let ownerId = '';
    for (const user of DEMO_USERS) {
      const row = await tx.query<{ id: string }>(
        'INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id',
        [user.email, user.displayName, hash],
      );
      const userId = row.rows[0]!.id;
      if (user.role === 'owner') ownerId = userId;
      await tx.query(
        'INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, $3)',
        [orgId, userId, user.role],
      );
    }
    for (const rate of DEMO_RATES) {
      await insertRate(tx, orgId, ownerId, { ...rate, rateType: 'spot' });
    }
    return { orgId, ownerId };
  });
}

async function createEntity(
  db: Db,
  orgId: string,
  input: CreateEntityInput,
  fiscalYears: readonly string[],
  extra?: { code: string; name: string; currency: string },
): Promise<EntityRecord> {
  return withTransaction(db, async (tx) => {
    const entity = await insertEntity(tx, {
      ...input,
      organizationId: orgId,
      countryCode: input.countryCode ?? null,
    });
    const ids = await applyStandardChart(tx, orgId, entity.id);
    if (extra) {
      await insertAccount(tx, orgId, entity.id, {
        code: extra.code,
        name: extra.name,
        type: 'asset',
        parentId: ids.get('1100') ?? null,
        isPostable: true,
        currency: extra.currency,
      });
    }
    await updateEntitySettings(tx, entity.id, {
      roundingAccountId: ids.get(STANDARD_ROUNDING_CODE) ?? null,
      retainedEarningsAccountId: ids.get(STANDARD_RETAINED_EARNINGS_CODE) ?? null,
    });
    for (const startMonth of fiscalYears) {
      const drafts = generateMonthlyPeriods(startMonth);
      await insertPeriods(tx, orgId, entity.id, drafts);
      await ensureSequence(tx, entity.id, drafts[0]!.fiscalYear);
    }
    return getEntity(tx, orgId, entity.id);
  });
}

async function postJournals(
  db: Db,
  auth: AuthContext,
  entity: EntityRecord,
  journals: readonly DemoJournal[],
) {
  const accounts = await listAccounts(db, auth.organizationId, entity.id);
  const ids = new Map(accounts.map((a) => [a.code, a.id] as const));
  for (const [index, journal] of journals.entries()) {
    await createJournal(db, auth, entity, toInput(journal, ids, entity.functionalCurrency), {
      post: journal.post,
      idempotencyKey: `seed-${entity.code}-${index}`,
      meta: { requestId: 'seed', ip: '127.0.0.1' },
    });
  }
}

async function setStatuses(
  db: Db,
  auth: AuthContext,
  entity: EntityRecord,
  fiscalYear: number,
  upTo: string,
  status: 'soft_closed' | 'closed',
) {
  const periods = await listPeriods(db, auth.organizationId, entity.id, fiscalYear);
  for (const period of periods.filter((p) => p.endDate <= upTo)) {
    await withTransaction(db, async (tx) => {
      await setPeriodStatus(tx, period.id, 'soft_closed', auth.userId);
      if (status === 'closed') await setPeriodStatus(tx, period.id, 'closed', auth.userId);
    });
  }
}

/** Idempotent development seed: does nothing when the demo organization already exists. */
export async function seed(db: Db, logger: Logger): Promise<void> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing to load demo data in production');
  const existing = await db.query('SELECT 1 FROM organizations WHERE name = $1', [DEMO_ORG]);
  if (existing.rows.length > 0) {
    logger.info('demo data already present');
    return;
  }
  const { orgId, ownerId } = await createOrgAndUsers(db);
  const owner = DEMO_USERS.find((u) => u.role === 'owner')!;
  const auth: AuthContext = {
    sessionId: 'seed',
    userId: ownerId,
    organizationId: orgId,
    organizationName: DEMO_ORG,
    email: owner.email,
    displayName: owner.displayName,
    role: 'owner',
    permissions: permissionsFor('owner'),
    csrfTokenHash: '',
  };
  const us = await createEntity(
    db,
    orgId,
    {
      code: 'NW-US',
      name: 'Northwind Inc.',
      functionalCurrency: 'USD',
      countryCode: 'US',
      timezone: 'America/New_York',
    },
    ['2025-01', '2026-01'],
    { code: '1115', name: 'EUR Operating Account', currency: 'EUR' },
  );
  const de = await createEntity(
    db,
    orgId,
    {
      code: 'NW-DE',
      name: 'Northwind GmbH',
      functionalCurrency: 'EUR',
      countryCode: 'DE',
      timezone: 'Europe/Berlin',
    },
    ['2026-01'],
  );
  await postJournals(db, auth, us, US_JOURNALS);
  await postJournals(db, auth, de, DE_JOURNALS);
  await setStatuses(db, auth, us, 2025, '2025-12-31', 'closed');
  await setStatuses(db, auth, us, 2026, '2026-01-31', 'soft_closed');
  logger.info({ organization: DEMO_ORG, entities: [us.code, de.code] }, 'demo data loaded');
}
