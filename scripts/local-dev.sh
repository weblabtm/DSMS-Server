#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)
ENV_FILE="${PROJECT_ROOT}/.env"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"

usage() {
    cat <<'EOF'
Local development pipeline

Usage:
  sh scripts/local-dev.sh dev            Start PostgreSQL + Redis, then run the server locally
  sh scripts/local-dev.sh up             Start PostgreSQL + Redis
  sh scripts/local-dev.sh down           Stop PostgreSQL + Redis
  sh scripts/local-dev.sh restart        Restart PostgreSQL + Redis
  sh scripts/local-dev.sh logs           Follow infrastructure logs
  sh scripts/local-dev.sh status         Show container status
  sh scripts/local-dev.sh db-shell       Open a psql shell in the database container
  sh scripts/local-dev.sh redis-cli      Open a Redis CLI session in the Redis container
  sh scripts/local-dev.sh generate       Run Prisma client generation
  sh scripts/local-dev.sh migrate        Run Prisma migrate dev
  sh scripts/local-dev.sh studio         Open Prisma Studio
  sh scripts/local-dev.sh build          Build the server
  sh scripts/local-dev.sh test           Run the test command
  sh scripts/local-dev.sh reset-db       Stop the stack and remove volumes
EOF
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

require_env() {
    if [ ! -f "$ENV_FILE" ]; then
        echo "Missing .env file. Copy .env.example to .env first." >&2
        exit 1
    fi
}

load_env() {
    set -a
    . "$ENV_FILE"
    set +a
    export POSTGRES_DB="${POSTGRES_DB:-dsms}"
    export POSTGRES_USER="${POSTGRES_USER:-dsms}"
    export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-dsms}"
    export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
    export REDIS_PORT="${REDIS_PORT:-6379}"
    export PORT="${PORT:-3000}"
    export NODE_ENV="${NODE_ENV:-development}"
    export MINIO_PORT="${MINIO_PORT:-9000}"
    export MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-9001}"
    export MINIO_USE_SSL="${MINIO_USE_SSL:-false}"
    export MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
    export MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin}"
    export MINIO_BUCKET="${MINIO_BUCKET:-dsms-files}"
    export MINIO_REGION="${MINIO_REGION:-us-east-1}"
    export MINIO_BUCKET_POLICY="${MINIO_BUCKET_POLICY:-private}"
    export DOCKER_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public"
    export DOCKER_REDIS_URL="redis://redis:6379"
    export DOCKER_MINIO_ENDPOINT="minio"
    export DOCKER_MINIO_PORT="9000"
    export DOCKER_MINIO_USE_SSL="false"
}

require_docker() {
    if ! command_exists docker; then
        echo "Docker is not installed or not available on PATH." >&2
        exit 1
    fi
}

compose() {
    (cd "$PROJECT_ROOT" && docker compose -f "$COMPOSE_FILE" "$@")
}

start_infra() {
    compose up -d --wait postgres redis minio minio-init
}

run_server() {
    (cd "$PROJECT_ROOT" && npm run dev)
}

case "${1:-dev}" in
    dev|run)
        require_env
        require_docker
        load_env
        start_infra
        run_server
        ;;
    up)
        require_env
        require_docker
        load_env
        start_infra
        ;;
    down)
        require_env
        require_docker
        load_env
        compose down
        ;;
    restart)
        require_env
        require_docker
        load_env
        compose down
        start_infra
        ;;
    logs)
        require_env
        require_docker
        load_env
            compose logs -f postgres redis minio minio-init
        ;;
    status|ps)
        require_env
        require_docker
        load_env
        compose ps
        ;;
    db-shell)
        require_env
        require_docker
        load_env
        compose exec postgres psql -U "${POSTGRES_USER:-dsms}" -d "${POSTGRES_DB:-dsms}"
        ;;
    redis-cli)
        require_env
        require_docker
        load_env
        compose exec redis redis-cli
        ;;
    generate)
        require_env
        load_env
        (cd "$PROJECT_ROOT" && npx prisma generate)
        ;;
    migrate)
        require_env
        load_env
        (cd "$PROJECT_ROOT" && npx prisma migrate dev)
        ;;
    studio)
        require_env
        load_env
        (cd "$PROJECT_ROOT" && npx prisma studio)
        ;;
    build)
        require_env
        load_env
        (cd "$PROJECT_ROOT" && npm run build)
        ;;
    test)
        require_env
        load_env
        (cd "$PROJECT_ROOT" && npm test)
        ;;
    reset-db)
        require_env
        require_docker
        load_env
        compose down -v
        ;;
    help|-h|--help)
        usage
        ;;
    *)
        echo "Unknown command: ${1}" >&2
        usage
        exit 1
        ;;
esac