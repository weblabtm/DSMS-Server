# DSMS-Server
Driving School Management System server codebase

## Infrastructure Docs

- [Database infrastructure](src/infrastructure/database/README.md)
- [Redis infrastructure](src/infrastructure/redis/README.md)
- [Storage infrastructure](src/infrastructure/storage/README.md)

## Local development

1. The repo includes a local `.env` and a matching `.env.example` for PostgreSQL, Redis, MinIO, `PORT`, and `ALLOWED_ORIGINS`.
2. Start the local infrastructure and server with `sh scripts/local-dev.sh dev` on a POSIX shell, or `powershell -File scripts/local-dev.ps1 dev` on Windows.
3. The local-dev wrappers load the real `.env`, derive the container-only values such as `DOCKER_DATABASE_URL`, and then invoke Compose. That keeps the compose file free of hardcoded fallback credentials and URLs.
4. Use `sh scripts/local-dev.sh up`, `down`, `restart`, `logs`, `status`, `db-shell`, `redis-cli`, `generate`, `migrate`, `studio`, `build`, `test`, or `reset-db` as needed. The PowerShell wrapper exposes the same commands.
5. Tenant-aware requests are resolved from the incoming hostname. The server also exposes `GET /config`, which returns the resolved `apiBaseUrl` for the current host so web and mobile clients can hydrate their runtime API config from the same origin they are using.

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