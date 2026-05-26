# Exam Module

## Purpose
Manages exams, exam schedules, evaluations, and results.

## Key Classes
| Class            | Responsibility                               |
| ---------------- | -------------------------------------------- |
| `ExamController` | Exposes exam endpoints.                      |
| `ExamService`    | Manages exam lifecycle and evaluation rules. |
| `ExamRepository` | Persists exam records.                       |
| `ResultService`  | Processes and stores exam results.           |

## Ownership Rules
- Keep exam logic isolated here.
- Do not mix result calculation with payment or attendance rules.
- Use branch or tenant scope as required by the business rule.
