// What Mote says over Liar's Dice, and the face that goes with it. The game
// never ends, so these are about rounds: bids, calls, and who was right.

export type LiarsDiceEvent =
  | "start"
  | "resume"
  /** Mote bids (now and then they say it out loud). */
  | "mote-bids"
  /** Mote bids on something they don't have (they never say so). */
  | "mote-bluffs"
  | "mote-calls"
  | "you-call"
  /** Mote called and was right: your bid didn't hold. */
  | "mote-caught-you"
  /** Mote called but your bid held. */
  | "mote-called-wrong"
  /** You called and Mote's bid didn't hold. */
  | "you-caught-mote"
  /** You called but Mote's bid held. */
  | "you-called-wrong"
  /** Three rounds in a row, either way. */
  | "mote-streak"
  | "you-streak"
  | "pause";

export const LIARSDICE_FACE: Partial<Record<LiarsDiceEvent, string>> = {
  start: "delight",
  resume: "cute",
  "mote-bluffs": "ch-check",
  "mote-calls": "ch-check",
  "you-call": "ch-checked",
  "mote-caught-you": "ck-smug",
  "mote-called-wrong": "ck-ouch",
  "you-caught-mote": "uhoh",
  "you-called-wrong": "ck-smug",
  "mote-streak": "ck-win",
  "you-streak": "ck-lose",
};

export const LIARSDICE_CHANCE: Record<LiarsDiceEvent, number> = {
  start: 1,
  resume: 1,
  "mote-bids": 0.3,
  "mote-bluffs": 0.5,
  "mote-calls": 1,
  "you-call": 0.6,
  "mote-caught-you": 0.8,
  "mote-called-wrong": 0.8,
  "you-caught-mote": 0.8,
  "you-called-wrong": 0.8,
  "mote-streak": 1,
  "you-streak": 1,
  pause: 1,
};

const LINES: Record<LiarsDiceEvent, string[]> = {
  start: ["Liar’s dice! Roll ’em.", "Dice time. No peeking.", "Okay, cups down. Let’s go."],
  resume: ["Back to the dice!", "Where were we? Oh, right."],
  "mote-bids": ["Hmm… {bid}.", "I’ll say {bid}.", "{bid}. Easy.", "Let’s go with {bid}."],
  "mote-bluffs": ["{bid}. Definitely.", "Oh, {bid}, for sure.", "{bid}. Trust me."],
  "mote-calls": ["Liar!", "No way. Liar!", "I don’t believe you. Liar!"],
  "you-call": ["Oh? You think so?", "Liar? Me?", "Let’s see, then."],
  "mote-caught-you": ["Caught you!", "Ha! I knew it.", "Nice try."],
  "mote-called-wrong": ["Wait, really?", "You actually had them?", "Okay, okay. You got me."],
  "you-caught-mote": ["Busted.", "Ugh. How did you know?", "Fine. I was bluffing."],
  "you-called-wrong": ["Told you!", "I wasn’t lying! This time.", "Never doubt the dice."],
  "mote-streak": ["Three in a row! I’m on a roll.", "Is it me, or am I good at this?"],
  "you-streak": ["Three in a row?! Are you peeking?", "You’re reading me like a book."],
  pause: ["I’ll keep my dice hidden till you’re back.", "Cups down. We can pick this up later."],
};

/** A line for this moment, avoiding recent ones. `{bid}` is filled in. */
export function pickLiarsDiceLine(
  event: LiarsDiceEvent,
  recent: string[],
  words: { bid?: string } = {},
  rand: () => number = Math.random,
): { id: string; text: string } {
  const all = LINES[event].map((text, i) => ({ id: `ld-${event}-${i}`, text }));
  const fresh = all.filter((l) => !recent.includes(l.id));
  const from = fresh.length ? fresh : all;
  const line = from[Math.floor(rand() * from.length)] ?? from[0];
  const bid = words.bid ?? "that";
  const text = line.text.replace("{bid}", bid);
  return { id: line.id, text: text.charAt(0).toUpperCase() + text.slice(1) };
}
