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
