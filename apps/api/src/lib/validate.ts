import type { ZodType, ZodTypeDef } from 'zod';
import { badRequest } from './errors';

/** Parse untrusted input with a zod schema, raising a 400 VALIDATION_ERROR with field issues. */
export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw badRequest(
      'Request validation failed',
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}
