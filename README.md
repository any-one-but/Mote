# Mote

A little friend who lives in a window on your Mac. Mote isn't a tool: they
watch things with you, play games with you, react to you, and remember you,
and how they feel about you grows with how you treat them (see
`Mote Design Doc.md`). Everything Mote feels shows in two pill-shaped eyes,
shaped by two soft cuts: one from above (the brows) and one from below (the
cheeks).

## Meeting Mote

The first time Mote opens, they say hello and show you the basics a step at
a time (poking and petting them, double-clicking to do something together,
watching things along with you, dropping links on them), each with a button
to go on. Then they ask what to call you. Type your name and Mote remembers
it: now and then they'll call you by it, where it fits (a hello, a "Morning,
Sam!", a "Still up, Sam?", a check-in, asking you for a game or a pet, a
"Good game, Sam!"). Every place that can use your name has lines without it
too, used when Mote doesn't know it. Saying you'd rather not is fine too, and Mote won't ask again.
Your name can be changed any time in Settings, and Mote notices ("Robin! Got
it."). Debug's Data tab has **Meet Mote again**, to see it all from the start.

## Things you give Mote

Drag something onto Mote's window:

**Apps** are fun:

- **Games** get played, with gamer moves and a little controller: locking
  in, button mashing, a clutch moment, then a victory hop or a deflated head
  shake (Apple's **Chess** and **Minecraft** get lines of their own). Afterwards Mote
  sometimes asks to go again. Mote knows something is a game if the app
  says so, if it's a game store or launcher (Steam, GOG, Epic, Battle.net…)
  or lives in one's folder, if it's one of Steam's little shortcut apps
  (Mote reads its one-line launch script for the `steam://` link; it's never
  run), or if it's built with a game engine.
- **The Mac's own apps** (Safari, Music, Calculator, Photo Booth, Terminal
  and about 60 more) each get their own line and a little reaction.
- **Any other app** gets "That's an app, not a game."
- **Files and folders** aren't Mote's kind of thing: a sorry-but-no shake of
  the head ("That's a bit too much like work for me. I'm more of a
  games-and-movies friend.").

**Links** dragged onto Mote (from a browser's address bar or a page, or a
`.webloc` link file from Finder) are saved: any website, with YouTube and
other video sites talked about as videos. Now and then, when Mote is awake,
nothing is playing and you've been around in the last couple of minutes,
Mote brings one up ("Little break? We could watch *lofi hip hop radio*.") and
asks if you'd like to go there; yes opens it in your browser. It happens about
every 20 minutes at most, and never within 12 minutes of the last one. Mote
keeps count of how often they've suggested each link, how often you said yes,
and when they last brought it up, and favours links they've never suggested,
ones you usually say yes to, and ones that haven't come up for a while.
Debug's Links tab lists your saved links with their history, and you can remove any.

## Mote themself

Mote looks at your pointer, blinks, glances around, thinks, gets grumpy, gets
surprised, and hops happily when poked (clicked right on the face; a
double-click starts a conversation, see "Talking to Mote"). Four quick pokes
in a row is too many, and Mote gets annoyed.

- **Petting:** press and keep stroking across Mote's face for a second or so.
  Mote melts into it and purrs. Stroke as fast as you like: moving with the
  button held down never counts as shaking.
- **Dizzy:** shaking the pointer around wildly (without holding the button),
  or throwing the window around the screen, makes Mote dizzy for a moment.
- **Naps:** left be for 4–7 minutes with nothing interesting going on, Mote
  yawns, dozes and falls asleep, and naps until something wakes them: a
  click (a poke), something starting to play (with a jolt) or something
  dropped on them. Petting a napping Mote gets a sleepy purr.
- **Eyes on you:** Mote's eyes follow your pointer anywhere on the screen,
  even while you're busy in other windows.
- **Watching along:** in the Mac app, if another visible window is playing
  sound, Mote keeps glancing toward it. Mote only knows *that* something is
  playing and where, never what. Moving the pointer a lot catches Mote's eye,
  and so does typing in another app (Mote only notices *that* keys are
  pressed, never which).

## Mood

Mote's mood sits on two axes, which Debug's Mind tab draws as a chart:

- **Joyful ↔ Frustrated** is about how Mote is *treated*. Petting, pokes,
  playing, attention and winning bring joy. Meanness (poking over and over),
  being shaken or thrown around, and losing at games
  (more so each time in a row) bring frustration. It fades back toward the
  middle on its own.
- **Satisfied ↔ Depressed** is about whether Mote is *looked after* and not
  ignored. Time together, playing anything and a good nap bring
  satisfaction. Being left alone for 20 minutes or more (faster when
  you're right there at the computer, just not with Mote) brings them down.
  It changes slowly.

The corners are **Happy**, **Needy** (treated well but too often left out),
**Grumpy** (looked after, but someone's been mean) and **Miserable**; with
only one axis leaning, Mote is **Cheerful**, **Cross**, **Content** or
**Lonely**; near the middle, **Okay**. It shows on Mote's face (a little
smile, a scowl, a droop), in what they do on their own, in how much they
chat and what about, and when they're lonely they ask for a game or a pet.

All of it carries over when Mote's app is closed: joy settles, and being
gone for more than ten hours or so gets a bit lonely. Back after a few hours, Mote is glad
to see you.

**Friendly mode** (in Debug's Features tab, with the Mind; on unless switched off) keeps Mote from getting too upset: joy and
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
feeling. How often follows **Energy** (in Debug's Features tab, with the Mind) (about every 3–6 minutes at
Normal), and their mood.

**Check-ins:** every hour or two (the first about half an hour in), instead of
a passing thought, Mote asks a simple question about how you're doing: calm?
rested? eaten? comfy? having fun? Questions fit the moment: a late-night one
after 11pm, a work one while you're typing, a "good morning" one before 11.
Green always means you're fine, and gets something glad. Red gets a
concerned, soft look and a reply that fits the question, understanding
first and maybe one small idea ("Late-night brain is the worst brain. Don't
believe everything it tells you right now."). Not having fun isn't a worry,
though: Mote offers the games instead, as a list to pick from. Left unanswered, Mote says nothing at all: just a slow blink, a
gentle smile and a little nod. Answers never upset Mote, the same question
doesn't come back within eight hours, and none come while Mote is cross
(unless in Friendly mode).

## Talking to Mote

Almost everything you do with Mote starts with a double-click on them. Mote
asks what you'd like to do (the words change with their mood: bright when happy,
a little short when cross), with a box to type in (its hint never names anything in particular). Type it
however you like, and press Return:

- "I want to play a game", "game", "I'm bored" — the games, as a list to
  pick from (click one, type its name, or type "2")
- "chess", "I want to play chess", "checkers", "tic tac toe",
  "solitaire" (or "cards", "patience"), "uno"
  — that game, straight away
- "a video", "something to watch", "my links" — one of your saved links
  (or how to save one, if there are none)
- "settings", "dark mode" — opens Settings
- "what can you do", "help", "idk" — a list of everything Mote can do right
  now, to pick from
- and a few friendly ones: "hi", "thanks", "how are you", "never mind"

Mote reads it with a big list of keywords for each thing, and is forgiving:
plurals, words cut short ("solitai"), words run together or split ("tictactoe",
"tic tac toe"), extra or missing letters, swapped letters. If Mote is sure,
they just do it. If it only matches with a typo or two ("I want to paaly a
gatme"), they check first ("You want to play a game?"): yes does it, no asks
what you meant. If nothing matches, Mote asks you to put it another way.
"Don't" is understood ("I don't want to play" isn't a game). Each keyword
belongs to one thing only, so new features join the thing they belong to
rather than competing for words. Anything switched off, Mote says so.

A double-click always works, whatever's open: a game (it's saved for next
time) or the file options go away and a new conversation
starts. The first click of it is a poke as usual, so it gets a little hop;
if that click woke Mote up, they need a moment, and you can talk once
they're up. While Mote is busy with a file job, they say so. Leaving a question
unanswered is fine: it goes away on its own, and Mote doesn't mind. Press
Escape to close it.

## Try it as a Mac app

Open Terminal in this folder and run:

```bash
npm run mac
```

A Mote window opens. Any change you save to the code shows up in it right away.
Drag the window by its top edge.

## How Mote plays board games

There's no difficulty to pick, and no other way to play: in every game,
Mote plays well but keeps themself just behind you, so games are close and
you usually win by a hair:

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

The thinking is in `src/lib/close-game.ts`.

## Checkers

Double-click Mote and say "checkers" (or pick it from the games), and the
game starts straight away (or picks up where you left off). Mote's window
grows to fit the board, with Mote sitting just above it. When a game ends,
**Play again** starts the next one.

You're the dark pieces and go first. Click a piece, then one of the dots. The
usual rules: jumping is compulsory (the pieces that can jump pulse), a jump
keeps going while it can, and a piece that reaches the far side is crowned.
Mote's pieces are tiny Motes that blink and look at whichever piece you pick
up. In every game, Mote's pieces and marks are Mote in miniature, in Mote's
whole look: little jack-o'-lanterns with triangle eyes and a carved grin,
little ghosts, and so on (chess pieces keep their shapes and get Mote's
eyes). They're drawn from the same shapes as Mote (`MoteMark.tsx`), so any
new look reaches them too.

Mote plays along: watching your pointer on your turn, scanning the board on
theirs, wincing when you take a piece, looking smug when they take one,
puffing up proud when they're crowned, a victory dance or a good-sport smile
at the end. They comment on the big moments. Close the board mid-game and
it's saved for next time. Your record against Mote sits at the top of the
board.


## Chess

Double-click Mote and say "chess". Same board, same
record-keeping and saving as checkers. You're white (the cream pieces) and
go first, and Mote is black (ink pieces with little cream eyes), in light
and dark mode: click a
piece and the dots show where it can go (rings mean a capture). All the rules
are there: castling (move the king two squares), en passant, promotion (you
pick what the pawn becomes), check (the king glows red), checkmate,
stalemate, and draws by threefold repetition, fifty quiet moves, or too
little left to mate.

Mote's pieces are cream with little eyes (the knight, side-on, has one).

Mote has their own chess lines and faces: a sly, narrow-eyed nod when they put
you in check, wide darting eyes when you check them, a pout (naming the
piece) when you take one of theirs, real dismay over their queen, proud
stretching when a pawn of theirs promotes, and the victory dance or
good-sport smile at the end.

## Tic-tac-toe

Double-click Mote and say "tic-tac-toe". Same record-keeping
and saving as the other games. You're X; you and Mote take turns going first.
Your X draws itself in ink; Mote's marks are tiny Motes that blink and glance
at your latest move. Mote reacts when
you block them, when they block you, and when either of you sets up two ways
to win at once.

## Solitaire

Double-click Mote and say "solitaire" (or "cards"). It's Klondike, turning
one card at a time, and Mote is on your side: they watch, cheer the good bits
(an ace, a two or a finished suit going home, a hidden card turning over, a
column cleared), and help.

- Click a card and it glides wherever it can go: home first, if it can,
  otherwise the first column it fits on (an empty column only if nothing
  else fits). Nowhere to go, Mote says so. A face-up card in a column takes
  the cards on it along.
- Or drag a card exactly where you want it: onto a column, a foundation, or
  an empty spot. Somewhere it can't go, it slides back.
- Click the deck to turn a card; when it's empty, click it to turn the pile
  back over, as often as you like.
- **Ask Mote** for a move: they say it ("Try the 7 of clubs on the 8 of
  hearts") and light up the card and where it goes. Mote's advice goes: an
  ace or two home, then anything that uncovers a hidden card, then the pile,
  then the deck. Look at one spot for 25 seconds and Mote offers a move on
  their own.
- **Undo** takes moves back, one at a time. **New deal** asks once if a game
  is going.
- When nothing on the table or in the deck helps any more, Mote says so and
  offers a new deal. When every card is face up, **Let Mote finish** puts
  them all home.
- It's saved as you go, and the header keeps count: "Won 3 of 8".

Cards fly to wherever they go: from the deck to the pile, between columns,
home, and all 28 off the deck when a new deal is laid out; a card that turns
over flips. Their size follows the window both ways, so they grow when it's
bigger and shrink again when it's smaller, always leaving room for Mote.

The cards follow the style guide (see `STYLE.md`): warm paper faces with a
deeper rim and no outlines, Mote's colour on the back with a little pair of
Mote eyes.

## Uno

Double-click Mote and say "uno" (or pick it from the games). It's Uno for
two, with the usual 108 cards: seven each, match the top card's colour,
number or symbol, or play a Wild and pick the colour. Skips and Reverses
(with two players a Reverse is just a Skip) mean going again; a Draw Two or a
Wild Draw Four makes the other draw and lose their turn. A Wild Draw Four
only goes down when you have nothing of the colour asked for, so it's always
fair. You and Mote take turns going first.

- Your hand is along the bottom, sorted by colour; on your turn the cards
  that fit lift up, and the rest fade back. Click one to play it.
- Nothing fits (or you'd rather not)? Click the draw pile. If the card you
  draw fits, play it or press **Keep it**.
- Down to two cards, press **Uno!** before you play one (or quickly after).
  Forget, and Mote will usually catch you: two cards.
- Mote's cards are face down along the top. Mote always says "Uno!", gloats
  a little over a Draw Two, sulks a little at yours, and says which colour
  they pick with a wild.
- Cards fly to the pile and off the deck, and Mote's turn over as they go.

Like every game with Mote, they keep it close: well ahead of you (and not in
one of the games they may win), they hold back, drawing instead of playing
and going easy on Draw Twos, so the win stays within your reach. Games are
saved as you go, the header keeps your record, and Mote remembers how each
game went.

## Settings and debug mode

In the Mac app, press **⌘,** (Command + comma) to open Settings. It's kept
short: **Your name** (what Mote calls you), **Mote Appearance** (Normal or the
Jack-o'-lantern, see below), **Light or dark** (Light, Dark, or System to
follow the Mac), whether Mote opens when you log in, and whether the window floats above
others. Everything else (Friendly mode, Energy, Debug's own
Mode, saved links) is in Debug. Mote's eyes
always follow your pointer, and Mote always naps when left alone.

**Dark mode** swaps Mote's colours, like a photo negative: a dark face with
cream eyes (and cream eyebrows and mouth, if they're on), on a dark window.
Everything around Mote goes dark and warm too: speech bubbles, buttons, the
game cards and Settings. The game boards go a deep walnut, and the pieces
swap like Mote does: Mote's pieces (and tic-tac-toe marks) are dark with
cream eyes, yours cream. Chess is the exception: you're white and Mote is
black in both modes. The playing cards stay paper.

**Mote Appearance** (in Settings) gives Mote a special look: **Normal**, or the
**Jack-o'-lantern**, which always has its carved grin there (the mouth is
otherwise an experimental switch, and plain Mote never gets one from
Settings). Debug's own **Mode** (in the Features tab, with the Looks) does the
same for testing, but leaves the mouth to its switch, and also has the
**Ghost**, which isn't ready for Settings yet; Mote Appearance wins when it
isn't Normal. **Neutral** is just
Mote. **Jack-o'-lantern** (for Halloween) turns Mote's cream a soft pumpkin
orange, makes the eyes triangles like a carved pumpkin's (they still scowl,
smile, blink and look around), and turns the mouth, if it's on, into a
carved grin: wide and jagged, with two blocky teeth hanging down and one
standing up, soft and cartoony. It follows the face like the little mouth
does (corners up when happy, a droop when glum, taller when surprised), and
works its jaw while Mote talks. In dark mode it's inverted like everything
else: a dark pumpkin with glowing orange eyes and grin. The expression sheet
shows it with ?jack=1.

**Ghost** (Debug's Mode only, for now) puts Mote under a sheet: Mote's own round top, falling to the
classic wavy ghost hem, and round eye holes, perfectly round at rest (they
still squint, scowl, widen and blink, cut by the same brows and cheeks). The
ghost hovers, bobbing gently over a smaller, fainter shadow, and the sheet is
soft cloth: each point of the hem is on a little spring of its own, so it
trails behind and jiggles when Mote hops, turns, gets shaken or has their
window dragged, and billows a touch all the time. The sheet stays white and
the holes dark in dark mode too (so in dark mode your checkers go back to
ink, to stay apart from the ghost's white ones). Ghosts don't have mouths:
there's no ghost mouth, and Settings never gives one (with Debug's
experimental mouth on, it's the plain little one). The expression sheet
shows it with ?ghost=1.

Text in the app calls Mote "Mote", or "they/them" when a pronoun is needed.

### Debug and experimental features

**Debug** is locked behind a key. There's no box for it: with the Settings
window in front, just type it. Unlocking is for good (resetting settings
doesn't undo it) and takes effect straight away. To lock it again, use
**Turn off debugging** in the Data tab. Only a fingerprint of the key is kept
in the app, never the key itself.

With Debug unlocked, Settings grows tabs down the left of the window (and
the window grows to fit them): **Settings** first, then the Debug tabs. Mote
is in debug mode (taking orders from those tabs) only while Settings is
open. A tab about a feature that's switched off (Links) isn't shown.

- **Features**: a switch for everything Mote does, sorted by kind. Most are
  on until switched off; the ones tagged Experimental, and Saved links,
  Reacting to apps, Getting dizzy and the mood-shaped eyes, are off until
  switched on. A switch tagged "Needs …" only works with that one on too
  (it's greyed out without it). **Set to defaults** at the top (press it
  twice) puts every switch, and Friendly mode, Energy and Mode, back to how
  they start.

  **Mind**
  - **Mind**: how Mote feels and everything that moves it (joy, peace, the
    lasting moods, and how they show). Off, Mote is held even (no lasting
    moods, nothing changes how they feel) and how they felt is kept aside,
    so switching it back on picks up where it left off. The mood-shaped
    eyes need it.
  - **Friendly mode** (a setting): Mote never gets too upset.
  - **Energy** (a setting): how often Mote does something on their own.

  **Speech: what Mote says on their own** (replies to what you do, and
  what the skills below need to say, aren't affected)
  - **Remarks**: a word about something that just happened (after a pet or
    a dizzy spell, waking up, being startled awake, something starting to
    play, you coming back). Off, the face still reacts.
  - **Small talk**: the every-few-minutes chat (time of day, your typing or
    what's playing, a passing thought, how Mote feels).
  - **Asking for things**: speaking up for a game or a pet when lonely.
    Off, the need is still there, Mote just doesn't say.
  - **Check-ins**: Mote now and then asking how you're doing.
  - **Remembering games** (needs Games): rematch nods, streaks, and old
    games in small talk. Off, games are still remembered, never mentioned.
  - **Talking during games** (needs Games): Mote's lines while you play.
    Off, they play in silence with just their faces; Solitaire advice you
    ask for is still said.

  **Doing things together**
  - **Conversations**: double-click (or Enter) to talk to Mote. Off, a
    double-click is just two pokes, and nothing can be asked for.
  - **Saved links**: saving links dragged onto Mote, and Mote suggesting
    them. Off, a dropped link gets a polite "not right now", no link is
    brought up, and Debug hides the Links tab (saved ones are kept).
  - **Reacting to apps**: playing games and reacting to the Mac's own apps
    dragged onto Mote. Off, apps get the same "not right now".
  - **Games**: the games, and Mote asking for or suggesting a game. Off, an
    open game is put away, Mote says the games are put away if you ask, and
    never brings them up: a lonely Mote asks for a pet instead,
    and "not having fun" gets a nudge toward something fun rather than a
    game. Games already played are still remembered.

  **Noticing and moving**
  - **Noticing the screen**: turning to look at sound in another window or
    typing in another app. Off, Mote notices neither (the eyes still follow
    the pointer).
  - **Getting dizzy**: whipping the pointer or shaking the window. Off, Mote
    rides it out.
  - **Little moods**: the glances, thoughts, cute moments, hums, huffs and
    sulks Mote does on their own between things. Off, they just rest.

  **Looks**
  - **Mood effects persistent eye shape** (needs Mind): how Mote feels
    shaping their resting eyes (a scowl, a little smile, a droop). Off, the eyes rest in their usual shape whatever
    the mood; expressions still play.

  - **Mode** (a setting): a special look (see above).

  and in **Looks**, the experimental ones:
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
- **Moods**: the **Animation set**, Simple (new) or Classic (old), then play
  any mood on demand, blink, poke, turn off automatic moods, loop a mood.
  Classic has a mood for nearly every moment (33 of them). Simple has 23
  general ones, each standing in for several classic moods: Happy, Cheer,
  Proud (any good move, a crown, a check), Content, Gentle look, Grumpy (every
  grumpy mood), Sad, Worried, No, Watching, Concentrating and Playing a game,
  plus the ones that were already general (glance, think, cute, surprise,
  dizzy, purr, yawn, doze, sleep, wake). Mote behaves the same with either:
  everything still asks for its classic mood, and the simple set shows the
  one standing in for it. The tab lists what each simple mood stands in for.
- **Mind**: the mood chart (with buttons to nudge it), the
  games Mote remembers, and every reaction with what it does to the mood
- **Speech**: everything Mote can say, and a button to say any of it now
- **Pose**: shape Mote's face by hand with sliders, then "Copy values" to share the numbers
- **Motion**: slow time down, freeze Mote, show outlines of the eye cuts, pretend
  another window is playing sound, give Mote a folder or video by typing its path
  (or pretend ones, in a browser), live numbers
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
- `src-tauri/target/release/bundle/dmg/Mote_0.10.29_aarch64.dmg` (an installer you can share)

Both are made by:

```bash
npm run mac:build
```

### Releasing a new version

```bash
npm run release:patch
```

It moves the version up one (0.10.0 to 0.10.1) everywhere Mote keeps it,
checks everything first (types, Mote's tests and the Mac side's tests), builds the
app and installer, and only then saves it all to git as `release: v0.10.1`
and pushes it. If a check or the build fails, nothing is changed, saved or
pushed. Add `-- --dry-run` to see what it would do without doing it. The
script is `scripts/release-patch.mjs`.

The project on GitHub keeps only Mote's own part of the built app, and the
installer is only on this computer. Build again to get the full one anywhere
else.

## See every expression side by side

While `npm run mac` is running, open http://127.0.0.1:1420/gallery.html in a browser.
Each face there is one expression frozen in place, handy for tweaking how they look.
Add `?brows=1` to see them with eyebrows, `?mouth=1` with the mouth.

## Where things live

- `STYLE.md` — the style guide: how Mote and everything around them should
  look (tone, not lines; colours; shapes; motion; games; voice)
- `src/components/companion/engine.ts` — every expression and how Mote moves between them
- `src/components/companion/Face.tsx` — how the face is drawn (the eyebrows' shape is in `eyeShape`, in engine.ts)
- `src/lib/companion/theme.ts` — sizes and positions of the face and eyes
- `desktop/` — the Mac app's pages: Mote (`index.html`), Settings (with the Debug tabs in `debug.tsx`), and the expression sheet
- `desktop/ui.tsx` and `desktop/ui.css` — the soft buttons, switches and sliders
- `src/lib/companion/settings.ts` — the list of settings and their defaults, and dark mode (`useDark`)
- `src/lib/companion/features.ts` — Debug's key and every switch in the Features tab, by section
- `src/components/companion/mind.ts` — Mote's mood, and how it changes
- `src/components/companion/memories.ts` — the games Mote remembers, and how they bring them up
- `src/components/companion/converse.ts` — talking to Mote: every keyword, how typing is understood, and what Mote says
- `src/components/companion/reactions.ts` — every stimulus → response rule
- `src/components/companion/speech.ts` — everything Mote can say, and when
- `src/components/companion/SpeechBubble.tsx` — how the bubbles look
- `desktop/senses/main.swift` — the helper that notices sound, the pointer and typing
- `src/components/companion/Checkers.tsx` and `checkers.css` — the checkers board
- `src/components/companion/checkers-lines.ts` — what Mote says over a game
- `src/lib/checkers/rules.ts` — the rules; `ai.ts` — how Mote picks a move
- `src/components/companion/Chess.tsx`, `chess-pieces.tsx` and `chess-lines.ts` — the chess board, its pieces, and what Mote says
- `src/lib/chess/rules.ts` — every chess rule; `ai.ts` — how Mote picks a chess move
- `src/lib/close-game.ts` — how Mote keeps games close (the usual way they play)
- `src/components/companion/TicTacToe.tsx` and `tictactoe-lines.ts`, and `src/lib/tictactoe/game.ts` — tic-tac-toe
- `src/components/companion/Solitaire.tsx`, `solitaire.css` and `solitaire-lines.ts`, and `src/lib/solitaire/game.ts` — Solitaire (the rules and Mote's advice)
- `src/components/companion/Uno.tsx`, `uno.css` and `uno-lines.ts`, and `src/lib/uno/game.ts` — Uno (the rules and how Mote plays)
- `src/components/companion/cards.tsx` and `cards.css`, and `src/lib/cards.ts` — the playing cards the card games share
- `src/components/companion/MoteMark.tsx` — Mote in miniature for game pieces and marks, in Mote's whole look
- `src/components/companion/board-ui.tsx` and `board.css` — what both games share (level picker, header, end panel, the board's look)
- `src/components/companion/links.ts` — saved links, their history, and how Mote picks one to suggest
- `src-tauri/src/links.rs` — reading a dragged link, and opening one in your browser
- `src-tauri/src/apps.rs` — reading an app dropped on Mote: its name, and whether it's a game
- `src-tauri/` — the Mac app wrapper itself
