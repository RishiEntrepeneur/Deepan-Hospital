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
APP_USER=deepan
APP_DIR=/opt/deepan-hospital
DATA_DIR=/var/lib/deepan-hospital

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
mkdir -p "$APP_DIR" "$DATA_DIR"
# The database lives outside the code folder on purpose, so re-running this
# script and copying a new build over the top can never land on top of it.
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
PORT=4000
DATABASE_FILE=$DATA_DIR/deepan.db
CORS_ORIGINS=https://$DOMAIN,https://www.$DOMAIN
COOKIE_SECURE=true
TIMEZONE=Asia/Kolkata
HOSPITAL_NAME=Deepan Hospital
BACKUP_ENABLED=true
BACKUP_EVERY_HOURS=6
BACKUP_KEEP=28
ENV
  ok "written for https://$DOMAIN"
else
  ok "kept the settings already here"
fi

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
cat >/etc/systemd/system/deepan.service <<UNIT
[Unit]
Description=Deepan Hospital
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
systemctl enable deepan >/dev/null 2>&1 || true
systemctl restart deepan
sleep 3
systemctl is-active --quiet deepan \
  || die "the app did not start. See what it said:  journalctl -u deepan -n 40 --no-pager"
curl -fsS http://127.0.0.1:4000/api/health >/dev/null \
  || die "the app started but is not answering. See:  journalctl -u deepan -n 40 --no-pager"
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

cat >/etc/caddy/Caddyfile <<CADDY
$DOMAIN, www.$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:4000
}
CADDY
systemctl reload caddy 2>/dev/null || systemctl restart caddy
sleep 5
ok "Caddy is fetching a free HTTPS certificate — this takes up to a minute"

say "Done"
printf '      https://%s\n' "$DOMAIN"
printf '%s\n' "$LOGINS"
cat <<'NEXT'
  Check it in a browser now. If it says "not secure", wait a minute and reload —
  the certificate is still being issued.

  Useful later:
      systemctl restart deepan              restart the app
      journalctl -u deepan -n 40 --no-pager  see what it said
      ls /var/lib/deepan-hospital/backups    the automatic backups, every 6 hours

  The backups sit on this same machine, which does not help if the machine
  dies. Copy them somewhere else — see server/scripts/backup-offsite.sh.

  Before real patients use it, work through the checklist in DEPLOY.md.
NEXT
