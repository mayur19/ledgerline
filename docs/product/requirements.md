# Requirements

Functional (FR) and non-functional (NFR) requirements for Ledgerline. Priorities use MoSCoW. Every requirement names the backlog ticket that delivers it ([backlog.md](../planning/backlog.md)); status reflects the code on `main`. Traceability to modules and tests is in [requirements-traceability.md](requirements-traceability.md).

**Summary:** 56 functional requirements (30 implemented, 26 pending); 20 non-functional requirements (15 implemented/verified, 5 pending).

## Functional requirements

### E01 — Foundation & tooling

| ID     | Requirement                     | Priority | Acceptance criteria                                                                      | Ticket | Status      |
| ------ | ------------------------------- | -------- | ---------------------------------------------------------------------------------------- | ------ | ----------- |
| FR-054 | Expose planned endpoints as 501 | Must     | Every planned route returns 501 NOT_IMPLEMENTED with its ticket ID once authenticated.   | LL-003 | implemented |
| FR-055 | Report health and readiness     | Must     | /health never touches the database; /ready returns 503 when the database is unreachable. | LL-006 | implemented |

### E02 — Identity, access & audit

| ID     | Requirement                                  | Priority | Acceptance criteria                                                                                                                                                                                                    | Ticket | Status      |
| ------ | -------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| FR-001 | Register an organization and its owner       | Must     | POST /auth/register creates organization + owner and returns 202 with a generic message; the response is identical whether or not the email exists; no session is started.                                             | LL-010 | implemented |
| FR-002 | Sign in and sign out with email and password | Must     | Valid credentials return profile, role and permissions and set an HttpOnly SameSite=Lax session cookie; logout revokes the session server-side and /auth/me then returns 401.                                          | LL-010 | implemented |
| FR-003 | Throttle authentication attempts             | Must     | IP fixed window, email progressive backoff (reserved before any await), distinct-emails-per-IP cap and registration-per-IP limit each return 429 with Retry-After; IPv6 collapses to /64 and IPv4-mapped IPv6 to IPv4. | LL-011 | implemented |
| FR-004 | Protect mutating requests against CSRF       | Must     | Every unsafe request with a session must carry X-CSRF-Token equal to the ll_csrf cookie and to the token bound to the session; otherwise 403 CSRF_INVALID.                                                             | LL-011 | implemented |
| FR-005 | Enforce role-based permissions               | Must     | Six roles map to permissions in one matrix; routes declare the permission they need; missing permission returns 403 FORBIDDEN.                                                                                         | LL-012 | implemented |
| FR-006 | Record an append-only audit trail            | Must     | Every state change writes an audit event in the same transaction; UPDATE/DELETE on audit_events fails with SQLSTATE LL001.                                                                                             | LL-013 | implemented |
| FR-007 | Query the audit trail                        | Should   | GET /audit-events filters by action, target type and target id with pagination; requires audit.view.                                                                                                                   | LL-013 | implemented |
| FR-008 | Invite users and manage roles                | Must     | Owner/admin invites by email (local outbox), changes role, deactivates; deactivated users' sessions stop working immediately.                                                                                          | LL-014 | pending     |
| FR-009 | Reset a forgotten password                   | Should   | Single-use, time-limited token written to the outbox; reset revokes all sessions.                                                                                                                                      | LL-015 | pending     |
| FR-010 | Verify email on sign-up                      | Should   | Account is activated only after confirming a token delivered through the local outbox.                                                                                                                                 | LL-120 | pending     |
| FR-011 | Two-factor authentication                    | Could    | TOTP (RFC 6238) enrolment with recovery codes; required per role by policy.                                                                                                                                            | LL-018 | pending     |
| FR-012 | Restrict users to assigned entities          | Should   | Users without an assignment receive 404 for that entity's routes.                                                                                                                                                      | LL-017 | pending     |
| FR-013 | Verify audit trail integrity                 | Could    | Each event stores the hash of its predecessor; a verification endpoint reports the first broken link.                                                                                                                  | LL-019 | pending     |

### E03 — Entities & chart of accounts

| ID     | Requirement                               | Priority | Acceptance criteria                                                                                                                                                   | Ticket | Status      |
| ------ | ----------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| FR-014 | Create legal entities                     | Must     | Entity has unique code per organization, functional currency and canonical IANA time zone (e.g. europe/london stored as Europe/London); unsupported zones return 400. | LL-020 | implemented |
| FR-015 | Isolate tenants                           | Must     | Entities of another organization return 404 on every entity-scoped route; composite foreign keys prevent cross-entity references.                                     | LL-020 | implemented |
| FR-016 | Maintain a hierarchical chart of accounts | Must     | Accounts have code, type, optional currency restriction and parent; parents must be same-type header accounts; cycles are rejected with 422.                          | LL-021 | implemented |
| FR-017 | Apply a standard chart template           | Should   | Creating an entity with chartTemplate=standard inserts the standard chart and wires FX rounding and retained-earnings accounts.                                       | LL-022 | implemented |
| FR-018 | Configure entity accounting settings      | Must     | Rounding account must be an active postable account; retained earnings must be equity; invalid choices return 422.                                                    | LL-023 | implemented |
| FR-019 | Import and export the chart of accounts   | Should   | CSV import with dry-run report of row errors; export round-trips.                                                                                                     | LL-024 | pending     |
| FR-020 | Tag lines with analysis dimensions        | Could    | Department/project/cost center on lines; trial balance filterable by dimension.                                                                                       | LL-026 | pending     |

### E04 — Journals & posting engine

| ID     | Requirement                                       | Priority | Acceptance criteria                                                                                                                                                                                                   | Ticket | Status      |
| ------ | ------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| FR-021 | Validate journal entries in a pure posting engine | Must     | At least two lines; positive amounts within currency precision; active postable accounts; account currency restrictions; all errors returned together with line numbers.                                              | LL-030 | implemented |
| FR-022 | Convert foreign lines to functional currency      | Must     | One rate per currency per entry (explicit or latest spot on/before entry date, inverse quotes inverted exactly); each currency/side total converted once with banker's rounding and apportioned by largest remainder. | LL-030 | implemented |
| FR-023 | Absorb cross-currency rounding residue            | Must     | A residue of at most floor(k/2) minor units (k = rounded foreign currency sides) is posted to the entity FX rounding account; larger differences are UNBALANCED.                                                      | LL-030 | implemented |
| FR-024 | Post entries with period rules                    | Must     | No period: 422 PERIOD_NOT_FOUND; closed: 409 PERIOD_CLOSED; soft-closed: only journal.post_soft_closed (controller) may post, else 403 PERIOD_SOFT_CLOSED.                                                            | LL-031 | implemented |
| FR-025 | Number posted entries without gaps                | Must     | Posted entries receive ENTITY-FY-NNNNNN numbers contiguous per entity and fiscal year, even with 25 parallel posters.                                                                                                 | LL-031 | implemented |
| FR-026 | Create entries idempotently                       | Must     | A repeated Idempotency-Key returns the original entry (200, Idempotent-Replayed); reuse with a different payload returns 422; concurrent retries create one entry.                                                    | LL-031 | implemented |
| FR-027 | Save drafts and post them later                   | Must     | Drafts have no number; posting a draft re-validates against current accounts and period status.                                                                                                                       | LL-031 | implemented |
| FR-028 | Make posted history immutable                     | Must     | Database triggers reject updates/deletes of posted entries and their lines (LL002) and reject unbalanced posted entries at commit (LL003).                                                                            | LL-032 | implemented |
| FR-029 | List, view and preview journals                   | Must     | List filters by status and date range with pagination; detail includes lines with account codes; preview validates and converts without persisting.                                                                   | LL-033 | implemented |
| FR-030 | Enter journals in the browser with a live balance | Must     | Editor shows per-currency debit/credit totals as the user types, flags invalid amounts and offers a server check before posting.                                                                                      | LL-034 | implemented |
| FR-031 | Reverse a posted entry                            | Must     | Creates a linked entry with swapped sides in an open period and marks the original reversed.                                                                                                                          | LL-035 | pending     |
| FR-032 | Edit and discard work-in-progress drafts          | Should   | Drafts may be saved unbalanced, edited and deleted; only posting enforces balance.                                                                                                                                    | LL-036 | pending     |
| FR-033 | Drill down from balances to journal lines         | Should   | General ledger and account activity with running balance per account.                                                                                                                                                 | LL-038 | pending     |
| FR-034 | Import journals in bulk                           | Could    | CSV import validates every row with the posting engine and reports errors before committing.                                                                                                                          | LL-039 | pending     |

### E05 — Periods & close

| ID     | Requirement                       | Priority | Acceptance criteria                                                                                                                                                                                          | Ticket | Status      |
| ------ | --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------- |
| FR-035 | Generate fiscal years and periods | Must     | Monthly periods (1–13) computed in UTC; overlaps rejected with 409 and by an exclusion constraint.                                                                                                           | LL-040 | implemented |
| FR-036 | Control period status             | Must     | Transitions open→soft_closed, soft_closed→open, soft_closed→closed only; closing a period with drafts returns 409 PERIOD_HAS_DRAFTS; a close racing with postings never leaves a posting in a closed period. | LL-040 | implemented |
| FR-037 | Run a close checklist             | Should   | Tasks with owners and due dates per period; period cannot close until required tasks are signed off.                                                                                                         | LL-041 | pending     |
| FR-038 | Perform year-end close            | Must     | Closing entries move P&L to retained earnings; all periods of the year locked.                                                                                                                               | LL-042 | pending     |

### E06 — Multi-currency & revaluation

| ID     | Requirement                            | Priority | Acceptance criteria                                                                                                  | Ticket | Status      |
| ------ | -------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| FR-039 | Maintain FX rates                      | Must     | Rates per pair, type and date with up to 10 decimals; duplicates 409; same-currency pairs rejected.                  | LL-050 | implemented |
| FR-040 | Revalue foreign balances at period end | Must     | Monetary account balances revalued at closing rate; unrealized gain/loss entry posted and auto-reversed next period. | LL-052 | pending     |
| FR-041 | Translate to presentation currency     | Should   | Current-rate method with cumulative translation adjustment.                                                          | LL-055 | pending     |

### E07 — Intercompany & consolidation

| ID     | Requirement                       | Priority | Acceptance criteria                                                                               | Ticket | Status  |
| ------ | --------------------------------- | -------- | ------------------------------------------------------------------------------------------------- | ------ | ------- |
| FR-042 | Capture intercompany transactions | Must     | One action posts matching due-to/due-from entries in both entities.                               | LL-060 | pending |
| FR-043 | Consolidate the entity hierarchy  | Must     | Consolidated trial balance aggregates subsidiaries by ownership with elimination and NCI columns. | LL-062 | pending |
| FR-044 | Eliminate intercompany balances   | Must     | Rules eliminate due-to/due-from and intercompany revenue/expense; residual mismatches reported.   | LL-063 | pending |
| FR-045 | Compute non-controlling interest  | Should   | NCI share of equity and profit for partially owned subsidiaries.                                  | LL-064 | pending |

### E08 — Bank import & reconciliation

| ID     | Requirement                           | Priority | Acceptance criteria                                                                | Ticket | Status  |
| ------ | ------------------------------------- | -------- | ---------------------------------------------------------------------------------- | ------ | ------- |
| FR-046 | Import bank statements                | Must     | CSV (mapping profiles) and OFX parsed in-house; duplicate statements detected.     | LL-071 | pending |
| FR-047 | Match statement lines to ledger lines | Must     | Exact, date-window and many-to-one matching with scores; user confirms or rejects. | LL-073 | pending |

### E09 — Approvals & notifications

| ID     | Requirement                                | Priority | Acceptance criteria                                                         | Ticket | Status  |
| ------ | ------------------------------------------ | -------- | --------------------------------------------------------------------------- | ------ | ------- |
| FR-048 | Approve entries with segregation of duties | Must     | Policies route entries above thresholds; preparer cannot approve own entry. | LL-081 | pending |

### E10 — Recurring & reversing journals

| ID     | Requirement                 | Priority | Acceptance criteria                                                   | Ticket | Status  |
| ------ | --------------------------- | -------- | --------------------------------------------------------------------- | ------ | ------- |
| FR-049 | Schedule recurring journals | Should   | Templates with schedules generate entries idempotently with catch-up. | LL-085 | pending |

### E11 — Financial reporting

| ID     | Requirement                                | Priority | Acceptance criteria                                                                                                                                                                                                                     | Ticket | Status      |
| ------ | ------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| FR-050 | Produce a trial balance                    | Must     | Opening, period debit/credit and closing per account; header roll-up excluded from totals; prior-year P&L rolled into retained earnings; ranges cannot span fiscal years; reported in functional currency from one consistent snapshot. | LL-090 | implemented |
| FR-051 | View the trial balance in the browser      | Must     | Date range, zero-balance toggle, balanced indicator, indented header rows.                                                                                                                                                              | LL-107 | implemented |
| FR-052 | Produce income statement and balance sheet | Must     | Comparative periods; balance sheet ties to trial balance.                                                                                                                                                                               | LL-091 | pending     |
| FR-053 | Produce an indirect cash-flow statement    | Should   | Operating/investing/financing classification from account mapping.                                                                                                                                                                      | LL-093 | pending     |

### E13 — Web experience

| ID     | Requirement                         | Priority | Acceptance criteria                                                                     | Ticket | Status      |
| ------ | ----------------------------------- | -------- | --------------------------------------------------------------------------------------- | ------ | ----------- |
| FR-056 | Show planned sections in navigation | Should   | Sidebar lists planned modules with a Planned badge linking to a page naming the ticket. | LL-105 | implemented |

## Non-functional requirements

Targets are measurable; the verification method for each is described in [quality-attributes.md](../architecture/quality-attributes.md).

| ID      | Quality                            | Priority | Target / acceptance                                                                                                                                                                                                                          | Ticket | Status      |
| ------- | ---------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| NFR-001 | Money correctness                  | Must     | All amounts are bigint minor units; no floating point on any money path; one documented half-even rounding step per conversion. Verified by property tests (300+ random balanced entries).                                                   | LL-030 | implemented |
| NFR-002 | Ledger integrity under concurrency | Must     | 25 parallel posts yield contiguous numbers; a period close racing 20 posts leaves no posting in the closed period. Verified in concurrency.db.test.ts.                                                                                       | LL-031 | implemented |
| NFR-003 | Defence in depth                   | Must     | Balance, immutability and closed-period rules enforced by both application and database triggers.                                                                                                                                            | LL-032 | implemented |
| NFR-004 | Posting latency                    | Should   | p95 < 150 ms for a 10-line entry at 50 concurrent users on a 4 vCPU VM.                                                                                                                                                                      | LL-102 | pending     |
| NFR-005 | Trial balance latency              | Should   | p95 < 2 s for 1 M lines / 10 k accounts; < 300 ms for demo-size data (met today).                                                                                                                                                            | LL-096 | pending     |
| NFR-006 | Password storage                   | Must     | scrypt N=16384, r=8, p=1, 16-byte salt, parameters stored with the hash.                                                                                                                                                                     | LL-010 | implemented |
| NFR-007 | Session security                   | Must     | 256-bit random tokens; only HMAC-SHA256 hashes stored; HttpOnly, SameSite=Lax, Secure in production; 12 h TTL by default.                                                                                                                    | LL-011 | implemented |
| NFR-008 | Brute-force resistance             | Must     | Per-IP window (default 50/15 min), per-email backoff after 10 failures (30 s doubling to 1 h), 20 distinct emails per IP per window, 5 registrations per IP per window; bounded stores (10 k keys) evict least-time-left with a warning log. | LL-011 | implemented |
| NFR-009 | Proxy trust                        | Must     | TRUST_PROXY is false, a hop count or IP/CIDR list; `true` is rejected; unset in production fails startup.                                                                                                                                    | LL-011 | implemented |
| NFR-010 | Tenant isolation                   | Must     | Every query filters by organization; cross-tenant access returns 404; composite FKs prevent cross-entity rows.                                                                                                                               | LL-020 | implemented |
| NFR-011 | Auditability                       | Must     | 100 % of state-changing operations produce an audit event in the same transaction; trail is append-only.                                                                                                                                     | LL-013 | implemented |
| NFR-012 | Test coverage                      | Must     | Coverage thresholds enforced in CI: shared ≥ 90 % lines, API ≥ 80 % lines; currently ≈ 97–99 %.                                                                                                                                              | LL-001 | implemented |
| NFR-013 | No runtime third-party calls       | Must     | No outbound network access needed; email via local outbox, files on local disk.                                                                                                                                                              | LL-001 | implemented |
| NFR-014 | Portability                        | Must     | Runs on Node.js ≥ 22 and native PostgreSQL ≥ 15 on Linux/macOS; one command setup (./run.sh setup).                                                                                                                                          | LL-005 | implemented |
| NFR-015 | Observability                      | Should   | Structured JSON logs with request IDs, secrets redacted; x-request-id echoed on every response.                                                                                                                                              | LL-002 | implemented |
| NFR-016 | Availability                       | Should   | 99.5 % monthly for single-VM deployments; RPO ≤ 24 h via nightly pg_dump, RTO ≤ 2 h, restore drill each release.                                                                                                                             | LL-101 | pending     |
| NFR-017 | Accessibility                      | Should   | WCAG 2.2 AA for all screens; journal grid fully keyboard operable.                                                                                                                                                                           | LL-103 | pending     |
| NFR-018 | Scalability path                   | Could    | Throttle counters move to Postgres before running more than one API instance.                                                                                                                                                                | LL-100 | pending     |
| NFR-019 | Maintainability                    | Should   | Strict TypeScript, files < 400 lines, functions small; lint and format gates in CI.                                                                                                                                                          | LL-001 | implemented |
| NFR-020 | Input validation                   | Must     | Every boundary validated with zod; 1 MB body limit; invalid input returns 400 VALIDATION_ERROR with field paths.                                                                                                                             | LL-003 | implemented |

## Out of scope

Payroll, tax filing, AR/AP sub-ledgers, live bank feeds, payment initiation, and any hosted third-party service (see PRD §5).
