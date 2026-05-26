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
