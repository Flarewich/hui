#!/usr/bin/env bash
set -euo pipefail

PROJECT_PATH="${1:-$(pwd)}"
BACKUP_SCRIPT="$PROJECT_PATH/scripts/backup-db.sh"

if [ ! -f "$BACKUP_SCRIPT" ]; then
  echo "Backup script not found: $BACKUP_SCRIPT" >&2
  exit 1
fi

echo "Add this line to your crontab:"
echo "30 3 * * * cd \"$PROJECT_PATH\" && \"$BACKUP_SCRIPT\" >> \"$PROJECT_PATH/backups/nightly.log\" 2>&1"
