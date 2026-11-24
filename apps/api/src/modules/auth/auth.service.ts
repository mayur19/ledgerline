import { type LoginInput, type RegisterInput } from '@ledgerline/shared';
import type { AppDeps } from '../../deps';
import { isUniqueViolation, withTransaction } from '../../db/pool';
import { AppError, tooManyRequests } from '../../lib/errors';
import { DUMMY_HASH_PROMISE, hashPassword, verifyPassword } from '../../security/password';
import { hashToken, randomToken } from '../../security/tokens';
import { limiterIpKey } from '../../http/client-ip';
import { recordAudit } from '../audit/audit.service';
import { insertSession, revokeSession } from './session.repository';
import { createOrganizationWithOwner, findLoginCandidate } from './user.repository';

export interface ClientInfo {
  readonly ip: string;
  readonly userAgent: string | null;
  readonly requestId: string;
}

export interface IssuedSession {
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly userId: string;
  readonly organizationId: string;
}

async function issueSession(
  deps: AppDeps,
  userId: string,
  organizationId: string,
  client: ClientInfo,
): Promise<IssuedSession> {
  const sessionToken = randomToken();
  const csrfToken = randomToken();
  await insertSession(deps.db, {
    tokenHash: hashToken(sessionToken, deps.env.SESSION_SECRET),
    csrfTokenHash: hashToken(csrfToken, deps.env.SESSION_SECRET),
    userId,
    organizationId,
    ttlHours: deps.env.SESSION_TTL_HOURS,
    ip: client.ip,
    userAgent: client.userAgent?.slice(0, 300) ?? null,
  });
  return { sessionToken, csrfToken, userId, organizationId };
}

export const REGISTRATION_ACCEPTED_MESSAGE =
  'If this email address can be registered, the organization is ready and you can sign in.';

/**
 * Self-service sign-up. The response never reveals whether the email already
 * exists: both branches hash a password (similar timing) and return the same
 * message, and neither starts a session. Email-verified sign-up through the
 * local outbox replaces this in LL-120.
 */
export async function register(
  deps: AppDeps,
  input: RegisterInput,
  client: ClientInfo,
): Promise<void> {
  const decision = deps.throttle.registerByIp.hit(`register-ip:${limiterIpKey(client.ip)}`);
  if (!decision.allowed) throw tooManyRequests(decision.retryAfterSeconds);
  const passwordHash = await hashPassword(input.password);
  const existing = await findLoginCandidate(deps.db, input.email);
  if (existing) {
    await recordAudit(deps.db, {
      organizationId: existing.organization_id,
      actorUserId: null,
      action: 'auth.register_existing_email',
      targetType: 'user',
      targetId: existing.id,
      requestId: client.requestId,
      ipAddress: client.ip,
    });
    return;
  }
  await withTransaction(deps.db, async (tx) => {
    const created = await createOrganizationWithOwner(tx, { ...input, passwordHash });
    await recordAudit(tx, {
      organizationId: created.organizationId,
      actorUserId: created.userId,
      action: 'organization.registered',
      targetType: 'organization',
      targetId: created.organizationId,
      requestId: client.requestId,
      ipAddress: client.ip,
    });
  }).catch((error: unknown) => {
    // Lost a race with a concurrent registration of the same email: same generic outcome.
    if (!isUniqueViolation(error)) throw error;
  });
}

const INVALID_CREDENTIALS = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');

/**
 * Login guarded by an IP-only window (spraying) and an email-only progressive
 * backoff (targeted guessing). Unknown emails take the same path and timing.
 */
export async function login(
  deps: AppDeps,
  input: LoginInput,
  client: ClientInfo,
): Promise<IssuedSession> {
  const emailKey = `email:${input.email}`;
  // Both reservations happen synchronously, before the first await.
  const ipKey = limiterIpKey(client.ip);
  const byIp = deps.throttle.loginByIp.hit(`ip:${ipKey}`);
  if (!byIp.allowed) throw tooManyRequests(byIp.retryAfterSeconds);
  const distinct = deps.throttle.emailsPerIp.hit(ipKey, input.email);
  if (!distinct.allowed) throw tooManyRequests(distinct.retryAfterSeconds);
  const byEmail = deps.throttle.loginByEmail.reserve(emailKey);
  if (!byEmail.allowed) throw tooManyRequests(byEmail.retryAfterSeconds);

  const candidate = await findLoginCandidate(deps.db, input.email);
  const hash = candidate?.password_hash ?? (await DUMMY_HASH_PROMISE);
  const valid = await verifyPassword(input.password, hash);
  if (!candidate || !valid || !candidate.is_active) {
    if (candidate) {
      await recordAudit(deps.db, {
        organizationId: candidate.organization_id,
        actorUserId: candidate.id,
        action: 'auth.login_failed',
        targetType: 'user',
        targetId: candidate.id,
        requestId: client.requestId,
        ipAddress: client.ip,
      });
    }
    throw INVALID_CREDENTIALS();
  }
  deps.throttle.loginByEmail.recordSuccess(emailKey);
  const session = await issueSession(deps, candidate.id, candidate.organization_id, client);
  await recordAudit(deps.db, {
    organizationId: candidate.organization_id,
    actorUserId: candidate.id,
    action: 'auth.login',
    targetType: 'user',
    targetId: candidate.id,
    requestId: client.requestId,
    ipAddress: client.ip,
  });
  return session;
}

export async function logout(deps: AppDeps, sessionId: string): Promise<void> {
  await revokeSession(deps.db, sessionId);
}
