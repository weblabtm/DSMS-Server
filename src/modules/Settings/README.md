# Settings Module

## Purpose
Manages application settings, tenant preferences, and feature controls.

## Key Classes
| Class                | Responsibility                     |
| -------------------- | ---------------------------------- |
| `SettingsController` | Exposes settings endpoints.        |
| `SettingsService`    | Reads and updates settings.        |
| `SettingsRepository` | Persists configuration data.       |
| `FeatureFlagService` | Enables or disables feature flags. |

## Ownership Rules
- Keep configuration logic here.
- Avoid duplicating settings across other modules.
- Use tenant scope where settings are tenant-specific.

**Module: Settings**

- **Scope:** Application and tenant-level settings, feature flags, and environment-driven configuration.

- **Folder structure:**
	- `application/` — settings service and validation
	- `domain/` — configuration value objects
	- `infrastructure/` — persistence and external config adapters
	- `presentation/` — settings APIs
	- `prisma/` — module Prisma models for settings (if persisted)

- **Guidance:** Validate settings on write and cache frequently-read values.

