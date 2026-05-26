# Progress Module

## Purpose
Tracks student progress, milestones, and performance-related metrics.

## Key Classes
| Class                | Responsibility                       |
| -------------------- | ------------------------------------ |
| `ProgressController` | Exposes progress endpoints.          |
| `ProgressService`    | Calculates and stores progress data. |
| `ProgressRepository` | Persists progress records.           |
| `ProgressPolicy`     | Controls who can view progress.      |

## Ownership Rules
- Keep progress calculation logic here.
- Avoid duplicating exam or attendance logic in this module.
- Allow self-view for students and scoped view for staff roles.
