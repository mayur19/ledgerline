# Test strategy

## 1. Pyramid

```
            ┌──────────────┐  e2e (Playwright, 2 smoke specs, local only — LL-104)
          ┌─┴──────────────┴─┐  web component tests (RTL, jsdom)
        ┌─┴──────────────────┴─┐  API integration (Fastify inject + real PostgreSQL)
      ┌─┴──────────────────────┴─┐  API unit (env, security, throttles, HTTP shell with a fake DB)
    ┌─┴──────────────────────────┴─┐  shared domain unit + property tests (fast-check)
```

The hard logic lives in `packages/shared` and is tested hardest: exhaustive cases plus property tests for rounding, apportionment, rate inversion, amount round-trips and multi-currency balancing.

## 2. What is tested where

| Layer           | Location                                    | Tools                                                 | Covers                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain          | `packages/shared/test`                      | Vitest, fast-check                                    | `divideHalfEven`, `parseAmount`/`formatMinor` (all currencies), rational rates and conversion, largest-remainder apportionment, account hierarchy and cycle detection, period lifecycle and generation, posting engine (every error code, residue/rounding lines, property: per-currency-balanced entries always balance), trial balance (prior-year earnings, header roll-up), RBAC, schemas, time zone canonicalisation |
| API unit        | `apps/api/test/{env,security,http}.test.ts` | Vitest, `app.inject` + fake DB                        | Env parsing (TRUST_PROXY forms, production requirement), scrypt, tokens, bounded store sweep/eviction, IP normalisation, all limiters, security headers, request ids, 404/400/500 envelopes, trust-proxy behaviour                                                                                                                                                                                                        |
| API integration | `apps/api/test/*.db.test.ts`                | Vitest, real PostgreSQL, fresh schema + seed per file | Auth (non-enumerating register, lockout, spraying, parallel bad logins, CSRF, cookies), tenancy 404s, RBAC, entities/accounts/periods/FX, posting (multi-currency, rates, periods, soft-close, drafts, idempotency races, preview), concurrency (gapless numbers, close vs post race), DB invariants (direct SQL), trial balance figures, migrations (idempotent, tamper detection, rollback), every pending route → 501  |
| Web             | `apps/web/test`                             | Vitest, Testing Library, user-event                   | API client (CSRF header, error mapping), live balance summary, journal lines editor, trial balance table, navigation/planned badges                                                                                                                                                                                                                                                                                       |
| E2E             | `e2e/tests`                                 | Playwright                                            | Controller posts a journal and sees it in the trial balance; planned sections show tickets                                                                                                                                                                                                                                                                                                                                |

## 3. Acceptance test matrix

| Requirement area | Acceptance criterion                                                                         | Test                                          |
| ---------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Balanced posting | Unbalanced entry rejected with difference                                                    | `posting.test.ts`, `journals.db.test.ts`      |
| Multi-currency   | EUR line converted at latest rate on/before date; opposite quote inverted exactly            | `journals.db.test.ts`                         |
| Rounding         | Group-balanced entries never need a rounding line; sub-unit residue goes to rounding account | `posting.test.ts` (property + examples)       |
| Periods          | Closed periods reject posts; soft-closed only for controllers; no drafts at close            | `journals.db.test.ts`, `setup.db.test.ts`     |
| Concurrency      | 25 parallel posts → numbers 1..25; close racing posts leaves no late entries                 | `concurrency.db.test.ts`                      |
| Immutability     | Direct UPDATE/DELETE of posted rows fails                                                    | `invariants.db.test.ts`                       |
| Idempotency      | Retries replay; concurrent retries create one entry                                          | `journals.db.test.ts`                         |
| Trial balance    | Balanced; prior-year profit in retained earnings; header roll-up                             | `trial-balance.test.ts`, `reports.db.test.ts` |
| Tenancy          | Foreign entity → 404                                                                         | `setup.db.test.ts`                            |
| Auth hardening   | Register non-enumerating; backoff; spraying; distinct-email cap; parallel bursts             | `auth.db.test.ts`, `security.test.ts`         |
| Planned API      | Every pending route → 501 + ticket                                                           | `pending.db.test.ts`, `http.test.ts`          |

## 4. Coverage thresholds

Configured in each `vitest.config.ts` and enforced by `npm run test:coverage` in CI:

| Package           | Lines | Functions | Branches | Statements |
| ----------------- | ----- | --------- | -------- | ---------- |
| `packages/shared` | 90    | 90        | 85       | 90         |
| `apps/api`        | 80    | 80        | 75       | 80         |

Process entry points (`src/index.ts`, `src/db/cli.ts`) are excluded; they are exercised by `run.sh` and the CI build.

## 5. Running

```bash
./run.sh test                         # creates ledgerline_test if missing, runs all workspaces
npm test -w @ledgerline/shared        # domain only, no database
TEST_DATABASE_URL='postgres:///ledgerline_test?host=/tmp' npm test -w @ledgerline/api
npm run test:coverage
./run.sh e2e                          # Playwright against the running dev stack
```

Integration suites drop and recreate the `public` schema of the test database, so never point `TEST_DATABASE_URL` at a database you care about. Files run sequentially (`fileParallelism: false`) because they share that database. Without `TEST_DATABASE_URL` the database suites are skipped and only unit tests run.

## 6. CI

`.github/workflows/ci.yml` starts the runner's preinstalled PostgreSQL with `systemctl`, creates a role and the test database, then runs lint, format check, typecheck, tests with coverage and the build. Playwright is not run in CI yet (browser download policy); LL-104 adds it.

## 7. Planned additions

- Load and latency tests for QA-07..QA-09 (LL-102).
- Golden-file tests for financial statements (LL-091..LL-093).
- Property tests for revaluation idempotency and consolidation (eliminations net to zero) when those land.
