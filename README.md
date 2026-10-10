# Mote

A little face in a window. Everything he feels shows in his two pill-shaped eyes,
which get shaped by two soft cuts: one from above (his brows) and one from below
(his cheeks).

He looks at your pointer, blinks, glances around, thinks, gets grumpy, winks,
gets surprised, dozes off if you leave him alone, and hops happily when you click him.
Click him four times in a row quickly and he gets annoyed.

## Try it as a Mac app

Open Terminal in this folder and run:

```bash
npm run mac
```

A Mote window opens. Any change you save to the code shows up in it right away.
Drag the window by its top edge.

## Settings and debug mode

In the Mac app, press **⌘,** (Command + comma) to open Settings. You can choose
a gender (saved, but nothing uses it yet), whether Mote follows your pointer,
whether he naps, how lively he is, and whether his window floats above others.

At the bottom of Settings, **Debug mode** opens a separate window of testing tools:

- **Moods**: play any mood on demand, blink, poke, turn off automatic moods, loop a mood
- **Pose**: shape his face by hand with sliders, then "Copy values" to share the numbers
- **Motion**: slow time down, freeze him, show outlines of the eye cuts, live numbers
- **Log**: everything that happened, in order
- **Data**: the saved settings, and a reset button

Closing the debug window turns debug mode off.

## Make a real Mac app you can keep

```bash
npm run mac:build
```

This takes a few minutes the first time. When it's done, the app is here:

- `src-tauri/target/release/bundle/macos/Mote.app` (drag this into Applications)
- `src-tauri/target/release/bundle/dmg/` (an installer file you can share)

## See every expression side by side

While `npm run mac` is running, open http://127.0.0.1:1420/gallery.html in a browser.
Each face there is one expression frozen in place, handy for tweaking how they look.

## Where things live

- `src/components/companion/engine.ts` — every expression and how he moves between them
- `src/components/companion/Face.tsx` — how the face is drawn
- `src/lib/companion/theme.ts` — sizes and positions of the face and eyes
- `desktop/` — the Mac app's pages: Mote (`index.html`), Settings, Debug, and the gallery
- `desktop/ui.tsx` and `desktop/ui.css` — the soft buttons, switches and sliders
- `src/lib/companion/settings.ts` — the list of settings and their defaults
- `src-tauri/` — the Mac app wrapper itself
