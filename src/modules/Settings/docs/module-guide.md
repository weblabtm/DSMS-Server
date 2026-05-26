# Settings Module Guide

Scope
- Application and tenant-level settings, feature flags, and configuration.

Folder structure (required)
- `application/` — settings service, validators, `dtos/`
- `domain/` — configuration VOs
- `infrastructure/` — persistence and external config adapters, `prisma/`
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Validate settings on write and cache frequently-read values.
