# ADR-0007: Exchange rates as exact rationals with a single rounding step

- Status: Accepted
- Date: 2026-11-24

## Context

Rates are quoted as decimals with up to 10 places, sometimes in the opposite direction (USD/JPY 149.20 when converting JPY to USD). Converting through an inverted decimal (0.0067024129...) introduces error before the final rounding.

## Decision Drivers

- Exact inversion
- One rounding per converted amount
- Rates comparable for conflict detection

## Considered Options

1. **Parse decimals into reduced `numerator/denominator` bigints; invert by swapping; convert `amount × num × 10^eTo / (den × 10^eFrom)` with half-even** — Exact until the last step.
2. **Store a 10-decimal inverted rate** — Simple, but compounds error for large amounts.
3. **Floating point rates** — Unacceptable.

## Decision Outcome

Chosen: **rational rates**. `findSpotRate` picks the latest quote on or before the entry date in either direction (direct preferred on ties) and inverts exactly. Lines store the rate rounded to 10 places for display/audit; the functional amount computed from the exact rational is authoritative.

## Consequences

- JPY 150,000 at USD/JPY 149.20 converts to exactly 1,005.36 USD
- Stored display rate may differ from the exact inverse in the 11th place; documented
- Triangulation via a base currency is planned (LL-051)

## Status

Accepted.
