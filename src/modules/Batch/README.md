# Batch Module

## Purpose
Manages class batches, batch lifecycle, and batch-related grouping rules.

## Key Classes
| Class             | Responsibility                              |
| ----------------- | ------------------------------------------- |
| `BatchController` | Exposes batch endpoints.                    |
| `BatchService`    | Handles batch lifecycle and business rules. |
| `BatchRepository` | Persists batch records.                     |
| `BatchPolicy`     | Controls access to batch actions.           |

## Ownership Rules
- Keep batch lifecycle rules here.
- Do not store scheduling or attendance rules in this module.
- Use this module as the batch source of truth.

**Module: Batch**

- **Scope:** Batch operations, bulk imports/exports, and scheduled background jobs for large data updates.

- **Folder structure:**
	- `application/` — batch workers, job orchestrators
	- `domain/` — batch job types and payload definitions
	- `infrastructure/` — queue adapters, file parsers, DB writes
	- `presentation/` — endpoints to trigger or check batch status
	- `prisma/` — module Prisma models if needed

- **Guidance:** Use idempotent job handlers, persist job state, and use transactions for multi-row operations.

