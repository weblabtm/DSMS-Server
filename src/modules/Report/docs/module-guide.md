# Report Module Guide

Scope
- Analytics, scheduled reports, exports, and dashboard aggregation.

Folder structure (required)
- `application/` — report builders, `dtos/`, aggregation services
- `domain/` — report definitions and DTOs
- `infrastructure/` — read-optimized queries, caching, `prisma/`
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Keep reporting read-optimized; prefer pre-aggregation and caching for heavy reports.
