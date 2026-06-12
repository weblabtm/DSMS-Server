# Database Infrastructure

This folder contains the PostgreSQL/Prisma connection layer used by the server bootstrap and any feature code that needs database access.

## What it does

- Creates the Prisma client from `DATABASE_URL`.
- Validates the database URL protocol before connecting.
- Exposes connect, disconnect, and health-check operations.
- **Enforces Automatic Multi-Tenant Isolation**: Automatically extends Prisma queries to scope reads/writes to the active request's tenant, preventing cross-tenant leaks.

## Main entry points

- `DatabaseConnection` in `database-connection.ts`
- `tenantIsolationExtension` in `tenant-isolation.ts` (the Prisma query filter extension)

---

## 🔒 Multi-Tenant Database Isolation Sandbox

The backend client automatically sandboxes database queries using **[tenantIsolationExtension](file:///c:/Users/sadee/Documents/weblabtm/sadeeshaweblabtm/DSMS-Server/src/infrastructure/database/tenant-isolation.ts)**:

1. **How it works**:
   * Web requests flow through `tenantContextMiddleware` which extracts the `x-tenant-id` header and sets the active tenant ID in an `AsyncLocalStorage` context.
   * Every Prisma client model query (e.g. `prisma.student.findMany`) checks if a context is active. If so, it dynamically appends `{ where: { tenantId } }` to the query logic.
   * Direct record mutations (`update`, `delete`) verify record ownership against the active tenant context first before proceeding. If there is a scope mismatch, they throw a `Tenant Isolation Breach` error.
   
2. **Cron jobs, seeds, and background workers**:
   * If there is no active request context (e.g. cron tasks, DB seeders, start-up scripts), the `tenantId` is `undefined` and the Prisma Client skips scoping checks. This allows global administration tasks to execute freely.

---

## ╔═══ AGENT / DEVELOPER RULES ═══╗
* **❌ DO NOT bypass the ORM layer**: Never use raw database queries (`$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, `$executeRawUnsafe`). These queries bypass the Prisma query extension layer and will lead to security isolation breaches. The CI linter will block pull requests containing raw queries.
* **✅ DO rely on automatic scoping**: You do NOT need to manually append `{ where: { tenantId } }` for every model query inside Express request handlers; the Prisma client automatically injects the tenant boundary context.
* **✅ DO use standard Prisma methods**: Use standard Prisma queries (`findFirst`, `findMany`, `update`, etc.) as they are fully covered by the isolation sandbox.
* **⚠️ findUnique compatibility**: Under the hood, `findUnique` operations are converted to `findFirst` to allow filtering on both unique fields and the non-unique `tenantId` field. Ensure your client-side filters take this into account.
* **⚠️ Upsert operations**: `upsert` queries are translated to sequential search + write operations. This ensures that created or updated records are scoped correctly to the active tenant.
* **❌ DO NOT construct new Prisma clients**: Always use the shared database client created at server bootstrap, which is pre-configured with the query filters.
╚═════════════════════════════════╝

## How application code uses it

The database connection is created once during server startup and passed into the app bootstrap.

Example:

```ts
import { EnvironmentConfig } from '../../config/environment.js';
import { DatabaseConnection } from '../infrastructure/database/database-connection.js';

const environment = EnvironmentConfig.fromProcessEnv();
const databaseConnection = new DatabaseConnection(environment.databaseUrl);

await databaseConnection.connect();
const prisma = databaseConnection.getClient();
```
