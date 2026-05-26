# Payroll Module

## Purpose
Manages salary calculations, payroll runs, payslips, and payroll workflows.

## Key Classes
| Class               | Responsibility                                    |
| ------------------- | ------------------------------------------------- |
| `PayrollController` | Exposes payroll endpoints.                        |
| `PayrollService`    | Orchestrates payroll processing and calculations. |
| `PayrollRepository` | Persists payroll data.                            |
| `PayslipService`    | Generates payslips.                               |

## Ownership Rules
- Keep payroll math and workflow rules here.
- Do not mix payroll logic into report or user modules.
- Restrict access to tenant-level or higher roles.
