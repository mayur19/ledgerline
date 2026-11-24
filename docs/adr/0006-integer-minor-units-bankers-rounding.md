# ADR-0006: Money as integer minor units with banker's rounding

- Status: Accepted
- Date: 2026-11-24

## Context

Floating point cannot represent 0.10 exactly; summing thousands of lines drifts. Currencies have different exponents (JPY 0, USD 2, KWD 3). Conversions and allocations must round, and the rounding rule must not bias totals upward over many postings.

## Decision Drivers

- Exactness for storage and addition
- Currency-aware precision
- Unbiased rounding at scale
- Same code in browser and server

## Considered Options

1. **`bigint` minor units everywhere; decimal strings on the wire; every division through `divideHalfEven`** — Exact; one rounding function.
2. **`numeric` in Postgres + decimal.js in JS** — Exact, but two arithmetic libraries and no enforced exponent.
3. **Half-up rounding** — Common, but biased: systematic upward drift on .5 cases.

## Decision Outcome

Chosen: **bigint minor units, currency exponent table, round half to even**. `parseAmount` rejects excess precision instead of rounding user input. Postgres stores `bigint` amounts with `CHECK (amount_minor > 0)`.

## Consequences

- No float ever touches money (property tests round-trip every currency)
- Wire format is strings; clients must not use JS numbers
- Adding a currency is a data change in two places (shared table and `currencies` seed)

## Status

Accepted.
