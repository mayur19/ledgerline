import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import type { TrustProxy } from '../config/env';
import type { AppDeps } from '../deps';
import { registerAccountRoutes } from '../modules/accounts/accounts.routes';
import { registerAuditRoutes } from '../modules/audit/audit.routes';
import { registerAuthRoutes } from '../modules/auth/auth.routes';
import { registerEntityRoutes } from '../modules/entities/entities.routes';
import { registerFxRoutes } from '../modules/fx/fx.routes';
import { registerHealthRoutes } from '../modules/health/health.routes';
import { registerJournalRoutes } from '../modules/journals/journals.routes';
import { registerPendingRoutes } from '../modules/pending/pending.routes';
import { registerPeriodRoutes } from '../modules/periods/periods.routes';
import { registerReportRoutes } from '../modules/reports/reports.routes';
import '../types';
import { errorHandler, notFoundHandler } from './error-handler';
import { createCsrfCheck, createSessionLoader } from './session-hook';

/** Hop count -> proxy-addr trust function (trust the first n hops); list/false pass through. */
export function toFastifyTrustProxy(
  value: TrustProxy,
): false | string[] | ((address: string, hop: number) => boolean) {
  if (typeof value === 'number') return (_address, hop) => hop < value;
  return value;
}

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;
const BODY_LIMIT_BYTES = 1024 * 1024;

/** Build the HTTP application. Pure construction: no listening, no global state. */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: deps.logger as FastifyBaseLogger,
    trustProxy: toFastifyTrustProxy(deps.env.TRUST_PROXY),
    bodyLimit: BODY_LIMIT_BYTES,
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    },
  });

  await app.register(cookie);
  app.decorateRequest('auth', null);
  app.addHook('onRequest', createSessionLoader(deps));
  app.addHook('onRequest', createCsrfCheck(deps));
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
    reply.header('cache-control', 'no-store');
  });
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  registerHealthRoutes(app, deps);
  registerAuthRoutes(app, deps);
  registerAuditRoutes(app, deps);
  registerEntityRoutes(app, deps);
  registerAccountRoutes(app, deps);
  registerPeriodRoutes(app, deps);
  registerFxRoutes(app, deps);
  registerJournalRoutes(app, deps);
  registerReportRoutes(app, deps);
  registerPendingRoutes(app);

  return app;
}
