import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../../deps';
import { sendData } from '../../lib/reply';

export function registerHealthRoutes(app: FastifyInstance, { db, version }: AppDeps): void {
  /** Liveness: the process is up. Never touches the database. */
  app.get('/api/v1/health', async (request, reply) =>
    sendData(request, reply, {
      status: 'ok',
      version,
      uptimeSeconds: Math.round(process.uptime()),
    }),
  );

  /** Readiness: dependencies reachable; load balancers route traffic only when this is 200. */
  app.get('/api/v1/ready', async (request, reply) => {
    try {
      await db.query('SELECT 1');
      return sendData(request, reply, { status: 'ready', checks: { database: 'ok' } });
    } catch (error) {
      request.log.warn({ err: error }, 'readiness check failed');
      return reply.status(503).send({
        data: null,
        error: {
          code: 'NOT_READY',
          message: 'Database unavailable',
          details: { database: 'error' },
        },
        meta: { requestId: request.id },
      });
    }
  });
}
