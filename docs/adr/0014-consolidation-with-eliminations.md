# ADR-0014: Consolidation by aggregation with rule-based eliminations and NCI

- Status: Proposed
- Date: 2026-11-24

## Context

Groups need consolidated statements across an entity hierarchy with different functional currencies, intercompany balances eliminated and non-controlling interest shown separately (LL-062..LL-066).

## Decision Drivers

- Reproducible, versioned runs
- No changes to entity ledgers
- Explainable elimination entries

## Considered Options

1. **Consolidation runs as snapshots: translate each entity TB to the group currency (LL-055), map to the group chart (LL-025), aggregate bottom-up, apply elimination rules, compute NCI from ownership %, store results per run** — Auditable, re-runnable.
2. **Post eliminations into a dedicated elimination entity ledger** — Simple reporting, but mutable history and period-lock complications.
3. **Compute on the fly at report time** — No audit trail of what was reported.

## Decision Outcome

Proposed: **snapshot runs** stored in `consolidation_runs` / `consolidation_lines` with an elimination column; due-to/due-from pairs eliminated by counterparty matching, differences reported (LL-061).

## Consequences

- Runs are immutable and versioned (LL-066)
- Requires translation and group mapping first
- Storage grows with runs; retention policy needed

## Status

Proposed. Will be revisited when the related tickets start.
