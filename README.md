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

**Apps** dropped on Mote aren't work, they're fun:

- **Games** get played. Apple's **Chess** has its own animations (a long
  think, then a clever move, a smug look and checkmate, or a blunder and a
  laugh), and so does **Minecraft** (mining a block, or a creeper… BOOM).
  Any other game gets gamer moves: locking in, button mashing, a clutch
  moment, then a victory hop or a deflated head shake. Afterwards Mote
  sometimes asks to go again. Mote knows something is a game if the app
  says so, if it's a game store or launcher (Steam, GOG, Epic, Battle.net…)
  or lives in one's folder, if it's one of Steam's little shortcut apps
  (Mote reads its one-line launch script for the `steam://` link; it's never
  run), or if it's built with a game engine.
- **The Mac's own apps** (Safari, Music, Calculator, Photo Booth, Terminal
  and about 60 more) each get their own line and a little reaction.
- **Any other app** gets "That's an app, not a game."

**Links** dragged onto Mote (from a browser's address bar or a page, or a
`.webloc` link file from Finder) are saved: any website, with YouTube and
other video sites talked about as videos. Now and then, when Mote is awake,
nothing is playing and you've been around in the last couple of minutes,
Mote brings one up ("Snack break? We could watch *lofi hip hop radio*.") and
asks if you'd like to go there; yes opens it in your browser. It happens about
every 20 minutes at most, and never within 12 minutes of the last one. Mote
keeps count of how often they've suggested each link, how often you said yes,
and when they last brought it up, and favours links they've never suggested,
ones you usually say yes to, and ones that haven't come up for a while.
Settings lists your saved links with their history, and you can remove any.

## Mote themself

Mote looks at your pointer, blinks, glances around, thinks, gets grumpy, gets
surprised, and hops happily when poked (clicked right on the face). Four quick
pokes in a row is too many, and Mote gets annoyed.

- **Petting:** press and keep stroking across Mote's face for a second or so.
  Mote melts into it and purrs. Stroke as fast as you like: moving with the
  button held down never counts as shaking.
- **Dizzy:** shaking the pointer around wildly (without holding the button),
  or throwing the window around the screen, makes Mote dizzy for a moment.
- **Sleep** (tiredness is an experimental feature, Goodnight Mote; without it, Mote
  just naps after a few quiet minutes left alone): Mote gets tired while awake (faster late at night and while
  playing). Once tired, left be for a few minutes with nothing interesting
  going on, they yawn, doze and fall asleep, and they sleep until rested.
  Exhausted, they nod off even with things going on. A poke wakes them
  (groggy, and a little put out, if they're still tired), and so does
  something starting to play (with a jolt) or something dropped on them.
  Petting a sleeping Mote gets a sleepy purr.
- **Eyes on you:** Mote's eyes follow your pointer anywhere on the screen,
  even while you're busy in other windows.
- **Watching along:** in the Mac app, if another visible window is playing
  sound, Mote keeps glancing toward it. Mote only knows *that* something is
  playing and where, never what. Moving the pointer a lot catches Mote's eye,
  and so does typing in another app (Mote only notices *that* keys are
  pressed, never which).

## Mood, hunger and sleep

Mote's mood sits on two axes, which Debug's Mind tab draws as a chart:

- **Joyful ↔ Frustrated** is about how Mote is *treated*. Petting, pokes,
  playing, attention and winning bring joy. Meanness (poking over and over),
  being shaken or thrown around, being woken up tired, and losing at games
  (more so each time in a row) bring frustration. It fades back toward the
  middle on its own.
- **Satisfied ↔ Depressed** is about whether Mote is *looked after* and not
  ignored. Time together, playing anything, being fed and being rested
  bring satisfaction. Being left alone for 20 minutes or more (faster when
  you're right there at the computer, just not with Mote), hunger, and
  being kept up exhausted bring them down. It changes slowly.

The corners are **Happy**, **Needy** (treated well but too often left out),
**Grumpy** (looked after, but someone's been mean) and **Miserable**; with
only one axis leaning, Mote is **Cheerful**, **Cross**, **Content** or
**Lonely**; near the middle, **Okay**. It shows on Mote's face (a little
smile, a scowl, a droop, heavy lids, worried brows), in what they do on their
own, in how much they chat and what about, and they ask for what they need:
a snack, bedtime, or a game.

**Hunger** (an experimental feature, Mote eats too): fullness goes down while Mote is awake (about four hours from
full to empty). Feed them from the snack bowl: a cookie, some berries, or a
proper meal. Full, they politely say no.

All of it carries over when Mote's app is closed: that time counts as
sleeping, a little hunger builds (never below 3), and being gone for more
than ten hours or so gets a bit lonely. Back after a few hours, Mote is glad
to see you.

**Friendly mode** (in Settings) keeps Mote from getting too upset: joy and
satisfaction never go below −3, hurt counts for half, and nothing sharp is
said.

**Games Mote remembers:** every game of checkers, chess or tic-tac-toe is remembered: who
won, by how much, whether it was a comeback, and when. Starting a game, Mote
may nod to the last one ("Rematch. I'm ready this time.", "You crushed me
yesterday. I've been practicing since.", "Moving up? Brave."). Three in a row
either way gets noticed. And now and then, while chatting, a memorable game
from the last few days comes back to them ("I was so far behind at chess the
other day. And then I won!"). Old, ordinary or just-played games aren't
brought up, and each game at most twice.

Mote speaks up when something happens (after a pet, getting dizzy, something
starting to play, you coming back after a while), when they need something,
and every few minutes while you're around, just to chat: a hello, a passing
thought, something about the time of day, what you're up to, or how they're
feeling. How often follows **Energy** in Settings (about every 3–6 minutes at
Normal), and their mood.

**Check-ins:** every hour or two (the first about half an hour in), instead of
a passing thought, Mote asks a simple question about how you're doing: calm?
rested? eaten? comfy? having fun? Questions fit the moment: a late-night one
after 11pm, a work one while you're typing, a "good morning" one before 11.
Green always means you're fine, and gets something glad. Red gets a
concerned, soft look and a reply that fits the question, understanding
first and maybe one small idea ("Late-night brain is the worst brain. Don't
believe everything it tells you right now."). Not having fun isn't a worry,
though: Mote offers a game instead, and the toy chest glows for a few
minutes. Left unanswered, Mote says nothing at all: just a slow blink, a
gentle smile and a little nod. Answers never upset Mote, the same question
doesn't come back within eight hours, and none come while Mote is cross
(unless in Friendly mode).

## The buttons

Along the bottom of Mote's window (quiet until your pointer is over it):

- **Toy chest:** the games (checkers, chess, tic-tac-toe and Liar's Dice). It can be switched off in Debug's Features tab.
- **Carrot:** log calories, or see the days (only with the diet tracker switched on).
- **Snack bowl:** feed Mote (only with "Mote eats too" switched on).
- **Bed** (with Goodnight Mote switched on): tuck Mote in (if they're tired enough). While they sleep it turns
  into a sun, to wake them.
- **Picture frame** (with Local Gallery switched on): open Local Gallery
  (Mote asks for the passcode first, if one is set).

A soft pulsing ring on a button means Mote would like that: hungry, sleepy,
or wanting to play.

## Try it as a Mac app

Open Terminal in this folder and run:

```bash
npm run mac
```

A Mote window opens. Any change you save to the code shows up in it right away.
Drag the window by its top edge.

## Calories

The diet tracker is locked behind its own **Feature Key** (see "Debug and
experimental features"): until it's unlocked and on, there's no carrot
button, no Calories section in Settings, and Mote keeps no count and says
nothing about it.

Set a **daily goal** in Settings (0 turns this off). Press the carrot and
choose **Log calories**: type an amount and press **+** (or Return) to add it,
or **−** to take it away. Click the big number to type today's total outright.

**See the days** (in the same menu, or in Settings) opens a calendar of every
day you've logged, colored the way the old Diet Tracker did: cool while you're
under the goal, hot once you pass it, nearly black when you're well past.

Mote reacts to each entry: cheerful while the day is light, matter-of-fact in
the middle, a little worried near the goal, and sad once you're over. Now and
then Mote mentions where today stands, asks once a day if you haven't logged
anything, says goodnight about the day after 9pm, and mentions yesterday the
next morning. Every line is in `src/components/companion/calorie-lines.ts`.

## How Mote plays board games

There's no difficulty to pick. Mote plays well, but keeps themself just
behind you, so games are close and you usually win by a hair:

- **When you're ahead**, Mote plays their best and keeps the pressure on.
- **When Mote gets further ahead than they should**, they make a mistake on
  purpose, and a believable one: a move that looks fine at a glance and only
  goes wrong a few moves later, so catching it is your good play, not a gift.
  A big lead is given back a bit at a time, never all at once.
- **As the game goes on**, Mote lets themself fall a little further behind,
  so you can actually close it out.
- **About one game in seven**, decided at the start, Mote is allowed to win:
  past the middle of that game, they stop holding back.

In tic-tac-toe, Mote always blocks a line you're about to finish, but now and
then plays a square that lets you set up two ways to win at once, if you spot
it. They only sometimes take a win you leave open.

The old levels (Easy, Normal, Hard) and Learn with Mote are still there,
behind the **Levels and learning** switch in Debug's Features tab
(see below). With it on, the level picker comes back, with **Close** (the
usual way) as a fourth choice.

The thinking is in `src/lib/close-game.ts`.

## Checkers

Open the toy chest and choose **Checkers**, then **Play** (with Levels and
learning switched on, pick a level first: **Easy**: Mote is still learning;
**Normal**: a fair game; **Hard**: Mote looks as far ahead as they can in
about a second and always plays their best). Mote's window grows to fit the
board, with Mote sitting just above it.

You're the dark pieces and go first. Click a piece, then one of the dots. The
usual rules: jumping is compulsory (the pieces that can jump pulse), a jump
keeps going while it can, and a piece that reaches the far side is crowned.
Mote's pieces are tiny Motes that blink and look at whichever piece you pick
up.

Mote plays along: watching your pointer on your turn, scanning the board on
theirs, wincing when you take a piece, looking smug when they take one,
puffing up proud when they're crowned, a victory dance or a good-sport smile
at the end. They comment on the big moments (and once in a while on a slip of
their own). Close the board mid-game and it's saved for next time. Your
record against Mote sits at the top of the board (kept separately for each
level).

### Learning with Mote

With the **Levels and learning** feature switched on (in Debug's Features tab), checkers
and tic-tac-toe have a **Learn with Mote** option on the level picker. Mote's notes appear under the board, in their own words:

- **On your turn**, a tip about what matters right now (a win to take, a
  threat to block, a piece in danger, a king to be had, the value of the
  center or your back row). **Show me** marks the squares on the board.
- **After a mistake** (a move that throws away a win, or hands Mote a piece
  or a win), Mote waits, explains what went wrong and marks the better move:
  **Take it back** to try again, or **Keep going**. Good moves that took some
  finding get a word too.
- **After Mote's move**, why they made it: a block, a fork, a trap, getting
  a piece out of danger, pushing for a king.

Learning games don't count toward your record or go into Mote's memories of
games, though playing together still keeps Mote company. At the end, Mote
says how many mistakes you made.

## Chess

Open the toy chest and choose **Chess**. Same board, same
record-keeping and saving as checkers. You're white and go first: click a
piece and the dots show where it can go (rings mean a capture). All the rules
are there: castling (move the king two squares), en passant, promotion (you
pick what the pawn becomes), check (the king glows red), checkmate,
stalemate, and draws by threefold repetition, fifty quiet moves, or too
little left to mate.

Mote's pieces are cream with little eyes (the knight, side-on, has one).
With Levels and learning on: **Easy** looks one move ahead and often goes with something that only looks
about right; **Normal** looks three moves ahead and follows trades through;
**Hard** looks as far as it can in about a second and a half and knows how to
finish off a won endgame.

Mote has their own chess lines and faces: a sly, narrow-eyed nod when they put
you in check, wide darting eyes when you check them, a pout (naming the
piece) when you take one of theirs, real dismay over their queen, proud
stretching when a pawn of theirs promotes, and the victory dance or
good-sport smile at the end.

## Tic-tac-toe

Open the toy chest and choose **Tic-tac-toe**. Same record-keeping
and saving as the other games. You're X; you and Mote take turns going first.
Your X draws itself in ink; Mote's marks are tiny Motes that blink and glance
at your latest move. With Levels and learning on, **Easy** Mote mostly plays wherever (though often grabs
a win or a block); **Normal** always takes a win and nearly always blocks;
**Hard** plays perfectly, so the best you can do is a draw. Mote reacts when
you block them, when they block you, and when either of you sets up two ways
to win at once.

## Liar's Dice

Open the toy chest and choose **Liar's Dice**. It never ends: play a round
or a hundred, and close it whenever you like (a round in progress is kept,
dice and all, for next time).

You and Mote each roll five dice and keep them hidden. Yours are the ink ones
along the bottom; Mote's are face down along the top, blank with a little
pair of Mote eyes. Taking turns, you bid on how many of one number are
showing across all ten dice: pick how many and which number, and press
**Bid**. Each bid has to go higher: more dice, or as many of a higher
number. Instead of bidding, you can call **Liar!** Mote's dice turn over,
the dice showing that number lift up, and if there are at least as many as
the bid said, whoever bid it gets the point; if not, the caller does. Then
**Next round**; whoever lost opens the bidding. The score along the top just
keeps counting.

Mote plays by the odds: they know their own dice, guess at yours (if you bid
on a number, you probably have some), call when a bid looks unlikely, and
bluff now and then. Like the board games, they keep it close: ahead of you
over the last few rounds, they get careless (a call on a bid that was
probably fine, a bid a little too bold); level or behind, they play their
best. Mote says their bids out loud now and then, sounds very sure of
themself when bluffing, looks sly when calling you a liar and alarmed when
you call them one, and has a word for who was right (and for three in a row
either way). Rounds won and lost nudge their mood a little.

## Local Gallery

Mote carries Local Gallery, the Mac app from the Local_Gallery repo, inside
`Mote.app` and opens it from a picture-frame button (with Local Gallery
unlocked by its own Feature Key, and on). It's the real app, built from the same code with the same
app ID and name, so it uses the same library, folders, settings and
thumbnails as the Local Gallery you build from its own repo. Mote doesn't run
any of it; it only opens it, as if you'd double-clicked it.

Its code is kept apart in `local-gallery/` (the core app, plus its design
docs for keeping), with its own notes on where it came from and how to
update it.

### Mote keeps the passcode

Local Gallery's passcode lives in Mote now, not in the gallery. With Local
Gallery switched on, Settings has a **Local Gallery** section with everything
the gallery's own Passcode menu had:

- **Set a passcode** (four digits, typed twice so a slip can't lock you out),
  or **Change passcode** (the current one first).
- **Lock now**: if the gallery is open, it saves what it's doing and closes,
  so it needs the passcode to open again.
- **Turn passcode off** (the current one first).
- **Hide gallery folder**: renames the library in Documents to
  `.Local Gallery`, so Finder doesn't show it (the current passcode first).
  An open gallery closes for a moment while the folder is renamed, then opens
  again.

With a passcode set, pressing the picture frame brings up a passcode pad on
Mote's window (type it, or press the keys). Mote shuts their eyes tight and
turns away while you type, flinching a little at each digit. Right: their eyes
pop open, a hop, a nod and a wink, and the gallery opens. Wrong: a sorry-but-no
shake of the head (and a warning when you're down to the last two tries).
Five wrong in a row and Mote refuses outright, turning away with their chin
up, and won't take any tries for 30 seconds (then a minute, two, and so on up
to 15 minutes; quitting Mote doesn't reset it). Close the pad or press Escape
and the gallery simply stays shut. If the gallery is already open, the frame
just brings it to the front. Mote reacts in their own window to what you do in
Settings too.

The same care as the gallery took: Mote keeps only a salted, slowly worked
fingerprint of the passcode (the same kind the gallery used), never the
digits, in `~/Library/Application Support/com.anyonebut.mote/gallery-passcode.json`.
It keeps the gallery shut; it doesn't lock the pictures in Documents.
**Forgot it?** Quit Mote and delete that file; the passcode is then off.

In the copy Mote carries, the gallery's own passcode screen and Passcode menu
are switched off, and its `lock.log.json` is ignored. So it can't be opened
from inside Mote.app to get round Mote, it only starts when Mote hands it a
one-time ticket; opened any other way, it says to open it from Mote and quits
before showing anything. (The Local Gallery built from its own repo is
unchanged and still uses its own passcode.)

### Reading the gallery's logs

Mote reads the library's log folder (`Documents/Local Gallery/.local-gallery`,
or the hidden `.Local Gallery`): each log's size, when it was saved, and how
many entries it holds (folders tagged, scored, journal days, what's in the
trash, thumbnails), never the names, tags or anything else inside. Settings
shows a line of it under the passcode; Debug's **Gallery** tab shows every
file. The files Local Gallery kept for safekeeping (clean.sh, the
userscripts, Automator workflows and so on) are in `safekeeping/`, at the top
of Mote's folder; nothing in Mote or the gallery uses them. `npm run mac:build` builds it and tucks it in.

## Settings and debug mode

In the Mac app, press **⌘,** (Command + comma) to open Settings. You can choose
the **Appearance** (Light, Dark, or System to follow the Mac), Friendly mode,
how lively Mote is, the pace for helping with files, whether Mote opens when
you log in, and whether the window floats above others. With Local Gallery
switched on, it also has the gallery's passcode (see above). Mote's eyes
always follow your pointer, and Mote always naps when left alone.

**Dark mode** swaps Mote's colours, like a photo negative: a dark face with
cream eyes (and cream eyebrows and mouth, if they're on), on a dark window.
Everything around Mote goes dark and warm too: speech bubbles, buttons, the
game cards, Settings and the Days window. The game boards and pieces stay as
they are.

Text in the app calls Mote "Mote", or "they/them" when a pronoun is needed.

### Debug and experimental features

Three things are locked behind a **Feature Key** each: **Debug**, the **Diet
tracker** and **Local Gallery**. At the bottom of Settings, type a key into
**Feature Key** and press Unlock (or Return). Unlocking is for good
(resetting settings doesn't undo it), and takes effect straight away; each
unlocked one is then listed underneath, with a switch to turn it off again.
Only a fingerprint of each key is kept in the app, never the key itself.

With Debug unlocked and on, Settings itself grows tabs (and the window grows
to fit them): **Settings** first, then the Debug tabs. Mote is in debug mode
(taking orders from those tabs) only while Settings is open. A tab about a
feature that's switched off (Links, Gallery) isn't shown.

- **Features**: switches for Mote's usual skills (all on until switched off):
  - **Saved links**: saving links dragged onto Mote, and Mote suggesting
    them. Off, a dropped link gets a polite "not right now", no link is
    brought up, and Settings hides the list (saved ones are kept).
  - **Helping with files**: the cleanup jobs for folders and videos dragged
    onto Mote. Off, they get the same "not right now", and Settings hides the
    Pace. A job already running finishes first.
  - **Reacting to apps**: playing games and reacting to the Mac's own apps
    dragged onto Mote. Off, apps get the same "not right now".
  - **Check-ins**: Mote now and then asking how you're doing. Off, they
    don't ask.
  - **Mood effects persistent eye shape**: how Mote feels shaping their
    resting eyes (a scowl, a little smile, a droop, heavy lids, worried
    brows). Off, the eyes rest in their usual shape whatever the mood;
    expressions still play.
  - **Toy chest**: the toy chest button and its games, and Mote asking for
    or suggesting a game. Off, the button goes, an open game is put away,
    and Mote never brings games up: a lonely Mote asks for a pet instead,
    and "not having fun" gets a nudge toward something fun rather than a
    game. Games already played are still remembered.

  and for the experimental features (all off until switched on):
  - **Mote eats too**: Mote getting hungry, the snack bowl to feed them, and
    hunger's effect on their mood, face and what they say. Off, Mote simply
    stays full.
  - **Levels and learning**: picking a level for board games (Easy, Normal,
    Hard, or the usual Close), and the Learn with Mote option for checkers and
    tic-tac-toe. Off, Mote always plays the close way.
  - **Goodnight Mote**: Mote getting tired and needing sleep (sleepy and
    exhausted moods, asking for bed, the bed button, waking once rested).
    Off, Mote stays rested and simply naps after a few quiet minutes left
    alone, until poked.
  - **Eyebrows**: two little soft eyebrows above Mote's eyes. They have no
    moves of their own: they follow the brow cut that every expression
    already shapes, so they come down and slant in when Mote is cross, tilt up
    when worried, shoot up when surprised, relax when sleepy, and slide along
    when Mote looks around. They stay put while Mote blinks.
  - **Mouth**: a little mouth under the eyes, made the same way as the
    eyebrows: no moves of its own, it reads the face every expression already
    makes. Happy cheeks make it smile, a cross or worried slant makes a small
    frown, eyes opened wide make a little "o", and at rest it's a tiny
    contented line.
  - **Just the eyes**: no body, no dot, no shadow. The window takes Mote's
    cream colour and the eyes grow to fill it, so the whole window is Mote,
    and touching anywhere in it counts as touching Mote (pokes, pets).
    Eyebrows and the mouth work the same if they're on. The expression sheet
    shows it with ?eyes=1.
  - **Eye reflection dot**: a little reflection high in each eye. It rides
    along with the eyes (lagging their gaze a touch, as a real reflection
    would), and lids and blinks cover it. Its colour very quietly follows
    the mood: Mote's own cream when all's well, a hint of red when
    frustrated, a hint of blue when low, a little purple when both. In dark
    mode it's inverted with everything else, so it's dark.
- **Moods**: play any mood on demand, blink, poke, turn off automatic moods, loop a mood
- **Mind**: the mood chart, hunger and rest (with buttons to nudge them), the
  games Mote remembers, and every reaction with what it does to the mood
- **Speech**: everything Mote can say, and a button to say any of it now
- **Pose**: shape Mote's face by hand with sliders, then "Copy values" to share the numbers
- **Motion**: slow time down, freeze Mote, show outlines of the eye cuts, pretend
  another window is playing sound, give Mote a folder or video by typing its path
  (or pretend ones, in a browser), live numbers
- **Gallery**: Local Gallery as Mote sees it: whether it's carried and open,
  the passcode and tries left, where the library is, and every file in its
  log folder (size, when saved, how many entries)
- **Links**: every saved link with its history (when it was saved, how often
  Mote has suggested it and you've opened it), its weight and its chance of
  coming up next; add, rename, open, reset or remove links, or have Mote
  suggest a particular one right now
- **Log**: everything that happened, in order
- **Data**: the saved settings, and a reset button

## Install Mote

Quit Mote if it is open, then drag the new one into Applications and replace
the old one:

- `src-tauri/target/release/bundle/macos/Mote.app`
- `src-tauri/target/release/bundle/dmg/Mote_0.10.6_aarch64.dmg` (an installer you can share)

Both are made by:

```bash
npm run mac:build
```

### Releasing a new version

```bash
npm run release:patch
```

Works like Local Gallery's: it moves the version up one (0.10.0 to 0.10.1)
everywhere Mote keeps it, checks everything first (types, Mote's tests, the
Mac side's tests, and that Local Gallery still has Mote's changes), builds the
app and installer, and only then saves it all to git as `release: v0.10.1`
and pushes it. If a check or the build fails, nothing is changed, saved or
pushed. Add `-- --dry-run` to see what it would do without doing it. The
script is `scripts/release-patch.mjs`.

With Local Gallery inside, the app is about 340 MB and the installer about
155 MB, too big for GitHub (it refuses files over 100 MB). So the project on
GitHub keeps only Mote's own part of the built app, and the installer is only
on this computer. Build again to get the full one anywhere else.

## See every expression side by side

While `npm run mac` is running, open http://127.0.0.1:1420/gallery.html in a browser.
Each face there is one expression frozen in place, handy for tweaking how they look.
Add `?brows=1` to see them with eyebrows, `?mouth=1` with the mouth.

## Where things live

- `src/components/companion/engine.ts` — every expression and how Mote moves between them
- `src/components/companion/Face.tsx` — how the face is drawn (the eyebrows' shape is in `eyeShape`, in engine.ts)
- `src/lib/companion/theme.ts` — sizes and positions of the face and eyes
- `desktop/` — the Mac app's pages: Mote (`index.html`), Settings (with the Debug tabs in `debug.tsx`), Days, and the expression sheet
- `desktop/ui.tsx` and `desktop/ui.css` — the soft buttons, switches and sliders
- `src/lib/companion/settings.ts` — the list of settings and their defaults, and dark mode (`useDark`)
- `src/lib/companion/features.ts` — the Feature Keys (Debug, Diet tracker, Local Gallery) and the experimental features
- `local-gallery/` — Local Gallery's own code, kept separate; `src-tauri/src/gallery.rs` opens it,
  keeps its passcode and reads its logs
- `src/lib/companion/gallery.ts` — talking to that from Mote's windows (and a pretend gallery, passcode 1234, in a browser)
- `src/components/companion/PasscodePad.tsx` and `passcode.css` — the passcode pad, on Mote's window and in Settings
- `desktop/passcode-settings.tsx` — Settings' Local Gallery section
- `src/components/companion/mind.ts` — Mote's mood, hunger and rest, and how they change
- `src/components/companion/memories.ts` — the games Mote remembers, and how they bring them up
- `src/components/companion/Toolbar.tsx` — the buttons along the bottom of Mote's window
- `src/components/companion/reactions.ts` — every stimulus → response rule
- `src/components/companion/speech.ts` — everything Mote can say, and when
- `src/components/companion/SpeechBubble.tsx` — how the bubbles look
- `desktop/senses/main.swift` — the helper that notices sound, the pointer and typing
- `src/components/companion/Helper.tsx` — the conversation when you give Mote something
- `src/components/companion/assistant.ts` — what Mote says while helping, and the jobs on offer
- `src/components/companion/Checkers.tsx` and `checkers.css` — the checkers board
- `src/components/companion/checkers-lines.ts` — what Mote says over a game
- `src/lib/checkers/rules.ts` — the rules; `ai.ts` — how Mote picks a move
- `src/components/companion/Chess.tsx`, `chess-pieces.tsx` and `chess-lines.ts` — the chess board, its pieces, and what Mote says
- `src/lib/chess/rules.ts` — every chess rule; `ai.ts` — how Mote picks a chess move
- `src/lib/close-game.ts` — how Mote keeps games close (the usual way they play)
- `src/lib/checkers/coach.ts` and `src/lib/tictactoe/coach.ts` — Learn with Mote: tips, mistakes and Mote's explanations
- `src/components/companion/TicTacToe.tsx` and `tictactoe-lines.ts`, and `src/lib/tictactoe/game.ts` — tic-tac-toe
- `src/components/companion/LiarsDice.tsx`, `liarsdice.css` and `liarsdice-lines.ts`, and `src/lib/liarsdice/game.ts` — Liar's Dice (the rules and how Mote bids)
- `src/components/companion/board-ui.tsx` and `board.css` — what both games share (level picker, header, end panel, the board's look)
- `src/components/companion/links.ts` — saved links, their history, and how Mote picks one to suggest
- `src-tauri/src/links.rs` — reading a dragged link, and opening one in your browser
- `src-tauri/src/tidy/` — the jobs themselves, one file per step (rebuilt from the `clean.sh` cleaner)
- `src-tauri/` — the Mac app wrapper itself
