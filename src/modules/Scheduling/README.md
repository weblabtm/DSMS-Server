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
