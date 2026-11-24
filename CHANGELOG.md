# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- Journal reversal, recurring and reversing journals (LL-035, LL-085..LL-087)
- Period-end FX revaluation (LL-052)
- Intercompany capture and consolidation with eliminations and minority interest (LL-060..LL-066)
- Bank statement import (CSV/OFX) and reconciliation matching (LL-070..LL-076)
- Approval workflow with segregation of duties (LL-080..LL-083)
- Income statement, balance sheet and cash-flow statement (LL-091..LL-093)

## [0.1.0] - 2026-11-25

### Added

- Monorepo with npm workspaces, strict TypeScript, ESLint, Prettier, CI on the runner's native PostgreSQL.
- Forward-only SQL migration runner with checksums and an advisory lock.
- Session authentication with scrypt, CSRF double-submit and RBAC. Registration does not reveal whether an email exists.
- Login throttling with IP, email (progressive backoff) and distinct-email-per-IP limiters, plus `TRUST_PROXY` hop/CIDR configuration.
- Append-only audit trail.
- Legal entities with canonical IANA time zones, chart of accounts with hierarchy validation, and a standard chart template.
- Fiscal-year generation and period state machine (open, soft-closed, closed).
- FX rate table with exact inverse lookup.
- Posting engine with group-wise conversion, largest-remainder apportionment, banker's rounding and rounding-account residue handling.
- Journals API: drafts, posting, gapless numbering, idempotency keys, preview.
- Database triggers enforcing balance at commit and immutability of posted entries.
- Trial balance report with header roll-up and prior-year earnings.
- Web UI: login, journals, journal editor with live balance, chart of accounts, periods, trial balance.
- `501` stubs for every planned endpoint, tied to backlog tickets.
