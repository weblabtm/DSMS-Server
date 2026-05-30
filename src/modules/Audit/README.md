# Audit Module

## Purpose
Stores activity logs, change history, and security audit trails.

## Key Classes
| Class             | Responsibility                                   |
| ----------------- | ------------------------------------------------ |
| `AuditController` | Exposes audit search and audit export endpoints. |
| `AuditService`    | Records and queries audit events.                |
| `AuditRepository` | Persists audit trail entries.                    |
| `AuditLogger`     | Captures security and business audit events.     |

## Ownership Rules
- Keep audit logging here.
- Do not let audit concerns leak into business services.
- Treat audit records as immutable history.

**Module: Audit**

- **Scope:** Audit logs, event recording, and immutable change history for security and compliance.

- **Folder structure:**
	- `application/` — audit services and processors
	- `domain/` — audit event definitions and value objects
	- `infrastructure/` — write adapters (DB, external logging)
	- `presentation/` — endpoints for querying audit logs (read-only)
	- `prisma/` — Prisma models for audit events

- **Guidance:** Keep write path minimal and append-only; use background processors for heavy queries.

