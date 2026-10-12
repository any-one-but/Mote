# Local Gallery, inside Mote

This folder is Local Gallery's core app, copied from the Local_Gallery repo
(`/Users/jo/Programs/Local_Gallery`, version 1.7.61, commit 095ddec). It is
kept apart from Mote's own code on purpose: nothing here imports Mote, and
Mote only ever *launches* the built app.

What's here is exactly what Local Gallery's own build packs into its app:
`electron/`, `frontend/`, `tauri-bridge.js`, `tauri-fs-shim.js`,
`package.json` (the same app ID and name, so it shares Local Gallery's
settings, thumbnails and library) and `build/icon.icns`.

Also here, only for keeping (never built into the app, which packs just the
files above): `docs/VARIATIONS_DESIGN_LANGUAGE.html` and `DESIGN.md`, copied
as they were. Local Gallery's safekeeping folder (clean.sh, the userscripts,
Automator workflows, the dev launcher script, mod_merge.js, compare.html, the
old icon) is at the top of Mote's folder, in `safekeeping/`. Local Gallery's
scripts, release tooling and working notes didn't come over.

Mote's `npm run mac:build` builds this (`npm run gallery:build`) and tucks the
finished `Local Gallery.app` inside `Mote.app/Contents/Resources`. The Local
Gallery feature (Feature Key) adds a button that opens it.

## Mote's changes to it

Mote keeps the passcode for this copy (see Mote's README), so a few small
changes here are Mote's own, each marked with a `Mote:` comment:

- `electron/mote.js` (new): only opens when Mote hands it a one-time ticket,
  tells Mote while it's open, closes when Mote asks (Lock now, hiding the
  folder), and tells the page Mote keeps the passcode.
- `electron/main.js`: loads `mote.js`, checks the ticket before anything opens.
- `frontend/index.html`: skips its own passcode screen (and its
  `lock.log.json`) and drops its Passcode menu when Mote keeps the passcode.
  Anywhere else (the browser version, the app from its own repo) these do
  nothing.

`npm run gallery:build` checks these are still there (with
`scripts/check-gallery-mote.sh`) and refuses to build without them.

## Updating it

Copy the same files over again from the Local_Gallery repo, then run
`npm run gallery:build` in Mote's folder:

```bash
cd /Users/jo/Programs/Local_Gallery
cp -R electron tauri-bridge.js tauri-fs-shim.js package-lock.json ../Mote/local-gallery/
cp frontend/index.html frontend/variations.html ../Mote/local-gallery/frontend/
```

(Keep this folder's `package.json` scripts as they are: `build` here makes
only the app, no installer.)

Copying `electron/` and `frontend/index.html` over wipes Mote's changes
(`electron/mote.js` stays, since Local Gallery has no file by that name). Put
them back from git before building: `git diff` shows exactly what they were.
