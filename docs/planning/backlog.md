# Backlog

Single source of truth for ticket IDs (`LL-xxx`). Code (`501` stubs, `PENDING_ROUTES`), the OpenAPI `x-ticket` fields, GitHub issues and the traceability matrix all reference these IDs. Estimates are engineering hours including tests and docs.

**Totals:** 93 tickets, 1171 h, of which 143 h done (12.2%) and 1028 h pending. See [implementation-status.md](implementation-status.md).

## Epics

| Epic | Name                               | Tickets | Hours | Done h |
| ---- | ---------------------------------- | ------- | ----- | ------ |
| E01  | Foundation & tooling               | 7       | 29    | 29     |
| E02  | Identity, access & audit           | 11      | 106   | 24     |
| E03  | Entities & chart of accounts       | 9       | 87    | 17     |
| E04  | Journals & posting engine          | 10      | 105   | 45     |
| E05  | Periods & close                    | 6       | 87    | 5      |
| E06  | Multi-currency & revaluation       | 7       | 105   | 3      |
| E07  | Intercompany & consolidation       | 7       | 140   | 0      |
| E08  | Bank import & reconciliation       | 7       | 124   | 0      |
| E09  | Approvals & notifications          | 4       | 52    | 0      |
| E10  | Recurring & reversing journals     | 3       | 40    | 0      |
| E11  | Financial reporting                | 9       | 150   | 10     |
| E12  | Operations, performance & platform | 8       | 98    | 0      |
| E13  | Web experience                     | 5       | 48    | 10     |

## Tickets

### E01 Foundation & tooling

| ID     | Title                                                                          | Milestone | Estimate (h) | Status | Depends on |
| ------ | ------------------------------------------------------------------------------ | --------- | ------------ | ------ | ---------- |
| LL-001 | Monorepo tooling: workspaces, TypeScript strict, ESLint, Prettier, CI pipeline | M0        | 8            | done   | —          |
| LL-002 | Zod-validated config loader, structured logging with redaction, request IDs    | M0        | 4            | done   | LL-001     |
| LL-003 | JSON envelope, central error handler, 501 stubs for the planned API            | M0        | 4            | done   | LL-001     |
| LL-004 | Forward-only SQL migration runner with checksums and advisory lock             | M0        | 5            | done   | LL-001     |
| LL-005 | run.sh launcher (setup, migrate, seed, reset, test, check, dev)                | M0        | 4            | done   | LL-004     |
| LL-006 | Health and readiness endpoints                                                 | M0        | 1            | done   | LL-003     |
| LL-108 | Demo seed: two entities, FX rates, posted and draft journals, closed FY2025    | M1        | 3            | done   | LL-031     |

### E02 Identity, access & audit

| ID     | Title                                                                                 | Milestone | Estimate (h) | Status  | Depends on |
| ------ | ------------------------------------------------------------------------------------- | --------- | ------------ | ------- | ---------- |
| LL-010 | Organization owner registration (non-enumerating), login/logout/me, scrypt hashing    | M1        | 8            | done    | LL-004     |
| LL-011 | Postgres-backed sessions, CSRF double-submit, IP/email/distinct-email login throttles | M1        | 8            | done    | LL-010     |
| LL-012 | RBAC role/permission matrix and route guards                                          | M1        | 4            | done    | LL-010     |
| LL-013 | Append-only audit event table (trigger enforced), write path and read API             | M1        | 4            | done    | LL-004     |
| LL-014 | User invitations, role changes and deactivation                                       | M2        | 14           | pending | LL-012     |
| LL-015 | Password reset via the local email outbox                                             | M2        | 10           | pending | LL-082     |
| LL-016 | Session list/revoke UI and idle-timeout policy                                        | M7        | 8            | pending | LL-011     |
| LL-017 | Per-entity access scoping (users see only assigned entities)                          | M5        | 12           | pending | LL-012     |
| LL-018 | TOTP two-factor authentication (in-house RFC 6238)                                    | M7        | 16           | pending | LL-011     |
| LL-019 | Audit trail hash chaining and verification report                                     | M7        | 14           | pending | LL-013     |
| LL-120 | Email-verified sign-up via the local outbox                                           | M2        | 8            | pending | LL-082     |

### E03 Entities & chart of accounts

| ID     | Title                                                                   | Milestone | Estimate (h) | Status  | Depends on |
| ------ | ----------------------------------------------------------------------- | --------- | ------------ | ------- | ---------- |
| LL-020 | Legal entity CRUD with functional currency and canonical IANA time zone | M1        | 4            | done    | LL-004     |
| LL-021 | Chart of accounts CRUD with hierarchy validation and header accounts    | M1        | 8            | done    | LL-020     |
| LL-022 | Standard chart template applied on entity creation                      | M1        | 3            | done    | LL-021     |
| LL-023 | Entity settings: FX rounding and retained-earnings accounts             | M1        | 2            | done    | LL-021     |
| LL-024 | Chart of accounts CSV import/export with dry run                        | M2        | 12           | pending | LL-021     |
| LL-025 | Account mapping to a group chart for consolidation                      | M5        | 14           | pending | LL-021     |
| LL-026 | Analysis dimensions (department, project, cost center) on lines         | M3        | 24           | pending | LL-031     |
| LL-027 | Entity hierarchy and ownership percentages                              | M5        | 12           | pending | LL-020     |
| LL-028 | Account controls: negative-balance alerts and posting restrictions      | M3        | 8            | pending | LL-031     |

### E04 Journals & posting engine

| ID     | Title                                                                                    | Milestone | Estimate (h) | Status  | Depends on |
| ------ | ---------------------------------------------------------------------------------------- | --------- | ------------ | ------- | ---------- |
| LL-030 | Posting engine: balancing, group-wise FX conversion, banker's rounding, residue handling | M1        | 16           | done    | LL-021     |
| LL-031 | Journal create/post API: period checks, gapless numbering, idempotency                   | M1        | 12           | done    | LL-030     |
| LL-032 | Database invariants: deferred balance trigger, immutability triggers, tenant FKs         | M1        | 5            | done    | LL-031     |
| LL-033 | Journal list, detail and preview API                                                     | M1        | 4            | done    | LL-031     |
| LL-034 | Journal entry screen with live per-currency balance                                      | M1        | 8            | done    | LL-033     |
| LL-035 | Journal reversal (linked reversing entry, period rules)                                  | M2        | 12           | pending | LL-031     |
| LL-036 | Work-in-progress drafts: unbalanced save, edit and discard                               | M2        | 10           | pending | LL-031     |
| LL-037 | Journal attachments on local disk with checksums                                         | M3        | 12           | pending | LL-031     |
| LL-038 | General ledger detail and account activity drill-down                                    | M2        | 10           | pending | LL-031     |
| LL-039 | Bulk journal import from CSV with row-level validation                                   | M3        | 16           | pending | LL-030     |

### E05 Periods & close

| ID     | Title                                                                | Milestone | Estimate (h) | Status  | Depends on |
| ------ | -------------------------------------------------------------------- | --------- | ------------ | ------- | ---------- |
| LL-040 | Fiscal year generation and period status transitions                 | M1        | 5            | done    | LL-020     |
| LL-041 | Period close checklist (tasks, owners, sign-off)                     | M4        | 20           | pending | LL-040     |
| LL-042 | Year-end close: closing entries to retained earnings and period lock | M4        | 18           | pending | LL-041     |
| LL-043 | Re-open a closed period with dual control                            | M4        | 8            | pending | LL-040     |
| LL-044 | Close status dashboard across entities                               | M4        | 12           | pending | LL-041     |
| LL-045 | Accrual and prepayment amortization schedules                        | M4        | 24           | pending | LL-085     |

### E06 Multi-currency & revaluation

| ID     | Title                                                                     | Milestone | Estimate (h) | Status  | Depends on |
| ------ | ------------------------------------------------------------------------- | --------- | ------------ | ------- | ---------- |
| LL-050 | FX rate table maintenance (spot/average/closing, inverse lookup)          | M1        | 3            | done    | LL-004     |
| LL-051 | FX rate CSV import and triangulation via a base currency                  | M3        | 10           | pending | LL-050     |
| LL-052 | Period-end revaluation engine (unrealized gain/loss on monetary accounts) | M3        | 28           | pending | LL-050     |
| LL-053 | Automatic reversal of revaluation on the first day of the next period     | M3        | 6            | pending | LL-052     |
| LL-054 | Realized FX gain/loss on settlement                                       | M6        | 24           | pending | LL-052     |
| LL-055 | Translation to presentation currency (current-rate method, CTA)           | M5        | 26           | pending | LL-052     |
| LL-056 | Rate-type policies (average for P&L, closing for balance sheet)           | M5        | 8            | pending | LL-055     |

### E07 Intercompany & consolidation

| ID     | Title                                                               | Milestone | Estimate (h) | Status  | Depends on |
| ------ | ------------------------------------------------------------------- | --------- | ------------ | ------- | ---------- |
| LL-060 | Intercompany transaction capture (paired entries in both entities)  | M5        | 22           | pending | LL-027     |
| LL-061 | Intercompany balance matching and mismatch report                   | M5        | 16           | pending | LL-060     |
| LL-062 | Consolidation engine across the entity hierarchy                    | M5        | 30           | pending | LL-025     |
| LL-063 | Elimination rules: due-to/due-from and intercompany revenue/expense | M5        | 24           | pending | LL-062     |
| LL-064 | Non-controlling (minority) interest computation                     | M5        | 20           | pending | LL-062     |
| LL-065 | Consolidated trial balance and statements with elimination column   | M5        | 16           | pending | LL-063     |
| LL-066 | Consolidation run versioning, re-run and audit                      | M5        | 12           | pending | LL-062     |

### E08 Bank import & reconciliation

| ID     | Title                                                                     | Milestone | Estimate (h) | Status  | Depends on |
| ------ | ------------------------------------------------------------------------- | --------- | ------------ | ------- | ---------- |
| LL-070 | Bank accounts linked to GL cash accounts                                  | M6        | 6            | pending | LL-021     |
| LL-071 | In-house CSV statement parser with column-mapping profiles                | M6        | 14           | pending | LL-070     |
| LL-072 | In-house OFX parser (SGML 1.x and XML 2.x)                                | M6        | 18           | pending | LL-070     |
| LL-073 | Reconciliation matching engine (exact, date window, many-to-one, scoring) | M6        | 36           | pending | LL-071     |
| LL-074 | Reconciliation workspace UI (match, unmatch, create entry from line)      | M6        | 24           | pending | LL-073     |
| LL-075 | Reconciliation report and sign-off with locked statement                  | M6        | 10           | pending | LL-074     |
| LL-076 | Deterministic match-rule suggestions from reconciliation history          | M6        | 16           | pending | LL-073     |

### E09 Approvals & notifications

| ID     | Title                                                              | Milestone | Estimate (h) | Status  | Depends on |
| ------ | ------------------------------------------------------------------ | --------- | ------------ | ------- | ---------- |
| LL-080 | Approval policies (amount thresholds, account rules)               | M4        | 16           | pending | LL-031     |
| LL-081 | Approval workflow: submit/approve/reject with preparer != approver | M4        | 18           | pending | LL-080     |
| LL-082 | In-app notifications and local email outbox                        | M4        | 10           | pending | LL-013     |
| LL-083 | Approval delegation and out-of-office rules                        | M4        | 8            | pending | LL-081     |

### E10 Recurring & reversing journals

| ID     | Title                                                              | Milestone | Estimate (h) | Status  | Depends on |
| ------ | ------------------------------------------------------------------ | --------- | ------------ | ------- | ---------- |
| LL-085 | Recurring journal templates with schedules (in-house RRULE subset) | M3        | 20           | pending | LL-031     |
| LL-086 | Recurring generation job with catch-up and idempotency             | M3        | 12           | pending | LL-085     |
| LL-087 | Reversing journals scheduled for next period start                 | M3        | 8            | pending | LL-035     |

### E11 Financial reporting

| ID     | Title                                                                             | Milestone | Estimate (h) | Status  | Depends on |
| ------ | --------------------------------------------------------------------------------- | --------- | ------------ | ------- | ---------- |
| LL-090 | Trial balance report (opening/period/closing, header rollup, prior-year earnings) | M1        | 6            | done    | LL-031     |
| LL-107 | Trial balance screen                                                              | M1        | 4            | done    | LL-090     |
| LL-091 | Income statement with comparative periods                                         | M2        | 14           | pending | LL-090     |
| LL-092 | Balance sheet with retained earnings roll-forward                                 | M2        | 14           | pending | LL-090     |
| LL-093 | Cash-flow statement (indirect method) with account classification                 | M3        | 26           | pending | LL-092     |
| LL-094 | Report export (CSV and printable HTML)                                            | M3        | 10           | pending | LL-091     |
| LL-095 | Report snapshots frozen at period close                                           | M4        | 12           | pending | LL-042     |
| LL-097 | Budgets and budget-vs-actual reporting                                            | M6        | 24           | pending | LL-091     |
| LL-098 | Custom report builder (row/column definitions)                                    | M8        | 40           | pending | LL-091     |

### E12 Operations, performance & platform

| ID     | Title                                                                           | Milestone | Estimate (h) | Status  | Depends on |
| ------ | ------------------------------------------------------------------------------- | --------- | ------------ | ------- | ---------- |
| LL-096 | Account balance summary tables for large ledgers                                | M7        | 18           | pending | LL-090     |
| LL-100 | API-wide rate limiting and throttle counters moved to Postgres (multi-instance) | M7        | 10           | pending | LL-011     |
| LL-101 | Backup/restore verification job and runbook drill                               | M8        | 8            | pending | —          |
| LL-102 | Load test: 1M lines, posting throughput and trial-balance latency budget        | M7        | 14           | pending | LL-096     |
| LL-104 | Playwright end-to-end suite running in CI                                       | M7        | 10           | pending | LL-034     |
| LL-110 | Read API tokens for BI tools (scoped, hashed)                                   | M8        | 12           | pending | LL-012     |
| LL-111 | Full organization data export                                                   | M8        | 10           | pending | —          |
| LL-112 | Multi-organization admin console                                                | M8        | 16           | pending | LL-014     |

### E13 Web experience

| ID     | Title                                                               | Milestone | Estimate (h) | Status  | Depends on |
| ------ | ------------------------------------------------------------------- | --------- | ------------ | ------- | ---------- |
| LL-105 | Web shell: login, navigation with planned sections, entity switcher | M1        | 6            | done    | LL-010     |
| LL-106 | Chart of accounts and periods screens                               | M1        | 4            | done    | LL-021     |
| LL-103 | Accessibility audit (WCAG 2.2 AA) and keyboard-first journal grid   | M7        | 14           | pending | LL-034     |
| LL-109 | Dashboard with close status and KPIs                                | M4        | 12           | pending | LL-044     |
| LL-113 | Localization: number/date formats and translations                  | M8        | 12           | pending | LL-105     |
