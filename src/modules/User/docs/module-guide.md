# User Module Guide

Scope
- User accounts, profile management, and role assignment.

Folder structure (required)
- `application/` — user services, role assignment, `dtos/`
- `domain/` — user entities and VOs
- `infrastructure/` — persistence and external identity providers, `prisma/`
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Keep authentication concerns in `Auth` module; profile and role assignment belong here.
