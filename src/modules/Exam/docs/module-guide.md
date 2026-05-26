# Exam Module Guide

Scope
- Exam scheduling, question sets, evaluation, and result storage.

Folder structure (required)
- `application/` — scoring services, `dtos/`, job orchestration
- `domain/` — exam entities and grading rules
- `infrastructure/` — storage and external adapters, `prisma/`
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Keep scoring deterministic and testable. Persist raw answers for audits.
