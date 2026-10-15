#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
action="${1:---deploy}"

usage() {
  cat <<'HELP'
Usage: ./deploy.sh [--deploy|--build-only|--postgres-only|--import-mysql|--status|--stop|--help]
  --deploy         Build images, migrate PostgreSQL, check config, start services, wait for health.
  --build-only     Build frontend/backend images without starting the app.
  --postgres-only  Start PostgreSQL only and wait for health.
  --import-mysql   Copy an existing project MySQL container into empty PostgreSQL (requires host Node).
  --status         Show service status.
  --stop           Stop this Compose stack; retain all database/upload volumes.
Defaults: frontend :8080, backend 127.0.0.1:3000, PostgreSQL 127.0.0.1:5433.
Overrides: WEB_PORT, WEB_BIND, BACKEND_PORT, POSTGRES_PORT, FORMS_HOST_DIR,
           CORS_ORIGINS, FRONTEND_API_URL, BUILD_NETWORK, MYSQL_SOURCE_CONTAINER,
           DEPLOY_WAIT_TIMEOUT (default 180 seconds).
The backend uses PostgreSQL. Existing MySQL data is preserved separately.
HELP
}

[[ $# -le 1 ]] || { usage; exit 2; }
case "$action" in
  --help|-h) usage; exit 0 ;;
  --deploy|--build-only|--postgres-only|--import-mysql|--status|--stop) ;;
  *) usage; exit 2 ;;
esac

command -v docker >/dev/null || { echo 'Docker is required.' >&2; exit 1; }
docker compose version >/dev/null
docker info >/dev/null 2>&1 || { echo 'Docker daemon is unavailable.' >&2; exit 1; }
compose=(docker compose --env-file /dev/null -f "$PROJECT_DIR/compose.yaml")

# Serialize this project's deployments; no secrets are evaluated as shell code.
command -v flock >/dev/null || { echo 'flock is required.' >&2; exit 1; }
exec 9>"$PROJECT_DIR/.deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }

for env_path in backend/.env frontend/.env; do
  [[ -f "$env_path" ]] || { echo "Missing $env_path; create it from .env.example." >&2; exit 1; }
done

if [[ ! -f docker/postgres.env ]]; then
  if [[ "$action" == --status || "$action" == --stop ]]; then
    echo 'No docker/postgres.env yet; run --postgres-only or --deploy first.' >&2
    exit 1
  fi
  command -v openssl >/dev/null || { echo 'openssl is required to initialize PostgreSQL credentials.' >&2; exit 1; }
  postgres_password="$(openssl rand -hex 32)"
  printf 'POSTGRES_DB=seasmart\nPOSTGRES_USER=seasmart\nPOSTGRES_PASSWORD=%s\n' "$postgres_password" > docker/postgres.env
  unset postgres_password
  echo 'Created private docker/postgres.env; credential values are not displayed.'
fi

if [[ ! -f docker/jwt_secret ]]; then
  command -v openssl >/dev/null || { echo 'openssl is required.' >&2; exit 1; }
  openssl rand -hex 32 > docker/jwt_secret
  echo 'Created private JWT secret; its value is not displayed.'
fi

# Quiet validation avoids rendering resolved environment values to the terminal.
if ! "${compose[@]}" config --quiet >/dev/null 2>&1; then
  echo 'Compose configuration is invalid; check env files and port overrides.' >&2
  exit 1
fi
wait_timeout="${DEPLOY_WAIT_TIMEOUT:-180}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:${WEB_PORT:-8080},http://127.0.0.1:${WEB_PORT:-8080},http://localhost:5173,http://127.0.0.1:5173}"
# BuildKit secret changes alone do not invalidate its cache. Re-run the frontend
# compile on each deployment without exposing env values or hashing credentials.
export FRONTEND_BUILD_ID="$(date +%s)-$$"

build_images() {
  if [[ "${BUILD_NETWORK:-default}" == host ]]; then
    # Compose/Bake may otherwise prompt for host-network entitlements in CI.
    docker buildx build --load --network host --allow network.host \
      -t seasmart-backend:local backend
    docker buildx build --load --network host --allow network.host \
      --secret id=frontend_env,src=frontend/.env \
      --build-arg FRONTEND_BUILD_ID \
      --build-arg "FRONTEND_API_URL=${FRONTEND_API_URL:-/api/v1}" \
      -t seasmart-frontend:local frontend
  else
    "${compose[@]}" build backend frontend
  fi
}

case "$action" in
  --status) "${compose[@]}" ps ;;
  --stop) "${compose[@]}" stop ;;
  --postgres-only)
    "${compose[@]}" up -d --wait --wait-timeout "$wait_timeout" postgres
    "${compose[@]}" ps postgres
    ;;
  --build-only) build_images ;;
  --import-mysql)
    command -v node >/dev/null || { echo 'Host Node and backend dependencies are required for --import-mysql.' >&2; exit 1; }
    "${compose[@]}" up -d --wait --wait-timeout "$wait_timeout" postgres
    "${compose[@]}" run --rm --no-deps -T backend node scripts/migrate.js
    node backend/scripts/import_mysql.js "${MYSQL_SOURCE_CONTAINER:-seasmart-mysql}"
    ;;
  --deploy)
    build_images
    "${compose[@]}" up -d --wait --wait-timeout "$wait_timeout" postgres
    "${compose[@]}" run --rm --no-deps -T backend node scripts/migrate.js
    "${compose[@]}" run --rm --no-deps -T backend node scripts/check_deploy_env.js
    "${compose[@]}" up -d --wait --wait-timeout "$wait_timeout" postgres backend frontend
    "${compose[@]}" ps
    printf 'Frontend: http://localhost:%s\n' "${WEB_PORT:-8080}"
    ;;
esac
