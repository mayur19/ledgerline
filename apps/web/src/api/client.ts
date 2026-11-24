import type { ApiErrorBody, ApiResponse, ApiSuccess } from '@ledgerline/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Double-submit token: the API sets a readable ll_csrf cookie at login. */
export function readCsrfCookie(cookieString: string = document.cookie): string | null {
  const match = cookieString.split('; ').find((part) => part.startsWith('ll_csrf='));
  return match ? decodeURIComponent(match.slice('ll_csrf='.length)) : null;
}

export async function apiEnvelope<T>(path: string, init: RequestInit = {}): Promise<ApiSuccess<T>> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  const csrf = readCsrfCookie();
  if (UNSAFE.has(method) && csrf) headers.set('X-CSRF-Token', csrf);

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    method,
    headers,
    credentials: 'same-origin',
  });
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!payload) {
    throw new ApiError(response.status, {
      code: 'NETWORK_ERROR',
      message: 'Unexpected server response',
    });
  }
  if (payload.error) throw new ApiError(response.status, payload.error);
  return payload;
}

export const api = {
  get: async <T>(path: string) => (await apiEnvelope<T>(path)).data,
  post: async <T>(path: string, body?: unknown) =>
    (
      await apiEnvelope<T>(path, {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    ).data,
  patch: async <T>(path: string, body: unknown) =>
    (await apiEnvelope<T>(path, { method: 'PATCH', body: JSON.stringify(body) })).data,
};

/** Human-readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const details = error.body.details as { errors?: { message: string }[] } | undefined;
    if (details?.errors?.length) return details.errors.map((e) => e.message).join(' • ');
    return error.body.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
