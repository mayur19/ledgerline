# ADR-0012: Period locking with FOR SHARE / FOR UPDATE and deferred database invariants

- Status: Accepted
- Date: 2026-11-24

## Context

A controller may close a period while accountants are posting into it. Without coordination an entry can commit into a period that was closed a millisecond earlier. Application bugs or manual SQL could also leave unbalanced posted entries.

## Decision Drivers

- No posting commits into a closed period
- Concurrent posters do not block each other
- Defence in depth below the application

## Considered Options

1. **Posting reads the period `FOR SHARE`; status changes take `FOR UPDATE`; a deferred constraint trigger re-checks balance, totals, line count, date range and period status at COMMIT** — Readers share, writers exclude; DB is the last line.
2. **SERIALIZABLE for all posting** — Correct but retries under load and harder reasoning.
3. **Application checks only** — No protection against bypass.

## Decision Outcome

Chosen: **row locks + deferred trigger**. Immutability triggers block updates/deletes of posted lines and entries (SQLSTATE `LL002`); the deferred trigger raises `LL003`. Entries are born as drafts and posted via an UPDATE so the trigger sees all lines.

## Consequences

- Close waits for in-flight posts; posts waiting on a close see `closed` and fail with `PERIOD_CLOSED` (tested)
- Direct SQL cannot create an unbalanced posted entry (tested)
- Lock ordering (period, then sequence row) avoids deadlocks

## Status

Accepted.
