# Payroll Module Guide

Scope
- Payroll runs, salary calculations, payslip generation, and payroll reporting.

Folder structure (required)
- `application/` — payroll orchestration, calculators, `dtos/`
- `domain/` — salary rules and entities
- `infrastructure/` — persistence, exports, `prisma/`
- `presentation/` — controllers, mappers, middleware
- `docs/` — this file

Practical rules
- Keep calculations deterministic and test inputs/outputs; persist inputs for audits.
