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

**Module: Payroll**

- **Scope:** Payroll runs, salary calculations, payslip generation, and payroll reporting.

- **Folder structure:**
	- `application/` — payroll run orchestration and calculators
	- `domain/` — salary rules and payroll entities
	- `infrastructure/` — persistence and payroll export adapters
	- `presentation/` — payroll APIs and administrative endpoints
	- `prisma/` — module Prisma models for payroll data

- **Guidance:** Keep payroll calculations deterministic and well-tested; store inputs and outputs for audits.

