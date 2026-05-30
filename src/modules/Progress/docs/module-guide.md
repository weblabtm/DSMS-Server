# Progress Module Guide

Scope
- Student progress tracking, milestones, and performance metrics.

Folder structure (required)
- `application/` — progress calculators, aggregators, `dtos/`
- `domain/` — progress entities and metric definitions
- `infrastructure/` — persistence, analytic adapters, `prisma/`
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Prefer incremental updates for heavy data and keep aggregation efficient.
