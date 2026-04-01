#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_DUMP="$PROJECT_ROOT/supabase.sql"
CUSTOM_DUMP="$PROJECT_ROOT/supabase.dump"

DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5434}"
DB_NAME="${PGDATABASE:-appdb}"
DB_USER="${PGUSER:-postgres}"
DB_PASSWORD="${PGPASSWORD:-postgres}"

step() {
  printf '==> %s\n' "$1"
}

ensure_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf "Command '%s' not found. Install PostgreSQL client tools and retry.\n" "$1" >&2
    exit 1
  fi
}

step "Checking database client tools"
ensure_command psql

export PGPASSWORD="$DB_PASSWORD"

if [[ -f "$SQL_DUMP" ]]; then
  step "Found supabase.sql, importing with psql"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$SQL_DUMP"
  printf 'Import completed from supabase.sql\n'
  exit 0
fi

if [[ -f "$CUSTOM_DUMP" ]]; then
  step "Found supabase.dump, importing with pg_restore"
  ensure_command pg_restore
  pg_restore \
    --host "$DB_HOST" \
    --port "$DB_PORT" \
    --username "$DB_USER" \
    --dbname "$DB_NAME" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    "$CUSTOM_DUMP"
  printf 'Import completed from supabase.dump\n'
  exit 0
fi

cat <<'EOF'
No dump file found.
Place one of these files in the project root:
  - supabase.sql
  - supabase.dump

Typical problems during import:
  - role does not exist: re-run with --no-owner / create placeholder roles
  - extension does not exist: comment unsupported CREATE EXTENSION or install extension locally
  - schema auth/storage does not exist: remove Supabase-specific schema objects or create compatibility schemas
  - must be owner of ... : use pg_restore --no-owner --no-privileges
EOF
exit 1
