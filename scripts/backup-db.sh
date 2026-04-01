#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
CONTAINER_NAME="${CONTAINER_NAME:-turniry-postgres}"
PGDATABASE="${PGDATABASE:-appdb}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5435}"

mkdir -p "$OUTPUT_DIR"
TARGET="$OUTPUT_DIR/appdb_$(date +%Y-%m-%d_%H-%M-%S).dump"

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  echo "Creating backup via Docker container $CONTAINER_NAME..."
  docker exec "$CONTAINER_NAME" sh -lc "PGPASSWORD='$PGPASSWORD' pg_dump -U '$PGUSER' -d '$PGDATABASE' -Fc" > "$TARGET"
  echo "Backup created: $TARGET"
  exit 0
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found and Docker container '$CONTAINER_NAME' is not running." >&2
  exit 1
fi

echo "Creating backup via local pg_dump..."
PGPASSWORD="$PGPASSWORD" pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -Fc -f "$TARGET"
echo "Backup created: $TARGET"
