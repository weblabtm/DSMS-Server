# Student Module Guide

Scope
- Student profiles, enrollment, and lifecycle management.

Folder structure (required)
- `application/` — enrollment and profile services, `dtos/`
- `domain/` — student entities and VOs
- `infrastructure/` — persistence, identity adapters, `prisma/`
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Protect PII and validate enrollments. Keep enrollment business rules centralized.
