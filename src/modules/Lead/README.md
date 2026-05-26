# Lead Module

## Purpose
Tracks enquiries, lead qualification, conversion, and follow-up workflows.

## Key Classes
| Class            | Responsibility                                 |
| ---------------- | ---------------------------------------------- |
| `LeadController` | Exposes lead endpoints.                        |
| `LeadService`    | Manages lead lifecycle and status transitions. |
| `LeadRepository` | Persists lead records.                         |
| `LeadPolicy`     | Controls who can view or modify leads.         |

## Ownership Rules
- Keep lead pipeline logic here.
- Do not mix lead handling with student enrollment until conversion is explicit.
- Apply branch access rules to lead data.
