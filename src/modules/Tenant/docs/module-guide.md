# Tenant Module Guide

Scope
- Tenant provisioning, isolation, tenant settings, and lifecycle.

Folder structure (required)
- `application/` — tenant services and lifecycle orchestrators, `dtos/`
- `domain/` — tenant entities and constraints
- `infrastructure/` — tenant storage and isolation adapters, `prisma/`
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Enforce tenant isolation on queries and use tenant-aware middleware for requests.
- Resolve tenant context from the incoming hostname before auth and controller logic runs.
- Keep the public client config response aligned with the request host so web and mobile apps can derive the correct API base URL.
