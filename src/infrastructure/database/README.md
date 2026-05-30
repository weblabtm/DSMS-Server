# Database Infrastructure

This folder contains the PostgreSQL/Prisma connection layer used by the server bootstrap and any feature code that needs database access.

## What it does

- Creates the Prisma client from `DATABASE_URL`.
- Validates the database URL protocol before connecting.
- Exposes connect, disconnect, and health-check operations.

## Main entry point

- `DatabaseConnection` in `database-connection.ts`

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

If `DATABASE_URL` is missing or invalid, the database client is not created and the server continues without database-backed features.

## When to use it

Use this infrastructure when you need:

- Prisma queries
- transactional persistence
- schema-aware database health checks
- access to the shared database client during bootstrap or in modules

## Environment variables

- `DATABASE_URL`

## Notes for the team

- Keep direct Prisma usage behind service or repository layers.
- Prefer injecting the client from bootstrap instead of constructing new Prisma clients inside feature modules.
- Call `getHealthStatus()` when you need to report database availability in `/health` or diagnostics.
