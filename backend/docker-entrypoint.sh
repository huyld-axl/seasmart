#!/bin/sh
set -eu
# Compose file secrets retain host permissions. Copy privately at container
# startup, then drop privileges, so a root-owned 0600 source file works too.
install -m 600 -o node -g node /run/secrets/backend_env /app/backend/.env
install -m 600 -o node -g node /run/secrets/jwt_secret /app/backend/.jwt_secret
export JWT_SECRET_FILE=/app/backend/.jwt_secret
export DB_USER="$POSTGRES_USER" DB_PASSWORD="$POSTGRES_PASSWORD" DB_NAME="$POSTGRES_DB"
exec gosu node "$@"
