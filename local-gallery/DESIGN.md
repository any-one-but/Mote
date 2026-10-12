# Local Gallery — Design Document

> A complete reference to the features, design language, technical standards, and
> runtime behaviors of Local Gallery and its companion tooling.
>
> This document describes the application as it exists in code at version
> `01.06.55` (branch `native-thumbnails`). It is hand-derived from the source and
> is intended to stay in sync with it; when behavior and this document disagree,
> the code is authoritative.

---

## Table of contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Data model](#3-data-model)
4. [Persistence & metadata](#4-persistence--metadata)
5. [UI layout & panes](#5-ui-layout--panes)
6. [Navigation model](#6-navigation-model)
7. [Keyboard & input system](#7-keyboard--input-system)
8. [Settings & preferences](#8-settings--preferences)
9. [Media viewing & playback](#9-media-viewing--playback)
10. [Appearance, themes & media filters](#10-appearance-themes--media-filters)
11. [Thumbnails](#11-thumbnails)
12. [Organization: scoring, tags, search, sorting](#12-organization-scoring-tags-search-sorting)
13. [File operations](#13-file-operations)
14. [Special folders & views](#14-special-folders--views)
15. [Stats & history](#15-stats--history)
16. [Notifications system](#16-notifications-system)
17. [Privacy & "panic" mode](#17-privacy--panic-mode)
18. [Design language & standards](#18-design-language--standards)
19. [Companion tooling](#19-companion-tooling)
20. [Build, release & CI](#20-build-release--ci)
21. [Features present but turned off in code](#21-features-present-but-turned-off-in-code)

---

## 1. Overview

Local Gallery is an **Electron desktop application** for viewing and organizing a
local media library (images, GIFs, and videos). It is built around browsing a
folder tree, previewing media in a large pane, and layering a workflow on top:
scoring folders, tagging and grouping them, filtering by media type / aspect
ratio, applying live visual "film" filters, and performing destructive and
non-destructive file operations (trash, storage, rename, sanitize).

Key characteristics:

- **Single-folder workspace.** The user picks one root folder ("Choose Root").
  Everything the app does happens inside that tree.
- **File System Access API.** The renderer reads and writes media through the
  browser's `showDirectoryPicker` / file-handle APIs rather than Node `fs`. The
  Electron main process is intentionally minimal.
- **Self-contained UI.** Nearly the entire app — markup, CSS, and ~52k lines of
  JavaScript — lives inlined in `index.html`.
- **Local-only metadata.** All user data (scores, tags, preferences, keybinds,
  trash records, thumbnail caches) is stored in a hidden `.local-gallery/`
  directory inside the chosen root, plus `localStorage` mirrors.
- **Companion tooling.** A standalone Bash media-processing pipeline
  (`clean.sh`), a set of macOS Automator workflows, and several Tampermonkey
  userscripts for downloading media from external sites feed the library but are
  independent of the Electron app.

---

## 2. Architecture

The Electron app has three thin layers plus one large renderer.

### `main.js` — main process

- Creates a single `BrowserWindow` (1100×750, launched fullscreen), with
  `nodeIntegration: false`, `contextIsolation: true`, and the `preload.js`
  bridge.
- Hides the menu bar and ignores menu shortcuts (`setMenuBarVisibility(false)`,
  `setIgnoreMenuShortcuts(true)`, `Menu.setApplicationMenu(null)`).
- Forwards renderer console messages and `render-process-gone` events to the
  terminal for debugging.
- Exposes exactly **one IPC handler**: `downloads-write-file`, which writes bytes
  to the OS Downloads folder under a sanitized, de-duplicated filename
  (`name (1).ext`, `name (2).ext`, …). This is the path used for exporting
  generated artifacts (e.g. GIFs).
- Standard macOS lifecycle handling (recreate window on `activate`, quit on all
  windows closed except on darwin).

### `preload.js` — context bridge

Exposes `window.electronAPI` with `isElectron: true` and two methods:

- `getPathForFile(file)` — wraps `webUtils.getPathForFile` to resolve a
  `File`'s absolute native path (used to build `file://` URLs and locate cache
  directories).
- `writeDownloadFile(payload)` — invokes the `downloads-write-file` IPC handler.

No other native capability is bridged. (This boundary matters: several in-code
features — see §21 — call `electronAPI` methods that are *not* exposed here and
are therefore inert.)

### `index.html` — renderer (the application)

A single ~59k-line file with two auto-generated inlined regions delimited by
HTML comments that must not be hand-edited:

- `<!-- BEGIN: inlined from ./styles.css -->` … `END` — all CSS (~6.6k lines).
- `<!-- BEGIN: inlined from ./app.js (auto-generated) -->` … `END` — all
  JavaScript (~52k lines).

The renderer uses the **File System Access API** (`showDirectoryPicker`,
`getDirectoryHandle`, `getFileHandle`, `createWritable`) for all media and
metadata I/O. Object URLs are created on demand and revoked when the workspace
resets.

> **Code convention:** many functions are defined more than once in the
> generated bundle; **the last declaration wins**. When editing, grep for all
> definitions and modify the final one.

---

## 3. Data model

The single global `WS` ("workspace") object holds all state. Its top-level
members:

| Field | Purpose |
|---|---|
| `WS.root` / `WS.dirByPath` | The directory tree. Nodes are `DirNode` objects (`makeDirNode()`), keyed by path. Built from File System Access handles. |
| `WS.fileById` | `Map<id, FileRecord>`. A `FileRecord` holds `{ id, file, name, relPath, dirPath, ext, type, url, thumbUrl, videoThumbUrl, size, … }`. |
| `WS.catalog` | On-disk catalog for deferred loading of very large libraries (sharded JSON under `.local-gallery/catalog/`). Holds folder summaries and per-file location/descriptor/light indexes plus a shard cache. Disabled by default (`enabled: false`) until a library is indexed. |
| `WS.fsRootHandle` / `WS.fsStoredPaths` | The writable root directory handle and the set of paths currently routed to Storage. |
| `WS.meta` | All user preferences and metadata: `options`, `scores`, `scoreHistory`, `dailyJournals`, `tags`, `tagAlbums`, `trash`, `thumbnails`, `aspectRatios`, `appearancePresets`, `appearanceAssignments`, `keybinds`, `gridKeybinds`, `dirSortMode`, etc. |
| `WS.view` | Transient UI state: filter mode, slideshow, bulk-select, search, navigation history, active pane, tag-folder view mode, favorites/hidden modes, bulk-action menu, preview selection cursor, etc. |
| `WS.nav` | The currently listed directory (`dirNode`) and its `entries[]` (a mixed list of `{kind:"dir"}` / `{kind:"file"}`), plus `selectedIndex`. |
| `WS.preview` | What the Preview Pane shows: `kind`, `dirNode`, `fileId`. |

### File typing

Files are classified by extension:

- **Image:** standard raster extensions.
- **GIF:** `.gif` (treated specially for filter processing — can be exempted).
- **Video:** `.mp4 .m4v .mov .wmv .flv .avi .webm .mkv` (`vidRE`).
- Markdown (`.md`, `.markdown`) is recognized (`mdRE`) for post-text companions.

### Aspect-ratio buckets

Files are bucketed as **portrait / square / landscape** from measured
dimensions, persisted in `aspect-ratios.log.json`. Buckets drive the aspect-ratio
filter and per-aspect Storage rules.

---

## 4. Persistence & metadata

All persistent state lives in `<root>/.local-gallery/` and is mirrored to
`localStorage`. Each metadata document is an append-style JSON "log" file with a
matching `localStorage` key prefix and a stable internal id.

### Metadata documents (`META_DOC_IDS`)

| Doc id | File name | localStorage prefix |
|---|---|---|
| `scores` | `scores.log.json` | `LocalGalleryScoresV2` |
| `scoreHistory` | `score-history.log.json` | `LocalGalleryScoreHistoryV2` |
| `dailyJournals` | `daily-journals.log.json` | `LocalGalleryDailyJournalsV1` |
| `tags` | `tags.log.json` | `LocalGalleryTagsV2` |
| `tagAlbums` | `tag-albums.log.json` | `LocalGalleryTagAlbumsV2` |
| `trash` | `trash.log.json` | `LocalGalleryTrashV1` |
| `thumbnails` | `custom-thumbnails.log.json` | `LocalGalleryThumbnailsV2` |
| `aspectRatios` | `aspect-ratios.log.json` | `LocalGalleryAspectRatiosV1` |
| `appearancePresets` | `appearance-presets.log.json` | `LocalGalleryAppearancePresetsV2` |
| `appearanceAssignments` | `appearance-assignments.log.json` | `LocalGalleryAppearanceAssignmentsV2` |
| `prefGeneral` | `preferences.general.log.json` | `LocalGalleryPreferencesGeneralV2` |
| `prefNotifications` | `preferences.notifications.log.json` | `LocalGalleryPreferencesNotificationsV2` |
| `prefAppearance` | `preferences.appearance.log.json` | `LocalGalleryPreferencesAppearanceV2` |
| `prefPlayback` | `preferences.playback.log.json` | `LocalGalleryPreferencesPlaybackV2` |
| `prefThumbnails` | `preferences.thumbnails.log.json` | `LocalGalleryPreferencesThumbnailsV2` |
| `prefFilenames` | `preferences.filenames.log.json` | `LocalGalleryPreferencesFilenamesV2` |
| `prefControls` | `preferences.controls.log.json` | `LocalGalleryPreferencesControlsV2` |
| `keybinds` | `keyboard-configuration.log.json` | `LocalGalleryKeyboard` |

> Preferences are split across several `preferences.*.log.json` files so the
> options menu's sub-sections (general / notifications / appearance / playback /
> thumbnails / filenames / controls) each persist independently.

### Other on-disk state

- `.local-gallery/catalog/` — sharded JSON catalog for deferred loading.
- `.local-gallery/video-thumbs/` — JPEG video-thumbnail cache (see §11).
- The internal trash directory `__LOCAL_GALLERY_TRASH__` (see §14).
- A legacy `folder-votes.log.json` is also referenced for backward
  compatibility (`LocalGalleryVotes::…`).

The app marks docs dirty (`metaMarkDirty`) and batches saves
(`metaScheduleSave`). The `.local-gallery` directory is always skipped during
tree/catalog scans.

---

## 5. UI layout & panes

The app is a CSS-grid layout in `#app` with three primary surfaces plus several
overlays.

### Three panes

1. **Title Pane (`#titlePane`)** — current folder title (`#titleLabel`), a
   folder **search input** (`#directoriesSearchInput`), and a status/info chip
   (`#titleInfo`).
2. **File Pane / Directories Pane (`#directoriesPane`)** — the folder tree and
   file list for the active directory. Contains the header (title, tag row,
   action menus, bulk-select row) and the scrollable `#directoriesList`. It can
   render in **list mode** or **grid mode** (`filePaneViewMode`).
3. **Preview Pane (`#previewPane`)** — the media viewer (`#previewBody`) plus a
   **Control Pane (`#controlPane`)** with transport controls and a scrub bar,
   and the **settings menu overlay** (`#menuOverlay`).

A draggable **`#divider`** resizes the file pane vs. preview pane
(`leftPaneWidthPct`), and a **`#menuDivider`** resizes the settings menu width
(`menuPaneWidthPx`).

### Control Pane

Transport row: previous item, skip back, play/pause, skip forward, next item,
and mute, plus a `#controlProgressRange` scrubber and a `#controlTimecode`
readout. Icons are inline Lucide SVGs.

### Settings menu (`#menuOverlay` / `#menuCard`)

A tabbed card with three tabs:

- **Settings** (`menuTabOptions`, data-tab `general`) — the preferences UI.
- **Controls** (`menuTabKeybinds`, data-tab `controls`) — keybind editor.
- **Stats** (`menuTabCalendar`, data-tab `calendar`) — score history & ledger.

Each tab has a footer with a status label and contextual buttons (Reset
defaults / Choose Root / Delete all logs).

### Overlays

- **Gallery / viewer overlay (`#overlay`)** — fullscreen media viewer with a
  close button, viewport, and filename caption.
- **Busy overlay (`#busyOverlay`)** — spinner + label + detail for long
  operations (workspace load, thumbnail warm, sanitize, trash, etc.).
- **Confirm/alert dialog (`#confirmOverlay`)** — themed replacement for native
  `confirm()` / `alert()`.
- **Decoy overlay (`#banicOverlay`)** — opaque black screen for panic mode (§17).
- **Thumbnail crop editor** — modal for editing a folder/file thumbnail's crop
  or chosen video frame.

---

## 6. Navigation model

This is the conceptual model on which keyboard and grid navigation are built.

### The two cursors

- **The file pane is authoritative.** `WS.nav.dirNode` is the official current
  directory; the file pane lists its children, and `WS.nav.selectedIndex` is the
  selected child.
- **The preview pane is always exactly one level below the file pane.** It shows
  the contents of the currently selected child as a "grid"; `WS.view.previewSelectedKey`
  is the cursor *within* that grid — a second, independent selection.

So at any moment: file pane = directory **D**, selected child = **C**, preview =
**C's contents**, grid cursor = an item inside C.

### Quick navigation

The `quickNavigation` option makes opening a **media folder** (a folder that
contains only files) feel like media instantly going fullscreen: the app
descends into the folder, selects the first file, and auto-closes the side panes
so the preview fills the window. Closing reopens the panes and returns to the
prior view.

The number of directory levels the panes must traverse depends on where the
folder was opened from:

- **From the file pane** (`enterSelectedDirectory`): the media folder is a direct
  child, so the file pane descends one level; closing steps back up one level.
- **From the grid** (`navigateToDirectory` → `enterMediaFolderWithQuickNavigation`):
  the file pane sits two-or-more levels above the media, so opening jumps the
  file pane straight to the media folder and descends two levels.

### The grid round-trip (preview-folder bridge)

Opening a folder from the grid uses a **preview-folder bridge** so that closing
returns *both* panes to the exact grid view in one step (avoiding a pane-level
desync). On open, `captureViewerCloseRestoreState` snapshots the full pre-open
view (current dir, selected child, previewed subfolder, and a
`pendingPreviewSelectionKey` so the opened folder is re-selected on return) into
`WS.view.previewFolderBridgeReturnState`; quick-nav additionally captures the
sidebar-close state. On close, the exit paths
(`restorePanesClosedByFilePaneEnter`, `handleClosedFilePaneNavigationAction`)
restore the bridge state if present, else fall back to a single-level
`leaveDirectory`. A freshly-applied pending selection is revealed via
`revealPreviewCard()`.

---

## 7. Keyboard & input system

Local Gallery is heavily keyboard-driven. There are **two binding sets**: the
main "pane" keybinds and a small "grid" keybind set used in grid-interaction
mode. Bindings are normalized, de-duplicated (one key → one action), and persist
in `keyboard-configuration.log.json`. Two actions are **locked** (cannot be
rebound or have their keys reused): score up (`=`) and score down (`-`).

### Default key bindings

Notation: `Cmd` is the platform command/meta key.

#### Navigation
| Action | Key | Behavior |
|---|---|---|
| Up selection | `w` | Move selection up |
| Down selection | `s` | Move selection down |
| Left selection | `a` | Move left in the preview grid, or switch to the file pane |
| Right selection | `d` | Move right in the preview grid |
| Open selection | `e` | Open the selected item |
| Up directory | `q` | Go to parent folder / close current item |
| Previous folder | `Cmd+w` | Jump to previous folder, focus first file |
| Next folder | `Cmd+s` | Jump to next folder, focus first file |
| Quick navigation (toggle) | _(unbound)_ | Toggle quick navigation |

#### Panes & surfaces
| Action | Key |
|---|---|
| File pane | `Tab` |
| Settings + File panes | `Space` |
| Refresh workspace | _(unbound)_ |
| Mute messages | _(unbound)_ |
| Preview media pane background | `b` |
| PANIC! (decoy) | `g` |

#### Random navigation & sorting
| Action | Key |
|---|---|
| Random set jump | `r` |
| Random file jump | `Shift+r` |
| Random file sort (toggle) | _(unbound)_ |
| Random folder sort (toggle) | `Cmd+r` |

#### Filters
| Action | Key |
|---|---|
| Cycle media filter | `f` |
| Cycle aspect ratio filter | _(unbound)_ |
| Cycle folder sort | `t` |
| Cycle animated filters | `Cmd+i` |

#### Visibility (reveal special entries)
| Action | Key |
|---|---|
| Reveal hidden items | `h` |
| Trash folder | `Cmd+Alt+t` |
| Untagged folder | `u` |
| Storage folder | `Cmd+Shift+s` |

#### Playback
| Action | Key |
|---|---|
| Slideshow mode | `v` |
| Video skip backward | `z` |
| Video skip forward | `c` |
| Pause/Play video | `x` |
| Mute/Unmute video | `Cmd+x` |
| Shuffle Play (toggle) | _(unbound)_ |

#### Folder actions
| Action | Key |
|---|---|
| Favorite folder selection | `Cmd+f` |
| Tag folder selection | `Shift+t` |
| Rename selected item | _(unbound)_ |
| Increase folder score (locked) | `=` |
| Decrease folder score (locked) | `-` |

#### Appearance & filenames
| Action | Key |
|---|---|
| Light mode | `i` |
| Cycle presets | _(unbound)_ |
| Toggle hide file extensions | _(unbound)_ |
| Trim before last dash | `n` |
| Trim after first underscore | _(unbound)_ |

#### Appearance preset toggles
Each saved appearance preset gets a dynamic toggle action
(`toggleAppearancePreset:<id>`). The five built-in non-default presets are bound
to `1`–`5` by default (Basic, Film, Tint, VHS, Win95).

#### Grid keybinds (grid-interaction mode)
| Action | Key |
|---|---|
| Move selection up | _(unbound)_ |
| Move selection down | _(unbound)_ |
| Open selection | `d` |

The normalizer migrates older bindings forward (e.g. legacy `Space`→play moved to
`x`, `q`/`e` seek moved to `z`/`c`, `a`/`d` dir-step restored to selection, etc.)
so saved configs upgrade cleanly across versions.

---

## 8. Settings & preferences

The **Settings** tab renders sections in this order: **General, Thumbnails,
Reveal, Filters, Playback, Filenames, Storage**. Defaults come from
`defaultOptions()`; values are clamped/validated by `normalizeOptions()`.

### General
| Setting | Default | Description |
|---|---|---|
| Quick navigation | on | Auto-close side panes when opening a files-only folder; restore on exit. |
| Mute messages | off | Hide status/notification messages. |
| Light Mode | off | Switch between light and dark UI variants. |
| Extra file info | on | Show counts, sizes, scores, item-type on file-pane entries. |
| Blank row after tag folders | on | Insert a spacer separating tag/favorites/album folders from regular folders. |
| Preview media pane background | off | Keep preview media on the recessed pane surface instead of black. |
| Workspace | — | "Refresh Workspace" action (re-reads the writable root from disk). |

### Thumbnails
Per **Files**, **Folders** (root + subfolder), and **Tags** card kinds, toggle
which metadata badges appear and the title size: **Title**, **Size**,
**File count**, **Folder count**, **Menu button**, plus a **Title size** toggle
(small/large). These map to a large family of `show*ThumbnailTitles`,
`hide*ThumbnailMenuButton`, and `*ThumbnailTitleSize` option keys.

### Reveal
| Setting | Default |
|---|---|
| Hidden items | off |
| Trash folder | on |
| Storage folder | on |
| Untagged folder | off |

### Storage
Auto-storage routing rules. Toggling one **sends every currently loaded and
future** matching file to Storage until turned off:
**Portrait / Square / Landscape files** and **Images / GIFs / Videos**
(all default off).

### Filters
- A **filter-preset manager** (apply / save / rename / delete appearance presets).
- The full set of overlay sliders (see §10).
- **Animated filters** select: Off / On / Videos only (default On).
- **GIFs ignore processing** (default off) — keep GIFs unfiltered when overlays
  are on.

### Playback
| Setting | Options / Default |
|---|---|
| Video audio | Muted / **Unmuted** |
| Video skip step | 1 / 3 / **5** / 10 / 15 / 30 seconds |
| Video end behavior | **Loop** / Advance to next / Stop |
| Shuffle Play | off — one-pass randomized, non-repeating segment order |
| Crop persistent black bars | off — detect & crop letterbox/pillarbox before filters; videos sample multiple moments |
| Slideshow speed | **Cycle speeds** / Toggle 1s / 3s / 5s / 10s |

### Filenames
Display-only name transforms (do not rename files on disk):
| Setting | Default |
|---|---|
| Force Title Case | on |
| Show position numbers | off |
| Hide file extensions | on |
| Hide underscores | on |
| Trim before last dash | on |
| Trim after first underscore | on |

Plus a **"Sanitize Names Across Root"** action that *does* rename files/folders
on disk using the same rules as `clean.sh` step 6 (see §13).

### Footer actions
Each settings tab footer offers **Reset defaults**, **Choose Root**, and (Stats
tab) **Delete all logs**.

---

## 9. Media viewing & playback

### Preview & gallery modes

- **Preview pane** shows the selected item (folder grid or single media). The
  default `previewMode` is `grid`.
- **Gallery / viewer overlay** is the fullscreen single-item viewer with its own
  transport, filename caption, and close button.

### Video behavior

- **Audio:** `videoAudio` (muted/unmuted), with per-session mute toggle.
- **Seeking:** left/right seek by `videoSkipStep` seconds.
- **End behavior:** loop, advance to next, or stop.
- **Shuffle Play:** plays a video through a randomized, non-repeating order of
  internal segments (one pass), giving a "scrambled" playback without repeats.
- **Crop persistent black bars:** when enabled, detects black borders on images
  and videos and crops them before overlays/filters apply; videos are sampled at
  several timestamps so only persistent bars are removed.

### Quad playback

Selecting **exactly four videos** in bulk surfaces a **Play** action that opens a
2×2 simultaneous video grid (`openQuadPlaybackForRecords`,
`VIEWER_LAYOUT_MODE === "quad"`). One slot is "active" for audio; navigation keys
move the active slot. Quad video *thumbnails* are a separate, disabled concept
(see §21) — quad *playback* is live.

### Slideshow

Toggled with `v`. Speed follows the `slideshowDefault` setting: a fixed interval
(1/3/5/10s) or **Cycle speeds**, which rotates through the intervals.

### Control pane

The transport bar mirrors keyboard actions (prev/next item, skip back/forward,
play/pause, mute) and provides a draggable scrubber with a live timecode.

---

## 10. Appearance, themes & media filters

### Themes & light mode

The app ships a retro/90s visual identity with two CSS themes selected via the
`data-theme` attribute:

- `retro90s` — light variant (warm paper background `#c7c7b7`, near-black text).
- `retro90s-dark` — dark variant (near-black background, warm off-white text).

`colorScheme` defaults to `retro`; the **Light Mode** toggle (`lightMode`, key
`i`) switches between the two. The palette is driven by CSS custom properties
(`--color0-*` foreground, `--color1-*` surface, `--palette-accent`, tag
include/exclude colors, score-positive/negative stats colors, focus rings, hover
shadows). Folder card sizing is also theme-tokenized (`--folder-grid-min`, etc.).

### Media filters (overlays)

A live, per-frame visual processing system applies "film" looks to displayed
media. Processing is done in the renderer via canvas (`scratchCtx`,
`getImageData`/`putImageData`, canvas `filter` for blur) plus CSS/SVG filters
(`#kodak-film`, `#kodak-grain`, `#polaroid-film`, `#polaroid-grain`,
`#crt-chroma` are defined inline). When a custom overlay is active the app sets
`data-media-filter="custom-overlay"` on `#app`.

Each overlay has an enabled flag, an intensity (nullable = "neutral/unset"), and
a clamped range. The **slider overlays** exposed in the Filters UI are:

| Slider (UI label) | Option key | Range |
|---|---|---|
| Brightness | `brightnessOverlayIntensity` | −0.6 … 1.5 |
| Contrast | `contrastOverlayIntensity` | −0.75 … 2 |
| Saturation | `saturationOverlayIntensity` | −1 … 3 |
| Temperature (warmth) | `warmthOverlayIntensity` | −1 … 1 |
| Hue shift | `hueShiftOverlayIntensity` | −180 … 180 |
| Black crush | `blackCrushOverlayIntensity` | 0 … 0.8 |
| White crush | `whiteCrushOverlayIntensity` | 0 … 0.8 |
| Color crush | `colorCrushOverlayIntensity` | 0 … 2 |
| Pixelation | `pixelateOverlayIntensity` | 1 … 16 |
| Blur | `blurOverlayIntensity` | 0 … 8 |
| Detail (upscale smoothing) | `upscaleSmoothingOverlayIntensity` | 0 … 1 |
| Chromatic aberration | `chromaOverlayIntensity` | 0 … 8 |
| Halation bloom | `halationOverlayIntensity` | 0 … 1 |
| Temporal ghosting | `ghostingOverlayIntensity` | 0 … 1 |
| Tape fuzz (line damage) | `lineDamageOverlayIntensity` | 0 … 1 |
| Grain | `grainOverlayIntensity` | 0 … 0.5 |
| Vignette | `vignetteOverlayIntensity` | 0 … 1 |
| Film corners | `filmCornerOverlayIntensity` | 0 … 1 |

> A separate `upscalerOverlay*` pair exists in the option schema but is **not**
> in the slider list and has no UI — see §21.

**Animated filters** (`animatedMediaFilters`: Off / On / Videos only) control
whether grain, ghosting, and tape fuzz animate over time. **GIFs ignore
processing** exempts GIFs from overlays.

### Appearance presets

Presets snapshot all slider intensities and can be applied, saved, renamed, and
deleted. Built-ins:

| Preset | Notable values |
|---|---|
| **Default** (`builtin-null`, locked) | all neutral/null — no effect |
| **Basic** | upscale smoothing 1, film corners 0.01 |
| **Film** | hue +10, sat 0.35, warmth 0.1, smoothing 1, chroma 0.4, grain 0.08 |
| **Tint** | hue +10, sat 0.35, contrast 0.1, warmth 0.1, smoothing 1 |
| **VHS** | hue +10, sat 0.35, contrast −0.05, warmth 0.1, halation 0.16, ghosting 0.16, line damage 0.52, blur 0.4, chroma 1.6, grain 0.08, vignette 0.07 |
| **Win95** | color crush 0.02, pixelation 3.5, smoothing 1 |

The active preset is `activeAppearancePresetId`. Presets can be:

- **Cycled** alphabetically (Default first) via the "Cycle Presets" action.
- **Toggled** individually via per-preset keybinds (1–5 by default).
- **Assigned per folder or per tag** as an override (folder/tag menu → "Filters"),
  stored in `appearance-assignments.log.json`. Overrides can be cleared
  ("Clear media preset override").

---

## 11. Thumbnails

### Card kinds & display options

Thumbnails appear on **file cards**, **root-folder cards**, **subfolder cards**,
and **tag cards**. For each kind the user controls (via Settings → Thumbnails)
title visibility, title size, size badge, file/folder counts, and the menu
button. Folder cards can show a **rotating** thumbnail (cycling through contained
media), a fixed chosen thumbnail/frame, or none (`__thumb_rotate__`,
`__thumb_none__` sentinels). Custom thumbnails/crops persist in
`custom-thumbnails.log.json`.

### Thumbnail scale & style

- **Style:** `thumbnailStyle` is effectively **cropped** only (the "aspect"
  natural-ratio style is gated off — see §21).
- **Scale:** grid column counts map from a scale tier (`row3`…`row10`), default
  `row7` (7 columns). Cropped and aspect scales are tracked separately
  (`thumbnailScaleCropped`, `thumbnailScaleAspect`).

### Video thumbnail cache (`VideoThumbCache`)

To avoid mounting a live `<video>`/WebMediaPlayer for every video tile in a dense
grid, the app maintains a **static video-thumbnail cache** (Electron path):

- Cache files: `<root>/.local-gallery/video-thumbs/vt_<hash(relPath)>__<size>__<frameMs>.jpg`
  (512px JPEG). The filename encodes size and frame, so editing the chosen frame
  or replacing the file yields a new name; stale variants are deleted on regen.
- Generation decodes one frame via a temporary `<video>` → canvas → `toBlob`,
  capturing from a blob URL (not `file://`, which would taint the canvas).
- A two-tier queue prioritizes on-demand (grid render) generation over a
  background whole-library warm (`startVideoThumbWarm`), concurrency ~3.
- File cards render an `<img>` when a cached frame exists, else fall back to a
  live `<video>` and enqueue generation.
- Wired into workspace open (`initVideoThumbCacheForWorkspace`), warm at end of
  open, reset on workspace reset, and crop-editor frame changes. Diagnostic:
  `videoThumbCacheStats()`.

Live-video concurrency throttles still apply to not-yet-cached videos
(images load at a higher concurrency than videos). Worker/concurrency budgets
scale with `navigator.hardwareConcurrency`.

> Historical note: earlier designs used a renderer canvas disk cache
> (`thumb-cache/`, 384px) and a never-merged native main-process pipeline
> (`thumb://` protocol + SQLite via sharp/ffmpeg). Neither is the current path;
> the `thumb://` protocol does not exist in the shipped renderer.

---

## 12. Organization: scoring, tags, search, sorting

### Scoring ("votes")

Each folder carries an integer **score**, adjusted up/down with the locked
`=` / `-` keys or the per-card up/down vote box. Scores persist in
`scores.log.json`, and every change is logged to `score-history.log.json` with a
timestamp (driving the Stats calendar and the daily journals). Scores can be
bumped in bulk across a selection (`metaBumpScoreBulk`). A folder's order can be
reset (clearing manual ordering).

### Sorting

Folder sort mode (`dirSortMode`, default **Score**) cycles with `t`. Modes:

| Mode | Meaning |
|---|---|
| Name | Alphabetical |
| Score | By folder score (default) |
| Efficiency | Score ÷ recursive item count |
| Size | Total bytes, descending |
| Item count | Recursive file count |

(Score and Efficiency are hidden when score UI is disabled.)

### Random ordering & jumps

- **Random file sort** / **Random folder sort** toggles shuffle the listing
  order (folder shuffle bound to `Cmd+r`).
- **Random set jump** (`r`) jumps to a random folder and focuses its first
  matching file; **Random file jump** (`Shift+r`) jumps to a random folder and a
  random matching file.

### Media & aspect filters

- **Media filter** (`f`) cycles **All / Images / Videos / GIFs** (root-wide).
- **Aspect ratio filter** cycles **All / Portrait / Square / Landscape**.
- Both interact with the per-folder/per-tag content filters and the catalog.

### Tags, albums, favorites, hidden

Folders are organized with a tag system stored in `tags.log.json` /
`tag-albums.log.json`:

- **Tags** — free-form labels applied to folders (single or bulk, via `Shift+t`
  or the folder menu → Tag). Tag *folders* appear as virtual entries that gather
  all folders carrying a tag. Tags can be renamed, deleted, and an **inverse
  tag** (everything *not* carrying the tag) can be created.
- **Albums** — named groupings of tags (`tag-albums.log.json`); tags can be
  added to / removed from an album, and albums deleted.
- **Favorites** (`__favorite__`) — a built-in tag with a favorites view and the
  `Cmd+f` toggle; favorited folders get an accent-colored title.
- **Hidden** (`__hidden__`) — folders/tags hidden from normal views; revealed
  with `h` or the Reveal settings. Hidden items can be excluded from stats.
- **Untagged** — a virtual folder gathering folders with no tags (toggle `u`).
- A legacy **processing-disabled** tag (`__processing_disabled__`) is recognized
  but ignored (stripped during reads).

Tag entries also support per-tag appearance-preset overrides and per-tag content
filters in their bulk menus.

### Search

The Title-Pane search input (`#directoriesSearchInput`) filters within the
current root (`searchRootPath`); results render in the file pane with their own
spacer/scroll context.

---

## 13. File operations

Operations are reachable from per-item menus (folder/file ⋯ menus) and from the
**bulk-action menu** that appears when items are selected in bulk-select mode.

### Per-folder menu actions
Tag, Rename, Favorite/Unfavorite, **Store** (send to Storage), Hide/Unhide,
**Filters** (assign appearance preset), folder thumbnail submenu (default /
rotate / none / pick), **Index** (build catalog for the folder), Reset order,
and **Move to trash** (destructive). Trash and Storage stub folders get reduced
menus (Remove from trash / Remove from storage / Move to trash). Root folder gets
Filters / thumbnail / Index.

### Per-file menu actions
Thumbnail submenu and **Rename**. Selecting four videos adds **Play** (quad).

### Bulk-action menu
Operates on a heterogeneous selection of folders, tag folders, and files:

- **Folders:** Tag, Rename (single), Favorite/Unfavorite, Store, Hide/Unhide,
  Filters (preset submenu), Move to trash.
- **Tag entries:** Album (assign), Rename (single), Delete, Hide/Unhide,
  Create inverse, Filters override.
- **Files:** Rename file (single), Play (4 videos → quad).
- **Trash/Storage selections:** Remove from trash / Remove from storage.

### Rename & sanitize
- **Rename** edits an item's name on disk (inline editor).
- **Sanitize Names Across Root** walks the writable root and renames files and
  folders using `clean.sh` step-6 rules, updating internal metadata and reloading
  the workspace.

### Trash
"Move to trash" relocates folders/items into the internal trash directory
`__LOCAL_GALLERY_TRASH__` and records the original location in `trash.log.json`,
so **Remove from trash / Put Back** can restore them. The Trash entry appears at
root (toggle `Cmd+Alt+t`).

### Storage
"Store" moves items into a Storage area and tracks them in `WS.fsStoredPaths`.
Auto-storage rules (Settings → Storage) continuously route matching files (by
aspect bucket or media type) into Storage. Stored items appear under a Storage
folder (toggle `Cmd+Shift+s`) as stubs and can be removed from storage or moved
to trash.

### Set Merge / Loose Set Merge
Two folder/file consolidation operations exist in code (`setMergeSelectedDirs`,
`looseSetMergeSelectedFiles`) with matching macOS Automator workflows. **Neither
currently has an active in-app UI entry point** — see §21. (Equivalent merges are
available through the Automator workflows.)

---

## 14. Special folders & views

The root listing and grid can include several **virtual / special entries**, each
individually revealable:

- **Trash** (`Trash` label, internal dir `__LOCAL_GALLERY_TRASH__`) — holds
  trashed items; supports Put Back.
- **Storage** (`Storage` label) — holds stored items as stubs.
- **Hidden** — folders/tags hidden by the hidden tag.
- **Untagged** — folders with no tags.
- **Favorites** — favorited folders.
- **Above-root view** (`aboveRootView`) — a synthetic level above the chosen
  root.

Special folders are placed with a configurable spacer row separating them from
regular folders (`showTagFolderSpacerRow`).

---

## 15. Stats & history

The **Stats** tab visualizes engagement derived from score history:

- A **monthly score-history calendar** (heatmap) — each day's net score delta is
  colored by magnitude/sign; days with journal entries are shown even with no
  delta.
- A **root-folder ledger** listing each top-level folder with its score, item
  count, size, and **efficiency** (score ÷ item count), sorted by the active sort
  key.
- **Daily journals** (`daily-journals.log.json`) accumulate per-day markdown
  headers per root folder from score events.
- Hidden items can be included or excluded from stats
  (`includeHiddenItemsInStats`).
- Footer offers **Delete all logs** (clears score history).

---

## 16. Notifications system

Status/notification messages are bucketed by source so each category can be
individually silenced (Settings → notifications; all default **on**). A master
**Mute messages** switch hides everything. Buckets (`NOTIFICATION_SOURCE_SPECS`)
include, among others:

- Library & workspace: folder loading / read-only state, workspace refresh,
  storage portal messages.
- Panes & surfaces: pane/surface toggles.
- Hidden & special views: visibility toggles, quick navigation.
- Cycling actions: media filter, aspect-ratio filter, animated filters, folder
  sort, video-end behavior.
- Random navigation & sorting: set/file jump, random file sort, random folder
  sort.
- Playback, appearance & filenames, appearance presets, tags/albums, rename,
  trash, delete, merge, scrub, stats, and a fallback "misc" bucket.

Each bucket maps to a `notify*` boolean option key.

---

## 17. Privacy & "panic" mode

The **PANIC!** action (`g`, internally "banic") instantly toggles a decoy state:
an opaque black overlay (`#banicOverlay`) covers the entire window, all media is
paused and muted, and slideshow state is suspended. Pressing the key again
restores the previous playback state. This is a quick "hide what's on screen"
control. Combined with the hidden-folder system and the lack of any cloud sync,
the app keeps the library private and local by design.

---

## 18. Design language & standards

- **Visual identity:** a retro/90s aesthetic — flat warm-paper / dark surfaces,
  hard hover shadows (`0 3px 0`), chunky bordered controls, DOS-style framing
  echoed in `clean.sh`'s terminal UI.
- **Theming via CSS custom properties.** Two themes (`retro90s`,
  `retro90s-dark`) define a tokenized palette (`--color0-*`, `--color1-*`,
  accents, tag colors, stats colors, focus/hover). New surfaces should consume
  tokens, not hard-coded colors.
- **Icons:** inline Lucide SVGs with `currentColor` so they inherit theme color.
- **Accessibility hooks:** `role`/`aria-*` on tabs, dialogs, sliders/spinbuttons,
  and live regions; keyboard parity for primary actions.
- **Native dialogs replaced:** `confirm`/`alert` are themed overlays
  (`#confirmOverlay`).
- **Performance posture:** virtualized lists for large folders, `requestAnimationFrame`
  batching for layout (grid card sizing), concurrency budgets scaled to CPU
  cores, disk-cached video thumbnails, and explicit release of media elements to
  avoid WebMediaPlayer exhaustion.
- **Data safety:** all writes go through the File System Access API to the chosen
  root; `.local-gallery/` is always skipped in scans; destructive actions use a
  recoverable internal trash rather than immediate deletion where possible.

---

## 19. Companion tooling

These ship alongside the app but run independently.

### `clean.sh` (media-processing pipeline)

A standalone Bash tool (script version `1.8.6`) with a DOS-style TTY UI and an
ASCII fallback for pipes. It runs a configurable, ordered set of **11 steps**
against a media folder:

1. Dedupe files (`fdupes`)
2. Move lower-quality similar media (`czkawka`)
3. Convert videos to MP4 (`ffmpeg`)
4. Resize oversized media (max height `MAX_MEDIA_HEIGHT=3200`)
5. Remove metadata (`mat2`)
6. Sanitize file and folder names (shared with the in-app sanitizer)
7. Quarantine empty files and folders (into `_clean_empty_items`)
8. Upscale and denoise media (`waifu2x-ncnn-vulkan`, scale 2 / noise 3,
   auto-installed under `~/.local/share/local_gallery/`)
9. Trim video starts (default 10s)
10. Trim video ends (default 10s)
11. Extract MP3 audio from videos

Each step declares tool requirements and is skippable. Not invoked by the
Electron app.

### macOS Automator workflows (`Automator workflows/`)

Finder Quick Actions for batch library maintenance, including: dedupe folder;
alphabetical inventory; **loose set merge** (+ simulation); **set merge**;
pack / un-pack (nonrecursive); and rename helpers (one/two levels, files /
directories).

### Tampermonkey / Violentmonkey userscripts

Browser userscripts that download media from external sites into the gallery
folder. They are fully independent of the Electron app.

| Script | Version | Target | Purpose |
|---|---|---|---|
| **Stripper** | 00.17.00 | Reddit | Reddit media + post-text (Markdown) downloader with a built-in "Rabbithole" click-path map (vis-network). |
| **PostDownloaderCustom** | 01.02.01 | SimpCity threads | Downloads images/videos from forum posts (Coomer/Kemono/Bunkr/Box, etc.). |
| **PartyGuest** | 01.13.10 | Coomer / Kemono | Bulk image/video downloader. |
| **PersonalAddBlocker** | 3.2.0 | SimpCity / Coomer / Kemono / others | Cosmetic ad blocking via injected CSS. |

> Note (from project memory): Stripper's Rabbithole Reddit map uses GM storage,
> which is per-script — data from an older standalone version is not shared.

### Repo scripts (`scripts/`)

- `release-patch.js` — bumps the zero-padded version, writes `package.json` /
  `package-lock.json`, commits `release: v<version>`, pushes, then builds
  (`--dry-run` supported).
- `_commit_indexed.sh` + `authoritative.sh` / `checkpoint.sh` / `stable.sh` /
  `unstable.sh` — stage-all, then commit/push with an auto-incremented indexed
  subject (`Checkpoint 0007`, etc.).

---

## 20. Build, release & CI

- **Run:** `npm start` or `npm run tauri:dev` (Tauri dev server + system WebView + Rust backend).
- **Build:** `npm run tauri:build` (or `npm run dist` / `npm run build` aliases).
  Tauri bundles the synced `frontend/` + Rust binary + resources/ffmpeg.
  macOS outputs `.app` + `.dmg` (plus others for target platforms).
- **Release:** `npm run release:patch` runs `scripts/release-patch.js` (version
  bump for package + tauri.conf + Cargo.toml → commit → push → tauri build).
- **Versioning:** zero-padded `MAJOR.MINOR.PATCH` in package.json (e.g. `01.06.60`);
  Tauri/Cargo use the clean semver form. Last segment increments per patch.
- **CI:** `.github/workflows/build-windows.yml` runs Tauri build on Windows
  (Node + Rust toolchain). Artifacts are in the tauri bundle dir.
- **Rust tests:** `cd src-tauri && cargo test`.
- **Dependencies:** Tauri v2 CLI + API (dev), ffmpeg-static (for bundling); no
  runtime npm deps and no JS test suite. The `frontendDist` build excludes
  node_modules by design via the sync step.

---

## 21. Features present but turned off in code

These exist in the codebase but are disabled, gated off, or have no reachable UI
in the shipped app.

### Hard-gated by constants

- **Aspect-ratio (natural-ratio) thumbnail style** — `ENABLE_ASPECT_RATIO_THUMBNAIL_STYLE = false`.
  The "aspect" thumbnail style remains in code for future reactivation, but the
  app forces **cropped** thumbnails only. Related helpers
  (`naturalAspectThumbnailCardsEnabled`, `previewSquareMediaThumbsEnabled`) are
  stubbed to no-ops. The persisted `betaAspectRatioThumbCards` preference is
  ignored while the gate is off.
- **Quad thumbnails** — `ENABLE_QUAD_THUMBNAILS = false`. The quad-thumbnail
  logic is kept but forced off in the shipped UI/runtime path. (Quad *playback*
  of four selected videos is a separate, active feature.)

### Present in schema, no UI surface

- **Upscaler overlay** — `upscalerOverlayEnabled` / `upscalerOverlayIntensity`
  exist in `defaultOptions()` / `normalizeOptions()` and in presets, but the key
  is **not** in `APPEARANCE_SLIDER_OPTION_KEYS`, so no slider renders and the
  overlay is effectively inert. (The visible "Detail" slider is the separate
  `upscaleSmoothing` overlay.)

### Defined but not invoked (orphaned)

- **Scrub** — `scrubFoldersByPaths` and its messages/notifications exist, but it
  has no UI trigger and calls `window.electronAPI.scrubFolder`, which is **not
  exposed by `preload.js`**. At runtime it always reports "Scrub is unavailable."
- **Set Merge** — `setMergeSelectedDirs` is fully implemented but has no button
  or `data-action` that calls it; reachable only via the standalone Automator
  workflow.
- **Loose Set Merge** — `looseSetMergeSelectedFiles` is wired through
  `runFileActionFromMenu("loose-set-merge")`, but no menu currently emits that
  action string, so there is no active in-app entry point (Automator workflow
  only).

### Legacy / compatibility-only

- **Processing-disabled tag** — `__processing_disabled__` (`LEGACY_PROCESSING_DISABLED_TAG`)
  is recognized for backward compatibility but stripped/ignored everywhere it is
  read; no current feature sets it.
- **Legacy votes file** — `folder-votes.log.json` (`LocalGalleryVotes::…`) is read
  for migration; current scoring uses `scores.log.json` + `score-history.log.json`.
- **Native main-process thumbnail pipeline** (`thumb://` protocol, SQLite cache
  via `sharp`/`ffmpeg-static`/`better-sqlite3`) — described in project history but
  **not present** in the current renderer or `preload.js`; the active path is the
  renderer-side `VideoThumbCache` (§11).

### Default-off behaviors worth noting

These are real, working features that simply ship disabled by default:
`preloadNextMode` (`off`), `thumbnailLoading` (`false`), `shufflePlay`,
`autoCropBlackBars`, `gifsIgnoreProcessing`, all six auto-**Storage** routing
rules, `showHiddenFolder`, `showUntaggedFolder`, and the hidden-in-UI score
keybinds (`scoreUpSelection` / `scoreDownSelection`, `hiddenInUi: true`, bound to
the locked `=` / `-`).

---

*End of document.*
