# ADR-0003: Zod validation at every boundary with schemas in the shared package

- Status: Accepted
- Date: 2026-11-24

## Context

Untrusted data enters through HTTP bodies, query strings, headers, environment variables and the database (e.g. numeric rates). The browser must validate the same way the server does.

## Decision Drivers

- Fail fast with field-level messages
- One schema for client and server
- Strict objects: unknown keys are rejected

## Considered Options

1. **zod schemas in `@ledgerline/shared`, `.strict()` objects, parsed via a `parse()` helper that raises 400** — Single definition, inferred TypeScript types.
2. **JSON Schema with Fastify's built-in validator** — Fast, but types must be maintained separately and the browser needs another validator.
3. **Manual checks** — Error-prone.

## Decision Outcome

Chosen: **zod**. Request schemas live in the shared package; the API parses params, query, body and headers in each route; `loadEnv` parses the environment at startup and lists every problem at once.

## Consequences

- Consistent `VALIDATION_ERROR` responses with `details[].path`
- Schema changes are a shared-package change that both apps pick up
- Runtime cost is negligible relative to database work

## Status

Accepted.
