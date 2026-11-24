# User stories

Stories are grouped by epic (see [backlog.md](../planning/backlog.md)). Acceptance criteria use Given/When/Then. Status: **done** = shipped on `main`, **planned** = pending ticket.

## E01 Foundation & tooling

### US-001 One-command local setup (LL-005) — done

As a developer I want one command to prepare my machine so that I can run Ledgerline in minutes.

- **Given** Node.js 22 and a local PostgreSQL server reachable on the `/tmp` socket
- **When** I run `./run.sh setup`
- **Then** `.env` is created with a random `SESSION_SECRET`, `ledgerline_dev` and `ledgerline_test` exist, migrations are applied and demo data is loaded, and re-running is a no-op.

### US-002 Planned features are discoverable (LL-003) — done

As an integrator I want the full API surface to exist today so that I can build against it.

- **Given** I am signed in
- **When** I call a planned endpoint such as `POST /entities/{id}/revaluations`
- **Then** I receive `501 NOT_IMPLEMENTED` with `details.ticket = "LL-052"`.

## E02 Identity, access & audit

### US-010 Register an organization (LL-010) — done

As a CFO I want to create my organization so that my team can start.

- **Given** the sign-up form
- **When** I submit organization name, my name, email and a 12+ character password
- **Then** I get `202` with a generic message and can sign in; **and given** the email already exists, **then** the response is byte-for-byte the same and the existing account is untouched.

### US-011 Sign in safely (LL-011) — done

As a user I want my account protected from guessing.

- **Given** 10 failed attempts for my email from any IPs
- **When** another attempt arrives
- **Then** it is refused with `429` and `Retry-After` of 30 s, doubling with each further failure up to 1 h, and a successful login resets the counter.
- **Given** 12 wrong-password requests sent in parallel with a budget of 2
- **When** they are processed
- **Then** at most 3 reach password verification and the rest get `429`.

### US-012 Stop password spraying (LL-011) — done

As a security officer I want one address to be unable to try many accounts.

- **Given** an IP (or IPv6 /64) that already tried 20 distinct emails this window
- **When** it tries a 21st
- **Then** it gets `429`, while the same email from another network still works.

### US-013 Least privilege (LL-012) — done

As an owner I want roles to limit what people can do.

- **Given** I am an auditor
- **When** I try to create a journal or an account
- **Then** I get `403`, but I can read journals, accounts and reports.

### US-014 Audit everything (LL-013) — done

As an auditor I want a trail of every change.

- **Given** an account was renamed
- **When** I query `/audit-events?targetId={accountId}`
- **Then** I see `account.updated` with the previous name, the actor and the request id, and nobody can edit or delete the event.

### US-015 Invite colleagues (LL-014) — planned

- **Given** I am an admin **When** I invite `sam@corp.example` as accountant **Then** an invitation is written to the local outbox and Sam can set a password once.

### US-016 Verified sign-up (LL-120) — planned

- **Given** I registered **When** I open the confirmation link from the outbox **Then** my organization becomes active.

### US-017 Two-factor authentication (LL-018) — planned

- **Given** 2FA is required for controllers **When** a controller signs in **Then** a valid TOTP code is required after the password.

## E03 Entities & chart of accounts

### US-020 Add a legal entity (LL-020, LL-022, LL-023) — done

As a controller I want to add a subsidiary with its own currency.

- **Given** I create `NW-UK` with functional currency GBP and time zone `europe/london`
- **When** the entity is saved
- **Then** it has the standard chart, an FX rounding account and a retained-earnings account, and the time zone is stored as `Europe/London`.

### US-021 Keep the chart consistent (LL-021) — done

- **Given** `1000 Assets` is a header and `1100` is its child
- **When** I try to make `1000` a child of `1100`
- **Then** I get `422 ACCOUNT_CYCLE`; **and when** I try to attach an expense account under an asset header **then** `422 ACCOUNT_PARENT_TYPE_MISMATCH`.

### US-022 Currency-restricted bank accounts (LL-021) — done

- **Given** account `1115 EUR Operating Account` accepts only EUR
- **When** a USD line is posted to it
- **Then** the entry is rejected with `ACCOUNT_CURRENCY_MISMATCH`.

### US-023 Import a chart (LL-024) — planned

- **Given** a CSV of 400 accounts **When** I run a dry-run import **Then** I see every invalid row before anything is written.

## E04 Journals & posting engine

### US-030 Post a balanced entry (LL-030, LL-031) — done

As an accountant I want to post an entry and get a stable reference.

- **Given** an open period covering 2026-02-25
- **When** I post Dr 6300 310.25 / Cr 2100 310.25
- **Then** it is posted with the next number `NW-US-2026-000007` and appears in the trial balance.

### US-031 Understand rejections (LL-030) — done

- **Given** an entry with a header account on line 2 and an amount of `100.005` USD
- **When** I post it
- **Then** I receive `422 JOURNAL_INVALID` listing both problems with line numbers.

### US-032 Foreign-currency entries (LL-030) — done

- **Given** a EUR/USD spot rate of 1.041 on 2026-02-02
- **When** I post EUR 1,000.00 on 2026-02-27
- **Then** functional amounts are USD 1,041.00 and the rate is stored on each line.
- **Given** two foreign sides that each round half a cent up
- **When** I post the entry
- **Then** a one-cent line to the FX rounding account balances it; a two-cent difference is rejected as unbalanced.

### US-033 Safe retries (LL-031) — done

- **Given** my network dropped after I clicked Post
- **When** the client retries with the same `Idempotency-Key`
- **Then** I get the original entry (`Idempotent-Replayed: true`), never a duplicate.

### US-034 Drafts (LL-031) — done

- **Given** a saved draft whose expense account was later deactivated
- **When** I post the draft
- **Then** it is re-validated and rejected with `ACCOUNT_INACTIVE`.

### US-035 Tamper-proof history (LL-032) — done

- **Given** a posted entry
- **When** anyone runs `UPDATE journal_lines ...` directly in the database
- **Then** PostgreSQL raises `LL002` and nothing changes.

### US-036 Live balance while typing (LL-034) — done

- **Given** I typed a 250.00 debit
- **When** I have not yet entered the credit
- **Then** the balance bar shows `Out by 250.00`, turning to `Balanced` once the credit matches.

### US-037 Reverse a mistake (LL-035) — planned

- **Given** a posted entry in a closed period **When** I reverse it **Then** the reversal is dated in the first open period and both entries are linked.

### US-038 Drill down (LL-038) — planned

- **Given** a trial balance row **When** I open it **Then** I see the account's lines with running balance.

## E05 Periods & close

### US-040 Open a fiscal year (LL-040) — done

- **Given** an entity **When** I generate FY2027 starting 2027-01 **Then** 12 contiguous monthly periods exist and generating 2027-06 again returns `409 PERIOD_OVERLAP`.

### US-041 Soft-close for late adjustments (LL-040) — done

- **Given** January is soft-closed
- **When** an accountant posts into January **Then** `403 PERIOD_SOFT_CLOSED`; **when** a controller posts **then** it succeeds.

### US-042 Close safely under load (LL-040) — done

- **Given** postings are in flight for April
- **When** the controller closes April
- **Then** every posting either committed before the close or fails with `PERIOD_CLOSED`.

### US-043 Close checklist (LL-041) — planned

- **Given** required tasks are not signed off **When** I close the period **Then** the close is refused listing the open tasks.

### US-044 Year-end close (LL-042) — planned

- **Given** FY2026 is complete **When** I run year-end close **Then** P&L balances move to retained earnings and the year is locked.

## E06 Multi-currency & revaluation

### US-050 Maintain rates (LL-050) — done

- **Given** a USD→JPY quote of 149.20 **When** a JPY entry is posted in a USD entity **Then** the rate is inverted exactly (150,000 JPY → USD 1,005.36).

### US-051 Month-end revaluation (LL-052) — planned

- **Given** a EUR bank balance and a new closing rate **When** I run revaluation **Then** an unrealized gain/loss entry posts and reverses on day 1 of next period.

## E07 Intercompany & consolidation

### US-060 Record an intercompany charge (LL-060) — planned

- **Given** NW-US charges NW-DE EUR 10,000 **When** I record it once **Then** due-from in NW-US and due-to in NW-DE are posted with a shared reference.

### US-061 Consolidate (LL-062, LL-063, LL-064) — planned

- **Given** a group with a 70 %-owned subsidiary **When** I run consolidation **Then** intercompany balances eliminate to zero and NCI shows 30 % of the subsidiary's equity.

## E08 Bank import & reconciliation

### US-070 Import a statement (LL-071, LL-072) — planned

- **Given** an OFX file **When** I import it **Then** lines are parsed without external services and a repeated import is detected.

### US-071 Auto-match (LL-073) — planned

- **Given** statement and ledger lines **When** I run auto-match **Then** exact and near matches are proposed with scores for confirmation.

## E09 Approvals & notifications

### US-080 Approve large entries (LL-080, LL-081) — planned

- **Given** a policy requiring approval above USD 50,000 **When** an accountant submits such an entry **Then** an approver other than the preparer must approve before it posts.

## E10 Recurring & reversing journals

### US-085 Monthly rent template (LL-085, LL-086) — planned

- **Given** a monthly template **When** the job runs after a two-month outage **Then** both missing entries are created exactly once.

## E11 Financial reporting

### US-090 Trial balance (LL-090, LL-107) — done

- **Given** FY2025 ended with USD 63,000 profit
- **When** I view the FY2026 trial balance
- **Then** revenue and expense accounts open at zero, retained earnings opens at a 63,000 credit, and totals balance.

### US-091 Financial statements (LL-091, LL-092, LL-093) — planned

- **Given** posted activity **When** I open the balance sheet **Then** assets equal liabilities plus equity and tie to the trial balance.

## E12 Operations, performance & platform

### US-100 Multi-instance readiness (LL-100) — planned

- **Given** two API instances **When** an attacker alternates between them **Then** throttle counters stored in Postgres still apply.

### US-101 Restore drill (LL-101) — planned

- **Given** last night's `pg_dump` **When** I follow the runbook **Then** a fresh server is serving within 2 hours.

## E13 Web experience

### US-105 Navigate the product (LL-105) — done

- **Given** I am signed in **When** I open the sidebar **Then** implemented screens are links and planned modules show a "Planned" badge naming their ticket.

### US-106 Keyboard-first journal grid (LL-103) — planned

- **Given** the journal editor **When** I use only the keyboard **Then** I can add lines, move between cells and post.
