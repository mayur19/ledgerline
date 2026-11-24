# ADR-0015: Bank reconciliation matching by staged rules and scoring

- Status: Proposed
- Date: 2026-11-24

## Context

Bank statement lines must be matched to ledger cash lines: exact matches, date drift, one deposit covering several receipts, fees netted out (LL-073).

## Decision Drivers

- High auto-match precision (false matches are worse than misses)
- Explainable suggestions
- Bounded runtime on 10k-line statements

## Considered Options

1. **Staged pipeline: exact (amount+date+reference) → amount within date window → many-to-one subset sum with bounded search → scored candidates (amount, date distance, reference similarity) above a threshold; user confirms below it** — Deterministic and explainable.
2. **Pure scoring of all pairs** — O(n·m) and opaque.
3. **Statistical learning** — Non-deterministic, hard to audit.

## Decision Outcome

Proposed: **staged rules + scoring**, subset-sum limited to 4 items within a 7-day window, each match storing its rule and score.

## Consequences

- Each match is explainable in the UI
- Many-to-many cases remain manual
- Rule suggestions from history are deterministic (LL-076)

## Status

Proposed. Will be revisited when the related tickets start.
