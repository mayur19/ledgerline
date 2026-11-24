# Ledgerline documentation

| Area         | Document                                                   | What it answers                                                                         |
| ------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Product      | [PRD](product/PRD.md)                                      | Why Ledgerline exists, who it serves, scope and success metrics                         |
|              | [Requirements](product/requirements.md)                    | Numbered functional (FR) and non-functional (NFR) requirements with acceptance criteria |
|              | [User stories](product/user-stories.md)                    | Epics and stories with Given/When/Then criteria                                         |
|              | [Traceability](product/requirements-traceability.md)       | FR → epic → ticket → module → test → status                                             |
| Architecture | [Overview](architecture/overview.md)                       | C4 diagrams, module boundaries, request lifecycle                                       |
|              | [Quality attributes](architecture/quality-attributes.md)   | Measurable NFR targets and how they are verified                                        |
|              | [ADRs](adr/README.md)                                      | Architecture decision records (MADR)                                                    |
| Design       | [System design](design/system-design.md)                   | State machines, sequences, posting and trial-balance algorithms, concurrency            |
|              | [Data model](design/data-model.md)                         | Full target ERD, table notes, indexes, migrated vs planned                              |
| API          | [API guide](api/README.md)                                 | Conventions, envelope, errors, auth, idempotency, curl examples                         |
|              | [OpenAPI 3.1](api/openapi.yaml)                            | Every operation, each marked `x-status: implemented` or `pending`                       |
| Security     | [Threat model](security/threat-model.md)                   | STRIDE, trust boundaries, mitigations, ASVS mapping                                     |
| Testing      | [Test strategy](testing/test-strategy.md)                  | Test pyramid, coverage, acceptance matrix                                               |
| Operations   | [Runbook](operations/runbook.md)                           | Configuration, migrate/seed, backup/restore, troubleshooting                            |
|              | [Deployment](operations/deployment.md)                     | systemd + nginx + native PostgreSQL, release and rollback                               |
| Planning     | [Roadmap](planning/roadmap.md)                             | Milestones M0–M8 with exit criteria                                                     |
|              | [Backlog](planning/backlog.md)                             | Every ticket with estimate, status and dependencies                                     |
|              | [Implementation status](planning/implementation-status.md) | What is done, what is stubbed, percentage by area                                       |
|              | [Risks](planning/risks.md)                                 | Risk register                                                                           |
| Reference    | [Glossary](glossary.md)                                    | Accounting and domain terms                                                             |
