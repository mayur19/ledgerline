# ADR-0011: Authentication throttling and explicit proxy trust

- Status: Accepted
- Date: 2026-11-24

## Context

Login is the main attack surface: targeted guessing against one account from many IPs, password spraying from one IP across many accounts, parallel bursts that race the check, and IP spoofing through `X-Forwarded-For`. Registration can be abused to enumerate emails.

## Decision Drivers

- Separate defences for spraying and targeted guessing
- No race between check and count
- Bounded memory that an attacker cannot use to lock everyone out
- Client IP derived only from trusted proxies

## Considered Options

1. **Independent limiters: per-IP fixed window, per-email progressive backoff, per-IP distinct-email cap, per-IP registration window; synchronous reservation; bounded stores with resumable sweep and least-time-left eviction; `TRUST_PROXY` as `false` | hop count | IP/CIDR list, required in production** — Covers each threat explicitly.
2. **Single combined `ip|email` key** — Misses spraying and distributed guessing.
3. **`trustProxy: true`** — Any client can spoof its IP.

## Decision Outcome

Chosen: **independent limiters** (`apps/api/src/http/login-throttle.ts`). IPs are normalised (IPv4-mapped → IPv4, IPv6 → /64). Email backoff: free budget `AUTH_RATE_LIMIT_MAX`, then 30 s doubling to 1 h. When a store is full of active entries the one with the least time left is evicted and a warning logged. Registration returns the same 202 message whether or not the email exists.

## Consequences

- State is per process: running more than one instance requires moving counters to Postgres first (LL-100)
- Shared NAT users can hit the IP window; the window is generous (50/15 min)
- Startup fails in production without an explicit `TRUST_PROXY`

## Status

Accepted.
