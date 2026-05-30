# Scheduling Module Guide

Scope
- Timetables, calendar operations, and instructor/resource allocation.

Folder structure (required)
- `application/` — scheduling algorithms, conflict resolution, `dtos/`
- `domain/` — schedule entities and constraints
- `infrastructure/` — calendar adapters, `prisma/`
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Ensure atomic conflict checks and provide hooks for rescheduling consequences.
