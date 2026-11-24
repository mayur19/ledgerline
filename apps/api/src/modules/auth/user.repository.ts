import type { Role } from '@ledgerline/shared';
import type { Queryable } from '../../db/pool';

export interface LoginCandidate {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  is_active: boolean;
  organization_id: string;
  organization_name: string;
  role: Role;
}

export async function findLoginCandidate(
  db: Queryable,
  email: string,
): Promise<LoginCandidate | null> {
  const { rows } = await db.query<LoginCandidate>(
    `SELECT u.id, u.email, u.display_name, u.password_hash, u.is_active,
            m.organization_id, o.name AS organization_name, m.role
       FROM users u
       JOIN memberships m ON m.user_id = u.id
       JOIN organizations o ON o.id = m.organization_id
      WHERE u.email = $1
      ORDER BY m.created_at
      LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function createOrganizationWithOwner(
  db: Queryable,
  input: { organizationName: string; email: string; displayName: string; passwordHash: string },
): Promise<{ organizationId: string; userId: string }> {
  const org = await db.query<{ id: string }>(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
    [input.organizationName],
  );
  const user = await db.query<{ id: string }>(
    'INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [input.email, input.displayName, input.passwordHash],
  );
  const organizationId = org.rows[0]!.id;
  const userId = user.rows[0]!.id;
  await db.query(
    `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [organizationId, userId],
  );
  return { organizationId, userId };
}
