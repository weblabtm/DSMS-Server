# Lead Module Guide

Scope
- Lead capture, qualification, and conversion workflows.

Folder structure (required)
- `application/` — lead workflows, `dtos/`, services
- `domain/` — lead entities and rules
- `infrastructure/` — persistence and CRM adapters, `prisma/`
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Keep conversion explicit and transactional; add audit entries on conversion.
