import type { FastifyReply, FastifyRequest } from 'fastify';

export interface Meta {
  readonly total?: number;
  readonly limit?: number;
  readonly offset?: number;
}

/** Send the standard success envelope. */
export function sendData<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  data: T,
  status = 200,
  meta: Meta = {},
): FastifyReply {
  return reply.status(status).send({ data, error: null, meta: { requestId: request.id, ...meta } });
}
