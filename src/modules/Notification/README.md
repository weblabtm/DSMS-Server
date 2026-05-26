# Notification Module

## Purpose
Handles in-app and external notifications, templates, and delivery rules.

## Key Classes
| Class                    | Responsibility                                      |
| ------------------------ | --------------------------------------------------- |
| `NotificationController` | Exposes notification endpoints.                     |
| `NotificationService`    | Sends notifications and manages delivery workflows. |
| `NotificationRepository` | Persists notification records.                      |
| `TemplateService`        | Manages reusable notification templates.            |

## Ownership Rules
- Keep notification content and delivery logic here.
- Avoid embedding business workflows from other modules into notifications.
- Notifications should be triggered by events, not direct rule duplication.
