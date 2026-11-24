import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';

interface PgError {
  code?: string;
  constraint?: string;
}

function toAppError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', error.issues);
  }
  const fastifyError = error as FastifyError;
  if (fastifyError.statusCode && fastifyError.statusCode >= 400 && fastifyError.statusCode < 500) {
    const code =
      fastifyError.code === 'FST_ERR_CTP_BODY_TOO_LARGE' ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
    return new AppError(fastifyError.statusCode, code, fastifyError.message);
  }
  const pg = error as PgError;
  if (pg.code === 'LL002')
    return new AppError(409, 'IMMUTABLE_RECORD', 'Posted records cannot be changed');
  if (pg.code === 'LL003')
    return new AppError(409, 'LEDGER_INVARIANT', 'Ledger invariant violated');
  if (pg.code === '40001' || pg.code === '40P01') {
    return new AppError(503, 'RETRY_LATER', 'Concurrent update detected, please retry');
  }
  return null;
}

/** Central error handler: every failure leaves as the standard envelope; 5xx details never leak. */
export function errorHandler(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  const appError = toAppError(error);
  if (appError) {
    if (appError.status === 429) {
      const retry = (appError.details as { retryAfterSeconds?: number } | undefined)
        ?.retryAfterSeconds;
      if (retry) reply.header('Retry-After', String(retry));
    }
    request.log.info({ code: appError.code, status: appError.status }, 'request rejected');
    return reply.status(appError.status).send({
      data: null,
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details === undefined ? {} : { details: appError.details }),
      },
      meta: { requestId: request.id },
    });
  }
  request.log.error({ err: error }, 'unhandled error');
  return reply.status(500).send({
    data: null,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    meta: { requestId: request.id },
  });
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return reply.status(404).send({
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url.split('?')[0]} not found`,
    },
    meta: { requestId: request.id },
  });
}
