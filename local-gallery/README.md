# Local Gallery, inside Mote

This folder is Local Gallery's core app, copied from the Local_Gallery repo
(`/Users/jo/Programs/Local_Gallery`, version 1.7.61, commit 095ddec). It is
kept apart from Mote's own code on purpose: nothing here imports Mote, and
Mote only ever *launches* the built app.

What's here is exactly what Local Gallery's own build packs into its app:
`electron/`, `frontend/`, `tauri-bridge.js`, `tauri-fs-shim.js`,
`package.json` (the same app ID and name, so it shares Local Gallery's
settings, thumbnails and library) and `build/icon.icns`. Nothing else from
that repo (safekeeping, docs, scripts, release tooling) came over.

Mote's `npm run mac:build` builds this (`npm run gallery:build`) and tucks the
finished `Local Gallery.app` inside `Mote.app/Contents/Resources`. The Local
Gallery feature (Feature Key) adds a button that opens it.

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
