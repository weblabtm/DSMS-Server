# Auth Module

## Purpose
Handles login, token issuance, permission checks, and access control workflows.

## Key Classes
| Class               | Responsibility                                                           |
| ------------------- | ------------------------------------------------------------------------ |
| `AuthController`    | Exposes HTTP endpoints for login, logout, refresh, and session actions.  |
| `AuthService`       | Coordinates authentication, token creation, and authorization decisions. |
| `TokenService`      | Creates and verifies access and refresh tokens.                          |
| `PermissionGuard`   | Verifies whether a role can execute a requested action.                  |
| `RoleMatrix`        | Maps roles to allowed permissions.                                       |
| `PermissionCatalog` | Keeps the canonical list of permission keys.                             |

## Ownership Rules
- Keep authentication logic here.
- Do not put business rules from other modules here.
- Use this module as the source of truth for RBAC.
