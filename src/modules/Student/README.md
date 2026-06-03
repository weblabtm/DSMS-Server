# Student Module

## Purpose
Manages student profiles, enrollment, progress, and student lifecycle rules.

## Key Classes
| Class               | Responsibility                                    |
| ------------------- | ------------------------------------------------- |
| `StudentController` | Exposes student endpoints.                        |
| `StudentService`    | Creates, updates, enrolls, and manages students.  |
| `StudentRepository` | Persists student data.                            |
| `StudentPolicy`     | Controls self, branch, and tenant student access. |
| `EnrollmentService` | Handles student enrollment workflow.              |

## Ownership Rules
- Keep student lifecycle rules here.
- Do not store exam, payment, or attendance rules directly in this module.
- Student self-service should only expose safe fields.

**Module: Student**

- **Scope:** Student profiles, enrollment, and lifecycle management.

- **Folder structure:**
	- `application/` — enrollment and profile services
	- `domain/` — student entities and value objects
	- `infrastructure/` — persistence and external identity adapters
	- `presentation/` — student APIs
	- `prisma/` — module Prisma models for student data

- **Guidance:** Protect PII, validate enrollments, and keep enrollment business rules centralized.

