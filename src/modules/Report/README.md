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
