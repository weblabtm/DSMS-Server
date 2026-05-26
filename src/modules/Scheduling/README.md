# Scheduling Module

## Purpose
Manages timetables, scheduling rules, calendar operations, and instructor allocation.

## Key Classes
| Class                  | Responsibility                               |
| ---------------------- | -------------------------------------------- |
| `SchedulingController` | Exposes scheduling endpoints.                |
| `SchedulingService`    | Creates and adjusts schedules.               |
| `SchedulingRepository` | Persists scheduling data.                    |
| `SchedulePolicy`       | Enforces branch and tenant scheduling rules. |

## Ownership Rules
- Keep all timetable changes here.
- Do not duplicate batch or attendance rules in this module.
- Use branch scope to prevent cross-branch schedule conflicts.

**Module: Scheduling**

- **Scope:** Timetables, calendar operations, and instructor/resource allocation.

- **Folder structure:**
	- `application/` — scheduling algorithms and conflict resolution
	- `domain/` — schedule entities and constraints
	- `infrastructure/` — calendar adapters and persistence
	- `presentation/` — scheduling APIs
	- `prisma/` — module Prisma models for schedules

- **Guidance:** Ensure atomic conflict checks and provide hooks for rescheduling consequences (notifications, attendance adjustments).

