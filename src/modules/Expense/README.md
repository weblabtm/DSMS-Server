# Expense Module

## Purpose
Handles operational expense tracking, approvals, and spending workflows.

## Key Classes
| Class                    | Responsibility                               |
| ------------------------ | -------------------------------------------- |
| `ExpenseController`      | Exposes expense endpoints.                   |
| `ExpenseService`         | Orchestrates expense submission and updates. |
| `ExpenseRepository`      | Persists expense records.                    |
| `ExpenseApprovalService` | Handles approval and rejection logic.        |

## Ownership Rules
- Keep all expense rules here.
- Do not mix accounting logic from payroll into this module.
- Use branch or tenant access rules as needed.

**Module: Expense**

- **Scope:** Expense submission, approvals, and recording for accounting purposes.

- **Folder structure:**
	- `application/` — expense workflows, approval orchestrators
	- `domain/` — expense entities and validation rules
	- `infrastructure/` — persistence and external accounting adapters
	- `presentation/` — expense APIs
	- `prisma/` — module Prisma models if required

- **Guidance:** Use atomic transactions for approval state changes and ensure audit trails for approvals.

