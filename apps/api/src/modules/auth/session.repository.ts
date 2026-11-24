import type { Role } from '@ledgerline/shared';
import type { Queryable } from '../../db/pool';

export interface SessionRow {
  session_id: string;
  csrf_token_hash: string;
  user_id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  display_name: string;
  role: Role;
}

export async function insertSession(
  db: Queryable,
  input: {
    tokenHash: string;
    csrfTokenHash: string;
    userId: string;
    organizationId: string;
    ttlHours: number;
    ip: string | null;
    userAgent: string | null;
  },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO sessions (token_hash, csrf_token_hash, user_id, organization_id, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5), $6, $7)
     RETURNING id`,
    [
      input.tokenHash,
      input.csrfTokenHash,
      input.userId,
      input.organizationId,
      input.ttlHours,
      input.ip,
      input.userAgent,
    ],
  );
  return rows[0]!.id;
}

/** Resolve a live session (not expired, not revoked, user active, membership intact). */
export async function findActiveSession(
  db: Queryable,
  tokenHash: string,
): Promise<SessionRow | null> {
  const { rows } = await db.query<SessionRow>(
    `SELECT s.id AS session_id, s.csrf_token_hash, s.user_id, s.organization_id, o.name AS organization_name,
            u.email, u.display_name, m.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id AND u.is_active
       JOIN organizations o ON o.id = s.organization_id
       JOIN memberships m ON m.user_id = s.user_id AND m.organization_id = s.organization_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function touchSession(db: Queryable, sessionId: string): Promise<void> {
  await db.query(
    `UPDATE sessions SET last_seen_at = now() WHERE id = $1 AND last_seen_at < now() - interval '1 minute'`,
    [sessionId],
  );
}

export async function revokeSession(db: Queryable, sessionId: string): Promise<void> {
  await db.query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [
    sessionId,
  ]);
}
