# DSMS-Server
Multi-tenant Driving School Management System (SaaS) — server codebase

Driving School Management System server codebase

## Infrastructure Docs

- [Database infrastructure](src/infrastructure/database/README.md)
- [Redis infrastructure](src/infrastructure/redis/README.md)
- [Storage infrastructure](src/infrastructure/storage/README.md)

## Multi-Tenant Database Isolation Sandbox

The backend database client automatically scopes all operations to the active request's tenant to prevent cross-tenant data leaks. 

- **How it works**:
  - Web requests flow through a global Express middleware that extracts the tenant identifier from the request headers and scopes the request inside a Node `AsyncLocalStorage` context.
  - The Prisma Client is configured with an extension ([tenantIsolationExtension](file:///c:/Users/sadee/Documents/weblabtm/sadeeshaweblabtm/DSMS-Server/src/infrastructure/database/tenant-isolation.ts)) that intercepts all queries. If the target model contains a `tenantId` field, it dynamically injects the current tenant ID into the query filters or creation data.
  - Mutations (`update`, `delete`) verify record ownership against the active tenant context first before proceeding, throwing an error if a tenant boundary breach is attempted.
  - Cron jobs, DB seeders, and start-up scripts run outside of a request context and skip scoping checks.

### Static Code Guards and CI Pipelines

To enforce multi-tenant isolation, the codebase includes strict ESLint rules blocking direct raw queries (`$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, `$executeRawUnsafe`), as these bypass the query scoping extension layer.
- Run the server linter: `npm run lint`
- Run integration tests: `npm run test:integration`

### ╔═══ AGENT / DEVELOPER RULES ═══╗
- **❌ DO NOT bypass the ORM layer**: Never use raw database queries (`$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, `$executeRawUnsafe`). The CI pipeline runs `npm run lint` and will reject commits violating this rule.
- **✅ DO rely on automatic scoping**: You do not need to manually append `{ where: { tenantId } }` for every model query inside Express request handlers; the database client automatically applies the boundary context.
- **✅ DO use standard Prisma methods**: Use standard Prisma queries (`findFirst`, `findMany`, `update`, etc.) as they are fully covered by the isolation sandbox.
- **⚠️ findUnique compatibility**: Under the hood, `findUnique` operations are converted to `findFirst` to allow filtering on both unique fields and the non-unique `tenantId` field.
- **⚠️ Upsert operations**: `upsert` queries are translated to sequential search + write operations. This ensures that created or updated records are scoped correctly to the active tenant.
- **❌ DO NOT construct new Prisma clients**: Always use the shared database client created at server bootstrap, which is pre-configured with the query filters.
╚═════════════════════════════════╝

## Developer Guides

- [Auth Module Overview](src/modules/Auth/README.md)
- [OTP & MFA Transaction Architecture Guide](src/modules/Auth/docs/otp-guide.md)

## Local development

1. The repo includes a local `.env` and a matching `.env.example` for PostgreSQL, Redis, MinIO, `PORT`, and `ALLOWED_ORIGINS`.
2. Start the local infrastructure and server with `sh scripts/local-dev.sh dev` on a POSIX shell, or `powershell -File scripts/local-dev.ps1 dev` on Windows.
3. The local-dev wrappers load the real `.env`, derive the container-only values such as `DOCKER_DATABASE_URL`, and then invoke Compose. That keeps the compose file free of hardcoded fallback credentials and URLs.
4. Use `sh scripts/local-dev.sh up`, `down`, `restart`, `logs`, `status`, `db-shell`, `redis-cli`, `generate`, `migrate`, `studio`, `build`, `test`, or `reset-db` as needed. The PowerShell wrapper exposes the same commands.
5. Tenant-aware requests are resolved from the incoming hostname. The server also exposes `GET /config`, which returns the resolved `apiBaseUrl` for the current host so web and mobile clients can hydrate their runtime API config from the same origin they are using.
6. Set `ENABLE_SUBDOMAIN_ROUTING=true` only when you want hostname-based tenant resolution. If the variable is missing or `false`, the server follows normal routing and skips subdomain tenant parsing.

## Docker

`powershell -File scripts/local-dev.ps1 up` or `sh scripts/local-dev.sh up` starts the local data services and creates the MinIO bucket with the selected policy. The wrapper is the supported pipeline because it loads the real `.env`, derives the container-only URLs, and then invokes Compose without hardcoded fallback values in the compose file.

## MinIO Storage

The server now includes reusable MinIO utilities for bucket initialization, uploads, downloads, and public object URLs. See the full usage guide in [src/infrastructure/storage/README.md](src/infrastructure/storage/README.md).

1. Configure `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, and `MINIO_BUCKET_POLICY`.
2. Set `MINIO_BUCKET_POLICY=public-read` only if anonymous reads are intended. Private buckets keep downloads behind signed URLs or authenticated server access.
3. Use `MinioStorageService` from `src/infrastructure/storage/minio-storage.ts` in module handlers or services when you need reusable file storage operations.

## Super Admin Bootstrap

Use the one-time bootstrap script to provision the first `Super Admin` account without exposing credentials in code or API payloads.

1. Set environment variables securely (local `.env`, CI secrets, or secret manager):
	- `ENABLE_SUPER_ADMIN_BOOTSTRAP=true`
	- `SUPER_ADMIN_IDENTIFIER=<admin-identifier>`
	- `SUPER_ADMIN_PASSWORD=<strong-password>`
	- `DATABASE_URL=<database-connection-string>`
2. Run `npm run seed:super-admin`.

The script is idempotent. If the same identifier already has the `Super Admin` role, it exits successfully.

## Supabase Connectivity Check

Use this script to verify that a direct Supabase database URL is reachable before running migrations.

1. Pass the direct URI as an argument, or set `SUPABASE_DATABASE_URL`.
2. Run `npm run check:supabase-direct -- "postgresql://<user>:<password>@<host>:5432/<database>?schema=public"`.
3. The script runs `SELECT 1` and exits with a non-zero code if the connection fails.