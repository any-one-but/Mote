#!/bin/sh
# Tucks the built Local Gallery app inside Mote.app (in Contents/Resources),
# then makes Mote's installer again so it carries the gallery too. Run by
# `npm run mac:build`, after the gallery and Mote are both built.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GALLERY="$ROOT/local-gallery/dist-electron/mac-arm64/Local Gallery.app"
BUNDLE="$ROOT/src-tauri/target/release/bundle"
MOTE="$BUNDLE/macos/Mote.app"
VERSION="$(node -p "require('$ROOT/package.json').version")"
DMG="$BUNDLE/dmg/Mote_${VERSION}_aarch64.dmg"

if [ ! -d "$GALLERY" ]; then
  echo "Local Gallery isn't built (npm run gallery:build); Mote is left without it."
  exit 0
fi

# ditto keeps the Electron framework's links and signatures intact.
rm -rf "$MOTE/Contents/Resources/Local Gallery.app"
ditto "$GALLERY" "$MOTE/Contents/Resources/Local Gallery.app"

# The installer: Mote.app and a shortcut to Applications to drag it onto.
STAGE="$(mktemp -d)"
ditto "$MOTE" "$STAGE/Mote.app"
ln -s /Applications "$STAGE/Applications"
rm -f "$DMG"
hdiutil create -quiet -volname Mote -srcfolder "$STAGE" -format UDZO "$DMG"
rm -rf "$STAGE"

echo "Local Gallery is inside Mote.app; installer: $DMG"
