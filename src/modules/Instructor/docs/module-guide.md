# Instructor Module Guide

Scope
- Instructor profiles, teaching assignments, and instructor-specific workflows.

Folder structure (required)
- `application/` — assignment services, `dtos/`, services
- `domain/` — instructor entities and VOs
- `infrastructure/` — persistence, `prisma/`, external directory adapters
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Keep assignment logic transactional and validate availability before persisting.
