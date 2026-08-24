#!/usr/bin/env bash
#
# Sets up off-machine backups, once, with as few decisions as possible.
#
#   bash scripts/backup-setup.sh
#
# WHY THIS EXISTS
#   The app writes a backup every six hours, and those backups sit on the same
#   droplet as the database they protect. That covers a mistake — a bad import,
#   a wrong delete — and does nothing at all for the thing most likely to end
#   the hospital's records: the machine itself going away. A backup on the same
#   disk is a copy, not a backup.
#
#   This walks through pointing rclone at somewhere else, proves the copy
#   actually works, and installs a nightly job so nobody has to remember.
#
# It is safe to run again. Nothing here touches the database.

set -euo pipefail

say()  { printf '\n  \033[1;36m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[0;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[0;33m⚠\033[0m  %s\n' "$*"; }
die()  { printf '\n  \033[0;31m✖  %s\033[0m\n\n' "$*" >&2; exit 1; }

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
remote_name="offsite"
remote_path="${BACKUP_REMOTE:-$remote_name:deepan-backups}"

[ "$(id -u)" -eq 0 ] || die "Run this with sudo:  sudo bash scripts/backup-setup.sh"

say "1/4  rclone"
if command -v rclone >/dev/null 2>&1; then
  ok "already installed ($(rclone version | head -1))"
else
  apt-get update -qq
  apt-get install -y -qq rclone >/dev/null
  ok "installed"
fi

say "2/4  Somewhere to copy to"
if rclone listremotes 2>/dev/null | grep -q "^${remote_name}:"; then
  ok "\"$remote_name\" is already configured"
else
  cat <<'GUIDE'
  rclone is about to ask a series of questions. The short version:

      n                      -> New remote
      offsite                -> the name. Type exactly this.
      drive                  -> for Google Drive (or s3, b2, dropbox...)
      <enter>                -> leave client_id blank
      <enter>                -> leave client_secret blank
      1                      -> full access
      <enter>                -> leave root_folder_id blank
      <enter>                -> leave service_account_file blank
      n                      -> do NOT edit advanced config
      n                      -> NO auto config (this machine has no browser)
                                It prints a command to run on YOUR OWN
                                computer; run it, sign in, paste the token back.
      n                      -> not a shared drive
      y                      -> yes, this is OK
      q                      -> quit config

  Press Enter to start.
GUIDE
  read -r _
  rclone config
  rclone listremotes 2>/dev/null | grep -q "^${remote_name}:" \
    || die "no remote called \"$remote_name\" was created. Run this again."
  ok "\"$remote_name\" configured"
fi

say "3/4  Proving it actually copies"
# A real copy of the real backups, not a hopeful message. If this cannot write
# to the remote, better to find out now than during a disaster.
BACKUP_REMOTE="$remote_path" bash "$here/scripts/backup-offsite.sh" \
  || die "the copy failed. Fix the remote before relying on this."

count="$(rclone ls "$remote_path" 2>/dev/null | wc -l | tr -d ' ')"
[ "$count" -gt 0 ] || die "the remote is empty after a copy — something is wrong."
ok "$count file(s) now stored off this machine"

say "4/4  Every night, without anyone remembering"
line="0 2 * * * BACKUP_REMOTE=$remote_path /usr/bin/env bash $here/scripts/backup-offsite.sh >> /var/log/deepan-backup.log 2>&1"
if crontab -l 2>/dev/null | grep -Fq "backup-offsite.sh"; then
  ok "a nightly job is already installed"
else
  ( crontab -l 2>/dev/null; echo "$line" ) | crontab -
  ok "installed — 2am daily, logging to /var/log/deepan-backup.log"
fi

say "Done"
cat <<NEXT
  The hospital's records now exist somewhere other than this droplet.

  Check on it later:
      rclone ls $remote_path | tail          what is stored off-machine
      tail /var/log/deepan-backup.log        how last night's copy went

  ONE MORE THING, and it is the one people skip: download a backup onto
  another computer and open it. A backup nobody has ever restored is a
  belief, not a backup.
NEXT
