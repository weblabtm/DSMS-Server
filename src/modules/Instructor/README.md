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
