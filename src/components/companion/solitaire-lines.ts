// What Mote says over Solitaire, and the face that goes with it. Mote's on
// your side here: they cheer the good bits, point out moves when you ask (or
// when you've been looking a while), and are in it with you when it's stuck.

export type SolitaireEvent =
  | "start"
  | "resume"
  /** An ace (or a two) goes home. */
  | "home-low"
  /** Any other card goes home. */
  | "home"
  /** A hidden card turns over. */
  | "reveal"
  /** A column is cleared. */
  | "cleared"
  /** Mote's advice, asked for or offered: `{move}` is filled in. */
  | "hint"
  /** Mote offers advice after you've been looking a while. */
  | "nudge"
  /** The advice is to turn a card from the stock. */
  | "hint-draw"
  /** The advice is to turn the waste back over. */
  | "hint-recycle"
  | "undo"
  | "stuck"
  /** Everything's face up: Mote can finish it. */
  | "finish"
  | "win"
  | "new-deal";

export const SOLITAIRE_FACE: Partial<Record<SolitaireEvent, string>> = {
  start: "delight",
  resume: "cute",
  "home-low": "delight",
  reveal: "surprise",
  cleared: "beam",
  hint: "think",
  nudge: "glance",
  stuck: "worry",
  finish: "beam",
  win: "ck-win",
  "new-deal": "cute",
};

export const SOLITAIRE_CHANCE: Record<SolitaireEvent, number> = {
  start: 1,
  resume: 1,
  "home-low": 0.5,
  home: 0.15,
  reveal: 0.15,
  cleared: 0.6,
  hint: 1,
  nudge: 1,
  "hint-draw": 1,
  "hint-recycle": 1,
  undo: 0.25,
  stuck: 1,
  finish: 1,
  win: 1,
  "new-deal": 0.6,
};

const LINES: Record<SolitaireEvent, string[]> = {
  start: ["Solitaire! I’ll help.", "Ooh, cards. Let’s do this together.", "Fresh deck! I’m right here if you want a hand."],
  resume: ["Back to our cards!", "I kept them just how we left them.", "Where were we? Oh, right."],
  "home-low": ["An ace! Off it goes.", "Ooh, a good start for that pile.", "Home it goes!"],
  home: ["Home it goes.", "One more home.", "Nice."],
  reveal: ["Ooh, what’s under there?", "A new card!", "Look at that."],
  cleared: ["A whole column, empty! A king would love that spot.", "Look at all that room.", "Ooh, a free column."],
  hint: ["Try {move}.", "How about {move}?", "Psst: {move}.", "I think {move}."],
  nudge: ["Psst. {move}?", "Can I help? {move}.", "Hmm… what about {move}?"],
  "hint-draw": ["Nothing on the table, I think. Turn a card from the deck?", "Let’s see what’s in the deck."],
  "hint-recycle": ["Turn the pile back over and go round again?", "Back to the top of the deck!"],
  undo: ["No worries.", "Taking it back.", "Happens to the best of us."],
  stuck: [
    "Hmm. I don’t see anything left that helps. New deal?",
    "I think we’re stuck. Want to try a new one?",
    "I’ve looked everywhere. Nothing. Fresh cards?",
  ],
  finish: ["Everything’s showing! I can finish this for us.", "We’ve got it now. Want me to put them all away?"],
  win: ["We did it!!", "Every card home! Teamwork!", "Yes! We won! High five. (Imagine I have hands.)"],
  "new-deal": ["New cards! Let’s go.", "Fresh deck. This one’s ours."],
};

/** A line for this moment, avoiding recent ones. `{move}` is filled in. */
export function pickSolitaireLine(
  event: SolitaireEvent,
  recent: string[],
  words: { move?: string } = {},
  rand: () => number = Math.random,
): { id: string; text: string } {
  const all = LINES[event].map((text, i) => ({ id: `sol-${event}-${i}`, text }));
  const fresh = all.filter((l) => !recent.includes(l.id));
  const from = fresh.length ? fresh : all;
  const line = from[Math.floor(rand() * from.length)] ?? from[0];
  const text = line.text.replace("{move}", words.move ?? "that");
  return { id: line.id, text: text.charAt(0).toUpperCase() + text.slice(1) };
}
