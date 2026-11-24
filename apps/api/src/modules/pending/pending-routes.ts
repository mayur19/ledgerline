/**
 * Planned API surface (docs/api/openapi.yaml operations with x-status: pending).
 * Each route is registered so clients see the final shape today and get a
 * 501 that names the backlog ticket delivering it.
 */
export interface PendingRoute {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly url: string;
  readonly ticket: string;
  readonly summary: string;
}

const E = '/api/v1/entities/:entityId';

export const PENDING_ROUTES: readonly PendingRoute[] = [
  // Identity & access
  { method: 'GET', url: '/api/v1/users', ticket: 'LL-014', summary: 'List organization users' },
  {
    method: 'POST',
    url: '/api/v1/users/invitations',
    ticket: 'LL-014',
    summary: 'Invite a user with a role',
  },
  {
    method: 'PATCH',
    url: '/api/v1/users/:userId',
    ticket: 'LL-014',
    summary: 'Change role or deactivate a user',
  },
  {
    method: 'POST',
    url: '/api/v1/auth/register/verify',
    ticket: 'LL-120',
    summary: 'Confirm sign-up via emailed token',
  },
  {
    method: 'POST',
    url: '/api/v1/auth/password-reset',
    ticket: 'LL-015',
    summary: 'Request a password reset',
  },
  {
    method: 'GET',
    url: '/api/v1/auth/sessions',
    ticket: 'LL-016',
    summary: 'List my active sessions',
  },
  {
    method: 'DELETE',
    url: '/api/v1/auth/sessions/:sessionId',
    ticket: 'LL-016',
    summary: 'Revoke a session',
  },
  {
    method: 'POST',
    url: '/api/v1/auth/mfa/totp',
    ticket: 'LL-018',
    summary: 'Enrol a TOTP authenticator',
  },
  {
    method: 'GET',
    url: '/api/v1/audit-events/verify',
    ticket: 'LL-019',
    summary: 'Verify audit hash chain',
  },
  { method: 'PUT', url: `${E}/access`, ticket: 'LL-017', summary: 'Assign users to an entity' },
  // Entities & chart of accounts
  {
    method: 'POST',
    url: `${E}/accounts/import`,
    ticket: 'LL-024',
    summary: 'Import accounts from CSV',
  },
  {
    method: 'GET',
    url: `${E}/accounts/export`,
    ticket: 'LL-024',
    summary: 'Export the chart of accounts',
  },
  {
    method: 'PUT',
    url: `${E}/accounts/:accountId/group-mapping`,
    ticket: 'LL-025',
    summary: 'Map to group chart',
  },
  {
    method: 'GET',
    url: '/api/v1/dimensions',
    ticket: 'LL-026',
    summary: 'List analysis dimensions',
  },
  {
    method: 'PUT',
    url: `${E}/ownership`,
    ticket: 'LL-027',
    summary: 'Set parent entity and ownership %',
  },
  // Journals
  {
    method: 'PATCH',
    url: `${E}/journals/:journalId`,
    ticket: 'LL-036',
    summary: 'Edit a draft entry',
  },
  {
    method: 'DELETE',
    url: `${E}/journals/:journalId`,
    ticket: 'LL-036',
    summary: 'Discard a draft entry',
  },
  {
    method: 'POST',
    url: `${E}/journals/:journalId/reverse`,
    ticket: 'LL-035',
    summary: 'Reverse a posted entry',
  },
  {
    method: 'POST',
    url: `${E}/journals/:journalId/attachments`,
    ticket: 'LL-037',
    summary: 'Attach a document',
  },
  {
    method: 'POST',
    url: `${E}/journals/import`,
    ticket: 'LL-039',
    summary: 'Bulk import journals from CSV',
  },
  {
    method: 'GET',
    url: `${E}/accounts/:accountId/activity`,
    ticket: 'LL-038',
    summary: 'Account activity drill-down',
  },
  // Periods & close
  {
    method: 'GET',
    url: `${E}/periods/:periodId/checklist`,
    ticket: 'LL-041',
    summary: 'Close checklist for a period',
  },
  {
    method: 'POST',
    url: `${E}/periods/:periodId/checklist/tasks`,
    ticket: 'LL-041',
    summary: 'Add a close task',
  },
  {
    method: 'POST',
    url: `${E}/fiscal-years/:fiscalYear/close`,
    ticket: 'LL-042',
    summary: 'Year-end close',
  },
  {
    method: 'POST',
    url: `${E}/periods/:periodId/reopen`,
    ticket: 'LL-043',
    summary: 'Re-open a closed period',
  },
  {
    method: 'GET',
    url: '/api/v1/close/status',
    ticket: 'LL-044',
    summary: 'Close status across entities',
  },
  // Multi-currency
  {
    method: 'POST',
    url: '/api/v1/fx-rates/import',
    ticket: 'LL-051',
    summary: 'Import rates from CSV',
  },
  {
    method: 'POST',
    url: `${E}/revaluations/preview`,
    ticket: 'LL-052',
    summary: 'Preview period-end revaluation',
  },
  {
    method: 'POST',
    url: `${E}/revaluations`,
    ticket: 'LL-052',
    summary: 'Run period-end revaluation',
  },
  { method: 'GET', url: `${E}/revaluations`, ticket: 'LL-052', summary: 'List revaluation runs' },
  {
    method: 'POST',
    url: `${E}/translations`,
    ticket: 'LL-055',
    summary: 'Translate to presentation currency',
  },
  // Intercompany & consolidation
  {
    method: 'GET',
    url: '/api/v1/intercompany-transactions',
    ticket: 'LL-060',
    summary: 'List intercompany transactions',
  },
  {
    method: 'POST',
    url: '/api/v1/intercompany-transactions',
    ticket: 'LL-060',
    summary: 'Record an intercompany transaction',
  },
  {
    method: 'GET',
    url: '/api/v1/intercompany/mismatches',
    ticket: 'LL-061',
    summary: 'Intercompany mismatch report',
  },
  {
    method: 'GET',
    url: '/api/v1/consolidation-groups',
    ticket: 'LL-062',
    summary: 'List consolidation groups',
  },
  {
    method: 'POST',
    url: '/api/v1/consolidation-groups',
    ticket: 'LL-062',
    summary: 'Create a consolidation group',
  },
  {
    method: 'POST',
    url: '/api/v1/consolidation-groups/:groupId/runs',
    ticket: 'LL-062',
    summary: 'Run a consolidation',
  },
  {
    method: 'GET',
    url: '/api/v1/elimination-rules',
    ticket: 'LL-063',
    summary: 'List elimination rules',
  },
  {
    method: 'POST',
    url: '/api/v1/elimination-rules',
    ticket: 'LL-063',
    summary: 'Create an elimination rule',
  },
  {
    method: 'GET',
    url: '/api/v1/consolidation-groups/:groupId/runs/:runId/trial-balance',
    ticket: 'LL-065',
    summary: 'Consolidated trial balance with eliminations and NCI',
  },
  // Bank reconciliation
  { method: 'GET', url: `${E}/bank-accounts`, ticket: 'LL-070', summary: 'List bank accounts' },
  {
    method: 'POST',
    url: `${E}/bank-accounts`,
    ticket: 'LL-070',
    summary: 'Link a bank account to a GL account',
  },
  {
    method: 'POST',
    url: '/api/v1/bank-accounts/:bankAccountId/statements',
    ticket: 'LL-071',
    summary: 'Import a CSV/OFX statement',
  },
  {
    method: 'GET',
    url: '/api/v1/bank-statements/:statementId/lines',
    ticket: 'LL-071',
    summary: 'Statement lines',
  },
  {
    method: 'POST',
    url: '/api/v1/bank-statements/:statementId/auto-match',
    ticket: 'LL-073',
    summary: 'Run the matching engine',
  },
  {
    method: 'POST',
    url: '/api/v1/bank-statements/:statementId/matches',
    ticket: 'LL-074',
    summary: 'Confirm a manual match',
  },
  {
    method: 'DELETE',
    url: '/api/v1/bank-statements/:statementId/matches/:matchId',
    ticket: 'LL-074',
    summary: 'Undo a match',
  },
  {
    method: 'POST',
    url: '/api/v1/bank-statements/:statementId/complete',
    ticket: 'LL-075',
    summary: 'Sign off reconciliation',
  },
  // Approvals
  {
    method: 'GET',
    url: '/api/v1/approval-policies',
    ticket: 'LL-080',
    summary: 'List approval policies',
  },
  {
    method: 'POST',
    url: '/api/v1/approval-policies',
    ticket: 'LL-080',
    summary: 'Create an approval policy',
  },
  {
    method: 'POST',
    url: `${E}/journals/:journalId/submit`,
    ticket: 'LL-081',
    summary: 'Submit a draft for approval',
  },
  {
    method: 'POST',
    url: `${E}/journals/:journalId/approve`,
    ticket: 'LL-081',
    summary: 'Approve a submitted entry',
  },
  {
    method: 'POST',
    url: `${E}/journals/:journalId/reject`,
    ticket: 'LL-081',
    summary: 'Reject a submitted entry',
  },
  {
    method: 'GET',
    url: '/api/v1/approvals/inbox',
    ticket: 'LL-081',
    summary: 'My pending approvals',
  },
  {
    method: 'GET',
    url: '/api/v1/notifications',
    ticket: 'LL-082',
    summary: 'In-app notifications',
  },
  // Recurring & reversing
  {
    method: 'GET',
    url: `${E}/recurring-journals`,
    ticket: 'LL-085',
    summary: 'List recurring templates',
  },
  {
    method: 'POST',
    url: `${E}/recurring-journals`,
    ticket: 'LL-085',
    summary: 'Create a recurring template',
  },
  {
    method: 'POST',
    url: `${E}/recurring-journals/:templateId/run`,
    ticket: 'LL-086',
    summary: 'Generate due entries',
  },
  // Reporting
  {
    method: 'GET',
    url: `${E}/reports/income-statement`,
    ticket: 'LL-091',
    summary: 'Income statement',
  },
  { method: 'GET', url: `${E}/reports/balance-sheet`, ticket: 'LL-092', summary: 'Balance sheet' },
  {
    method: 'GET',
    url: `${E}/reports/cash-flow`,
    ticket: 'LL-093',
    summary: 'Cash-flow statement (indirect)',
  },
  {
    method: 'GET',
    url: `${E}/reports/general-ledger`,
    ticket: 'LL-038',
    summary: 'General ledger detail',
  },
  {
    method: 'POST',
    url: `${E}/reports/exports`,
    ticket: 'LL-094',
    summary: 'Export a report to CSV/HTML',
  },
  { method: 'GET', url: `${E}/budgets`, ticket: 'LL-097', summary: 'Budgets for budget-vs-actual' },
  // Platform
  { method: 'GET', url: '/api/v1/api-tokens', ticket: 'LL-110', summary: 'List read API tokens' },
  {
    method: 'POST',
    url: '/api/v1/api-tokens',
    ticket: 'LL-110',
    summary: 'Create a read API token',
  },
  {
    method: 'POST',
    url: '/api/v1/organization/export',
    ticket: 'LL-111',
    summary: 'Export all organization data',
  },
];
