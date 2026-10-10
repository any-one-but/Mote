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

## Mote's mind (the `mind` branch)

Mote has four feelings, each scored 0 to 10:

| Feeling | 0 means | 10 means | On its own |
|---|---|---|---|
| Happy | Frustrated | Happy | drops one step every 6 minutes when left alone |
| Restless | Calm | Restless | rises one step every 6 minutes when left alone |
| Alert | Sleepy | Alert | drops one step every 16 minutes awake (not while intrigued); recharges asleep |
| Full | Hungry | Full | drops one step every 6 minutes awake; asleep, a fifth as fast and never below 3.5 |

**Hunger:** Mote eats files you drop on them (see "Things to give Mote"); a
full Mote turns them down. Once Mote gets hungry, their happy resting point
sinks and each hunger pang makes them crosser, more so the hungrier they are;
they get worried brows and tummy rumbles, and ask for food, more often and more
desperately, with a bubble you answer by dropping a file on them. Ignoring those
makes it worse. Hunger is switched off in Friendly mode, where food is just a
treat.

Left to themselves, Mote slides toward the bad end of every feeling: crosser,
more restless, more tired and hungrier. That pauses while you're around (using
Mote's window, or typing nearby), and asleep Mote calms down rather than getting
crosser. Attention is what lifts Mote back up: pets, food, games, company,
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
  and then. Covered-up windows don't count. Mote only knows *that* something
  is playing and where, never what it is.
- Moving the **pointer** a lot anywhere on screen catches Mote's eye briefly.
- While you're **typing** in another app, Mote looks over at that window and
  counts it as being intrigued. Mote only notices *that* keys are being pressed
  (from macOS's "time since the last key press"), never which keys.
- With several things going on, Mote's attention moves between them.
- Something starting to play while Mote is asleep jolts them awake.

### Speech bubbles

Mote doesn't chatter on a timer. They only speak up:

- **when something happens** they'd naturally react to: after being petted,
  waking up, getting dizzy, eating, finishing a game, something starting to
  play, or you coming back after 10 minutes or more away; and in reply to
  whatever you drop on them
- **when they need something**: food when hungry, the sleep mask when sleepy,
  a pet when feeling down, or a game or a new spot on the screen when bored.
  Mote notices a need for a little while (8–25 seconds) before asking, and
  if you ignore it, only asks again after a good while

A bubble can be a remark, a yes/no question (green and red buttons), or a
request you answer by doing it: drag the window somewhere, pet Mote, drop a
file, put the mask on, or drop a game. All of them disappear after a while;
ignoring a question or request counts as an answer too. Every line lives in
`src/components/companion/speech.ts`; the Debug window's Speech tab lists them
all and can make Mote say any of them.

Every stimulus → response rule lives in `src/components/companion/reactions.ts`,
with the feelings it changes. The Debug window's **Mind** tab shows the feelings,
lets you nudge them, and lists every reaction (built ones and ideas), lighting
each up as it fires.

### Things to give Mote

- **Food: drag a file onto Mote's window.** Mote munches it, bits flying. The
  file itself is never opened, changed, moved or deleted: all Mote finds out is
  its name and size. Bigger files are more filling (a small note is a crumb, a
  long video a feast). Mote remembers the names of the last 12 things eaten and
  won't eat those again. Mote won't eat anything important either: system
  files, settings and key files, hidden files, anything from your Library
  folder or from inside an app. Folders and empty files are turned down too.
- **Games: drag a game app onto Mote's window** to play it together. Apple's
  **Chess** gets its own animations (a long think, then a clever move, a smug
  look and checkmate, or a blunder, a worried look and a laugh). So does
  **Minecraft** (Mote bonks a block until it cracks and pops, and is delighted
  with it; or a creeper sneaks up, hisses… BOOM, and Mote is left dazed). Any
  other game gets gamer moves: locking in, button mashing, a clutch moment,
  then a victory hop or a deflated head shake. Mote knows something is a game
  if the app says so, if it's a game store or launcher (Steam, GOG, Epic,
  Battle.net and the like) or lives in one's folder, if it's one of Steam's
  little shortcut apps (Mote reads the shortcut's one-line script for its
  `steam://` link; it's never run), or if it's built with a game engine or
  game-store kit (Unity, Unreal, Godot, GameMaker, Ren'Py, Steam, Epic, GOG;
  only checked for being there). After a game, Mote sometimes asks to go again.
- **The Mac's own apps**: drop Safari, Music, Calculator, Photo Booth,
  Terminal or any of about 60 others and Mote has something to say about it
  (and hums, poses, puzzles or gets dizzy). Other apps that aren't games get
  "that's an app, not a game".
- **Earmuffs and sleep mask**, from the little tray that appears at the bottom
  when the pointer is in Mote's window: Mote can't see or hear anything else
  while wearing them, so they sleep through videos and your pointer. Putting
  them on a sleepy Mote sends them off to sleep; on a sleeping Mote it doesn't
  wake them; on a wide-awake Mote they'll ask whether they really have to. A
  poke wakes Mote and takes them off.

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
- **Moods**: play any mood on demand, blink, poke, turn off automatic moods, loop a mood, try flat sleeping eyes
- **Pose**: shape Mote's face by hand with sliders, then "Copy values" to share the numbers
- **Motion**: slow time down, freeze Mote, show outlines of the eye cuts, pretend
  another window is playing sound, pretend to drop files and games on Mote, see
  (and forget) what Mote has eaten, live numbers
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
- `src/components/companion/mind.ts` — Mote's feelings, how they drift, the lasting moods
- `src/components/companion/reactions.ts` — every stimulus → response rule
- `src/components/companion/speech.ts` — everything Mote can say, and when
- `src/components/companion/SpeechBubble.tsx` — how the bubbles look
- `desktop/senses/main.swift` — the helper that notices sound, the pointer and typing
- `src-tauri/src/offer.rs` — looks at what's dropped on Mote (name, size, and for apps whether it's a game; never the contents)
- `src-tauri/` — the Mac app wrapper itself
