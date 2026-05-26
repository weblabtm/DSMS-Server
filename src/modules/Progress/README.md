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

**Module: Progress**

- **Scope:** Student progress tracking, milestones, and performance metrics.

- **Folder structure:**
	- `application/` — progress calculators and aggregation services
	- `domain/` — progress entities and metrics definitions
	- `infrastructure/` — persistence and analytic adapters
	- `presentation/` — progress APIs and dashboards
	- `prisma/` — module Prisma models for progress data

- **Guidance:** Keep aggregation logic efficient; prefer incremental updates for heavy data.

