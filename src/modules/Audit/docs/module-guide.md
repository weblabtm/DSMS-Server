# Audit Module Guide

Scope
- Audit logs, event recording, and immutable change history for security and compliance.

Folder structure (required)
- `application/` — audit services and processors
- `domain/` — audit event definitions and VOs
- `infrastructure/` — persistence adapters, `prisma/`, external sinks
- `presentation/` — controllers, mappers, middleware for read-only access
- `docs/` — this file

Practical rules
- Treat audit records as append-only; prefer write-only APIs and separate read paths.
- Keep heavy query work out of the write path; use background processors.

Prisma
- Put audit model fragments under `src/modules/Audit/prisma/`.

Tests & CI
- Integration tests should verify audit writes and immutability.

Coding-agent notes
- Ensure audit entries include provenance (who/when) and are idempotent-safe.
