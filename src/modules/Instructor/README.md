# Instructor Module

## Purpose
Manages instructor profiles, teaching assignments, and instructor-specific workflows.

## Key Classes
| Class                       | Responsibility                             |
| --------------------------- | ------------------------------------------ |
| `InstructorController`      | Exposes instructor endpoints.              |
| `InstructorService`         | Creates and updates instructor data.       |
| `InstructorRepository`      | Persists instructor records.               |
| `TeachingAssignmentService` | Assigns instructors to batches or classes. |
| `InstructorPolicy`          | Enforces assigned-data access rules.       |

## Ownership Rules
- Keep instructor profile and assignment logic here.
- Do not mix student or attendance persistence concerns into this module.
- Prefer assigned-scope checks for instructor access.

**Module: Instructor**

- **Scope:** Instructor profiles, teaching assignments, and instructor-related permissions.

- **Folder structure:**
	- `application/` — assignment services, profile management
	- `domain/` — instructor entities and value objects
	- `infrastructure/` — persistence and external directory adapters
	- `presentation/` — instructor APIs
	- `prisma/` — module Prisma models for instructor data

- **Guidance:** Keep assignment logic transactional and validate availability before persisting assignments.

