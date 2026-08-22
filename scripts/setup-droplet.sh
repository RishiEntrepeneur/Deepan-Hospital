#!/usr/bin/env bash
#
# Prepares a fresh Ubuntu server to run Deepan Hospital.
#
#   ssh root@YOUR_IP
#   bash setup-droplet.sh
#
# Run it once, on a brand-new droplet, as root. It is safe to run twice —
# every step checks before it acts.
#
# WHAT IT DOES
#   · installs security updates
#   · turns on the firewall, leaving only SSH and the web ports open
#   · installs Node 22
#   · creates a `deepan` user for the app, so it never runs as root
#   · sets up a service so the app restarts on boot and after a crash
#
# WHAT IT DOES NOT DO
#   Put the site on the internet under a domain name with HTTPS. That needs a
#   domain pointed at this machine first — see the end of the run for the two
#   commands, and DEPLOY.md for the rest.
#
# WHY A FIREWALL FIRST
#   A new server on a public IP is found by automated scanners within minutes
#   of being created. They are not looking for this hospital; they sweep the
#   whole internet for anything with a weak password or an open database. The
#   firewall goes on before the app does.

set -euo pipefail

say()  { printf '\n  \033[1;36m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[0;32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[0;33m⚠\033[0m  %s\n' "$*"; }
die()  { printf '\n  \033[0;31m✖  %s\033[0m\n\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run this as root:  sudo bash $0"
command -v apt-get >/dev/null || die "This expects Ubuntu or Debian."

APP_USER=deepan
APP_DIR=/opt/deepan-hospital

say "1/6  Security updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
ok "up to date"

say "2/6  Firewall"
apt-get install -y -qq ufw >/dev/null
ufw allow OpenSSH   >/dev/null
ufw allow 80/tcp    >/dev/null
ufw allow 443/tcp   >/dev/null
# The app's own port stays shut to the outside world. Nothing reaches it
# except the web server on this same machine, which is the only thing that
# should — the app speaks plain HTTP and must never do so across the internet.
ufw --force enable  >/dev/null
ok "only SSH, 80 and 443 are open"

say "3/6  Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
fi
ok "node $(node -v)"

say "4/6  A user for the app"
if ! id "$APP_USER" >/dev/null 2>&1; then
  adduser --system --group --home "$APP_DIR" --disabled-login "$APP_USER" >/dev/null
fi
mkdir -p "$APP_DIR"
ok "$APP_USER — the app never runs as root, so a flaw in it cannot take the machine"

say "5/6  Where to put the code"
if [ ! -f "$APP_DIR/package.json" ]; then
  warn "No code here yet. From your own laptop, in the project folder:"
  printf '\n      \033[1mzip -r deepan.zip . -x "node_modules/*" "server/node_modules/*"\033[0m\n'
  printf '      \033[1mscp deepan.zip root@%s:/tmp/\033[0m\n' "$(hostname -I | awk '{print $1}')"
  printf '\n    then back here:\n\n'
  printf '      \033[1munzip -o /tmp/deepan.zip -d %s\033[0m\n' "$APP_DIR"
  printf '      \033[1mbash %s\033[0m   (run this again)\n' "$0"
  printf '\n'
  exit 0
fi
ok "code found"

say "6/6  Building and installing the service"
cd "$APP_DIR"
npm install --omit=dev --silent 2>/dev/null || npm install --silent
npm install --silent --include=dev >/dev/null 2>&1 || true
npm run build --silent
( cd server && npm install --omit=dev --silent )
[ -f server/.env ] || { cp server/.env.example server/.env 2>/dev/null || touch server/.env; }
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
ok "built"

cat >/etc/systemd/system/deepan.service <<UNIT
[Unit]
Description=Deepan Hospital API
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR/server
ExecStart=/usr/bin/node --env-file-if-exists=.env src/index.js
Restart=always
RestartSec=5
# The app is reachable only from this machine. A web server in front of it
# terminates HTTPS and forwards; nothing else should be able to reach it.
Environment=HOST=127.0.0.1
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now deepan >/dev/null 2>&1 || systemctl restart deepan
sleep 2
if systemctl is-active --quiet deepan; then
  ok "running, and will come back after a reboot"
else
  warn "the service did not start — see:  journalctl -u deepan -n 40"
fi

say "Done. What is left"
cat <<'NEXT'
  The app is running, but only this machine can reach it. To put it on the
  internet you need a domain name pointed at this server's IP, and then:

      apt install -y caddy
      # then put this in /etc/caddy/Caddyfile, with your own domain:
      #     yourdomain.in {
      #       reverse_proxy localhost:4000
      #     }
      systemctl reload caddy

  Caddy fetches the HTTPS certificate by itself, free.

  Before any real patient uses it, work through the checklist in DEPLOY.md.
  Two of those the server enforces for you: it refuses to start in production
  while a setup password is unchanged, or while an origin is plain http.
NEXT
