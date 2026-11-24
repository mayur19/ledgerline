# Runbook

## 1. Configuration

All configuration is environment variables, validated at startup by `apps/api/src/config/env.ts` (the process exits listing every problem). Locally they come from `.env` (created by `./run.sh` from `.env.example`); in production from `/etc/ledgerline/ledgerline.env`.

| Variable                    | Default                  | Description                                                                                                                                                                                                                                                                    |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                  | `development`            | `development`, `test` or `production`. Production enables `Secure` cookies, refuses the placeholder secret and requires `TRUST_PROXY`                                                                                                                                          |
| `API_HOST`                  | `127.0.0.1`              | Listen address. Keep loopback behind nginx                                                                                                                                                                                                                                     |
| `API_PORT`                  | `4101`                   | Listen port                                                                                                                                                                                                                                                                    |
| `WEB_PORT`                  | `5101`                   | Vite dev server port (development only)                                                                                                                                                                                                                                        |
| `APP_ORIGIN`                | `http://localhost:5101`  | Public origin of the web app                                                                                                                                                                                                                                                   |
| `DATABASE_URL`              | — (required)             | e.g. `postgres:///ledgerline_dev?host=/tmp` (Unix socket, current OS user)                                                                                                                                                                                                     |
| `TEST_DATABASE_URL`         | —                        | Test database; **its schema is dropped by the tests**                                                                                                                                                                                                                          |
| `DATABASE_POOL_MAX`         | `10`                     | Pool size (1–100)                                                                                                                                                                                                                                                              |
| `SESSION_SECRET`            | — (required, ≥ 32 chars) | HMAC key for session and CSRF token hashes. Rotating it signs everyone out                                                                                                                                                                                                     |
| `SESSION_TTL_HOURS`         | `12`                     | Absolute session lifetime (1–720)                                                                                                                                                                                                                                              |
| `LOG_LEVEL`                 | `info`                   | pino level; `silent` in tests                                                                                                                                                                                                                                                  |
| `AUTH_RATE_LIMIT_MAX`       | `10`                     | Free failed logins per email before progressive lockout (30 s doubling to 1 h)                                                                                                                                                                                                 |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000`                 | Window for the IP, distinct-email and registration limiters                                                                                                                                                                                                                    |
| `AUTH_IP_RATE_LIMIT_MAX`    | `50`                     | Login attempts per normalised IP per window                                                                                                                                                                                                                                    |
| `AUTH_EMAILS_PER_IP_MAX`    | `20`                     | Distinct emails one IP may try per window                                                                                                                                                                                                                                      |
| `REGISTER_RATE_LIMIT_MAX`   | `5`                      | Registrations per IP per window                                                                                                                                                                                                                                                |
| `TRUST_PROXY`               | `false`                  | Which proxies may set `X-Forwarded-For`: `false` (none), a hop count (`1` behind a single nginx), or a comma-separated list of proxy IPs/CIDRs (`10.0.0.0/8,192.168.1.10`). `true` is rejected. **Must be set explicitly when `NODE_ENV=production`**, otherwise startup fails |

## 2. Everyday commands

```bash
./run.sh            # setup + start API (4101) and web (5101) with hot reload
./run.sh setup      # prerequisites, .env with random secret, create dev+test DBs, migrate, seed
./run.sh migrate    # apply pending migrations
./run.sh seed       # load demo data (idempotent, refuses in production)
./run.sh reset --yes  # drop dev schema, migrate, seed
./run.sh test       # unit + integration tests
./run.sh check      # lint, format, typecheck, tests, build
```

Demo logins (development only): `owner@`, `controller@`, `accountant@`, `auditor@northwind.example`, password `Ledgerline!Demo2026`.

Production equivalents (from `/opt/ledgerline/current`):

```bash
sudo -u ledgerline node --env-file=/etc/ledgerline/ledgerline.env apps/api/dist/db/cli.js migrate
sudo systemctl restart ledgerline-api
```

## 3. Health

- `GET /api/v1/health` — liveness, never touches the DB.
- `GET /api/v1/ready` — `200` when `SELECT 1` succeeds, `503 NOT_READY` otherwise. Point load balancer checks here.
- Logs: `journalctl -u ledgerline-api -o cat | jq` — every line has `reqId`; responses echo `x-request-id`.

## 4. Backup and restore

Nightly logical backup (RPO ≤ 24 h):

```bash
pg_dump --format=custom --no-owner --file=/var/backups/ledgerline/ledgerline-$(date +%F).dump ledgerline
find /var/backups/ledgerline -name '*.dump' -mtime +30 -delete
```

Restore (RTO ≤ 1 h):

```bash
sudo systemctl stop ledgerline-api
sudo -u postgres dropdb ledgerline_restore --if-exists
sudo -u postgres createdb -O ledgerline ledgerline_restore
pg_restore --no-owner --role=ledgerline --dbname=ledgerline_restore /var/backups/ledgerline/ledgerline-2026-11-24.dump
# verify: migrations table matches the release, trial balances balance
psql ledgerline_restore -c "SELECT name FROM schema_migrations ORDER BY 1"
psql ledgerline_restore -c "SELECT count(*) FROM journal_entries e WHERE status='posted' AND total_debit_functional <> total_credit_functional"
# switch DATABASE_URL to ledgerline_restore (or rename databases), then
sudo systemctl start ledgerline-api
```

Run a restore drill quarterly (automation: LL-101). Treat dump files as confidential financial data: encrypt at rest and restrict access.

## 5. Troubleshooting

| Symptom                                            | Likely cause                                                         | Fix                                                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Invalid environment configuration: ...` at start  | Missing/invalid variable                                             | Read the listed problems; compare with the table above                                                               |
| `TRUST_PROXY must be set explicitly in production` | Production without the variable                                      | Set `TRUST_PROXY=1` behind one nginx, or `false` if exposed directly                                                 |
| All users share one rate limit                     | `TRUST_PROXY=false` behind nginx: every request comes from 127.0.0.1 | Set `TRUST_PROXY=1`                                                                                                  |
| `Cannot reach PostgreSQL via ...` from run.sh      | Server not running / wrong socket                                    | `brew services start postgresql@17` or `sudo systemctl start postgresql`; check `host=/tmp` vs `/var/run/postgresql` |
| `Migration X was modified after being applied`     | An applied SQL file was edited                                       | Revert the edit; put the change in a new migration                                                                   |
| `extension "btree_gist" is not available`          | Contrib modules missing                                              | Install `postgresql-contrib` (Debian/Ubuntu)                                                                         |
| `403 CSRF_INVALID` from scripts                    | Missing `X-CSRF-Token`                                               | Send the `ll_csrf` cookie value as the header                                                                        |
| `429 RATE_LIMITED` for a user                      | Email lockout                                                        | Wait for `Retry-After`; restart clears in-memory counters (single instance)                                          |
| Warning `throttle store full: evicted entry`       | Store at 10,000 active keys — likely an attack                       | Check source IPs in logs; block at nginx; consider lowering windows                                                  |
| `409 PERIOD_CLOSED` when posting                   | Period closed                                                        | Post into an open period, or re-open (closed → soft_closed is LL-043)                                                |
| `422 RATE_MISSING`                                 | No FX rate on/before entry date                                      | Add the rate via `POST /fx-rates`                                                                                    |
| `422 ROUNDING_ACCOUNT_REQUIRED`                    | Entity has no FX rounding account                                    | `PATCH /entities/{id}/settings` with `roundingAccountId`                                                             |
| `503 RETRY_LATER`                                  | Serialization failure / deadlock                                     | Retry; investigate if frequent                                                                                       |
| Trial balance `isBalanced: false`                  | Should be impossible (DB invariants)                                 | Open an incident; run the posted-balance query above; check for manual SQL                                           |

## 6. Housekeeping

```sql
-- expired or revoked sessions older than 30 days
DELETE FROM sessions WHERE (revoked_at IS NOT NULL OR expires_at < now()) AND created_at < now() - interval '30 days';
```

Audit events are never deleted (append-only trigger); archival is part of LL-111.
