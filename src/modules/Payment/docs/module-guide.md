# Payment Module Guide

Scope
- Payment processing, transaction records, refunds, and reconciliation.

Folder structure (required)
- `application/` — payment workflows, `dtos/`, services
- `domain/` — payment entities and rules
- `infrastructure/` — gateway adapters, persistence, `prisma/`
- `presentation/` — controllers, mappers, middleware (webhooks)
- `docs/` — this file

Practical rules
- Isolate gateway code behind adapters; ensure idempotency for webhooks and callbacks.
