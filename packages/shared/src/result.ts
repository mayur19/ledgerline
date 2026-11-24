/** Minimal discriminated result type used by pure domain functions. */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly errors: readonly E[] };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const fail = <E>(errors: readonly E[]): Result<never, E> => ({ ok: false, errors });
