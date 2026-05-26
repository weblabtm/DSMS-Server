# Super Admin Module

## Purpose
Handles platform-wide administration, tenant oversight, and root-level controls.

## Key Classes
| Class                  | Responsibility                                    |
| ---------------------- | ------------------------------------------------- |
| `SuperAdminController` | Exposes global administration endpoints.          |
| `SuperAdminService`    | Orchestrates cross-tenant administration actions. |
| `PlatformPolicy`       | Enforces root-level access control.               |

## Ownership Rules
- Keep platform-only logic here.
- Do not duplicate tenant or branch logic in this module.
- All actions here should be limited to Super Admin users.

**Module: Super Admin**

- **Scope:** Platform-level administration, tenant provisioning, and global policies.

- **Folder structure:**
	- `application/` — tenant provisioning and platform services
	- `domain/` — platform-level entities and policies
	- `infrastructure/` — cross-tenant persistence adapters
	- `presentation/` — super-admin APIs
	- `prisma/` — module Prisma models for platform data

- **Guidance:** Restrict access strictly; ensure actions are auditable and reversible where possible.

