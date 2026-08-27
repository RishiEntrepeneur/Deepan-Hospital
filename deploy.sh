#!/usr/bin/env bash
#
# Puts Deepan Hospital on the internet, with HTTPS, in one command.
#
#   bash deploy.sh yourdomain.in
#
# Run it as root on a fresh Ubuntu server, from inside this folder. Safe to run
# again — every step checks before it acts, and nothing that already exists is
# overwritten (least of all the database).
#
# It expects the packaged deploy folder — dist/ already built, csp.js and
# server/ beside it — not a checkout of this repository. Build the package with
# `npm run build` and copy dist/, csp.js, package.json, server/src and
# server/scripts into one folder alongside this script.
#
# BEFORE YOU RUN IT
#   Point your domain at this server first. At your domain registrar, add an A
#   record for @ and one for www, both pointing at this machine's IP address.
#   Then wait a few minutes. HTTPS cannot be issued until the domain resolves
#   here, and this script checks that before it tries.
#
# WHY THE FIREWALL GOES ON BEFORE THE APP
#   A new server on a public IP gets found by automated scanners within minutes.
#   They are not looking for this hospital; they sweep the whole internet for
#   anything with a weak password or an open port. Firewall first, app second.

set -euo pipefail

say()  { printf '\n  \033[1;36m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[0;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[0;33m⚠\033[0m  %s\n' "$*"; }
die()  { printf '\n  \033[0;31m✖  %s\033[0m\n\n' "$*" >&2; exit 1; }

DOMAIN="${1:-}"
[ -n "$DOMAIN" ]      || die "Give me your domain:  bash deploy.sh yourdomain.in"
[ "$(id -u)" -eq 0 ]  || die "Run this as root:  sudo bash deploy.sh $DOMAIN"
command -v apt-get >/dev/null || die "This expects Ubuntu or Debian."
[ -f "$(dirname "$0")/server/src/index.js" ] || die "Run this from inside the unzipped folder."

SRC="$(cd "$(dirname "$0")" && pwd)"

#
# One script, two kinds of site.
#
#   bash deploy.sh deepanhospital.com                     the real one
#   INSTANCE=staging bash deploy.sh test.deepanhospital.com   somewhere to break
#
# With INSTANCE set, every path, port, service and system user gains that
# suffix, so a second copy runs beside the first and shares nothing with it:
# its own folder, its own database, its own backups, its own Linux user. Left
# unset, everything below resolves to exactly the names the live site already
# uses, so running this the old way changes nothing.
#
# The point of the second copy is that "try it and see" stops being a thing you
# do to a hospital's live appointment book.
#
INSTANCE="${INSTANCE:-}"
SUFFIX="${INSTANCE:+-$INSTANCE}"
APP_USER="deepan$SUFFIX"
APP_DIR="/opt/deepan-hospital$SUFFIX"
DATA_DIR="/var/lib/deepan-hospital$SUFFIX"
SERVICE="deepan$SUFFIX"
# Both stay shut to the outside world; only Caddy on this machine reaches them.
PORT="${PORT:-$([ -n "$INSTANCE" ] && echo 4001 || echo 4000)}"

say "1/9  Security updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
ok "up to date"

say "2/9  Firewall"
apt-get install -y -qq ufw >/dev/null
# Port 22 by name where the profile exists, by number where it does not —
# locking ourselves out of SSH would end the deploy here, permanently.
ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null
ufw allow 80/tcp  >/dev/null
ufw allow 443/tcp >/dev/null
# Port 4000 stays shut to the world. Only Caddy, on this same machine, reaches
# the app — it speaks plain HTTP and must never do that across the internet.
ufw --force enable >/dev/null
ok "only SSH, 80 and 443 are open to the world"

say "3/9  Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
fi
ok "node $(node -v)"

say "4/9  A user for the app"
id "$APP_USER" >/dev/null 2>&1 || \
  adduser --system --group --home "$APP_DIR" --disabled-login "$APP_USER" >/dev/null
ok "$APP_USER — the app never runs as root, so a flaw in it cannot take the machine"

say "5/9  Copying the code"
mkdir -p "$APP_DIR" "$DATA_DIR" "$DATA_DIR/backups"
# The database lives outside the code folder on purpose, so re-running this
# script and copying a new build over the top can never land on top of it.
#
# Backups needed to move out for exactly the same reason, and for a long time
# they did not. With no BACKUP_DIR set the app fell back to
# $APP_DIR/server/backups — inside the folder the next line deletes — so every
# deploy quietly threw away all twenty-eight snapshots and then wrote a fresh
# one six hours later. The gap never showed up as an error. Rescue anything
# still sitting there before the copy, and step 6 pins BACKUP_DIR so it cannot
# happen again.
if [ -d "$APP_DIR/server/backups" ]; then
  rescued="$(find "$APP_DIR/server/backups" -type f | wc -l | tr -d ' ')"
  cp -an "$APP_DIR/server/backups/." "$DATA_DIR/backups/" 2>/dev/null || true
  rm -rf "$APP_DIR/server/backups"
  ok "moved $rescued backup file(s) out of the code folder, into $DATA_DIR/backups"
fi
rsync -a --delete --exclude server/data "$SRC"/ "$APP_DIR"/ 2>/dev/null || {
  apt-get install -y -qq rsync >/dev/null
  rsync -a --delete --exclude server/data "$SRC"/ "$APP_DIR"/
}
( cd "$APP_DIR/server" && npm install --omit=dev --silent )
ok "code in $APP_DIR, database in $DATA_DIR"

say "6/9  Settings"
ENV_FILE="$APP_DIR/server/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat >"$ENV_FILE" <<ENV
NODE_ENV=production
PORT=$PORT
DATABASE_FILE=$DATA_DIR/deepan.db
CORS_ORIGINS=https://$DOMAIN,https://www.$DOMAIN
COOKIE_SECURE=true
TIMEZONE=Asia/Kolkata
HOSPITAL_NAME=Deepan Hospital
BACKUP_ENABLED=true
BACKUP_EVERY_HOURS=6
BACKUP_KEEP=28
BACKUP_DIR=$DATA_DIR/backups
ENV
  ok "written for https://$DOMAIN"
else
  # Settings written before backups moved have no BACKUP_DIR line, and without
  # one the app puts its snapshots straight back into the folder step 5 wipes.
  # Add the line; leave everything else in this file exactly as it is.
  if ! grep -q '^BACKUP_DIR=' "$ENV_FILE"; then
    echo "BACKUP_DIR=$DATA_DIR/backups" >>"$ENV_FILE"
    ok "kept the settings already here, and pinned backups to $DATA_DIR/backups"
  else
    ok "kept the settings already here"
  fi
fi

#
# Readable by the app and by root, and by nobody else.
#
# This file was being left at whatever the umask gave it — 644, world-readable.
# Everything secret the server has is in it: the database path, the cookie
# secret, and now a login to Klinique, which is the hospital's actual clinical
# system. Any account on this machine could read all of it. Set every time, not
# only on first write, so servers deployed before this are fixed by the next
# deploy rather than staying open until somebody remembers.
#
chmod 600 "$ENV_FILE"

say "7/9  The database"
FIRST_RUN=0
if [ ! -f "$DATA_DIR/deepan.db" ]; then
  FIRST_RUN=1
  ( cd "$APP_DIR/server" && node --env-file-if-exists=.env scripts/migrate.js >/dev/null )
  ( cd "$APP_DIR/server" && node --env-file-if-exists=.env scripts/seed.js    >/dev/null )
  ok "created, with the departments and doctors loaded"
else
  ( cd "$APP_DIR/server" && node --env-file-if-exists=.env scripts/migrate.js >/dev/null )
  ok "already here — left alone, only the structure was brought up to date"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR"

# Two logins, so somebody can actually get in.
#
# Called `manager`, not `admin`, deliberately. The server treats an unchanged
# `admin` / `test` / `demo` password as fatal and refuses to boot — the password
# was printed to a terminal, so it is sitting in somebody's scrollback, and that
# is not a credential for a database of patients. That check is right and is
# left switched on. Naming this account `manager` makes it a warning instead of
# a wall, so the site comes up; the password is still random, still shown once,
# and still has to be changed at first sign-in. Both are listed in the warnings
# at every boot until they are.
LOGINS=""
if [ "$FIRST_RUN" = 1 ]; then
  DESK_PW="$(head -c 12 /dev/urandom | base64 | tr -d '+/=' | head -c 14)"
  BOSS_PW="$(head -c 12 /dev/urandom | base64 | tr -d '+/=' | head -c 14)"
  ( cd "$APP_DIR/server" && STAFF_PASSWORD="$DESK_PW" node --env-file-if-exists=.env \
      scripts/create-staff.js --username reception --role staff >/dev/null )
  ( cd "$APP_DIR/server" && STAFF_PASSWORD="$BOSS_PW" node --env-file-if-exists=.env \
      scripts/create-staff.js --username manager --role admin >/dev/null )
  chown -R "$APP_USER:$APP_USER" "$DATA_DIR"
  LOGINS=$'\n  WRITE THESE DOWN NOW — they are not shown again.\n  Sign in with each one and change it straight away:\n'
  LOGINS+="      reception  /  $DESK_PW    (the front desk)"$'\n'
  LOGINS+="      manager    /  $BOSS_PW    (settings and doctors)"$'\n'
fi

say "8/9  Starting the app"
cat >/etc/systemd/system/$SERVICE.service <<UNIT
[Unit]
Description=Deepan Hospital${INSTANCE:+ ($INSTANCE)}
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR/server
ExecStart=/usr/bin/node --env-file-if-exists=.env src/index.js
Environment=HOST=127.0.0.1
Environment=CLIENT_DIR=$APP_DIR/dist
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1 || true
systemctl restart "$SERVICE"
sleep 3
systemctl is-active --quiet "$SERVICE" \
  || die "the app did not start. See what it said:  journalctl -u $SERVICE -n 40 --no-pager"
curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null \
  || die "the app started but is not answering. See:  journalctl -u $SERVICE -n 40 --no-pager"
ok "running, and it will come back after a reboot or a crash"

say "9/9  HTTPS and your domain"
if ! command -v caddy >/dev/null; then
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list 2>/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi

MY_IP="$(curl -fsS4 https://icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}')"
DOMAIN_IP="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
if [ "$DOMAIN_IP" != "$MY_IP" ]; then
  warn "$DOMAIN does not point here yet (it says '${DOMAIN_IP:-nothing}', this server is $MY_IP)."
  warn "Add an A record for @ and www pointing at $MY_IP, wait 10 minutes, run this again."
  warn "The app is running meanwhile — nothing is lost."
  printf '%s\n' "$LOGINS"
  exit 0
fi

#
# A file per site, imported — not one file overwritten.
#
# This used to write the whole Caddyfile every run, which was fine while there
# was exactly one site and silently fatal the moment there were two: deploying
# the staging site would delete the live site's block, and the hospital would
# drop off the internet until somebody redeployed it. The main file now holds
# nothing but the import, and each instance owns one file inside sites/.
#
mkdir -p /etc/caddy/sites
cat >/etc/caddy/Caddyfile <<'CADDY'
# Generated by deploy.sh. One file per site lives in sites/ — edit those, or
# better, re-run deploy.sh. Anything written directly here is overwritten.
import /etc/caddy/sites/*.caddy
CADDY

# `www.` only for the real site; a staging host does not have one, and asking
# Caddy for a certificate on a name with no DNS record fails the whole block.
CADDY_HOSTS="$DOMAIN"
[ -z "$INSTANCE" ] && CADDY_HOSTS="$DOMAIN, www.$DOMAIN"

cat >"/etc/caddy/sites/$SERVICE.caddy" <<CADDY
$CADDY_HOSTS {
	encode zstd gzip
	reverse_proxy 127.0.0.1:$PORT
}
CADDY
systemctl reload caddy 2>/dev/null || systemctl restart caddy
sleep 5
ok "Caddy is fetching a free HTTPS certificate — this takes up to a minute"

say "Done"
printf '      https://%s\n' "$DOMAIN"
printf '%s\n' "$LOGINS"
cat <<NEXT
  Check it in a browser now. If it says "not secure", wait a minute and reload —
  the certificate is still being issued.

  Useful later:
      systemctl restart $SERVICE
      journalctl -u $SERVICE -n 40 --no-pager   see what it said
      ls $DATA_DIR/backups                      the automatic backups, every 6 hours
NEXT

if [ -n "$INSTANCE" ]; then
cat <<NEXT

  This is the "$INSTANCE" copy. It has its own database, seeded with the
  ordinary departments and doctors and nothing else — no real patient has ever
  touched it, and none should. Break it as hard as you like; the live site at
  a different address is untouched by anything you do here.

  Never restore a production backup into it. The moment it holds real patient
  records it stops being a test server and starts being a second thing you have
  to protect.
NEXT
else
cat <<'NEXT'

  The backups sit on this same machine, which does not help if the machine
  dies. Copy them somewhere else — see server/scripts/backup-offsite.sh.

  Before real patients use it, work through the checklist in DEPLOY.md.
NEXT
fi
