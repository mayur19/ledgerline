# Security Policy

## Supported versions

Only the latest `main` is supported while the project is pre-1.0.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through GitHub's **Report a vulnerability** (Security Advisories) on this repository. Do not open a public issue. Include reproduction steps, the affected endpoint or file, and the impact you expect.

We aim to acknowledge reports within 3 business days and to ship a fix or mitigation for confirmed high-severity issues within 14 days.

## Security model in brief

- Session cookies are HttpOnly and SameSite=Lax (Secure in production). Tokens are stored only as HMAC-SHA256 hashes keyed by `SESSION_SECRET`.
- Every mutating request needs a CSRF double-submit token that is bound to the session.
- Passwords are hashed with scrypt (N=16384, r=8, p=1) and a per-user salt.
- Login is throttled per IP (IPv6 normalised to /64), per email (progressive backoff, reserved before any await) and by distinct emails per IP. Counters live in process; they must move to Postgres (LL-100) before running more than one API instance.
- Registration responses never reveal whether an email already exists.
- `TRUST_PROXY` accepts only `false`, a hop count or proxy IP/CIDR lists, and production refuses to start without it set explicitly.
- Tenant isolation: entity-scoped routes resolve the entity by `organization_id` first, so another tenant's entity returns 404. Composite foreign keys stop cross-entity references.
- Posted ledger data and the audit trail are immutable at the database level.

See [docs/security/threat-model.md](docs/security/threat-model.md) for the full STRIDE analysis.
