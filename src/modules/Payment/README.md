# Payment Module

## Purpose
Manages billing flows, receipts, payment transactions, refunds, and reconciliation.

## Key Classes
| Class               | Responsibility                                      |
| ------------------- | --------------------------------------------------- |
| `PaymentController` | Exposes payment and receipt endpoints.              |
| `PaymentService`    | Processes payments, refunds, and payment workflows. |
| `PaymentRepository` | Persists payment records.                           |
| `ReceiptService`    | Generates and formats receipts.                     |

## Ownership Rules
- Keep all payment rules in this module.
- Do not let payment logic leak into student or report modules.
- Use branch and tenant policies for access control.

**Module: Payment**

- **Scope:** Payment processing, transaction records, refunds, and reconciliation.

- **Folder structure:**
	- `application/` — payment workflows and reconciliation jobs
	- `domain/` — payment domain objects and rules
	- `infrastructure/` — payment gateway adapters and persistence
	- `presentation/` — payment endpoints and webhooks
	- `prisma/` — module Prisma models for transactions and receipts

- **Guidance:** Isolate gateway code behind adapters; ensure idempotency for webhooks and payment callbacks.

