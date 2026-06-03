# Auth Module Guide

Scope
- Authentication, authorization, RBAC, sessions, tokens, and permission guards.

Folder structure (required)
- `application/` — `dtos/`, `services/` (`AuthService`, `SessionService`, `TokenService`), `dao/` interfaces
- `domain/` — `Permission`, `Role`, `UserRole`, VOs
- `infrastructure/` — `dao/` implementations (Prisma/InMemory), `prisma/`, seeders
- `presentation/` — `controllers/`, `mappers/`, `middleware/` (guards, auth)
- `docs/` — this file

Practical rules
- Controllers must be thin: delegate to `AuthService`.
- Keep token logic in `TokenService`. Keep session persistence in a `SessionService` or DAO.
- DAO interfaces in `application/dao/`; implement in `infrastructure/dao/`.

Prisma
- Place Auth models under `src/modules/Auth/prisma/*.prisma`. Use `upsert` in RBAC seeder.

Seeding
- Seed roles/permissions with idempotent upserts. Run from CI (see `migrate-and-seed.yml`).

Security notes
- Hash passwords (`bcryptjs`) in DAO implementations. Store only hashed refresh tokens.
- Use `crypto.randomUUID()` for token JTIs.

Coding-agent notes
- Follow SOLID: controllers, mappers, services, DAOs separated. Add unit tests for mappers and services.
