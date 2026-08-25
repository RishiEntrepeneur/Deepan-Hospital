#!/usr/bin/env bash
#
# Updates a running Deepan Hospital server from GitHub, in one command.
#
#   bash update.sh deepanhospital.com
#
# Getting a new build onto the server used to mean downloading a zip in a
# browser, uploading it, unzipping it and then deploying — four steps, each of
# which silently redeploys the previous build if you skip it. This does the lot
# from the source of truth, so "did the new code actually get there?" stops
# being a question.
#
# The database is never touched: deploy.sh keeps it in /var/lib/deepan-hospital,
# well outside the folder this replaces.
set -euo pipefail

DOMAIN="${1:-}"
BRANCH="${2:-claude/project-continuation-vsx8gq}"
REPO=https://github.com/RishiEntrepeneur/Deepan-Hospital.git

#
#   bash update.sh deepanhospital.com                          the real site
#   INSTANCE=staging bash update.sh test.deepanhospital.com     the test one
#
# INSTANCE is passed straight through to deploy.sh, which puts every path,
# port, service and user behind the same suffix. The checkout and build folders
# are suffixed too, so updating the test site cannot leave a half-built tree
# where the live site's next update expects to find one.
#
INSTANCE="${INSTANCE:-}"
SUFFIX="${INSTANCE:+-$INSTANCE}"
WORK="/root/deepan-src$SUFFIX"
PKG="/root/deepan-deploy$SUFFIX"

say() { printf '\n  \033[1;36m%s\033[0m\n' "$*"; }
ok()  { printf '  \033[0;32m✓\033[0m %s\n' "$*"; }
die() { printf '\n  \033[0;31m✖  %s\033[0m\n\n' "$*" >&2; exit 1; }

[ -n "$DOMAIN" ] || die "Give me your domain:  bash update.sh deepanhospital.com"
[ -n "$INSTANCE" ] && say "Updating the \"$INSTANCE\" copy at $DOMAIN — not the live site"
command -v git >/dev/null || { apt-get update -qq && apt-get install -y -qq git; }

say "1/4  Getting the latest code"
rm -rf "$WORK"
git clone --depth 1 -b "$BRANCH" "$REPO" "$WORK" >/dev/null 2>&1 \
  || die "could not download the code. Is the branch name right?  $BRANCH"
ok "$(cd "$WORK" && git log --oneline -1)"

say "2/4  Building the website"
( cd "$WORK" && npm install --silent >/dev/null 2>&1 && npm run build >/dev/null 2>&1 ) \
  || die "the build failed. Run it by hand to see why:  cd $WORK && npm run build"
[ -f "$WORK/dist/index.html" ] || die "the build produced no dist/index.html"
ok "built"

say "3/4  Assembling the package"
rm -rf "$PKG"
mkdir -p "$PKG/server"
cp -r "$WORK/dist"           "$PKG/dist"
cp -r "$WORK/server/src"     "$PKG/server/src"
cp -r "$WORK/server/scripts" "$PKG/server/scripts"
cp "$WORK/server/package.json" "$PKG/server/package.json"
cp "$WORK/package.json" "$PKG/package.json"
[ -f "$WORK/csp.js" ]    && cp "$WORK/csp.js"    "$PKG/csp.js"
cp "$WORK/deploy.sh" "$PKG/deploy.sh"
ok "package ready in $PKG"

say "4/4  Deploying"
INSTANCE="$INSTANCE" bash "$PKG/deploy.sh" "$DOMAIN"
