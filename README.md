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

Mote has four feelings, each scored 0 to 10:

| Feeling | 0 means | 10 means | On its own |
|---|---|---|---|
| Happy | Frustrated | Happy | drops one step every 6 minutes when left alone |
| Restless | Calm | Restless | rises one step every 6 minutes when left alone |
| Alert | Sleepy | Alert | drops one step every 16 minutes awake (not while intrigued); recharges asleep |
| Full | Hungry | Full | drops one step every 6 minutes awake; asleep, a fifth as fast and never below 3.5 |

**Hunger:** a cookie from the tray fills Mote up a good way (a full Mote turns
it down). Once Mote gets hungry, their happy resting point sinks and each hunger
pang makes them crosser, more so the hungrier they are; they get worried brows
and tummy rumbles, and ask for food, more often and more desperately, with a
bubble you answer by giving a snack. Ignoring those makes it worse. Hunger is
switched off in Friendly mode, where snacks are just a treat.

Left to themselves, Mote slides toward the bad end of every feeling: crosser,
more restless, more tired and hungrier. That pauses while you're around (using
Mote's window, or typing nearby), and asleep Mote calms down rather than getting
crosser. Attention is what lifts Mote back up: pets, snacks, play, company,
answering their questions. In Friendly mode the slide stops short of anything
upsetting (Happy stays at 4 or more, Restless at 7 or less, never hungry).

Things that happen to Mote (pokes, petting, being shaken, sound, and so on)
nudge these a little. Mote spends most of the time near the middle; only when a
feeling gets far from it does Mote fall into a lasting mood (Frustrated, Annoyed, Happy, Restless, Calm, Sleepy,
Alert) that changes the resting face and which idle moods come up: a frustrated
Mote scowls, huffs, sulks and looks away; a sleepy one has heavy eyelids and
yawns; a restless one fidgets; a happy one hums. Feelings carry over when the
app is closed and reopened (time away counts as rest). Grumpiness and sleep are
never picked at random: they only come from how Mote actually feels.

Mote is **intrigued** while you're using the window (moving around it, poking,
petting, dragging) and while another window plays sound. Intrigued, Mote does
fewer random things and doesn't get tired. While watching something, the only
thing Mote does is look out to check in on you now and then (with a small,
happiness-based chance of something sweet). Only a really sleepy Mote nods off
while watching, and only an exhausted one actually falls asleep.

### Watching along

In the Mac app, a small helper (`desktop/senses/main.swift`, built into the app
as `mote-senses`) notices a few things on the rest of the screen. It needs no
special permissions and never captures the screen or sound:

- **Sound from a window you can see**: Mote watches it and checks in on you now
  and then. Covered-up windows don't count. If it's a music app (Apple Music or
  Spotify), Mote sways along.
- Moving the **pointer** a lot anywhere on screen catches Mote's eye briefly.
- While you're **typing** in another app, Mote looks over at that window and
  counts it as being intrigued. Mote only notices *that* keys are being pressed
  (from macOS's "time since the last key press"), never which keys.
- With several things going on, Mote's attention moves between them.
- Something starting to play while Mote is asleep jolts them awake.

### Speech bubbles

Every minute or two, when they feel like it, Mote says something in a bubble:
a remark, a yes/no question (green and red buttons), a request to be moved
somewhere on the screen (drag the window there), or a request for a pet. They
fit Mote's mood and what's going on, and all of them disappear after a while;
ignoring a question or request counts as an answer too. Every line lives in
`src/components/companion/speech.ts`; the Debug window's Speech tab lists them
all and can make Mote say any of them.

Every stimulus → response rule lives in `src/components/companion/reactions.ts`,
with the feelings it changes. The Debug window's **Mind** tab shows the feelings,
lets you nudge them, and lists every reaction (built ones and ideas), lighting
each up as it fires.

### Things to give Mote

Move the pointer into Mote's window and a little tray appears at the bottom:

- **Earmuffs and sleep mask**: Mote can't see or hear anything else while
  wearing them, so they sleep through music, videos and your pointer. Putting
  them on a sleepy Mote sends them off to sleep; on a sleeping Mote it doesn't
  wake them; on a wide-awake Mote they'll ask whether they really have to.
  A poke wakes Mote and takes them off.
- **A snack**: a cookie, munched happily (three in five minutes is plenty).
- **The ball**: Mote watches it bounce in and bops it, and may ask to go again.

### Friendly mode

In Settings, **Friendly mode** means Mote never gets cross or hurt: no
grumpiness, huffing or sulking, no sharp replies, nothing that makes Mote less
happy, lots of pokes just tickle, and Mote never gets hungry.

## Try it as a Mac app

Open Terminal in this folder and run:

```bash
npm run mac
```

A Mote window opens. Any change you save to the code shows up in it right away.
Drag the window by its top edge.

## Settings and debug mode

In the Mac app, press **⌘,** (Command + comma) to open Settings. You can choose
whether Mote follows your pointer, Friendly mode, whether Mote naps, how lively
Mote is, and whether the window floats above others.

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
- `src/components/companion/speech.ts` — everything Mote can say, and when
- `src/components/companion/SpeechBubble.tsx` — how the bubbles look
- `desktop/senses/main.swift` — the helper that notices sound, the pointer and typing
- `src-tauri/` — the Mac app wrapper itself
