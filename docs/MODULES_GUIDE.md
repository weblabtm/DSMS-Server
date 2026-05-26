# Modules Guide — Conventions and Best Practices

This document explains the project's module conventions, folder structure, OOP and SOLID guidance, and how Prisma is used. It is intended for developers and coding agents working on this repository.

1) Module layout (per `src/modules/<Module>`)
- `application/` — services, use-cases, DTOs. Business logic lives here.
- `domain/` — domain entities, value objects, and domain-only rules.
- `infrastructure/` — persistence adapters (DAOs), external API adapters, seeders.
- `presentation/` — HTTP controllers, middleware, and routes.
- `prisma/` — module-local Prisma model files (one or multiple `.prisma` fragments).

2) Module scope
- Each module owns a bounded context (e.g., `Auth` owns authentication and RBAC). Keep cross-cutting concerns minimal and prefer integration via service interfaces.

3) Prisma usage
- Put Prisma model fragments in `src/modules/<Module>/prisma/*.prisma`.
- The repo-level script `scripts/build-prisma-schema.js` concatenates module prisma fragments plus `prisma/schema.header.prisma` into `prisma/schema.prisma`.
- Run `npm run prisma:generate` (or `npx prisma generate`) after building schema to generate the client.
- Apply migrations in CI with `npx prisma migrate deploy --schema=prisma/schema.prisma` (do not run `migrate dev` in production).
- Run seeders from CI/post-deploy (idempotent upserts). See `.github/workflows/migrate-and-seed.yml`.

4) OOP & SOLID guidance (practical rules)
- Single Responsibility: one class per responsibility; services orchestrate, DAOs persist.
- Open/Closed: extend behavior using new classes/composition instead of patching existing classes.
- Liskov Substitution: program to interfaces for DAOs and services so implementations are swappable.
- Interface Segregation: prefer several small interfaces over one large interface.
- Dependency Inversion: depend on abstractions (interfaces) and inject concrete implementations in composition root.

5) Coding agent rules (for automated edits / PRs)
- Always respect the module boundary and update the module's README when adding public APIs.
- If adding Prisma models, create `src/modules/<Module>/prisma/<Name>.prisma` and run `node scripts/build-prisma-schema.js` locally in your PR to ensure schema concatenates.
- Do not run DB migrations in code; update migration files and let CI apply `prisma migrate deploy`.
- Seeders must be idempotent; prefer `upsert` and explicit checks.

6) Testing and CI
- Unit tests belong in `tests/unit/modules/<Module>` or `src/__tests__` and must not require a DB unless explicitly integration tests.
- Integration tests that require the DB should be gated by `DATABASE_URL` and run in CI with a test database.

7) Runtime considerations for serverless
- Avoid long-running startup tasks on serverless cold starts (do not migrate or seed at runtime).
- Use Prisma Data Proxy or a connection pooler to avoid connection exhaustion.

8) Example: Adding a Prisma model to a module
1. Create `src/modules/<Module>/prisma/MyModel.prisma` with `model MyModel { ... }`.
2. Run locally: `node scripts/build-prisma-schema.js` then `npm run prisma:generate`.
3. Add a migration locally (`npx prisma migrate dev --name add-my-model`) and commit the migration SQL files.
4. Push and let CI run `npx prisma migrate deploy` and seeders.

9) Contact points
- Update the module `README.md` when adding new responsibilities or public APIs so other developers/coding agents can find the scope and conventions.
