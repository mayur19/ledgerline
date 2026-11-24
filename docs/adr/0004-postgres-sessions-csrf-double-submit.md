# ADR-0004: Server-side sessions in PostgreSQL with a CSRF double-submit token

- Status: Accepted
- Date: 2026-11-24

## Context

Finance users expect revocable sessions and short idle lifetimes. JWTs cannot be revoked without a server-side list anyway, and storing them in browser storage exposes them to XSS.

## Decision Drivers

- Revocation on logout or deactivation
- No token readable by scripts
- CSRF protection for cookie-authenticated requests
- No external identity provider (ADR-0017)

## Considered Options

1. **Opaque session token in an HttpOnly SameSite=Lax cookie, HMAC of the token stored in `sessions`, CSRF token in a readable cookie echoed in `X-CSRF-Token` and bound to the session by hash** — Classic, revocable, simple.
2. **JWT access + refresh tokens** — Stateless reads, but revocation and rotation complexity.
3. **SameSite=Strict only, no CSRF token** — Breaks top-level navigation flows and is not defence in depth.

## Decision Outcome

Chosen: **Postgres sessions + double-submit CSRF bound to the session**. The token is 256 bits from `randomBytes`, stored as `HMAC-SHA256(SESSION_SECRET, token)`. On unsafe methods the header must equal the cookie _and_ hash to the session's `csrf_token_hash`.

## Consequences

- A leaked sessions table cannot be replayed without the server secret
- Each request costs one indexed lookup (`token_hash` unique)
- Session listing/revocation UI is planned (LL-016)

## Status

Accepted.
