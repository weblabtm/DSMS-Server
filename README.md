# DSMS-Server
Driving School Management System server codebase

## Local development

1. The repo includes a local `.env` and a matching `.env.example` for Docker, PostgreSQL, Redis, `PORT`, and `ALLOWED_ORIGINS`.
2. Start the local infrastructure and server with `sh scripts/local-dev.sh dev` on a POSIX shell, or `powershell -File scripts/local-dev.ps1 dev` on Windows.
3. Use `sh scripts/local-dev.sh up`, `down`, `restart`, `logs`, `status`, `db-shell`, `redis-cli`, `generate`, `migrate`, `studio`, `build`, `test`, or `reset-db` as needed. The PowerShell wrapper exposes the same commands.

## Docker

`docker compose up -d postgres redis` starts only PostgreSQL and Redis. The server runs on the host during local development, while the compose file also keeps a containerized server profile available for future use.
