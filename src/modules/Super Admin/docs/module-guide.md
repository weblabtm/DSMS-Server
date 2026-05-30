# Super Admin Module Guide

Scope
- Platform-level administration, tenant provisioning, and global policies.

Folder structure (required)
- `application/` — tenant provisioning and platform services, `dtos/`
- `domain/` — platform-level entities and policies
- `infrastructure/` — cross-tenant persistence, `prisma/`
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Restrict access strictly; ensure actions are auditable and reversible where possible.
