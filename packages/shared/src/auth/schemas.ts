import { z } from 'zod';
import { CURRENCY_CODES } from '../money/currency';
import { canonicalTimeZone } from '../time/timezone';

export const PASSWORD_MIN_LENGTH = 12;

const email = z.string().trim().toLowerCase().email().max(254);

export const registerSchema = z
  .object({
    organizationName: z.string().trim().min(2).max(120),
    displayName: z.string().trim().min(1).max(120),
    email,
    password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
  })
  .strict();

export const loginSchema = z.object({ email, password: z.string().min(1).max(200) }).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

const currency = z.enum(CURRENCY_CODES as [string, ...string[]]);

/** Accepts any supported IANA zone and outputs its canonical spelling. */
export const timeZoneSchema = z
  .string()
  .max(64)
  .transform((value, ctx) => {
    const canonical = canonicalTimeZone(value);
    if (canonical === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'timezone must be a supported IANA time zone',
      });
      return z.NEVER;
    }
    return canonical;
  });

export const createEntitySchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z0-9][A-Z0-9-]{1,15}$/, 'Entity code: 2-16 upper-case letters, digits or dashes'),
    name: z.string().trim().min(2).max(160),
    functionalCurrency: currency,
    countryCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    timezone: timeZoneSchema.default('UTC'),
  })
  .strict();

export type CreateEntityInput = z.infer<typeof createEntitySchema>;

export const updateEntitySettingsSchema = z
  .object({
    roundingAccountId: z.string().uuid().nullable().optional(),
    retainedEarningsAccountId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one setting is required');

export const createFxRateSchema = z
  .object({
    fromCurrency: currency,
    toCurrency: currency,
    rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    rate: z
      .string()
      .trim()
      .regex(/^\d{1,9}(\.\d{1,10})?$/, 'rate must be a positive decimal'),
    rateType: z.enum(['spot', 'average', 'closing']).default('spot'),
  })
  .strict()
  .refine((v) => v.fromCurrency !== v.toCurrency, 'fromCurrency and toCurrency must differ');
