# Product Requirements Document — Ledgerline

|         |                                                                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Product | Ledgerline — multi-entity double-entry accounting and financial close                                                                        |
| Status  | M1 (foundation + posting engine slice) delivered; M2–M8 planned                                                                              |
| Owner   | Product & Finance Engineering                                                                                                                |
| Related | [requirements.md](requirements.md), [user-stories.md](user-stories.md), [roadmap](../planning/roadmap.md), [backlog](../planning/backlog.md) |

## 1. Vision

Give mid-market finance teams that run several legal entities one self-hosted ledger they can trust: every posting balances, every number on a report can be traced back to an immutable journal line, and month-end close is a controlled, auditable workflow instead of a spreadsheet ritual. Ledgerline runs entirely on infrastructure the customer controls — no external services are called at runtime.

## 2. Problem

Finance teams with 3–30 entities typically outgrow an entry-level bookkeeping tool before they can justify an ERP implementation. Their pain points:

1. **Each entity is a separate book.** Intercompany balances are reconciled by hand in spreadsheets and rarely agree.
2. **Multi-currency is bolted on.** Rounding differences appear when foreign entries are converted line by line, and nobody can explain a one-cent imbalance in the trial balance.
3. **Close has no guard rails.** Entries land in periods that were supposed to be closed; there is no soft-close for late adjustments by a controller only.
4. **Audit evidence is weak.** Edits to posted entries are possible, numbering has gaps, and there is no single trail of who changed what.
5. **Bank reconciliation is manual.** Statements arrive as CSV/OFX files and are ticked off line by line.

## 3. Personas

| Persona                          | Role in Ledgerline    | Goals                                                                    | Frustrations today                                  |
| -------------------------------- | --------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| **Maya, Group Controller**       | `controller`          | Close 12 entities in 5 working days; trust the consolidated numbers      | Late entries after cut-off; intercompany mismatches |
| **Sofia, Staff Accountant**      | `accountant`          | Post accruals, payroll and multi-currency invoices quickly and correctly | Rounding differences; unclear rejection reasons     |
| **Priya, CFO / Owner**           | `owner`               | Sign off statements; see close progress across entities                  | No single view; numbers change after sign-off       |
| **Daniel, External Auditor**     | `auditor` (read-only) | Sample journals and trace them to reports and the audit trail            | Gaps in numbering; edited history                   |
| **Arjun, Finance Systems Admin** | `admin`               | Manage users, entities and configuration safely                          | Shared logins; no role separation                   |
| **Lena, Approver**               | `approver`            | Approve high-value entries without being able to create them             | Approval happens in email threads                   |

## 4. Goals

| ID  | Goal                                          | Measure                                                                                                                     |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| G1  | Ledger integrity is guaranteed, not hoped for | 0 unbalanced posted entries possible — enforced by engine _and_ database trigger                                            |
| G2  | Multi-currency math is explainable            | Every functional amount reproducible from stored amount, rate and one documented rounding rule                              |
| G3  | Close is controlled                           | Posting into soft-closed periods restricted to controllers; closed periods reject all postings, including under concurrency |
| G4  | Group reporting without spreadsheets          | Consolidated trial balance with eliminations and NCI produced in one run (M5)                                               |
| G5  | Reconciliation is mostly automatic            | ≥ 80 % of statement lines auto-matched on realistic data (M6)                                                               |
| G6  | Self-hostable on one VM                       | Runs with Node.js 22 and native PostgreSQL; no outbound network calls                                                       |

## 5. Non-goals

- Payroll calculation, tax filing, invoicing/AR/AP sub-ledgers with customer portals (journals arrive from those systems via import).
- Live bank feeds or payment initiation (statements are imported as files).
- Any hosted third-party service: email is written to a local outbox, files go to local disk.
- Inventory costing and fixed-asset depreciation engines (possible future modules).

## 6. Scope

### 6.1 Delivered in M1 (≈12 % of planned effort)

- Organizations, users, roles, sessions, CSRF, layered login throttling, append-only audit trail.
- Legal entities with functional currency and canonical IANA time zone; standard chart of accounts template; hierarchical chart with header accounts.
- Fiscal-year generation and period lifecycle `open → soft_closed → closed`.
- Org-level FX rate table with exact inverse lookup.
- **Posting engine**: balancing, group-wise multi-currency conversion with banker's rounding and largest-remainder apportionment, rounding-residue lines, period rules, gapless numbering, idempotent create, DB-enforced invariants.
- Trial balance with opening/period/closing columns, header roll-up and prior-year earnings rolled into retained earnings.
- Web UI: login, navigation with planned sections, chart of accounts, periods, journal list/editor with live balance, trial balance.

### 6.2 Planned (M2–M8)

Journal reversal and editable drafts, general ledger drill-down, financial statements (P&L, balance sheet, indirect cash flow), period close checklist and year-end close, approvals with segregation of duties, recurring/reversing journals, FX revaluation and translation, intercompany capture and matching, consolidation with eliminations and minority interest, bank statement import (CSV/OFX) and the matching engine, user management, 2FA, audit hash chain, performance work for large ledgers.

## 7. Success metrics

| Metric                                                   | Target                    | When          |
| -------------------------------------------------------- | ------------------------- | ------------- |
| Unbalanced or edited posted entries found by audit query | 0                         | Every release |
| Trial balance (10 k accounts × 1 M lines) p95 latency    | < 2 s                     | M7            |
| Posting throughput, single entity                        | ≥ 150 entries/s sustained | M7            |
| Days to close a 12-entity group (pilot customer)         | ≤ 5                       | M8            |
| Auto-match rate on pilot bank statements                 | ≥ 80 %                    | M6            |
| Intercompany mismatches unexplained at close             | 0                         | M5            |

## 8. Release plan

| Milestone | Theme                | Highlights                                                                  | Status  |
| --------- | -------------------- | --------------------------------------------------------------------------- | ------- |
| M0        | Foundation           | Tooling, CI, migrations, launcher                                           | Done    |
| M1        | Posting engine slice | Auth, entities, chart, periods, FX table, posting engine, trial balance, UI | Done    |
| M2        | Ledger completeness  | Reversals, drafts, GL detail, P&L, balance sheet, user admin                | Planned |
| M3        | Automation & FX      | Recurring journals, revaluation, imports, cash flow, dimensions             | Planned |
| M4        | Controlled close     | Checklist, year-end close, approvals, notifications, dashboard              | Planned |
| M5        | Group                | Hierarchy, intercompany, consolidation, eliminations, NCI, translation      | Planned |
| M6        | Cash                 | Bank import, matching engine, reconciliation workspace                      | Planned |
| M7        | Scale & hardening    | Summary tables, load tests, 2FA, audit chain, accessibility, e2e in CI      | Planned |
| M8        | Platform             | API tokens, exports, admin console, report builder, localization            | Planned |

## 9. Assumptions and constraints

- TypeScript on Node.js ≥ 22, React, PostgreSQL ≥ 15, deployed on a VM with systemd and nginx.
- A single API instance until throttle counters move to Postgres (LL-100).
- Amounts are integers in minor units; rates are exact rationals with up to 10 decimals.
