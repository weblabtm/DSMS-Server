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
