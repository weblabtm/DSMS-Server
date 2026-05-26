# Attendance Module

## Purpose
Handles attendance marking, attendance history, approvals, and attendance rules.

## Key Classes
| Class                  | Responsibility                                              |
| ---------------------- | ----------------------------------------------------------- |
| `AttendanceController` | Exposes attendance entry, update, and history endpoints.    |
| `AttendanceService`    | Applies attendance business rules and orchestrates updates. |
| `AttendanceRepository` | Persists attendance records.                                |
| `AttendancePolicy`     | Decides who can mark or view attendance.                    |

## Ownership Rules
- Keep attendance state changes here.
- Do not mix attendance reporting with payment or scheduling logic.
- Use policies to control branch and role access.
