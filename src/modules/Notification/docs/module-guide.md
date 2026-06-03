# Notification Module Guide

Scope
- Template management, delivery pipelines (email, SMS), and notification history.

Folder structure (required)
- `application/` — delivery services, queues, `dtos/`
- `domain/` — template VOs and notification types
- `infrastructure/` — SMTP/SMS adapters, persistence, `prisma/`
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Use durable queues and async delivery for external providers; store delivery receipts.
