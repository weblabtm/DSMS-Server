# User Module

## Purpose
Manages accounts, identities, profiles, roles, and user lifecycle rules.

## Key Classes
| Class                   | Responsibility                                     |
| ----------------------- | -------------------------------------------------- |
| `UserController`        | Exposes user and profile HTTP endpoints.           |
| `UserService`           | Creates, updates, deactivates, and restores users. |
| `UserRepository`        | Persists user data.                                |
| `RoleAssignmentService` | Assigns and removes roles from users.              |
| `UserPolicy`            | Controls which users can be viewed or edited.      |

## Ownership Rules
- Keep identity and account rules here.
- Role assignment belongs here, but permission definitions belong in Auth.
- Do not embed tenant or student business rules directly in this module.

**Module: User**

- **Scope:** User accounts, profile management, and role assignment (high-level user concerns).

- **Folder structure:**
	- `application/` — user services, role assignment, and account flows
	- `domain/` — user entities and value objects
	- `infrastructure/` — persistence and external identity providers
	- `presentation/` — user APIs
	- `prisma/` — module Prisma models for users (if separate from Auth)

- **Guidance:** Keep authentication in `Auth` module; user profile and role assignment live here and integrate via DAOs.

