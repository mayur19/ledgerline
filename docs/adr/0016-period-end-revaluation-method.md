# ADR-0016: Period-end revaluation of monetary balances with auto-reversal

- Status: Proposed
- Date: 2026-11-24

## Context

Foreign-currency monetary balances (cash, receivables, payables) must be restated at the closing rate at period end; the unrealized gain/loss is recognised and reversed on day one of the next period (LL-052, LL-053).

## Decision Drivers

- Correct under IAS 21 / ASC 830
- Idempotent re-runs
- No double counting with realized FX (LL-054)

## Considered Options

1. **Per account and currency: foreign balance × closing rate − carried functional balance → one revaluation entry (source `revaluation`) to 7910 Unrealized FX, with an automatic reversing entry dated the next period start** — Standard practice, reversible.
2. **Revalue at transaction level (open items)** — More precise, needs sub-ledgers that do not exist yet.
3. **No reversal; cumulative adjustments** — Complicates realized FX calculation.

## Decision Outcome

Proposed: **balance-level revaluation with auto-reversal**, recorded as a `revaluation_runs` row so a re-run replaces (reverses and re-posts) the previous run for the same period.

## Consequences

- Uses the same posting engine and invariants
- Requires `closing` rate type entries
- Open-item revaluation can come later with AR/AP

## Status

Proposed. Will be revisited when the related tickets start.
