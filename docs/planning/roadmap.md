# Roadmap

Milestones M0–M8. Ticket IDs, estimates and dependencies come from [backlog.md](backlog.md) (93 tickets, 1171 h). Each milestone ends with a release tagged `vX.Y.0` and a demo on the seed data set.

| Milestone | Theme                | Tickets | Hours | Done h | Status  |
| --------- | -------------------- | ------- | ----- | ------ | ------- |
| M0        | Foundation           | 6       | 26    | 26     | Done    |
| M1        | Posting engine slice | 20      | 117   | 117    | Done    |
| M2        | Ledger completeness  | 9       | 104   | 0      | Planned |
| M3        | Automation and FX    | 12      | 180   | 0      | Planned |
| M4        | Controlled close     | 11      | 158   | 0      | Planned |
| M5        | Group                | 12      | 212   | 0      | Planned |
| M6        | Cash                 | 9       | 172   | 0      | Planned |
| M7        | Scale and hardening  | 8       | 104   | 0      | Planned |
| M8        | Platform             | 6       | 98    | 0      | Planned |

## M0 — Foundation

**Goal.** Repository, tooling, CI with native PostgreSQL, migration runner, launcher, health checks.

**Exit criteria.** CI green on main; `./run.sh setup` works on a fresh clone; migrations idempotent with checksum guard.

| Ticket | Title                                                                          | Estimate (h) | Status |
| ------ | ------------------------------------------------------------------------------ | ------------ | ------ |
| LL-001 | Monorepo tooling: workspaces, TypeScript strict, ESLint, Prettier, CI pipeline | 8            | done   |
| LL-002 | Zod-validated config loader, structured logging with redaction, request IDs    | 4            | done   |
| LL-003 | JSON envelope, central error handler, 501 stubs for the planned API            | 4            | done   |
| LL-004 | Forward-only SQL migration runner with checksums and advisory lock             | 5            | done   |
| LL-005 | run.sh launcher (setup, migrate, seed, reset, test, check, dev)                | 4            | done   |
| LL-006 | Health and readiness endpoints                                                 | 1            | done   |

## M1 — Posting engine slice

**Goal.** Auth, RBAC, audit, entities, chart, periods, FX table, posting engine, trial balance, web shell and slice screens, demo seed.

**Exit criteria.** Balanced/unbalanced/multi-currency/period/idempotency/concurrency tests pass; trial balance balances on seed data; DB triggers block tampering; pending routes return 501.

| Ticket | Title                                                                                    | Estimate (h) | Status |
| ------ | ---------------------------------------------------------------------------------------- | ------------ | ------ |
| LL-108 | Demo seed: two entities, FX rates, posted and draft journals, closed FY2025              | 3            | done   |
| LL-010 | Organization owner registration (non-enumerating), login/logout/me, scrypt hashing       | 8            | done   |
| LL-011 | Postgres-backed sessions, CSRF double-submit, IP/email/distinct-email login throttles    | 8            | done   |
| LL-012 | RBAC role/permission matrix and route guards                                             | 4            | done   |
| LL-013 | Append-only audit event table (trigger enforced), write path and read API                | 4            | done   |
| LL-020 | Legal entity CRUD with functional currency and canonical IANA time zone                  | 4            | done   |
| LL-021 | Chart of accounts CRUD with hierarchy validation and header accounts                     | 8            | done   |
| LL-022 | Standard chart template applied on entity creation                                       | 3            | done   |
| LL-023 | Entity settings: FX rounding and retained-earnings accounts                              | 2            | done   |
| LL-030 | Posting engine: balancing, group-wise FX conversion, banker's rounding, residue handling | 16           | done   |
| LL-031 | Journal create/post API: period checks, gapless numbering, idempotency                   | 12           | done   |
| LL-032 | Database invariants: deferred balance trigger, immutability triggers, tenant FKs         | 5            | done   |
| LL-033 | Journal list, detail and preview API                                                     | 4            | done   |
| LL-034 | Journal entry screen with live per-currency balance                                      | 8            | done   |
| LL-040 | Fiscal year generation and period status transitions                                     | 5            | done   |
| LL-050 | FX rate table maintenance (spot/average/closing, inverse lookup)                         | 3            | done   |
| LL-090 | Trial balance report (opening/period/closing, header rollup, prior-year earnings)        | 6            | done   |
| LL-107 | Trial balance screen                                                                     | 4            | done   |
| LL-105 | Web shell: login, navigation with planned sections, entity switcher                      | 6            | done   |
| LL-106 | Chart of accounts and periods screens                                                    | 4            | done   |

## M2 — Ledger completeness

**Goal.** Reversals, editable drafts, GL drill-down, P&L and balance sheet, user administration, password reset, verified sign-up, chart import.

**Exit criteria.** Balance sheet ties to trial balance on seed and property-test data; reversal of any posted entry nets to zero; invited users can sign in.

| Ticket | Title                                                      | Estimate (h) | Status  |
| ------ | ---------------------------------------------------------- | ------------ | ------- |
| LL-014 | User invitations, role changes and deactivation            | 14           | pending |
| LL-015 | Password reset via the local email outbox                  | 10           | pending |
| LL-120 | Email-verified sign-up via the local outbox                | 8            | pending |
| LL-024 | Chart of accounts CSV import/export with dry run           | 12           | pending |
| LL-035 | Journal reversal (linked reversing entry, period rules)    | 12           | pending |
| LL-036 | Work-in-progress drafts: unbalanced save, edit and discard | 10           | pending |
| LL-038 | General ledger detail and account activity drill-down      | 10           | pending |
| LL-091 | Income statement with comparative periods                  | 14           | pending |
| LL-092 | Balance sheet with retained earnings roll-forward          | 14           | pending |

## M3 — Automation and FX

**Goal.** Recurring and reversing journals, FX import and triangulation, revaluation, cash-flow statement, dimensions, attachments, bulk import, report export.

**Exit criteria.** Revaluation of a EUR balance matches hand-computed gain/loss to the cent and reverses next period; recurring catch-up creates each entry exactly once.

| Ticket | Title                                                                     | Estimate (h) | Status  |
| ------ | ------------------------------------------------------------------------- | ------------ | ------- |
| LL-026 | Analysis dimensions (department, project, cost center) on lines           | 24           | pending |
| LL-028 | Account controls: negative-balance alerts and posting restrictions        | 8            | pending |
| LL-037 | Journal attachments on local disk with checksums                          | 12           | pending |
| LL-039 | Bulk journal import from CSV with row-level validation                    | 16           | pending |
| LL-051 | FX rate CSV import and triangulation via a base currency                  | 10           | pending |
| LL-052 | Period-end revaluation engine (unrealized gain/loss on monetary accounts) | 28           | pending |
| LL-053 | Automatic reversal of revaluation on the first day of the next period     | 6            | pending |
| LL-085 | Recurring journal templates with schedules (in-house RRULE subset)        | 20           | pending |
| LL-086 | Recurring generation job with catch-up and idempotency                    | 12           | pending |
| LL-087 | Reversing journals scheduled for next period start                        | 8            | pending |
| LL-093 | Cash-flow statement (indirect method) with account classification         | 26           | pending |
| LL-094 | Report export (CSV and printable HTML)                                    | 10           | pending |

## M4 — Controlled close

**Goal.** Close checklist, year-end close, period re-open with dual control, approvals with SoD, notifications and outbox, close dashboard, report snapshots, accrual schedules.

**Exit criteria.** Pilot entity closes a month using only the checklist; preparer cannot approve own entry (tested); year-end close zeroes P&L into retained earnings.

| Ticket | Title                                                                | Estimate (h) | Status  |
| ------ | -------------------------------------------------------------------- | ------------ | ------- |
| LL-041 | Period close checklist (tasks, owners, sign-off)                     | 20           | pending |
| LL-042 | Year-end close: closing entries to retained earnings and period lock | 18           | pending |
| LL-043 | Re-open a closed period with dual control                            | 8            | pending |
| LL-044 | Close status dashboard across entities                               | 12           | pending |
| LL-045 | Accrual and prepayment amortization schedules                        | 24           | pending |
| LL-080 | Approval policies (amount thresholds, account rules)                 | 16           | pending |
| LL-081 | Approval workflow: submit/approve/reject with preparer != approver   | 18           | pending |
| LL-082 | In-app notifications and local email outbox                          | 10           | pending |
| LL-083 | Approval delegation and out-of-office rules                          | 8            | pending |
| LL-095 | Report snapshots frozen at period close                              | 12           | pending |
| LL-109 | Dashboard with close status and KPIs                                 | 12           | pending |

## M5 — Group

**Goal.** Entity hierarchy and ownership, access scoping, group chart mapping, intercompany capture and matching, consolidation, eliminations, NCI, translation.

**Exit criteria.** Three-entity test group consolidates with eliminations netting to zero and NCI matching a worked example; IC mismatch report empty after matching.

| Ticket | Title                                                               | Estimate (h) | Status  |
| ------ | ------------------------------------------------------------------- | ------------ | ------- |
| LL-017 | Per-entity access scoping (users see only assigned entities)        | 12           | pending |
| LL-025 | Account mapping to a group chart for consolidation                  | 14           | pending |
| LL-027 | Entity hierarchy and ownership percentages                          | 12           | pending |
| LL-055 | Translation to presentation currency (current-rate method, CTA)     | 26           | pending |
| LL-056 | Rate-type policies (average for P&L, closing for balance sheet)     | 8            | pending |
| LL-060 | Intercompany transaction capture (paired entries in both entities)  | 22           | pending |
| LL-061 | Intercompany balance matching and mismatch report                   | 16           | pending |
| LL-062 | Consolidation engine across the entity hierarchy                    | 30           | pending |
| LL-063 | Elimination rules: due-to/due-from and intercompany revenue/expense | 24           | pending |
| LL-064 | Non-controlling (minority) interest computation                     | 20           | pending |
| LL-065 | Consolidated trial balance and statements with elimination column   | 16           | pending |
| LL-066 | Consolidation run versioning, re-run and audit                      | 12           | pending |

## M6 — Cash

**Goal.** Bank accounts, CSV/OFX parsers, matching engine, reconciliation workspace and sign-off, realized FX, budgets.

**Exit criteria.** ≥ 80 % auto-match on the reference statement corpus; OFX SGML and XML fixtures parse; reconciliation report ties statement to GL.

| Ticket | Title                                                                     | Estimate (h) | Status  |
| ------ | ------------------------------------------------------------------------- | ------------ | ------- |
| LL-054 | Realized FX gain/loss on settlement                                       | 24           | pending |
| LL-070 | Bank accounts linked to GL cash accounts                                  | 6            | pending |
| LL-071 | In-house CSV statement parser with column-mapping profiles                | 14           | pending |
| LL-072 | In-house OFX parser (SGML 1.x and XML 2.x)                                | 18           | pending |
| LL-073 | Reconciliation matching engine (exact, date window, many-to-one, scoring) | 36           | pending |
| LL-074 | Reconciliation workspace UI (match, unmatch, create entry from line)      | 24           | pending |
| LL-075 | Reconciliation report and sign-off with locked statement                  | 10           | pending |
| LL-076 | Deterministic match-rule suggestions from reconciliation history          | 16           | pending |
| LL-097 | Budgets and budget-vs-actual reporting                                    | 24           | pending |

## M7 — Scale and hardening

**Goal.** Balance summary tables, load tests, API-wide limits and Postgres-backed throttles, 2FA, audit hash chain, sessions UI, accessibility, Playwright in CI.

**Exit criteria.** Load-test targets in NFR-004/005 met; WCAG 2.2 AA audit has no critical findings; e2e suite green in CI.

| Ticket | Title                                                                           | Estimate (h) | Status  |
| ------ | ------------------------------------------------------------------------------- | ------------ | ------- |
| LL-016 | Session list/revoke UI and idle-timeout policy                                  | 8            | pending |
| LL-018 | TOTP two-factor authentication (in-house RFC 6238)                              | 16           | pending |
| LL-019 | Audit trail hash chaining and verification report                               | 14           | pending |
| LL-096 | Account balance summary tables for large ledgers                                | 18           | pending |
| LL-100 | API-wide rate limiting and throttle counters moved to Postgres (multi-instance) | 10           | pending |
| LL-102 | Load test: 1M lines, posting throughput and trial-balance latency budget        | 14           | pending |
| LL-104 | Playwright end-to-end suite running in CI                                       | 10           | pending |
| LL-103 | Accessibility audit (WCAG 2.2 AA) and keyboard-first journal grid               | 14           | pending |

## M8 — Platform

**Goal.** Read API tokens, organization export, admin console, custom report builder, localization, backup drill.

**Exit criteria.** Restore drill within RTO; exported organization re-imports into an empty instance; report builder reproduces the standard P&L.

| Ticket | Title                                              | Estimate (h) | Status  |
| ------ | -------------------------------------------------- | ------------ | ------- |
| LL-098 | Custom report builder (row/column definitions)     | 40           | pending |
| LL-101 | Backup/restore verification job and runbook drill  | 8            | pending |
| LL-110 | Read API tokens for BI tools (scoped, hashed)      | 12           | pending |
| LL-111 | Full organization data export                      | 10           | pending |
| LL-112 | Multi-organization admin console                   | 16           | pending |
| LL-113 | Localization: number/date formats and translations | 12           | pending |

## Sequencing notes

- M2 before M5: consolidation needs reversals, drafts and statements to be trustworthy per entity first.
- LL-082 (outbox) precedes password reset and verified sign-up, which is why both sit in M2/M4 boundaries.
- LL-100 (Postgres-backed throttles) must land before any multi-instance deployment.
- LL-096 summary tables are only introduced once LL-102 load tests prove the need; the trial balance currently aggregates journal lines directly.
