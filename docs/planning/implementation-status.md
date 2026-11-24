# Implementation status

**Overall: 143 of 1171 estimated hours done = 12.2 %.**

## How the percentage is computed

`percent = sum(estimate of tickets with status done) / sum(estimate of all tickets)` over [backlog.md](backlog.md). Estimates are in engineering hours and include tests and documentation. A ticket counts as done only when its code, tests and docs are on `main` and CI is green; partially finished tickets count as zero.

## By epic

| Epic | Name                               | Done h  | Total h  | %          |
| ---- | ---------------------------------- | ------- | -------- | ---------- |
| E01  | Foundation & tooling               | 29      | 29       | 100 %      |
| E02  | Identity, access & audit           | 24      | 106      | 23 %       |
| E03  | Entities & chart of accounts       | 17      | 87       | 20 %       |
| E04  | Journals & posting engine          | 45      | 105      | 43 %       |
| E05  | Periods & close                    | 5       | 87       | 6 %        |
| E06  | Multi-currency & revaluation       | 3       | 105      | 3 %        |
| E07  | Intercompany & consolidation       | 0       | 140      | 0 %        |
| E08  | Bank import & reconciliation       | 0       | 124      | 0 %        |
| E09  | Approvals & notifications          | 0       | 52       | 0 %        |
| E10  | Recurring & reversing journals     | 0       | 40       | 0 %        |
| E11  | Financial reporting                | 10      | 150      | 7 %        |
| E12  | Operations, performance & platform | 0       | 98       | 0 %        |
| E13  | Web experience                     | 10      | 48       | 21 %       |
|      | **Total**                          | **143** | **1171** | **12.2 %** |

## Done

| Ticket | Title                                                                                    | Hours |
| ------ | ---------------------------------------------------------------------------------------- | ----- |
| LL-001 | Monorepo tooling: workspaces, TypeScript strict, ESLint, Prettier, CI pipeline           | 8     |
| LL-002 | Zod-validated config loader, structured logging with redaction, request IDs              | 4     |
| LL-003 | JSON envelope, central error handler, 501 stubs for the planned API                      | 4     |
| LL-004 | Forward-only SQL migration runner with checksums and advisory lock                       | 5     |
| LL-005 | run.sh launcher (setup, migrate, seed, reset, test, check, dev)                          | 4     |
| LL-006 | Health and readiness endpoints                                                           | 1     |
| LL-108 | Demo seed: two entities, FX rates, posted and draft journals, closed FY2025              | 3     |
| LL-010 | Organization owner registration (non-enumerating), login/logout/me, scrypt hashing       | 8     |
| LL-011 | Postgres-backed sessions, CSRF double-submit, IP/email/distinct-email login throttles    | 8     |
| LL-012 | RBAC role/permission matrix and route guards                                             | 4     |
| LL-013 | Append-only audit event table (trigger enforced), write path and read API                | 4     |
| LL-020 | Legal entity CRUD with functional currency and canonical IANA time zone                  | 4     |
| LL-021 | Chart of accounts CRUD with hierarchy validation and header accounts                     | 8     |
| LL-022 | Standard chart template applied on entity creation                                       | 3     |
| LL-023 | Entity settings: FX rounding and retained-earnings accounts                              | 2     |
| LL-030 | Posting engine: balancing, group-wise FX conversion, banker's rounding, residue handling | 16    |
| LL-031 | Journal create/post API: period checks, gapless numbering, idempotency                   | 12    |
| LL-032 | Database invariants: deferred balance trigger, immutability triggers, tenant FKs         | 5     |
| LL-033 | Journal list, detail and preview API                                                     | 4     |
| LL-034 | Journal entry screen with live per-currency balance                                      | 8     |
| LL-040 | Fiscal year generation and period status transitions                                     | 5     |
| LL-050 | FX rate table maintenance (spot/average/closing, inverse lookup)                         | 3     |
| LL-090 | Trial balance report (opening/period/closing, header rollup, prior-year earnings)        | 6     |
| LL-107 | Trial balance screen                                                                     | 4     |
| LL-105 | Web shell: login, navigation with planned sections, entity switcher                      | 6     |
| LL-106 | Chart of accounts and periods screens                                                    | 4     |

## Stubbed (registered, returns 501)

67 planned operations are registered in `apps/api/src/modules/pending/pending-routes.ts`. Authenticated calls return `501 NOT_IMPLEMENTED` with `details.ticket`; `apps/api/test/pending.db.test.ts` checks every one.

| Method | Path                                                              | Ticket | Summary                                              |
| ------ | ----------------------------------------------------------------- | ------ | ---------------------------------------------------- |
| GET    | `/api/v1/users`                                                   | LL-014 | List organization users                              |
| POST   | `/api/v1/users/invitations`                                       | LL-014 | Invite a user with a role                            |
| PATCH  | `/api/v1/users/:userId`                                           | LL-014 | Change role or deactivate a user                     |
| POST   | `/api/v1/auth/register/verify`                                    | LL-120 | Confirm sign-up via emailed token                    |
| POST   | `/api/v1/auth/password-reset`                                     | LL-015 | Request a password reset                             |
| GET    | `/api/v1/auth/sessions`                                           | LL-016 | List my active sessions                              |
| DELETE | `/api/v1/auth/sessions/:sessionId`                                | LL-016 | Revoke a session                                     |
| POST   | `/api/v1/auth/mfa/totp`                                           | LL-018 | Enrol a TOTP authenticator                           |
| GET    | `/api/v1/audit-events/verify`                                     | LL-019 | Verify audit hash chain                              |
| PUT    | `/api/v1/entities/:entityId/access`                               | LL-017 | Assign users to an entity                            |
| POST   | `/api/v1/entities/:entityId/accounts/import`                      | LL-024 | Import accounts from CSV                             |
| GET    | `/api/v1/entities/:entityId/accounts/export`                      | LL-024 | Export the chart of accounts                         |
| PUT    | `/api/v1/entities/:entityId/accounts/:accountId/group-mapping`    | LL-025 | Map to group chart                                   |
| GET    | `/api/v1/dimensions`                                              | LL-026 | List analysis dimensions                             |
| PUT    | `/api/v1/entities/:entityId/ownership`                            | LL-027 | Set parent entity and ownership %                    |
| PATCH  | `/api/v1/entities/:entityId/journals/:journalId`                  | LL-036 | Edit a draft entry                                   |
| DELETE | `/api/v1/entities/:entityId/journals/:journalId`                  | LL-036 | Discard a draft entry                                |
| POST   | `/api/v1/entities/:entityId/journals/:journalId/reverse`          | LL-035 | Reverse a posted entry                               |
| POST   | `/api/v1/entities/:entityId/journals/:journalId/attachments`      | LL-037 | Attach a document                                    |
| POST   | `/api/v1/entities/:entityId/journals/import`                      | LL-039 | Bulk import journals from CSV                        |
| GET    | `/api/v1/entities/:entityId/accounts/:accountId/activity`         | LL-038 | Account activity drill-down                          |
| GET    | `/api/v1/entities/:entityId/periods/:periodId/checklist`          | LL-041 | Close checklist for a period                         |
| POST   | `/api/v1/entities/:entityId/periods/:periodId/checklist/tasks`    | LL-041 | Add a close task                                     |
| POST   | `/api/v1/entities/:entityId/fiscal-years/:fiscalYear/close`       | LL-042 | Year-end close                                       |
| POST   | `/api/v1/entities/:entityId/periods/:periodId/reopen`             | LL-043 | Re-open a closed period                              |
| GET    | `/api/v1/close/status`                                            | LL-044 | Close status across entities                         |
| POST   | `/api/v1/fx-rates/import`                                         | LL-051 | Import rates from CSV                                |
| POST   | `/api/v1/entities/:entityId/revaluations/preview`                 | LL-052 | Preview period-end revaluation                       |
| POST   | `/api/v1/entities/:entityId/revaluations`                         | LL-052 | Run period-end revaluation                           |
| GET    | `/api/v1/entities/:entityId/revaluations`                         | LL-052 | List revaluation runs                                |
| POST   | `/api/v1/entities/:entityId/translations`                         | LL-055 | Translate to presentation currency                   |
| GET    | `/api/v1/intercompany-transactions`                               | LL-060 | List intercompany transactions                       |
| POST   | `/api/v1/intercompany-transactions`                               | LL-060 | Record an intercompany transaction                   |
| GET    | `/api/v1/intercompany/mismatches`                                 | LL-061 | Intercompany mismatch report                         |
| GET    | `/api/v1/consolidation-groups`                                    | LL-062 | List consolidation groups                            |
| POST   | `/api/v1/consolidation-groups`                                    | LL-062 | Create a consolidation group                         |
| POST   | `/api/v1/consolidation-groups/:groupId/runs`                      | LL-062 | Run a consolidation                                  |
| GET    | `/api/v1/elimination-rules`                                       | LL-063 | List elimination rules                               |
| POST   | `/api/v1/elimination-rules`                                       | LL-063 | Create an elimination rule                           |
| GET    | `/api/v1/consolidation-groups/:groupId/runs/:runId/trial-balance` | LL-065 | Consolidated trial balance with eliminations and NCI |
| GET    | `/api/v1/entities/:entityId/bank-accounts`                        | LL-070 | List bank accounts                                   |
| POST   | `/api/v1/entities/:entityId/bank-accounts`                        | LL-070 | Link a bank account to a GL account                  |
| POST   | `/api/v1/bank-accounts/:bankAccountId/statements`                 | LL-071 | Import a CSV/OFX statement                           |
| GET    | `/api/v1/bank-statements/:statementId/lines`                      | LL-071 | Statement lines                                      |
| POST   | `/api/v1/bank-statements/:statementId/auto-match`                 | LL-073 | Run the matching engine                              |
| POST   | `/api/v1/bank-statements/:statementId/matches`                    | LL-074 | Confirm a manual match                               |
| DELETE | `/api/v1/bank-statements/:statementId/matches/:matchId`           | LL-074 | Undo a match                                         |
| POST   | `/api/v1/bank-statements/:statementId/complete`                   | LL-075 | Sign off reconciliation                              |
| GET    | `/api/v1/approval-policies`                                       | LL-080 | List approval policies                               |
| POST   | `/api/v1/approval-policies`                                       | LL-080 | Create an approval policy                            |
| POST   | `/api/v1/entities/:entityId/journals/:journalId/submit`           | LL-081 | Submit a draft for approval                          |
| POST   | `/api/v1/entities/:entityId/journals/:journalId/approve`          | LL-081 | Approve a submitted entry                            |
| POST   | `/api/v1/entities/:entityId/journals/:journalId/reject`           | LL-081 | Reject a submitted entry                             |
| GET    | `/api/v1/approvals/inbox`                                         | LL-081 | My pending approvals                                 |
| GET    | `/api/v1/notifications`                                           | LL-082 | In-app notifications                                 |
| GET    | `/api/v1/entities/:entityId/recurring-journals`                   | LL-085 | List recurring templates                             |
| POST   | `/api/v1/entities/:entityId/recurring-journals`                   | LL-085 | Create a recurring template                          |
| POST   | `/api/v1/entities/:entityId/recurring-journals/:templateId/run`   | LL-086 | Generate due entries                                 |
| GET    | `/api/v1/entities/:entityId/reports/income-statement`             | LL-091 | Income statement                                     |
| GET    | `/api/v1/entities/:entityId/reports/balance-sheet`                | LL-092 | Balance sheet                                        |
| GET    | `/api/v1/entities/:entityId/reports/cash-flow`                    | LL-093 | Cash-flow statement (indirect)                       |
| GET    | `/api/v1/entities/:entityId/reports/general-ledger`               | LL-038 | General ledger detail                                |
| POST   | `/api/v1/entities/:entityId/reports/exports`                      | LL-094 | Export a report to CSV/HTML                          |
| GET    | `/api/v1/entities/:entityId/budgets`                              | LL-097 | Budgets for budget-vs-actual                         |
| GET    | `/api/v1/api-tokens`                                              | LL-110 | List read API tokens                                 |
| POST   | `/api/v1/api-tokens`                                              | LL-110 | Create a read API token                              |
| POST   | `/api/v1/organization/export`                                     | LL-111 | Export all organization data                         |

### Planned UI sections

Visible in the sidebar with a **Planned** badge (`apps/web/src/navigation.ts`): Recurring journals (LL-085), Close checklist (LL-041), Approvals (LL-081), FX revaluation (LL-052), Intercompany (LL-060), Consolidation (LL-062), Bank reconciliation (LL-073), Financial statements (LL-091).

### Partially modelled

- `journal_entries.status = 'reversed'` and `reversed_by_entry_id` exist and the immutability trigger already allows the posted→reversed transition, but no endpoint performs it (LL-035).
- `journal_entries.source` accepts recurring/reversal/revaluation/import/elimination values ahead of those features.
- FX rate types `average` and `closing` can be stored; only `spot` is used by posting (LL-056, LL-052).
- Entity `timezone` is stored canonically but not yet used for scheduling (LL-086).

## Tests

| Workspace       | Tests   | Notes                                                                                                                            |
| --------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| packages/shared | 146     | Unit + fast-check property tests for money, rates, apportionment, posting engine, periods, chart tree, trial balance, time zones |
| apps/api        | 109     | Unit, HTTP (no DB) and integration tests against a real PostgreSQL test database, including concurrency and trigger tests        |
| apps/web        | 12      | React Testing Library component tests and API client tests                                                                       |
| e2e             | 2 specs | Playwright smoke tests, run locally with `./run.sh e2e` (CI pending, LL-104)                                                     |

Coverage thresholds are enforced in CI (shared ≥ 90 % lines, API ≥ 80 % lines).
