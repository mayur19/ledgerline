# ADR-0002: Fastify 5 and node-postgres without an ORM

- Status: Accepted
- Date: 2026-11-24

## Context

The API needs predictable SQL: row locks (`FOR SHARE`, `FOR UPDATE`), `unnest` bulk inserts, `FILTER` aggregates, deferred triggers and SQLSTATE handling. ORMs tend to hide exactly these features.

## Decision Drivers

- Explicit control of locking and isolation
- Minimal dependencies
- Fast JSON serialization and a good plugin model
- Testability without a network listener

## Considered Options

1. **Fastify 5 + `pg` + hand-written repositories** — Plain SQL per repository function, typed rows, `app.inject()` for tests.
2. **Express + Prisma** — Familiar, but Prisma's locking and raw-SQL ergonomics are weak for ledger work.
3. **NestJS + TypeORM** — Heavy framework, decorators, implicit transactions.

## Decision Outcome

Chosen: **Fastify 5 with `pg`**. Repositories are small functions that take a `Queryable` (pool or transaction client). `withTransaction` sets isolation explicitly. DATE columns are parsed as strings to avoid timezone drift.

## Consequences

- SQL is reviewed like code and can use every Postgres feature
- Developers must write migrations and mapping by hand
- No lazy loading surprises; N+1 risks are visible in code

## Status

Accepted.
