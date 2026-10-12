#!/bin/sh
# Before Local Gallery is built for Mote: makes sure Mote's changes to it are
# still there (Mote keeping the passcode, and the gallery only opening from
# Mote). Copying Local Gallery's files over again from its own repo wipes
# them; see local-gallery/README.md for putting them back.
set -e

DIR="$(cd "$(dirname "$0")/../local-gallery" && pwd)"
missing=""
[ -f "$DIR/electron/mote.js" ] || missing="$missing\n  electron/mote.js is gone"
grep -q 'mote.admit()' "$DIR/electron/main.js" || missing="$missing\n  electron/main.js doesn't check Mote's ticket"
grep -q 'registerCommands(mote.commands)' "$DIR/electron/main.js" || missing="$missing\n  electron/main.js doesn't tell the page Mote keeps the passcode"
grep -q 'if (await lgMoteKeepsPasscode())' "$DIR/frontend/index.html" || missing="$missing\n  frontend/index.html still asks for its own passcode"
grep -q 'if (LG_MOTE_KEEPS_PASSCODE) return null;' "$DIR/frontend/index.html" || missing="$missing\n  frontend/index.html still has its own Passcode menu"

if [ -n "$missing" ]; then
  printf "Local Gallery is missing Mote's changes, so it wasn't built:$missing\n" >&2
  exit 1
fi
