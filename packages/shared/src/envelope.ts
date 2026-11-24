/** JSON envelope shared by every API response (see docs/api/README.md). */
export interface ApiErrorBody {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface ApiMeta {
  readonly requestId?: string;
  readonly total?: number;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ApiSuccess<T> {
  readonly data: T;
  readonly error: null;
  readonly meta?: ApiMeta;
}

export interface ApiFailure {
  readonly data: null;
  readonly error: ApiErrorBody;
  readonly meta?: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
