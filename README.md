# Mote

A little face in a window. Everything Mote feels shows in two pill-shaped eyes,
shaped by two soft cuts: one from above (the brows) and one from below (the cheeks).

Mote looks at your pointer, blinks, glances around, thinks, gets grumpy, gets
surprised, dozes off when left alone, and hops happily when poked (clicked right
on the face — clicks on the empty window around Mote don't count). Four quick
pokes in a row is too many, and Mote gets annoyed. Only a poke wakes a sleeping Mote.

- **Petting:** press and keep stroking across Mote's face for a second or so. Mote melts into it and
  purrs (a sleeping Mote purrs a little without waking up).
- **Dizzy:** shaking the pointer around wildly, or throwing the window around
  the screen, makes Mote dizzy for a moment.
- **Watching along:** in the Mac app, if another visible window is playing
  sound, Mote won't nod off and keeps glancing toward that window.

Mote can also wear cat-ear headphones and a bushy mustache (switched on in the
Debug window, on its Moods tab).
Each brings three extra idle moods: the mustache gets twirled, blown on, and
almost sneezed through; the headphones bring listening for sounds, bopping to
music, and cat-like ear flicks.

## Mote's mind (the `mind` branch)

Mote has three feelings, each scored 0 to 10, starting at 5:

| Feeling | 0 means | 10 means | On its own |
|---|---|---|---|
| Happy | Frustrated | Happy | settles one step toward 5 every 40 seconds |
| Restless | Calm | Restless | settles one step toward 5 every 40 seconds |
| Alert | Sleepy | Alert | drops one step every 60 seconds awake; recharges while asleep |

Things that happen to Mote (pokes, petting, being shaken, sound, and so on)
push these up and down. When a feeling gets far enough from the middle, Mote
falls into a lasting mood (Frustrated, Annoyed, Happy, Restless, Calm, Sleepy,
Alert) that changes the resting face and which idle moods come up: a frustrated
Mote scowls, huffs, sulks and looks away; a sleepy one has heavy eyelids and
yawns; a restless one fidgets; a happy one hums. Feelings carry over when the
app is closed and reopened (time away counts as rest).

Every stimulus → response rule lives in `src/components/companion/reactions.ts`,
with the feelings it changes. The Debug window's **Mind** tab shows the feelings,
lets you nudge them, and lists every reaction (built ones and ideas), lighting
each up as it fires.

## Try it as a Mac app

Open Terminal in this folder and run:

```bash
npm run mac
```

A Mote window opens. Any change you save to the code shows up in it right away.
Drag the window by its top edge.

## Settings and debug mode

In the Mac app, press **⌘,** (Command + comma) to open Settings. You can choose
whether Mote follows your pointer, naps, how lively Mote is, and whether the
window floats above others.

Text in the app calls Mote "Mote", or "they/them" when a pronoun is needed.

At the bottom of Settings, **Debug mode** opens a separate window of testing tools:

- **Mind**: Mote's feelings and lasting moods, and every reaction Mote has
- **Moods**: play any mood on demand, put the headphones and mustache on or off,
  blink, poke, turn off automatic moods, loop a mood, try flat sleeping eyes
- **Pose**: shape Mote's face by hand with sliders, then "Copy values" to share the numbers
- **Motion**: slow time down, freeze Mote, show outlines of the eye cuts, pretend
  another window is playing sound, live numbers
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
- `src/components/companion/accessories.ts` — how the headphones and mustache are drawn
- `src/components/companion/mind.ts` — Mote's feelings, how they drift, the lasting moods
- `src/components/companion/reactions.ts` — every stimulus → response rule
- `src-tauri/` — the Mac app wrapper itself
