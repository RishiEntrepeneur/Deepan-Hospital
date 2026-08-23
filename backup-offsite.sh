#!/usr/bin/env bash
#
# Copies the database backups somewhere that is not this machine.
#
#   ./scripts/backup-offsite.sh
#
# The app already writes a backup every six hours into server/backups/. Those
# sit on the same disk as the database they protect, which means they survive
# a mistake — a bad import, a wrong delete — and not the thing most likely to
# actually happen, which is the disk or the whole server going away.
#
# SETUP, once, on the server:
#
#   1. apt install rclone
#   2. rclone config          # add your storage; call the remote "offsite"
#   3. BACKUP_REMOTE=offsite:deepan-backups ./scripts/backup-offsite.sh
#   4. crontab -e, and add:
#      0 2 * * * BACKUP_REMOTE=offsite:deepan-backups /path/to/scripts/backup-offsite.sh >> /var/log/deepan-backup.log 2>&1
#
# Any storage rclone supports will do. Prefer a bucket in an Indian region for
# the same reason the server is in one.
#
# AND THEN, ONCE: restore a copy onto a spare machine and open it. A backup
# nobody has ever restored is a belief, not a backup.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="${BACKUP_DIR:-$here/backups}"
remote="${BACKUP_REMOTE:-}"

if [ -z "$remote" ]; then
  echo "  ✖  BACKUP_REMOTE is not set — nothing to copy to." >&2
  echo "     Example:  BACKUP_REMOTE=offsite:deepan-backups $0" >&2
  exit 1
fi

if [ ! -d "$source_dir" ]; then
  echo "  ✖  No backup directory at $source_dir" >&2
  exit 1
fi

# Refuse to report success on an empty directory. A cron job that quietly
# copies nothing every night looks exactly like one that is working.
count="$(find "$source_dir" -name '*.db' -type f | wc -l | tr -d ' ')"
if [ "$count" -eq 0 ]; then
  echo "  ✖  $source_dir has no .db backups in it — is the server running?" >&2
  exit 1
fi

if ! command -v rclone >/dev/null 2>&1; then
  echo "  ✖  rclone is not installed.  apt install rclone" >&2
  exit 1
fi

echo "  Copying $count backup(s) from $source_dir → $remote"
rclone copy "$source_dir" "$remote" --include '*.db' --stats-one-line

newest="$(find "$source_dir" -name '*.db' -type f -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)"
echo "  ✓ Done. Newest local backup: $(basename "$newest")"
echo "    Remember: a backup nobody has restored is a belief, not a backup."
