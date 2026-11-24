# ADR-0001: Modular monolith in npm workspaces

- Status: Accepted
- Date: 2026-11-24

## Context

Ledgerline targets mid-market finance teams. The domain (ledger, close, consolidation, reconciliation) is highly cohesive: almost every feature reads or writes the same journal tables inside one transaction. The team is small and needs fast refactoring across the API, the web app and shared rules.

## Decision Drivers

- Transactions spanning several sub-domains (posting + audit + numbering) must stay ACID
- One deployable unit is easier to operate on a single VM
- Domain rules must be identical in browser and server
- Low tooling overhead

## Considered Options

1. **Modular monolith with npm workspaces (`apps/api`, `apps/web`, `packages/shared`)** — Single process, one database, compile-time sharing of domain code; module boundaries enforced by convention and review.
2. **Microservices per sub-domain** — Independent scaling, but distributed transactions for every posting and much higher ops cost.
3. **Monorepo with Nx/Turborepo** — Better task caching, but extra tooling the project does not yet need.

## Decision Outcome

Chosen: **modular monolith with plain npm workspaces**. Each domain lives in `apps/api/src/modules/<domain>` with its own repository/service/routes; pure rules live in `packages/shared` and are bundled into both the API (tsup `noExternal`) and the SPA (Vite).

## Consequences

- Posting, numbering and audit share one database transaction
- A single `npm ci` and one CI job build everything
- Module boundaries can erode; the overview documents allowed dependencies and reviews check them
- Scaling is vertical first; read replicas and summary tables (LL-096) come before any split

## Status

Accepted.
