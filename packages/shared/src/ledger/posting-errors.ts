export type PostingErrorCode =
  | 'TOO_FEW_LINES'
  | 'INVALID_AMOUNT'
  | 'NON_POSITIVE_AMOUNT'
  | 'EXCESS_PRECISION'
  | 'UNKNOWN_CURRENCY'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_INACTIVE'
  | 'ACCOUNT_NOT_POSTABLE'
  | 'ACCOUNT_CURRENCY_MISMATCH'
  | 'RATE_INVALID'
  | 'RATE_MISSING'
  | 'RATE_CONFLICT'
  | 'FUNCTIONAL_RATE_NOT_ONE'
  | 'ROUNDING_ACCOUNT_REQUIRED'
  | 'UNBALANCED';

export interface PostingError {
  readonly code: PostingErrorCode;
  readonly message: string;
  /** 1-based line number the error refers to, when line-specific. */
  readonly line?: number;
  readonly details?: Readonly<Record<string, string>>;
}

export const lineError = (code: PostingErrorCode, line: number, message: string): PostingError => ({
  code,
  line,
  message: `Line ${line}: ${message}`,
});
