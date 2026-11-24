# Requirements traceability

Maps each functional requirement to its epic, backlog ticket, implementing module and verifying tests. Implemented rows point at real files in this repository; pending rows list the ticket that will deliver them.

| FR     | Requirement                                       | Epic | Ticket | Module / file                                         | Test                                                                             | Status      |
| ------ | ------------------------------------------------- | ---- | ------ | ----------------------------------------------------- | -------------------------------------------------------------------------------- | ----------- |
| FR-001 | Register an organization and its owner            | E02  | LL-010 | `apps/api/src/modules/auth/auth.service.ts`           | `apps/api/test/auth.db.test.ts`                                                  | implemented |
| FR-002 | Sign in and sign out with email and password      | E02  | LL-010 | `apps/api/src/modules/auth/auth.routes.ts`            | `apps/api/test/auth.db.test.ts`                                                  | implemented |
| FR-003 | Throttle authentication attempts                  | E02  | LL-011 | `apps/api/src/http/login-throttle.ts`                 | `apps/api/test/security.test.ts`, `apps/api/test/auth.db.test.ts`                | implemented |
| FR-004 | Protect mutating requests against CSRF            | E02  | LL-011 | `apps/api/src/http/session-hook.ts`                   | `apps/api/test/auth.db.test.ts`                                                  | implemented |
| FR-005 | Enforce role-based permissions                    | E02  | LL-012 | `packages/shared/src/auth/roles.ts`                   | `packages/shared/test/roles.test.ts`, `apps/api/test/setup.db.test.ts`           | implemented |
| FR-006 | Record an append-only audit trail                 | E02  | LL-013 | `apps/api/src/modules/audit/audit.service.ts`         | `apps/api/test/invariants.db.test.ts`                                            | implemented |
| FR-007 | Query the audit trail                             | E02  | LL-013 | `apps/api/src/modules/audit/audit.routes.ts`          | `apps/api/test/setup.db.test.ts`                                                 | implemented |
| FR-008 | Invite users and manage roles                     | E02  | LL-014 | —                                                     | —                                                                                | pending     |
| FR-009 | Reset a forgotten password                        | E02  | LL-015 | —                                                     | —                                                                                | pending     |
| FR-010 | Verify email on sign-up                           | E02  | LL-120 | —                                                     | —                                                                                | pending     |
| FR-011 | Two-factor authentication                         | E02  | LL-018 | —                                                     | —                                                                                | pending     |
| FR-012 | Restrict users to assigned entities               | E02  | LL-017 | —                                                     | —                                                                                | pending     |
| FR-013 | Verify audit trail integrity                      | E02  | LL-019 | —                                                     | —                                                                                | pending     |
| FR-014 | Create legal entities                             | E03  | LL-020 | `apps/api/src/modules/entities/entities.routes.ts`    | `apps/api/test/setup.db.test.ts`                                                 | implemented |
| FR-015 | Isolate tenants                                   | E03  | LL-020 | `apps/api/src/modules/entities/entity.repository.ts`  | `apps/api/test/setup.db.test.ts`, `apps/api/test/invariants.db.test.ts`          | implemented |
| FR-016 | Maintain a hierarchical chart of accounts         | E03  | LL-021 | `packages/shared/src/ledger/account-tree.ts`          | `packages/shared/test/account-tree.test.ts`, `apps/api/test/setup.db.test.ts`    | implemented |
| FR-017 | Apply a standard chart template                   | E03  | LL-022 | `packages/shared/src/ledger/chart-template.ts`        | `apps/api/test/setup.db.test.ts`                                                 | implemented |
| FR-018 | Configure entity accounting settings              | E03  | LL-023 | `apps/api/src/modules/entities/entities.routes.ts`    | `apps/api/test/setup.db.test.ts`                                                 | implemented |
| FR-019 | Import and export the chart of accounts           | E03  | LL-024 | —                                                     | —                                                                                | pending     |
| FR-020 | Tag lines with analysis dimensions                | E03  | LL-026 | —                                                     | —                                                                                | pending     |
| FR-021 | Validate journal entries in a pure posting engine | E04  | LL-030 | `packages/shared/src/ledger/posting.ts`               | `packages/shared/test/posting.test.ts`                                           | implemented |
| FR-022 | Convert foreign lines to functional currency      | E04  | LL-030 | `packages/shared/src/ledger/posting-convert.ts`       | `packages/shared/test/posting.test.ts`, `apps/api/test/journals.db.test.ts`      | implemented |
| FR-023 | Absorb cross-currency rounding residue            | E04  | LL-030 | `packages/shared/src/ledger/posting.ts`               | `packages/shared/test/posting.test.ts`                                           | implemented |
| FR-024 | Post entries with period rules                    | E04  | LL-031 | `apps/api/src/modules/journals/posting.service.ts`    | `apps/api/test/journals.db.test.ts`                                              | implemented |
| FR-025 | Number posted entries without gaps                | E04  | LL-031 | `apps/api/src/modules/journals/journal.repository.ts` | `apps/api/test/concurrency.db.test.ts`                                           | implemented |
| FR-026 | Create entries idempotently                       | E04  | LL-031 | `apps/api/src/modules/journals/posting.service.ts`    | `apps/api/test/journals.db.test.ts`                                              | implemented |
| FR-027 | Save drafts and post them later                   | E04  | LL-031 | `apps/api/src/modules/journals/posting.service.ts`    | `apps/api/test/journals.db.test.ts`                                              | implemented |
| FR-028 | Make posted history immutable                     | E04  | LL-032 | `apps/api/migrations/0002_ledger_core.sql`            | `apps/api/test/invariants.db.test.ts`                                            | implemented |
| FR-029 | List, view and preview journals                   | E04  | LL-033 | `apps/api/src/modules/journals/journals.routes.ts`    | `apps/api/test/journals.db.test.ts`                                              | implemented |
| FR-030 | Enter journals in the browser with a live balance | E04  | LL-034 | `apps/web/src/pages/JournalEditorPage.tsx`            | `apps/web/test/components.test.tsx`, `apps/web/test/summary.test.ts`             | implemented |
| FR-031 | Reverse a posted entry                            | E04  | LL-035 | —                                                     | —                                                                                | pending     |
| FR-032 | Edit and discard work-in-progress drafts          | E04  | LL-036 | —                                                     | —                                                                                | pending     |
| FR-033 | Drill down from balances to journal lines         | E04  | LL-038 | —                                                     | —                                                                                | pending     |
| FR-034 | Import journals in bulk                           | E04  | LL-039 | —                                                     | —                                                                                | pending     |
| FR-035 | Generate fiscal years and periods                 | E05  | LL-040 | `packages/shared/src/ledger/period.ts`                | `packages/shared/test/period.test.ts`, `apps/api/test/setup.db.test.ts`          | implemented |
| FR-036 | Control period status                             | E05  | LL-040 | `apps/api/src/modules/periods/periods.routes.ts`      | `apps/api/test/setup.db.test.ts`, `apps/api/test/concurrency.db.test.ts`         | implemented |
| FR-037 | Run a close checklist                             | E05  | LL-041 | —                                                     | —                                                                                | pending     |
| FR-038 | Perform year-end close                            | E05  | LL-042 | —                                                     | —                                                                                | pending     |
| FR-039 | Maintain FX rates                                 | E06  | LL-050 | `apps/api/src/modules/fx/fx.repository.ts`            | `apps/api/test/setup.db.test.ts`                                                 | implemented |
| FR-040 | Revalue foreign balances at period end            | E06  | LL-052 | —                                                     | —                                                                                | pending     |
| FR-041 | Translate to presentation currency                | E06  | LL-055 | —                                                     | —                                                                                | pending     |
| FR-042 | Capture intercompany transactions                 | E07  | LL-060 | —                                                     | —                                                                                | pending     |
| FR-043 | Consolidate the entity hierarchy                  | E07  | LL-062 | —                                                     | —                                                                                | pending     |
| FR-044 | Eliminate intercompany balances                   | E07  | LL-063 | —                                                     | —                                                                                | pending     |
| FR-045 | Compute non-controlling interest                  | E07  | LL-064 | —                                                     | —                                                                                | pending     |
| FR-046 | Import bank statements                            | E08  | LL-071 | —                                                     | —                                                                                | pending     |
| FR-047 | Match statement lines to ledger lines             | E08  | LL-073 | —                                                     | —                                                                                | pending     |
| FR-048 | Approve entries with segregation of duties        | E09  | LL-081 | —                                                     | —                                                                                | pending     |
| FR-049 | Schedule recurring journals                       | E10  | LL-085 | —                                                     | —                                                                                | pending     |
| FR-050 | Produce a trial balance                           | E11  | LL-090 | `packages/shared/src/ledger/trial-balance.ts`         | `packages/shared/test/trial-balance.test.ts`, `apps/api/test/reports.db.test.ts` | implemented |
| FR-051 | View the trial balance in the browser             | E11  | LL-107 | `apps/web/src/pages/TrialBalancePage.tsx`             | `apps/web/test/components.test.tsx`                                              | implemented |
| FR-052 | Produce income statement and balance sheet        | E11  | LL-091 | —                                                     | —                                                                                | pending     |
| FR-053 | Produce an indirect cash-flow statement           | E11  | LL-093 | —                                                     | —                                                                                | pending     |
| FR-054 | Expose planned endpoints as 501                   | E01  | LL-003 | `apps/api/src/modules/pending/pending-routes.ts`      | `apps/api/test/pending.db.test.ts`                                               | implemented |
| FR-055 | Report health and readiness                       | E01  | LL-006 | `apps/api/src/modules/health/health.routes.ts`        | `apps/api/test/http.test.ts`                                                     | implemented |
| FR-056 | Show planned sections in navigation               | E13  | LL-105 | `apps/web/src/navigation.ts`                          | `apps/web/test/components.test.tsx`                                              | implemented |

## NFR verification

| NFR     | Verified by                                                                                             | Status      |
| ------- | ------------------------------------------------------------------------------------------------------- | ----------- |
| NFR-001 | `packages/shared/test/posting.test.ts`, `rounding.test.ts`, `apportion.test.ts` (fast-check properties) | implemented |
| NFR-002 | `apps/api/test/concurrency.db.test.ts`                                                                  | implemented |
| NFR-003 | `apps/api/test/invariants.db.test.ts`                                                                   | implemented |
| NFR-004 | Planned with LL-102                                                                                     | pending     |
| NFR-005 | Planned with LL-096                                                                                     | pending     |
| NFR-006 | `apps/api/test/security.test.ts`                                                                        | implemented |
| NFR-007 | `apps/api/test/auth.db.test.ts`                                                                         | implemented |
| NFR-008 | `apps/api/test/security.test.ts`, `apps/api/test/auth.db.test.ts`                                       | implemented |
| NFR-009 | `apps/api/test/env.test.ts`, `apps/api/test/http.test.ts`                                               | implemented |
| NFR-010 | `apps/api/test/setup.db.test.ts`, `apps/api/test/invariants.db.test.ts`                                 | implemented |
| NFR-011 | `apps/api/test/invariants.db.test.ts`, `apps/api/test/setup.db.test.ts`                                 | implemented |
| NFR-012 | `vitest.config.ts` thresholds in each workspace, CI `test:coverage`                                     | implemented |
| NFR-013 | Code review; no HTTP client dependency in `apps/api/package.json`                                       | implemented |
| NFR-014 | `run.sh setup` on a fresh clone; CI on ubuntu-latest                                                    | implemented |
| NFR-015 | `apps/api/test/http.test.ts` (request id), `src/lib/logger.ts` redaction                                | implemented |
| NFR-016 | Planned with LL-101                                                                                     | pending     |
| NFR-017 | Planned with LL-103                                                                                     | pending     |
| NFR-018 | Planned with LL-100                                                                                     | pending     |
| NFR-019 | CI lint/format/typecheck jobs                                                                           | implemented |
| NFR-020 | `apps/api/test/http.test.ts`                                                                            | implemented |
