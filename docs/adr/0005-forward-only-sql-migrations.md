# ADR-0005: Forward-only SQL migrations with checksums and an advisory lock

- Status: Accepted
- Date: 2026-11-24

## Context

Schema changes must be reviewable SQL, repeatable across environments and safe during deploys where two processes might start at once.

## Decision Drivers

- Plain SQL for triggers, exclusion constraints and extensions
- Detect edited history
- No concurrent runners
- Each migration atomic

## Considered Options

1. **In-repo runner: `NNNN_name.sql`, `schema_migrations(name, checksum)`, one transaction per file, `pg_advisory_lock`** — Tiny, transparent.
2. **node-pg-migrate / Knex migrations** — JS DSL plus down migrations we would not trust in production.
3. **Sqitch / Flyway** — Extra runtimes.

## Decision Outcome

Chosen: **in-repo forward-only runner** (`apps/api/src/db/migrate.ts`). Rollback is done by a new forward migration or by restoring a backup (see deployment.md).

## Consequences

- Editing an applied file fails fast with a clear message
- A failing migration rolls back fully (tested)
- No down migrations: operators must plan reversible changes as expand/contract

## Status

Accepted.
