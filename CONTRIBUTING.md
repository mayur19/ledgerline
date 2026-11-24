# Contributing

## Setup

```bash
./run.sh setup   # Node 22+, native PostgreSQL 15+ required
./run.sh dev
```

## Workflow

1. Pick a ticket from [docs/planning/backlog.md](docs/planning/backlog.md) (or its GitHub issue).
2. Write the failing test first. Domain logic belongs in `packages/shared` as pure functions. API behaviour gets an integration test in `apps/api/test/*.db.test.ts` against a real database.
3. Implement, keeping files under ~400 lines and functions small. Return new objects; do not mutate inputs.
4. When the change alters a decision or behaviour, update the docs too: requirements, OpenAPI `x-status`, implementation status and ADRs.
5. Run `./run.sh check` before pushing. CI runs the same steps.

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`).
- **Money:** always integer minor units (`bigint`), parsed from decimal strings and never JavaScript numbers. Divisions go through `divideHalfEven`.
- **Database:** add a new numbered migration and never edit an applied one; the runner checks checksums. Every query is scoped by `organization_id`, directly or through the entity gate.
- **API:** every response uses the `{ data, error, meta }` envelope and every input is validated with zod. Pending endpoints stay registered and return `501` with their ticket.
- **Security:** no secrets in code, logs or fixtures. Report vulnerabilities privately (see [SECURITY.md](SECURITY.md)).

## Tests

```bash
./run.sh test                     # all workspaces, real Postgres
npm run test:coverage             # with thresholds (shared 90%, api 80%)
npm run test -w @ledgerline/shared
```
