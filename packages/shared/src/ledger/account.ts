import { z } from 'zod';
import { CURRENCY_CODES } from '../money/currency';

export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type Side = 'debit' | 'credit';

/** The side on which an account of a given type normally carries its balance. */
export const NORMAL_SIDE: Readonly<Record<AccountType, Side>> = {
  asset: 'debit',
  expense: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
};

/** Balance-sheet accounts carry forward; income-statement accounts close to retained earnings. */
export function isBalanceSheetType(type: AccountType): boolean {
  return type === 'asset' || type === 'liability' || type === 'equity';
}

/** 3 to 12 digits, optionally split into segments by single dashes, e.g. 1000 or 4000-10. */
export const ACCOUNT_CODE_PATTERN = /^\d{3,12}(?:-\d{1,6}){0,3}$/;

export interface AccountRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
  readonly parentId: string | null;
  /** Header (summary) accounts group children and cannot receive postings. */
  readonly isPostable: boolean;
  readonly isActive: boolean;
  /** When set, lines on this account must be in this currency (e.g. a EUR bank account). */
  readonly currency: string | null;
}

const currencyEnum = z.enum(CURRENCY_CODES as [string, ...string[]]);

export const createAccountSchema = z
  .object({
    code: z.string().trim().regex(ACCOUNT_CODE_PATTERN, 'Account code must be 3-12 digits'),
    name: z.string().trim().min(1).max(120),
    type: z.enum(ACCOUNT_TYPES),
    parentId: z.string().uuid().nullable().default(null),
    isPostable: z.boolean().default(true),
    currency: currencyEnum.nullable().default(null),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    isActive: z.boolean().optional(),
    parentId: z.string().uuid().nullable().optional(),
    description: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
