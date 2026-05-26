# Attendance Module Guide

Scope
- Attendance tracking, class/session check-ins, and attendance records for students and instructors.

Folder structure (required)
- `application/` — services, `dtos/`, `services/`, and `dao/` (interfaces)
- `domain/` — domain entities and value objects
- `infrastructure/` — `dao/` implementations, `prisma/` fragments, adapters
- `presentation/` — `controllers/`, `mappers/`, `middleware/`
- `docs/` — this file

Practical rules
- Controllers must be thin: map HTTP → DTOs, call application services, return responses.
- Mapping logic belongs in `mappers/` (request ↔ DTO and DTO ↔ response).
- Business logic belongs to `application/services` and `domain` objects — not controllers.
- DAO interfaces in `application/dao/`; implementations in `infrastructure/dao/`.

Prisma
- Put Prisma model fragments in `src/modules/Attendance/prisma/*.prisma`.
- Do not run migrations at runtime; CI handles migrations and seeding.

Tests & CI
- Unit tests under `tests/unit/modules/Attendance` or `src/__tests__`.
- Integration tests that need DB should be gated by `DATABASE_URL` and run in CI.

Coding-agent notes
- Follow SOLID. Use `upsert` for seeders. Respect module boundaries.
