# Mote's style guide

How Mote looks, and how everything around Mote should look, so that what
exists now and whatever comes next feel like one thing. When in doubt, look
at Mote themself: everything here comes from them.

## The idea

**Mote is a few soft shapes of different colours.** A round face, two pill
eyes, a soft shadow underneath. No outlines, no borders, no texture, nothing
sharp. Everything they do is the shapes changing: squashing, tilting, the
eyes being cut by a brow or a cheek. The face reads because the shapes are
different *tones*, not because anything is drawn around them.

Everything else in the app follows the same rules. It should feel:

- **Soft and round**: no sharp corners, no hard lines.
- **Warm**: creams, inks with brown in them, a terracotta accent. Never pure
  white, pure black, or cold greys and blues.
- **Quiet**: few things on screen, lots of room, one thing that matters most.
- **Alive**: things pop, spring and settle; nothing just appears.

## 1. Tone, not lines

This is the big one.

**Separate things by tone. Never draw a border, an outline, a divider or a
hairline ring around anything.** A card is a lighter tone than the window
it sits on. A button is a sunk tone inside the card. A selected thing gets
a warmer tone. An empty slot is a sunk tone. If two things need telling
apart, change the colour of one of them.

How to get each kind of separation without a line:

| You want… | Don't | Do |
| --- | --- | --- |
| A surface on the window | a 1px ring, a border | a lighter (or, in dark mode, a different) tone, plus a soft blurred shadow below |
| A row from the next row | a divider line | space between them (a full spacing step) |
| An empty spot or slot | a dashed or solid outline | a sunk tone, the same shape as what goes there |
| An object's edge (a piece, a die, a card) | an outline stroke | a **rim**: the same shape again, a few units lower, in a deeper tone, drawn underneath. It reads as the object's thickness |
| Overlapping objects (cards in a column) | a line on the top card | a soft shadow at the top card's edge, cast onto the one below |
| Picked up / selected | an accent outline | lift it a little, warm its tone, and turn its rim to the accent |
| A highlighted square or spot | an inset ring | a wash of colour over its own tone (accent, green for good, red for danger) |
| An empty dot (a passcode dot) | a ring | a sunk-tone dot; filled is ink |
| A focused text box | a ring | a warmer tone in the box (it's always focused while it's there) |

**Soft shadows are a tone, lines are not.** A blurred shadow under a card or
under Mote is fine: it's a shape of a darker tone with no edge. A 1px line
is never fine, however faint.

**Detail is tone too.** A chess piece's collar is a band of a slightly
different tone, not an inked line. A card back is a deeper panel inside a
lighter one, not a frame.

### The only lines allowed

- **Glyphs**: small icons made of thick, round-capped strokes (the close ×,
  arrows, the check and cross on yes/no buttons, the round arrow on an empty
  deck). They are symbols, not edges.
- **Marks that are drawn on purpose**: the tic-tac-toe X, the line through a
  winning row. They are the thing itself, not a border.
- **Chart guides** in Debug: faint, thin, in a tone close to the background.
- **Keyboard focus**: a soft accent halo on `:focus-visible` only, for
  accessibility. Never on mouse focus.

A shape "thickened" by a stroke *in its own colour* (to soften its corners or
keep it chunky) isn't an outline: it adds no second colour.

## 2. Colour

Every colour is a token. Use the token, never a hex value, in anything new.
They live in `src/styles.css` (Mote's window) and `desktop/ui.css` (Settings,
Debug, Days).

### Mote

| Token | Light | Dark | What |
| --- | --- | --- | --- |
| `--color-window` | `#e4ddd2` | `#3a322c` | the window behind Mote |
| `--color-face` | `#fff1e4` | `#231c18` | Mote's face (cream) |
| `--color-ink` | `#231c18` | `#fff1e4` | Mote's eyes, and text |
| `--mote-face` / `--mote-eyes` | face / ink | face / ink | what Mote is actually drawn in; modes change these |

**Dark mode is a photo negative of Mote**: the face and eyes swap (a dark
face, cream eyes). The window and everything around Mote go dark and warm.
Never make dark mode cold or blue-grey.

**Modes** (Settings' Mode) change Mote's two colours and shapes, and nothing
else. The jack-o'-lantern swaps the cream for `#f5ad6e` (the face in light
mode, the eyes in dark mode).

### Around Mote

| Token | Light | Dark | What |
| --- | --- | --- | --- |
| `--surface` | `#fffcf7` | `#2e2621` | bubbles, cards |
| `--surface-hover` | `#ffffff` | `#362d27` | a surface under the pointer |
| `--surface-soft` | `#f3eadf` | `#3a312b` | a quieter surface inside a surface |
| `--sunk` | `#ebe2d5` | `#463b34` | buttons, boxes to type in, empty slots |
| `--sunk-hover` | `#e4d9ca` | `#51453d` | those under the pointer |
| `--text-soft` | `#8b7d71` | `#b3a497` | secondary text |
| `--text-faint` | `#a39488` | `#8f8276` | hints, placeholders |
| `--accent` | `#e3997a` | same | the one accent: terracotta |
| `--accent-deep` | `#d5866a` | same | the accent pressed or under the pointer |
| `--on-accent` | `#fffcf7` | same | text and glyphs on the accent |
| `--warn` / `--warn-wash` | `#b5553b` / `#f6dccf` | `#ef9474` / `#4d2f25` | something's wrong |
| `--good` / `--good-wash` | `#4f7a35` / `#e3ecd4` | `#a9cf8e` / `#2f3b27` | something's right |

Settings, Debug and Days use the same family under their own names
(`--paper`, `--card`, `--sunk`, `--ink`, `--ink-soft`, `--accent`…).

**Tones step.** Window → surface → sunk is the whole ladder. Something on a
surface is sunk; something on the window is a surface. Don't invent an
in-between tone when a step will do.

**One accent, used rarely.** The accent means "this is the thing to do" (a
primary button), "this is yours right now" (picked up, selected), or "look
here" (Mote's hints). If everything is accent, nothing is.

**Text is ink, never grey-on-grey.** Secondary text is `--text-soft`. Hints
and placeholders are `--text-faint`. Emphasis in Mote's speech is `--warn`
(it reads as warm red).

### Things that stay put in dark mode

Game boards, pieces and playing cards are objects, not interface: they keep
their own colours in both modes (paper cards, a light wooden board, ink and
cream pieces). Only the card or table they sit on goes dark. If an object
would vanish on the dark card (ink dice), give it a lighter ink in dark
mode, not an outline.

## 3. Shape

- **Everything is rounded.** Pills (`999px`) for small controls and chips;
  `22px` for cards and panels in Settings; `20px` for speech bubbles;
  `12–14px` for buttons, choices and boxes to type in; roughly 12% of the
  width for playing cards. No sharp corners anywhere.
- **Mote's own shapes are softened by a filter**, so even cut edges are
  round. New shapes on Mote's face go inside that filter.
- **Big, simple, chunky.** Pieces are solid silhouettes with a few shapes.
  Suits are solid shapes. Icons are thick strokes with round ends.

## 4. Depth

- **Objects have a rim**: the same shape a few units lower in a deeper tone
  (see "Tone, not lines"). Pieces, dice and cards all have one.
- **Surfaces float on soft shadows**: wide, blurred, low opacity, warm
  (shadows use `--shade-rgb`, which is warm ink in light mode and black in
  dark mode).
- **Lifting is how you say "picked up"**: a few pixels up, a slightly bigger
  shadow, a warmer tone, an accent rim.
- **Nothing is flat-on-flat without a step in tone.**

## 5. Type

- **Outfit**, everywhere (400 for text, 500 for labels, 600 for headings,
  numbers that matter, and playing-card ranks).
- **Big is big, small is small.** Headings around 22–28px, body 15px,
  hints 12–13px. Never two sizes that nearly match.
- Short lines. Sentence case. Numbers in tables are tabular.

## 6. Space

- One unit: **8px**. Spacing is a multiple of it (half steps for tight
  things).
- Generous. When in doubt, more room, not a line.
- Rows in a list are separated by space, not dividers.

## 7. Motion

- **Springy for things appearing and being touched**: pops, hops, lifts use
  `cubic-bezier(0.34, 1.56, 0.64, 1)` (it overshoots a little and settles).
- **Soft for things settling and fading**: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Quick: 150–250ms for hover and press, 200–460ms for things arriving.
- Things never just appear or vanish: they pop in, fade or shrink out.
- **Hover** shifts the tone and lifts a hair; **press** shrinks a little
  (`scale(0.94–0.97)`).
- **"Look here"** is a gentle breathing wash of accent (Mote's hints), never
  a blinking outline.
- Respect **reduced motion**: drop the animation, keep the end state.

## 8. Components

- **Speech bubbles**: a surface with a soft shadow and a tail, text centred,
  typed out. Questions get round yes (green) and no (red) buttons with
  glyphs. Conversations get a sunk box to type in and choices as sunk rows,
  one per line.
- **Buttons**: primary is the accent with on-accent text; secondary is
  sunk; quiet is no tone at all until hovered (then sunk). Pill or 14px
  rounding.
- **Cards and panels**: a surface tone on the window, a soft shadow, no ring.
  A quieter panel (like Feature Key) is sunk instead.
- **Boxes to type in**: sunk, rounded, no border; warmer when focused.
- **Switches and segmented controls**: a sunk track with a surface thumb or
  segment; the on state is the accent.
- **Empty states** say something human, in Mote's voice.

## 9. Games

- **The table is the board game card** (a surface), with the game in sunk or
  board tones on it.
- **Your pieces are ink; Mote's are cream little Motes**, with two small pill
  eyes that look about and blink. This is how you tell whose is whose.
- **Every piece, die and card has a rim** in a deeper tone of its own colour.
- **Marks are washes**: a legal capture is an accent disc; a move worth
  making is a green wash on the square; danger is a red wash.
- **Playing cards** (Solitaire): warm paper faces (`#fff8ef`) with a deeper
  rim and a soft shadow at the top edge where they overlap. Rank in the
  corner with a small suit under it, and a big suit (or the letter, for a
  face card) in the middle. Red suits are a warm red (`#c4523c`), black
  suits are ink. Backs are Mote's accent with a deeper panel inside and a
  little pair of cream Mote eyes. Empty spots are sunk; an empty foundation
  shows a faint "A".

## 10. Voice

Mote's words are part of how the app looks.

- **Mote, or they/them.** Never he or she.
- Short, warm, a bit playful. Mote can be cross or sleepy, never mean.
- Interface text is plain and specific: say what happens ("Put the board
  away"), not what the control is.
- No jargon, no exclamation-mark walls, no emoji as icons.

## A checklist for anything new

- [ ] No `border`, no outline, no `0 0 0 1px` ring, no divider lines.
      Separation is tone, space, a rim or a soft shadow.
- [ ] Every colour is a token (or, for a game object, a named variable in
      its stylesheet), and there's a dark-mode value for it.
- [ ] Everything is rounded; nothing is sharp.
- [ ] One accent per screen, used for what matters.
- [ ] Hover, press and selected states change tone, not lines.
- [ ] It springs in; it respects reduced motion.
- [ ] It looks right in light and dark, and next to Mote.
