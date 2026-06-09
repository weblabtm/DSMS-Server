# Notification Module

## Purpose
Handles external notifications (SMS, Email) through a fully decoupled, provider-agnostic pipeline. All delivery is asynchronous and durable — messages are persisted before dispatch and retried with exponential backoff on failure.

## Key Classes

| Class | Layer | Responsibility |
|---|---|---|
| `SmsNotification` | Domain | SMS payload: recipient, body, tenantId, branchId, **senderName** |
| `EmailNotification` | Domain | Email payload: recipient, body, subject, tenantId, branchId |
| `SmsNotificationSender` | Application | Polymorphic sender for SMS — delegates to `SmsNotificationService` |
| `EmailNotificationSender` | Application | Polymorphic sender for Email — delegates to `EmailNotificationService` |
| `SmsNotificationService` | Application | Queues SMS, resolves sender name, manages retries |
| `EmailNotificationService` | Application | Queues email, manages retries |
| `ITenantNameResolver` | Application (port) | Interface owned by this module for tenant name lookup — fulfilled externally |
| `TwilioSmsProvider` | Infrastructure | Sends SMS via Twilio REST API. Supports alphanumeric sender IDs |
| `ConsoleSmsProvider` | Infrastructure | Dev-mode mock — logs SMS to console, simulates Twilio callbacks |

## Ownership Rules

- **No HTTP endpoints are exposed** by this module for triggering notifications. All integration is via in-app method calls only (`SmsNotificationSender.send(notification)`).
- **No direct imports of other modules.** The Notification module depends on the `ITenantNameResolver` interface it owns — not on `TenantService` or `prisma.tenant` directly.
- Notifications should be triggered by domain events or service calls from other modules, not by duplicating business logic here.
- Always use async delivery with the queuing service. Never call the provider directly from business code.

## How to Send a Notification (Quick Reference)

```typescript
// SMS — with tenant branding
const sms = new SmsNotification(phone, body, tenantId, branchId, tenantName);
await smsSender.send(sms);

// Email
const email = new EmailNotification(emailAddress, htmlBody, subject, tenantId, branchId);
await emailSender.send(email);
```

See [`docs/developer-guide.md`](./docs/developer-guide.md) for the full guide with patterns, examples, and environment variable reference.

## Folder Structure

- `application/` — delivery services, queuing logic, `ITenantNameResolver` port
- `domain/` — `Notification`, `SmsNotification`, `EmailNotification` value objects
- `infrastructure/` — SMS and Email provider adapters (`TwilioSmsProvider`, `ConsoleSmsProvider`, etc.)
- `presentation/` — webhook callback controllers and status endpoints
- `prisma/` — `SmsMessage`, `EmailMessage` Prisma models
- `docs/` — developer guide and module guide
