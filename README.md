# Ledgerline

Multi-entity double-entry accounting and financial close for mid-market finance teams that run several legal entities in several currencies.

[![CI](https://github.com/mayur19/ledgerline/actions/workflows/ci.yml/badge.svg)](https://github.com/mayur19/ledgerline/actions/workflows/ci.yml)

> **Status: foundation + first vertical slice (~12% of planned scope).** The posting engine, chart of accounts, periods, FX rate table and trial balance work end to end. Intercompany, consolidation, revaluation, bank reconciliation, approvals, recurring journals and financial statements are designed, documented and tracked as pending. See [implementation status](docs/planning/implementation-status.md).

## What works today

- **Posting engine** (`packages/shared/src/ledger/posting.ts`): validates journal entries and converts every line to the entity's functional currency with integer minor units and banker's rounding. Conversion is group-wise: each (currency, side) total is converted once and apportioned back to lines by largest remainder, so an entry that balances in EUR also balances in USD. A sub-unit residue across currencies goes to the entity's FX rounding account; anything larger is rejected as unbalanced. Exchange rates are exact rationals, so an inverted quote loses no precision.
- **Journals API**: create a draft or post in one transaction. Postings check the period status (open, soft-closed for controllers only, closed), take gapless per-entity, per-fiscal-year numbers and are idempotent via `Idempotency-Key`.
- **Database-enforced invariants**: a deferred constraint trigger re-checks the balance at commit. Posted lines and entries cannot change. Lines can only reference accounts of their own entity, periods cannot overlap and the audit trail is append-only.
- **Trial balance**: opening, period and closing balances with header-account roll-up. Income-statement accounts restart each fiscal year and prior-year profit rolls into retained earnings. The report reads one `REPEATABLE READ` snapshot.
- **Foundation**: session auth (scrypt, HttpOnly cookies, CSRF double-submit), IP/email/distinct-email login throttles, RBAC (owner, admin, controller, accountant, approver, auditor), audit log, forward-only migrations, structured logs and request IDs. Every planned endpoint is registered and returns `501` with its backlog ticket.
- **Web UI**: login, entity switcher, journals list, journal editor with a live per-currency balance, chart of accounts, periods and the trial balance. Planned sections appear in the navigation with a _Planned_ badge.

## Quick start

Requirements: Node.js 22+, npm, and a natively installed PostgreSQL 15+ server, e.g. `brew install postgresql@17 && brew services start postgresql@17`.

```bash
./run.sh            # checks prerequisites, writes .env with a random secret, creates DBs, migrates, seeds, starts API + web
```

- Web: http://localhost:5101, API: http://127.0.0.1:4101/api/v1
- The default `DATABASE_URL` uses the local socket in `/tmp` as the current OS user with no password. Edit `.env` for other setups.

Demo logins (**development seed only**), password `Ledgerline!Demo2026`:

| Email                        | Role                                           |
| ---------------------------- | ---------------------------------------------- |
| owner@northwind.example      | owner                                          |
| controller@northwind.example | controller (can post into soft-closed periods) |
| accountant@northwind.example | accountant                                     |
| auditor@northwind.example    | auditor (read-only)                            |

The seed creates _Northwind Inc._ (USD, with an EUR bank account) and _Northwind GmbH_ (EUR). It loads FY2025 (closed) and FY2026 periods, EUR/GBP/JPY rates (USD/JPY is quoted the other way round on purpose) and posted, multi-currency and draft journals.

## Commands

| Command                | What it does                                               |
| ---------------------- | ---------------------------------------------------------- |
| `./run.sh setup`       | Prerequisites, `.env`, databases, migrations, seed         |
| `./run.sh dev`         | Setup, then API + web with hot reload                      |
| `./run.sh test`        | Unit + integration tests against `ledgerline_test`         |
| `./run.sh check`       | Lint, format check, typecheck, tests, build (what CI runs) |
| `./run.sh reset --yes` | Drop and rebuild the dev database                          |
| `./run.sh e2e`         | Playwright smoke tests (local only for now)                |

## Repository layout

```
apps/api         Fastify 5 + pg + zod + pino; modules/<domain>; migrations/*.sql; test/
apps/web         React 18 + Vite + React Router; plain CSS design tokens
packages/shared  Money, rates, rounding, posting engine, trial balance, RBAC, schemas (pure, fully tested)
docs/            Product, architecture, ADRs, design, API (OpenAPI 3.1), security, testing, operations, planning
e2e/             Playwright smoke specs
```

## Documentation

Start at [docs/README.md](docs/README.md). Highlights:

- [System design](docs/design/system-design.md) covers the posting algorithm, concurrency strategy and state machines.
- [Data model](docs/design/data-model.md) has the full target ERD.
- [OpenAPI](docs/api/openapi.yaml) documents every operation with an `x-status` of implemented or pending.
- [ADRs](docs/adr/README.md)
- [Backlog](docs/planning/backlog.md) and [roadmap](docs/planning/roadmap.md)

## License

MIT © Ledgerline contributors
