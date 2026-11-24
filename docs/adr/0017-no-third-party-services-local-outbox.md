# ADR-0017: No third-party services; local outbox for notifications

- Status: Accepted
- Date: 2026-11-24

## Context

The product must run fully self-contained: no payment, email, SMS, identity, analytics or CDN providers, so it can be installed in restricted finance environments.

## Decision Drivers

- Zero outbound network at runtime
- Features that normally need providers still work
- Simple installation

## Considered Options

1. **Build in-house: local outbox table for email, uploaded files for bank data, user-maintained FX rates, in-house parsers** — Self-contained.
2. **Integrate providers behind feature flags** — Adds egress and secrets management.
3. **Skip such features** — Loses product value.

## Decision Outcome

Chosen: **self-contained**. Notifications will be written to an outbox table (LL-082) that an operator can relay; bank statements are parsed in-house (LL-071/072); fonts and assets are bundled.

## Consequences

- No API keys or egress rules to manage
- Rate feeds must be imported by users (LL-051)
- Delivering email is an operator concern outside the app

## Status

Accepted.
