import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../http/guards';
import { PENDING_ROUTES } from './pending-routes';

export function registerPendingRoutes(app: FastifyInstance): void {
  for (const route of PENDING_ROUTES) {
    app.route({
      method: route.method,
      url: route.url,
      preHandler: requireAuth,
      handler: async (request, reply) =>
        reply.status(501).send({
          data: null,
          error: {
            code: 'NOT_IMPLEMENTED',
            message: `${route.summary} is planned but not implemented yet`,
            details: { ticket: route.ticket },
          },
          meta: { requestId: request.id },
        }),
    });
  }
}
