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
