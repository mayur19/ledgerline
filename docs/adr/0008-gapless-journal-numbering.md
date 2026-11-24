# ADR-0008: Gapless journal numbering with a locked counter row

- Status: Accepted
- Date: 2026-11-24

## Context

Many jurisdictions and auditors expect sequential, gap-free journal numbers per entity and fiscal year. Postgres sequences are non-transactional: a rolled-back insert burns a number.

## Decision Drivers

- No gaps, no duplicates under concurrency
- Numbers assigned only to posted entries
- Acceptable throughput per entity

## Considered Options

1. **Counter table `journal_sequences(entity_id, fiscal_year, next_value)` incremented with `UPDATE ... RETURNING` inside the posting transaction** — Row lock serialises posters; rollback returns the number.
2. **Postgres SEQUENCE** — Fast but gaps on rollback.
3. **`max(sequence)+1`** — Race-prone without table locks.

## Decision Outcome

Chosen: **locked counter row**. Drafts carry no number; posting takes the next value and formats `ENTITY-FY-000001`. A unique constraint `(entity_id, fiscal_year, sequence_number)` backs it up.

## Consequences

- Verified with 25 parallel posters: numbers 1..N exactly
- Posting throughput per entity is bounded by the lock hold time (kept short: the lock is the last step)
- Bulk import (LL-039) will take one lock per batch

## Status

Accepted.
