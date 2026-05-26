# Batch Module

## Purpose
Manages class batches, batch lifecycle, and batch-related grouping rules.

## Key Classes
| Class             | Responsibility                              |
| ----------------- | ------------------------------------------- |
| `BatchController` | Exposes batch endpoints.                    |
| `BatchService`    | Handles batch lifecycle and business rules. |
| `BatchRepository` | Persists batch records.                     |
| `BatchPolicy`     | Controls access to batch actions.           |

## Ownership Rules
- Keep batch lifecycle rules here.
- Do not store scheduling or attendance rules in this module.
- Use this module as the batch source of truth.
