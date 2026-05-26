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
