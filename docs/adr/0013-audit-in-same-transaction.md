# ADR-0013: Audit events written in the same transaction as the change

- Status: Accepted
- Date: 2026-11-24

## Context

Auditors need to trust that the trail matches the data. Writing audit logs asynchronously or after commit can lose events or record changes that rolled back.

## Decision Drivers

- Atomicity between change and audit
- Tamper resistance
- Queryable trail

## Considered Options

1. **`audit_events` table written via `recordAudit(tx, ...)` inside the business transaction; append-only trigger** — Atomic and simple.
2. **Log files** — Not queryable per tenant; can diverge.
3. **Outbox + async writer** — Eventually consistent.

## Decision Outcome

Chosen: **same-transaction audit** with `BEFORE UPDATE OR DELETE` trigger raising `LL001`. Events carry actor, action, target, entity, request id, IP and JSON metadata (before/after for updates).

## Consequences

- A rolled-back change leaves no audit event
- Hash chaining for tamper evidence is planned (LL-019)
- Failed logins are audited outside a business transaction

## Status

Accepted.
