# Architecture decision records

MADR format. Status is one of Proposed, Accepted, Superseded.

| ADR                                                       | Title                                                                                | Status   | Kind     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- | -------- |
| [0001](0001-modular-monolith-npm-workspaces.md)           | Modular monolith in npm workspaces                                                   | Accepted | Platform |
| [0002](0002-fastify-and-pg-without-orm.md)                | Fastify 5 and node-postgres without an ORM                                           | Accepted | Platform |
| [0003](0003-zod-at-boundaries-shared-schemas.md)          | Zod validation at every boundary with schemas in the shared package                  | Accepted | Platform |
| [0004](0004-postgres-sessions-csrf-double-submit.md)      | Server-side sessions in PostgreSQL with a CSRF double-submit token                   | Accepted | Platform |
| [0005](0005-forward-only-sql-migrations.md)               | Forward-only SQL migrations with checksums and an advisory lock                      | Accepted | Platform |
| [0006](0006-integer-minor-units-bankers-rounding.md)      | Money as integer minor units with banker's rounding                                  | Accepted | Domain   |
| [0007](0007-exchange-rates-as-rationals.md)               | Exchange rates as exact rationals with a single rounding step                        | Accepted | Domain   |
| [0008](0008-gapless-journal-numbering.md)                 | Gapless journal numbering with a locked counter row                                  | Accepted | Domain   |
| [0009](0009-group-wise-conversion-largest-remainder.md)   | Group-wise FX conversion with largest-remainder apportionment and a rounding account | Accepted | Domain   |
| [0010](0010-scrypt-password-hashing.md)                   | scrypt password hashing from node:crypto                                             | Accepted | Platform |
| [0011](0011-authentication-throttling-and-trust-proxy.md) | Authentication throttling and explicit proxy trust                                   | Accepted | Platform |
| [0012](0012-period-locking-and-deferred-invariants.md)    | Period locking with FOR SHARE / FOR UPDATE and deferred database invariants          | Accepted | Domain   |
| [0013](0013-audit-in-same-transaction.md)                 | Audit events written in the same transaction as the change                           | Accepted | Domain   |
| [0014](0014-consolidation-with-eliminations.md)           | Consolidation by aggregation with rule-based eliminations and NCI                    | Proposed | Domain   |
| [0015](0015-reconciliation-matching-scoring.md)           | Bank reconciliation matching by staged rules and scoring                             | Proposed | Domain   |
| [0016](0016-period-end-revaluation-method.md)             | Period-end revaluation of monetary balances with auto-reversal                       | Proposed | Domain   |
| [0017](0017-no-third-party-services-local-outbox.md)      | No third-party services; local outbox for notifications                              | Accepted | Platform |

17 ADRs, 9 of them domain-specific (accounting rules, ledger integrity and the financial audit trail).
