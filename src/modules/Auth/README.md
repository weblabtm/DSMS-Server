# Auth Module

## Purpose
Handles login, token issuance, permission checks, and access control workflows.

## Key Classes
| Class               | Responsibility                                                           |
| ------------------- | ------------------------------------------------------------------------ |
| `AuthController`    | Exposes HTTP endpoints for login, logout, refresh, and session actions.  |
| `AuthService`       | Coordinates authentication, token creation, and authorization decisions. |
| `TokenService`      | Creates and verifies access and refresh tokens.                          |
| `PermissionGuard`   | Verifies whether a role can execute a requested action.                  |
| `RoleMatrix`        | Maps roles to allowed permissions.                                       |
| `PermissionCatalog` | Keeps the canonical list of permission keys.                             |

## Ownership Rules
- Keep authentication logic here.
- Do not put business rules from other modules here.
- Use this module as the source of truth for RBAC.

**Module: Auth**

- **Scope:** Authentication, authorization, RBAC, sessions, tokens, and permission guards.

- **Folder structure:**
	- `application/` — services (`AuthService`, `SessionService`, `TokenService`), DTOs, guards
	- `domain/` — permission, role and user value objects
	- `infrastructure/` — DAOs (Prisma/InMemory), session store, seeders
	- `presentation/` — controllers, routes and route registrars
	- `prisma/` — Prisma models for Auth (module-local `prisma/*.prisma`)

- **Prisma usage:**
	- Store module Prisma model files under `src/modules/Auth/prisma/`.
	- The repo-level `scripts/build-prisma-schema.js` will include these files when building `prisma/schema.prisma`.
	- Run `prisma migrate deploy` and seeders from CI (see `.github/workflows/migrate-and-seed.yml`).

- **SOLID / OOP guidelines:**
	- Keep token logic in `TokenService` (SRP).
	- Depend on `AuthDao` interface so implementations (InMemory / Prisma) are swappable.
	- Keep controllers thin; apply guards via middleware.

- **Seeding:** Use `src/scripts/seed-rbac.ts` (idempotent upserts) and run via CI.

**Routes:**
- Module routes are declared under `src/modules/Auth/presentation/routes/` and mounted at the base path `/auth` by the application. Controllers include per-method route comments indicating the HTTP verb and path.

---

For detailed information on the OTP flow, API endpoints, and local CLI testing, refer to the [OTP Guide](file:///c:/Users/sadee/Documents/weblabtm/sadeeshaweblabtm/DSMS-Server/src/modules/Auth/docs/otp-guide.md).

