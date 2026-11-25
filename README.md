# Ledgerline

[![CI](https://github.com/mayur19/ledgerline/actions/workflows/ci.yml/badge.svg)](https://github.com/mayur19/ledgerline/actions/workflows/ci.yml)

**Close the books across every legal entity and currency on one ledger that refuses to go out of balance.**

Ledgerline is a multi-entity double-entry accounting and financial-close platform for mid-market finance teams that run several legal entities in several currencies. Each entity keeps its own chart of accounts, accounting periods and functional currency. Journals are validated and converted by a shared posting engine using integer minor units and banker's rounding. The database itself makes sure posted history stays balanced and immutable. The planned scope adds period-end FX revaluation, intercompany eliminations and consolidation, bank reconciliation, approvals with segregation of duties, and the full set of financial statements.

> **Project status: early build.** The foundation is implemented and tested: auth, RBAC, audit trail and migrations. So is the first vertical slice: chart of accounts, the multi-currency journal posting engine, periods, the FX rate table and the trial balance, with API, database, screens and seed data. Everything else is designed, documented and tracked in the [backlog](docs/planning/backlog.md). **12.2 %** of the estimated effort is complete (143 of 1171 hours, see [implementation status](docs/planning/implementation-status.md)). Pending API endpoints answer `501 Not Implemented` with their ticket id, and planned screens appear in the navigation with a _Planned_ badge naming their ticket.

## Project status

| Area                                                                                                             | Status         | Tickets                                    |
| ---------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------ |
| Monorepo, CI, config, logging, error envelope, migration runner, health checks, `run.sh`, demo seed              | ✅ Implemented | LL-001 to LL-006, LL-108                   |
| Registration, login/logout, sessions, CSRF, login throttling, RBAC, append-only audit trail                      | ✅ Implemented | LL-010 to LL-013                           |
| User invitations, password reset, session management, per-entity access, TOTP, audit hash chain, verified signup | ⏳ Pending     | LL-014 to LL-019, LL-120                   |
| Legal entities (functional currency, IANA time zone), chart of accounts, standard template, entity settings      | ✅ Implemented | LL-020 to LL-023                           |
| Chart import/export, group account mapping, dimensions, ownership, account controls                              | ⏳ Pending     | LL-024 to LL-028                           |
| Posting engine, journal create/post API, database invariants, list/detail/preview, journal editor screen         | ✅ Implemented | LL-030 to LL-034                           |
| Reversal, work-in-progress drafts, attachments, general ledger drill-down, CSV journal import                    | ⏳ Pending     | LL-035 to LL-039                           |
| Fiscal-year generation and period state machine (open, soft-closed, closed)                                      | ✅ Implemented | LL-040                                     |
| Close checklist, year-end close, re-open with dual control, close dashboard, accrual schedules                   | ⏳ Pending     | LL-041 to LL-045                           |
| FX rate table with exact inverse lookup                                                                          | ✅ Implemented | LL-050                                     |
| Rate import, period-end revaluation, realized FX, translation (CTA), rate-type policies                          | ⏳ Pending     | LL-051 to LL-056                           |
| Intercompany capture and matching, consolidation, eliminations, minority interest, consolidated statements       | ⏳ Pending     | LL-060 to LL-066                           |
| Bank accounts, CSV/OFX statement parsers, matching engine, reconciliation workspace and sign-off                 | ⏳ Pending     | LL-070 to LL-076                           |
| Approval policies and workflow, notifications and local outbox, delegation                                       | ⏳ Pending     | LL-080 to LL-083                           |
| Recurring templates, generation job, scheduled reversing journals                                                | ⏳ Pending     | LL-085 to LL-087                           |
| Trial balance report and screen                                                                                  | ✅ Implemented | LL-090, LL-107                             |
| Income statement, balance sheet, cash flow, exports, snapshots, budgets, report builder                          | ⏳ Pending     | LL-091 to LL-095, LL-097, LL-098           |
| Balance summaries, shared throttle store, backup drill, load test, end-to-end tests in CI, API tokens, export    | ⏳ Pending     | LL-096, LL-100 to LL-104, LL-110 to LL-112 |
| Web shell with entity switcher and planned sections, chart of accounts and periods screens                       | ✅ Implemented | LL-105, LL-106                             |
| Accessibility audit, dashboard, localization                                                                     | ⏳ Pending     | LL-103, LL-109, LL-113                     |

## Quick start

Requirements: Node.js 22+, npm, and a natively installed PostgreSQL 15+ server (17 is what the project is tested on). The defaults expect the local Unix socket in `/tmp`, your OS user and no password, e.g. `brew install postgresql@17 && brew services start postgresql@17`.

```bash
./run.sh
```

This does the following:

- checks for Node, npm and `psql`
- creates `.env` from `.env.example` with a random `SESSION_SECRET`
- installs dependencies
- creates the `ledgerline_dev` and `ledgerline_test` databases
- applies migrations
- loads the demo seed (idempotent)
- starts:
  - Web: http://localhost:5101
  - API: http://127.0.0.1:4101/api/v1 (also proxied by the web dev server under `/api`)

## Demo logins (development only)

These accounts are created by the development seed and are public. They must never exist in a production database; the seed refuses to run with `NODE_ENV=production`. The password for all of them is `Ledgerline!Demo2026`.

| Email                          | Role                                                      | Organization       |
| ------------------------------ | --------------------------------------------------------- | ------------------ |
| `owner@northwind.example`      | Owner (all permissions)                                   | Northwind Holdings |
| `controller@northwind.example` | Controller (periods, accounts, can post into soft-closed) | Northwind Holdings |
| `accountant@northwind.example` | Accountant (create and post journals, maintain FX rates)  | Northwind Holdings |
| `auditor@northwind.example`    | Auditor (read-only, audit trail)                          | Northwind Holdings |

Seeded data:

- **Northwind Inc.** (`NW-US`, USD, America/New_York): the standard chart plus an EUR-only bank account (1115). FY2025 is fully closed and FY2026 is open, with January soft-closed. It has posted journals in USD, EUR, GBP and JPY, plus one draft.
- **Northwind GmbH** (`NW-DE`, EUR, Europe/Berlin): the standard chart, FY2026 periods and three posted journals.
- **FX rates:** EUR/USD, GBP/USD and GBP/EUR spot rates, plus USD/JPY quoted in the opposite direction to exercise exact inversion.
- **Trial balance:** NW-US as of 2026-02-28 balances at 563,000.00 opening, with 63,000.00 of prior-year profit rolled into retained earnings.

## run.sh commands

| Command                     | Description                                                                   |
| --------------------------- | ----------------------------------------------------------------------------- |
| `./run.sh` / `./run.sh dev` | Setup (below), then launch API + web with hot reload (`start` is an alias)    |
| `./run.sh setup`            | Check prerequisites, create `.env` and the dev/test databases, migrate, seed  |
| `./run.sh migrate`          | Apply pending database migrations                                             |
| `./run.sh seed`             | Load development demo data (idempotent)                                       |
| `./run.sh reset [--yes]`    | Drop and recreate the dev schema, then migrate and seed (asks unless `--yes`) |
| `./run.sh test`             | Unit + integration tests against `ledgerline_test`                            |
| `./run.sh check`            | Lint, format check, typecheck, tests and build (what CI runs)                 |
| `./run.sh e2e`              | Setup, install Playwright Chromium, run the end-to-end smoke tests            |
| `./run.sh help`             | Show all commands                                                             |

## Tech stack

| Layer    | Technology                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------- |
| API      | Node.js 22, Fastify 5, `@fastify/cookie`, TypeScript (strict), zod, pg, pino; tsup build, tsx dev        |
| Web      | React 18, React Router 6, Vite 6, plain CSS with design tokens                                           |
| Database | PostgreSQL 15+ (`btree_gist` for period exclusion), forward-only SQL migrations, PL/pgSQL triggers       |
| Shared   | `@ledgerline/shared`: money, rates, rounding, posting engine, trial balance, RBAC, zod schemas           |
| Tests    | Vitest, fast-check property tests, Testing Library, Fastify `inject` against real PostgreSQL, Playwright |
| Tooling  | npm workspaces, ESLint, Prettier, GitHub Actions (runner's native PostgreSQL)                            |

## Repository layout

```
ledgerline/
├── apps/
│   ├── api/                          Fastify API
│   │   ├── migrations/               0001_foundation.sql, 0002_ledger_core.sql
│   │   ├── src/
│   │   │   ├── config/               zod-validated environment (TRUST_PROXY, throttles, ...)
│   │   │   ├── db/                   pool, migration runner, CLI, demo seed
│   │   │   ├── http/                 app assembly, error handler, session/CSRF hooks, guards, throttles
│   │   │   ├── lib/ security/        envelope helpers, validation, scrypt, tokens
│   │   │   └── modules/
│   │   │       ├── auth/ audit/ health/                     implemented foundation
│   │   │       ├── entities/ accounts/ periods/ fx/         implemented slice
│   │   │       ├── journals/                                implemented slice: posting service
│   │   │       ├── reports/                                 implemented slice: trial balance
│   │   │       └── pending/                                 67 planned routes answering 501 + ticket
│   │   └── test/                     unit, HTTP and PostgreSQL integration tests
│   └── web/                          React SPA
│       └── src/
│           ├── pages/                journals, journal editor, accounts, periods, trial balance, PlannedPage
│           ├── journal/              lines editor and live per-currency balance
│           └── auth/ entity/ api/    session, entity switcher, API client
├── packages/shared/
│   └── src/
│       ├── money/                    currencies, parsing, banker's rounding, rational rates, apportionment
│       ├── ledger/                   accounts, hierarchy, periods, posting engine, trial balance, chart template
│       ├── auth/ time/               roles/permissions, boundary schemas, canonical IANA time zones
│       └── envelope.ts result.ts
├── e2e/                              Playwright config and smoke specs
├── docs/                             product, architecture, ADRs, design, API, security, testing, ops, planning
├── run.sh                            single entry point
└── .env.example                      placeholder configuration
```

## Documentation

Start with the [documentation index](docs/README.md). Key documents:
[PRD](docs/product/PRD.md) ·
[requirements](docs/product/requirements.md) ·
[architecture](docs/architecture/overview.md) ·
[ADRs](docs/adr/README.md) ·
[data model](docs/design/data-model.md) ·
[system design](docs/design/system-design.md) ·
[API](docs/api/README.md) ·
[OpenAPI](docs/api/openapi.yaml) ·
[threat model](docs/security/threat-model.md) ·
[test strategy](docs/testing/test-strategy.md) ·
[runbook](docs/operations/runbook.md) ·
[deployment](docs/operations/deployment.md) ·
[roadmap](docs/planning/roadmap.md) ·
[backlog](docs/planning/backlog.md) ·
[implementation status](docs/planning/implementation-status.md)

## Known limitations

- **Usable scope.** Only the ledger slice works end to end: entities, accounts, periods, FX rates, journals and the trial balance. Revaluation, intercompany, consolidation, reconciliation, approvals, recurring journals and financial statements are pending (see the status table).
- **Single instance.** Login throttle counters live in memory, so the API is only correct as one instance until they move to Postgres (LL-100).
- **End-to-end tests.** The Playwright smoke specs exist but are not run in CI and have not yet been run against the stack (LL-104).
- **Drafts.** A draft must pass full validation when saved. Unbalanced work-in-progress drafts, draft editing and discarding are LL-036.
- **Corrections.** Posted entries are immutable and reversal is not built yet (LL-035), so a correction needs a new offsetting entry.
- **Trial balance.** A range must stay within one fiscal year, and balances are aggregated on the fly without summary tables (LL-096).
- **Stored rates.** Line rates are stored rounded to 10 decimals. The functional amount, computed from the exact rate, is authoritative.
- **Registration.** Sign-up creates the organization immediately with no email verification (LL-120).
- **No external services by design.** There are no bank feeds, email providers or other third-party APIs; statements will be imported from files and notifications go to a local outbox.

## Contributing, security and license

- [Contributing guide](CONTRIBUTING.md): workflow, commit conventions, engineering rules.
- [Security policy](SECURITY.md): how to report vulnerabilities and a summary of the security model.
- [Changelog](CHANGELOG.md).
- Licensed under the [MIT License](LICENSE).
