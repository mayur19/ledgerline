import { z } from 'zod';
import { isIsoDate } from './period';

export const MAX_JOURNAL_LINES = 500;

export const journalLineInputSchema = z
  .object({
    accountId: z.string().uuid(),
    side: z.enum(['debit', 'credit']),
    /** Decimal string in the line currency, e.g. "1250.00". Never a JS number. */
    amount: z.string().trim().min(1).max(32),
    currency: z.string().trim().length(3).toUpperCase(),
    /** Optional explicit rate (functional units per one unit of `currency`). */
    rate: z.string().trim().max(24).optional(),
    memo: z.string().trim().max(240).optional(),
  })
  .strict();

export const journalEntryInputSchema = z
  .object({
    entryDate: z.string().refine(isIsoDate, 'entryDate must be a valid YYYY-MM-DD date'),
    memo: z.string().trim().min(1).max(500),
    reference: z.string().trim().max(64).optional(),
    lines: z.array(journalLineInputSchema).min(1).max(MAX_JOURNAL_LINES),
  })
  .strict();

export type JournalLineInput = z.infer<typeof journalLineInputSchema>;
export type JournalEntryInput = z.infer<typeof journalEntryInputSchema>;

export const JOURNAL_STATUSES = ['draft', 'posted', 'reversed'] as const;
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];
