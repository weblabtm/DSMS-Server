# Tenant Module

## Purpose
Manages tenant identity, tenant boundaries, plans, and tenant-scoped operations.

## Key Classes
| Class                   | Responsibility                                                       |
| ----------------------- | -------------------------------------------------------------------- |
| `TenantController`      | Exposes tenant CRUD and tenant configuration endpoints.              |
| `TenantService`         | Orchestrates tenant creation, updates, activation, and deactivation. |
| `TenantRepository`      | Persists tenant data.                                                |
| `TenantPolicy`          | Enforces tenant-level access rules.                                  |
| `TenantSettingsService` | Manages tenant-specific configuration.                               |

## Ownership Rules
- Keep tenant lifecycle logic here.
- Enforce tenant isolation at this boundary.
- Avoid mixing global platform rules into tenant use cases.

**Module: Tenant**

- **Scope:** Tenant provisioning, isolation, tenant settings, and tenant lifecycle.

- **Folder structure:**
	- `application/` — tenant services and lifecycle orchestrators
	- `domain/` — tenant entities and constraints
	- `infrastructure/` — tenant storage and isolation adapters
	- `presentation/` — tenant management APIs
	- `prisma/` — module Prisma models for tenant metadata

- **Guidance:** Enforce isolation on queries and use tenant-aware middleware for requests.

