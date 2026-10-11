# Mote

A little face in a window that helps you tidy up your files. Everything Mote
feels shows in two pill-shaped eyes, shaped by two soft cuts: one from above
(the brows) and one from below (the cheeks).

## Helping with files

Drop something on Mote's window and Mote works out what it is, then offers
what they can do with it. Pick one (click it, or press its number, like the
terminal cleaner Mote grew out of), and Mote gets to work, reports back on
how it went, and offers everything again until you pick **Done**. While the
options are up, Mote's window grows to fit them and Mote tucks into the corner.

**A folder** gets the core cleanup:

1. **Do all of these**: every job below, top to bottom. Mote asks up front
   whether to delete anything along the way and how to compress at the end,
   and before deleting shows you what matched and waits for a yes.
2. **Open archives**: zips, rars, 7z, tarballs and more are unpacked where
   they are, then deleted (up to 8 passes, for archives inside archives). One
   that won't open is left alone.
3. **Clear out clutter**: exact duplicates are deleted (the oldest copy
   stays); look-alike pictures and videos (the best copy stays), pictures that
   are just a frame of a video, videos that never move, and empty files and
   folders are moved into `_quarantined_media` inside the folder.
4. **Tidy names**: file and folder names down to letters, numbers, spaces,
   `_` and `-`.
5. **Convert to MP4**: other video formats, and animated GIFs (when it makes
   them smaller).
6. **Remove metadata**: hidden location, camera and date info, with mat2.
7. **Delete files…**: by a rule you pick (all videos, files bigger than a
   size, older than some days, with some text in the name, leftovers like
   `.tmp` and `Thumbs.db`…). Mote always shows what matched first.
8. **Compress media…**: smaller files (pictures to AVIF, no bigger than your
   biggest screen; videos to AV1), or better quality (Optimage at its own
   settings). Nothing is replaced unless the new version is smaller.

**Videos** (one or several) get: **trim the start**, **trim the end** (by
however many seconds you like), and **save the audio as an MP3** next to them.

Mote won't work on your Mac's own folders, your Library, your whole Home
folder, or the inside of apps. If a job needs a tool that isn't installed
(ffmpeg, czkawka, mat2…), Mote offers to install it with Homebrew.

How hard your Mac works on it is the **Pace** in Settings: Gentle (quietly in
the background), Normal (one thing at a time), or Turbo (many at once, much
faster, but your Mac will be busy).

## Mote themself

Mote looks at your pointer, blinks, glances around, thinks, gets grumpy, gets
surprised, and hops happily when poked (clicked right on the face). Four quick
pokes in a row is too many, and Mote gets annoyed.

- **Petting:** press and keep stroking across Mote's face for a second or so.
  Mote melts into it and purrs.
- **Dizzy:** shaking the pointer around wildly, or throwing the window around
  the screen, makes Mote dizzy for a moment.
- **Watching along:** in the Mac app, if another visible window is playing
  sound, Mote keeps glancing toward it. Mote only knows *that* something is
  playing and where, never what. Moving the pointer a lot catches Mote's eye,
  and so does typing in another app (Mote only notices *that* keys are
  pressed, never which).

Mote is always cheerful: interactions are momentary and nothing changes
Mote over time. Mote only speaks up when something happens (after a pet,
getting dizzy, something starting to play, you coming back after a while).

(A whole system of feelings that drift over time, lasting moods and needs is
still in the code, switched off: `MIND_ENABLED` in
`src/components/companion/mind.ts`. Its Debug tab and saved state come back
with it.)

## Try it as a Mac app

Open Terminal in this folder and run:

```bash
npm run mac
```

A Mote window opens. Any change you save to the code shows up in it right away.
Drag the window by its top edge.

## Settings and debug mode

In the Mac app, press **⌘,** (Command + comma) to open Settings. You can choose
whether Mote follows your pointer, how lively Mote is, the pace
for helping with files, and whether the window floats above others.

Text in the app calls Mote "Mote", or "they/them" when a pronoun is needed.

At the bottom of Settings, **Debug mode** opens a separate window of testing tools:

- **Moods**: play any mood on demand, blink, poke, turn off automatic moods, loop a mood
- **Pose**: shape Mote's face by hand with sliders, then "Copy values" to share the numbers
- **Motion**: slow time down, freeze Mote, show outlines of the eye cuts, pretend
  another window is playing sound, give Mote a folder or video by typing its path
  (or pretend ones, in a browser), live numbers
- **Log**: everything that happened, in order
- **Data**: the saved settings, and a reset button

Closing the debug window turns debug mode off.

## Make a real Mac app you can keep

```bash
npm run mac:build
```

This takes a few minutes the first time. If you keep a copy in Applications,
drag the new one over it afterwards to update it. When it's done, the app is here:

- `src-tauri/target/release/bundle/macos/Mote.app` (drag this into Applications)
- `src-tauri/target/release/bundle/dmg/` (an installer file you can share)

## See every expression side by side

While `npm run mac` is running, open http://127.0.0.1:1420/gallery.html in a browser.
Each face there is one expression frozen in place, handy for tweaking how they look.

## Where things live

- `src/components/companion/engine.ts` — every expression and how Mote moves between them
- `src/components/companion/Face.tsx` — how the face is drawn
- `src/lib/companion/theme.ts` — sizes and positions of the face and eyes
- `desktop/` — the Mac app's pages: Mote (`index.html`), Settings, Debug, and the gallery
- `desktop/ui.tsx` and `desktop/ui.css` — the soft buttons, switches and sliders
- `src/lib/companion/settings.ts` — the list of settings and their defaults
- `src/components/companion/mind.ts` — Mote's feelings (switched off for now)
- `src/components/companion/reactions.ts` — every stimulus → response rule
- `src/components/companion/speech.ts` — everything Mote can say, and when
- `src/components/companion/SpeechBubble.tsx` — how the bubbles look
- `desktop/senses/main.swift` — the helper that notices sound, the pointer and typing
- `src/components/companion/Helper.tsx` — the conversation when you give Mote something
- `src/components/companion/assistant.ts` — what Mote says while helping, and the jobs on offer
- `src-tauri/src/tidy/` — the jobs themselves, one file per step (rebuilt from the `clean.sh` cleaner)
- `src-tauri/` — the Mac app wrapper itself
