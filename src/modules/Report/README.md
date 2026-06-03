# Report Module

## Purpose
Produces analytics, summaries, exports, and dashboard views.

## Key Classes
| Class              | Responsibility                          |
| ------------------ | --------------------------------------- |
| `ReportController` | Exposes report endpoints.               |
| `ReportService`    | Builds report data from module queries. |
| `ReportRepository` | Runs read-optimized report queries.     |
| `ExportService`    | Exports data as PDF or CSV.             |

## Ownership Rules
- Keep read-only reporting logic here.
- Do not put write-side business rules in this module.
- Prefer composition from module services or repositories.

**Module: Report**

- **Scope:** Analytics, scheduled reports, exports, and dashboard aggregation.

- **Folder structure:**
	- `application/` — report builders and aggregation services
	- `domain/` — report definitions and DTOs
	- `infrastructure/` — read-optimized queries, caching adapters
	- `presentation/` — report endpoints and export handlers
	- `prisma/` — models or views used for reporting (if needed)

- **Guidance:** Keep reporting read-optimized; avoid heavy computations on request — use pre-aggregation.

