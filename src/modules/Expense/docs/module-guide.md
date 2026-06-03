# Expense Module Guide

Scope
- Expense submission, approvals, and accounting-related recording.

Folder structure (required)
- `application/` — approval workflows, `dtos/`, services
- `domain/` — expense entities and validation rules
- `infrastructure/` — persistence and external accounting adapters, `prisma/`
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Use transactions for approval state changes and keep audit trails for approvals.
