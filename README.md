# Mote

A little face in a window. Everything Mote feels shows in two pill-shaped eyes,
shaped by two soft cuts: one from above (the brows) and one from below (the cheeks).

Mote looks at your pointer, blinks, glances around, thinks, gets grumpy, winks,
gets surprised, dozes off when left alone, and hops happily when clicked.
Four quick clicks in a row is too many, and Mote gets annoyed.

Mote can also wear cat-ear headphones and a bushy mustache (both in Settings).
Each brings three extra idle moods: the mustache gets twirled, blown on, and
almost sneezed through; the headphones bring listening for sounds, bopping to
music, and cat-like ear flicks.

## Try it as a Mac app

Open Terminal in this folder and run:

```bash
npm run mac
```

A Mote window opens. Any change you save to the code shows up in it right away.
Drag the window by its top edge.

## Settings and debug mode

In the Mac app, press **⌘,** (Command + comma) to open Settings. You can choose
Mote's gender, whether Mote follows your pointer, naps, how lively Mote is,
the accessories, and whether the window floats above others.

The gender setting sets Mote's pronouns (he/him, they/them, she/her). Every bit
of text in the app that talks about Mote follows it. When adding new text, build
it from `usePronouns()` / `pronounsFor()` in `src/lib/companion/pronouns.ts`
instead of writing "he", "she" or "they" directly.

At the bottom of Settings, **Debug mode** opens a separate window of testing tools:

- **Moods**: play any mood on demand, blink, poke, turn off automatic moods, loop a mood
- **Pose**: shape Mote's face by hand with sliders, then "Copy values" to share the numbers
- **Motion**: slow time down, freeze Mote, show outlines of the eye cuts, live numbers
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

- `src/components/companion/engine.ts` — every expression and how Mote moves between them
- `src/components/companion/Face.tsx` — how the face is drawn
- `src/lib/companion/theme.ts` — sizes and positions of the face and eyes
- `desktop/` — the Mac app's pages: Mote (`index.html`), Settings, Debug, and the gallery
- `desktop/ui.tsx` and `desktop/ui.css` — the soft buttons, switches and sliders
- `src/lib/companion/settings.ts` — the list of settings and their defaults
- `src/lib/companion/pronouns.ts` — Mote's pronouns, from the gender setting
- `src/components/companion/accessories.ts` — how the headphones and mustache are drawn
- `src-tauri/` — the Mac app wrapper itself
