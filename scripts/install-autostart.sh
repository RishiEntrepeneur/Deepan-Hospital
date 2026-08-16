#!/bin/bash
#
# Starts the API and the built front end automatically on login, and restarts
# them if they crash.
#
# READ THIS FIRST — what it does not do:
#
#   This does NOT keep the app running while the Mac is asleep. macOS suspends
#   every process on sleep; nothing installed here changes that. When the lid
#   closes, the app is unreachable until the machine wakes.
#
#   It solves a narrower problem: after a reboot, a crash, or a power cut, the
#   servers come back by themselves instead of waiting for somebody to open a
#   terminal.
#
#   For a hospital booking system that patients rely on, the real answer is a
#   small always-on server — see COSTS.md. This is a stopgap for a machine at
#   the reception desk, not a deployment.
#
# Usage:  bash scripts/install-autostart.sh
# Undo:   bash scripts/install-autostart.sh --uninstall
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
LABEL_API="in.deepanhospital.api"
LOGS="$ROOT/server/logs"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL_API" 2>/dev/null || true
  rm -f "$AGENTS/$LABEL_API.plist"
  echo "  Removed. The API will no longer start on login."
  exit 0
fi

NODE_BIN="$(command -v node)"
if [[ -z "$NODE_BIN" ]]; then
  echo "  node is not on PATH. Install Node first." >&2
  exit 1
fi

mkdir -p "$AGENTS" "$LOGS"

# KeepAlive restarts it if it exits for any reason; RunAtLoad starts it at
# login. Both logs are kept so a failure to start is diagnosable.
cat > "$AGENTS/$LABEL_API.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL_API</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>--env-file-if-exists=$ROOT/server/.env</string>
    <string>$ROOT/server/src/index.js</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOGS/api.log</string>
  <key>StandardErrorPath</key><string>$LOGS/api.error.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL_API" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENTS/$LABEL_API.plist"

echo
echo "  Installed. The API starts on login and restarts if it stops."
echo "  Logs:  $LOGS/api.log"
echo
echo "  It will still stop while the Mac is asleep — that is macOS, not the app."
echo "  Undo with:  bash scripts/install-autostart.sh --uninstall"
echo
