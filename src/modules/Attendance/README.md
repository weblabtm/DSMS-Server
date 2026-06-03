# Attendance Module

## Purpose
Handles attendance marking, attendance history, approvals, and attendance rules.

## Key Classes
| Class                  | Responsibility                                              |
| ---------------------- | ----------------------------------------------------------- |
| `AttendanceController` | Exposes attendance entry, update, and history endpoints.    |
| `AttendanceService`    | Applies attendance business rules and orchestrates updates. |
| `AttendanceRepository` | Persists attendance records.                                |
| `AttendancePolicy`     | Decides who can mark or view attendance.                    |

## Ownership Rules

**Module: Attendance**

- **Scope:** Attendance tracking, class/session check-ins, and attendance records for students and instructors.

- **Folder structure:**
	- `application/` — services, DTOs, use-cases
	- `domain/` — domain value objects and entities
	- `infrastructure/` — DB DAO, adapters, external integrations
	- `presentation/` — controllers, routes
	- `prisma/` — Prisma model files for this module (e.g., `Attendance.prisma`)

- **Module structure & responsibilities:**
	- Keep business rules in `domain` and `application` layers.
	- Controllers in `presentation` should be thin and call `application` services.

- **OOP / SOLID guidance:**
	- Single Responsibility: one class per responsibility (e.g., `AttendanceService`, `AttendanceDao`).
	- Open/Closed: prefer composition over modifying existing services for new behaviors.
	- Liskov Substitution: depend on interfaces/abstract types for DAOs/services.
	- Interface Segregation: split large DAOs into focused interfaces.
	- Dependency Inversion: inject DAOs and external adapters into services.

- **Prisma usage:**
	- Place Prisma model files in `src/modules/Attendance/prisma/*.prisma`.
	- Do not run migrations from runtime; use the repo-level build script `npm run prisma:build-schema` and run migrations/seeds from CI.
	- Use `upsert` in seeders to make seeding idempotent.

- **Tests:** unit tests in `src/__tests__/` or `tests/unit/modules/Attendance`.

- **Tips for coding agents:**
	- Read the domain models first. Respect transaction boundaries and use Prisma transactions for multi-row writes.
