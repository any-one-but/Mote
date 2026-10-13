// What Mote says over a game of Uno, and the face that goes with it. Mote
// loves Uno: they gloat a little when they hit you with a Draw Two, sulk
// a little when you hit them, and always shout their own "Uno!".
// `{color}` is filled in with a colour a wild named.

export type UnoEvent =
  | "start"
  | "mote-first"
  | "resume"
  /** You skipped Mote (a Skip or a Reverse). */
  | "you-skip"
  | "mote-skip"
  /** You made Mote draw two, or four. */
  | "you-draw2"
  | "you-wild4"
  | "mote-draw2"
  | "mote-wild4"
  /** A wild changed the colour (Mote's: `{color}` is the one they named). */
  | "you-wild"
  | "mote-wild"
  /** Nothing to play. */
  | "mote-draws"
  /** Down to one card, said out loud. */
  | "mote-uno"
  | "you-uno"
  /** You forgot to say it, and Mote noticed: two cards. */
  | "caught"
  /** You forgot, and Mote didn't notice in time. */
  | "missed"
  | "mote-win"
  | "you-win"
  | "resign"
  | "pause";

export const UNO_FACE: Partial<Record<UnoEvent, string>> = {
  start: "delight",
  "mote-first": "cute",
  resume: "cute",
  "you-skip": "ck-ouch",
  "mote-skip": "ck-smug",
  "you-draw2": "ck-ouch",
  "you-wild4": "ch-checked",
  "mote-draw2": "ck-smug",
  "mote-wild4": "ch-check",
  "mote-wild": "think",
  "mote-uno": "ck-crown",
  "you-uno": "surprise",
  caught: "ch-check",
  "mote-win": "ck-win",
  "you-win": "ck-lose",
  resign: "cute",
};

export const UNO_CHANCE: Record<UnoEvent, number> = {
  start: 1,
  "mote-first": 1,
  resume: 1,
  "you-skip": 0.45,
  "mote-skip": 0.4,
  "you-draw2": 0.7,
  "you-wild4": 1,
  "mote-draw2": 0.6,
  "mote-wild4": 1,
  "you-wild": 0.25,
  "mote-wild": 1,
  "mote-draws": 0.2,
  "mote-uno": 1,
  "you-uno": 0.6,
  caught: 1,
  missed: 0.5,
  "mote-win": 1,
  "you-win": 1,
  resign: 1,
  pause: 1,
};

const LINES: Record<UnoEvent, string[]> = {
  start: ["Uno! Your go.", "Seven cards each. Let’s go!", "Ooh, I love Uno. Your turn.", "Uno with {name}! Your go."],
  "mote-first": ["Me first this time!", "My turn to start!", "I’ll go first. Ready?"],
  resume: ["Back to our cards!", "Where were we? Oh, right.", "I kept our hands just like that."],
  "you-skip": ["Hey! I was going to go.", "Skipped. Hmph.", "Rude! …Fair, but rude."],
  "mote-skip": ["Skip! My turn again.", "Hehe. Me again.", "Sorry! I’ll go again."],
  "you-draw2": ["Two cards? Aww.", "Ugh, fine. Two more.", "You’re enjoying this, aren’t you."],
  "you-wild4": ["Four?! You’re ruthless.", "FOUR cards. I’ll remember this.", "Oh, that’s mean. Good move, though."],
  "mote-draw2": ["Draw two! Hehe.", "Sorry! (Not sorry.) Two cards.", "Two for you!"],
  "mote-wild4": ["Wild Draw Four! And it’s {color}.", "Four for you, and {color} for me.", "Sorry, {name}. Draw four! It’s {color}."],
  "you-wild": ["Ooh, a new colour.", "Hmm. Let me see what I’ve got.", "Changing it up, huh."],
  "mote-wild": ["Wild! Let’s go {color}.", "I pick… {color}!", "{color}. Definitely {color}."],
  "mote-draws": ["Nothing! I’ll draw.", "Hmm… none of those. One more card.", "I’ll take one."],
  "mote-uno": ["Uno!", "UNO!", "Uno! One left!"],
  "you-uno": ["Uh oh. Uno already?", "One card left! I’d better hurry.", "Ooh, you remembered."],
  caught: ["You didn’t say Uno! Two cards.", "Hey, no Uno? Draw two!", "Caught you! You forgot to say Uno."],
  missed: ["Wait, did you say Uno? …Never mind.", "Hmm. I could’ve sworn… never mind."],
  "mote-win": ["Uno… out! I won!", "My last card! Good game!", "I’m out! Good game, {name}!"],
  "you-win": ["You’re out! Good game.", "Aw, I had so many left. Well played!", "You got me! Again?", "Out already? Good game, {name}."],
  resign: ["Giving up? Okay. Next time!", "Aw. We can play again soon."],
  pause: ["I’ll keep our cards just like this.", "We can finish later. No peeking!"],
};

/** A line for this moment, avoiding recent ones. `{color}` is filled in. */
export function pickUnoLine(
  event: UnoEvent,
  recent: string[],
  words: { color?: string } = {},
  rand: () => number = Math.random,
): { id: string; text: string } {
  const all = LINES[event].map((text, i) => ({ id: `uno-${event}-${i}`, text }));
  const fresh = all.filter((l) => !recent.includes(l.id));
  const from = fresh.length ? fresh : all;
  const line = from[Math.floor(rand() * from.length)] ?? from[0];
  const text = line.text.replaceAll("{color}", words.color ?? "red");
  return { id: line.id, text: text.charAt(0).toUpperCase() + text.slice(1) };
}
