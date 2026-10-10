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
| Happy | Frustrated | Happy | settles one step toward 5 every 2 minutes |
| Restless | Calm | Restless | settles one step toward 5 every 2 minutes |
| Alert | Sleepy | Alert | drops one step every 16 minutes awake (not while intrigued); recharges asleep |

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

### Watching, listening and dancing

In the Mac app, a small helper (`desktop/senses/main.swift`, built into the
app as `mote-senses`) keeps an eye on the rest of the screen:

- Only media in a window **you can actually see** counts: covered-up windows
  don't, and neither do players that are open but paused or silent.
- It tells **music** (Mote dances to its tempo, harder when it's loud, when
  Mote is happy, or when it's a favourite), **talk** (Mote tilts their head and
  listens) and **video** (Mote watches, looking away now and then for a break).
- It reads the **title**, so Mote can mention what's on by name.
- Moving the **pointer** a lot anywhere on screen catches Mote's eye briefly.
- While you're **typing** in another app, Mote looks over at that window and
  counts it as being intrigued. Mote only notices *that* keys are being
  pressed (from macOS's "time since the last key press"), never which keys.
- Apple Music, Spotify, Podcasts and TV only make sound while actually
  playing, so for them that alone counts as playing. Their sound is often
  copy-protected, which Mote can't hear; then Mote sways along instead of
  dancing to the beat.
  With several things going on, Mote's attention moves between them.
- Something starting to play while Mote is asleep jolts them awake.

To hear the sound and tell video from music, the helper needs the **Screen
Recording** permission (macOS asks the first time). It only looks at the one
window that's playing, at a tiny 96×54 size, and nothing is ever saved.
Without the permission Mote can still tell where sound is coming from, just not
what kind it is, how loud, or what it's called. Because the app isn't signed
with an Apple developer account, macOS may ask again after each rebuild.

### Learning likes and dislikes

Mote remembers each song or video they've watched or listened to with you.
Good moments while it plays (pets, pokes, nice answers, "yes, I like this")
make Mote like it more; bad ones (pestering, shaking, "no") less. Next time it
comes on, Mote is pleased (and dances harder) or unimpressed (won't dance, may
ask to skip it). The Debug window's Mind tab lists what Mote remembers, with a
Forget button.

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
happy, and lots of pokes just tickle.

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
- `src/components/companion/memory.ts` — Mote's memory of media, and their likes
- `desktop/senses/main.swift` — the helper that sees and hears other windows
- `src-tauri/` — the Mac app wrapper itself
