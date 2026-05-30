# Batch Module Guide

Scope
- Batch operations, bulk imports/exports, and scheduled background jobs.

Folder structure (required)
- `application/` — job orchestrators, `dtos/`, and `services/`
- `domain/` — job payloads and VOs
- `infrastructure/` — queue adapters, file parsers, `prisma/`
- `presentation/` — controllers, mappers, middleware to trigger jobs
- `docs/` — this file

Practical rules
- Make batch handlers idempotent and resumable. Persist job state.

Prisma
- Module prisma fragments (if needed) under `src/modules/Batch/prisma/`.
