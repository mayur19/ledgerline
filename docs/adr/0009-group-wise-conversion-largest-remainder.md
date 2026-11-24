# ADR-0009: Group-wise FX conversion with largest-remainder apportionment and a rounding account

- Status: Accepted
- Date: 2026-11-24

## Context

Converting each line independently can unbalance an entry that balances in its transaction currency: three 0.01 EUR debits at 1.5 each round to 0.02 USD (0.06) while the 0.03 EUR credit rounds to 0.04. Cross-currency entries (EUR debit, GBP debit, USD credit) can be off by sub-unit residues that are not real errors.

## Decision Drivers

- An entry balanced per currency must balance in functional currency, always
- Real imbalances must still be rejected
- Deterministic, explainable results
- Residues visible, not hidden

## Considered Options

1. **Convert each (currency, side) _total_ once, apportion back to lines by largest remainder; allow a residue of at most ⌊k/2⌋ minor units (k = rounded foreign side totals) posted to the entity's FX rounding account** — Exact for single-currency groups; bounded residue otherwise.
2. **Per-line conversion + plug the difference to the largest line** — Silently changes a user's line.
3. **Reject any functional difference** — Forces users to hand-tune amounts for rounding.

## Decision Outcome

Chosen: **group-wise conversion + largest remainder + explicit rounding line**. Ties go to the larger weight, then the earlier line. Beyond tolerance the engine returns `UNBALANCED` with the difference; with residue but no configured account it returns `ROUNDING_ACCOUNT_REQUIRED`.

## Consequences

- Property test: 300 random per-currency-balanced entries never need a rounding line
- Rounding lines are flagged `is_rounding_adjustment` and visible in reports
- Complexity O(n log n) per entry

## Status

Accepted.
