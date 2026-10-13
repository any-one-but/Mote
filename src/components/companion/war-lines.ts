// What Mote says over War, and the face that goes with it. It's all luck, so
// Mote is all feelings: gleeful when they take a round, sulky when you do,
// and very dramatic about wars.

export type WarEvent =
  | "start"
  | "resume"
  /** An ordinary round: who took it. */
  | "you-take"
  | "mote-take"
  | "war"
  /** A war (or two, or three) won. */
  | "you-win-war"
  | "mote-win-war"
  /** The lead changes hands by a good margin. */
  | "mote-ahead"
  | "you-ahead"
  /** Down to the last few cards. */
  | "mote-low"
  | "you-low"
  | "mote-win"
  | "you-win"
  | "pause";

export const WAR_FACE: Partial<Record<WarEvent, string>> = {
  start: "delight",
  resume: "cute",
  "mote-take": "cute",
  war: "surprise",
  "you-win-war": "ck-ouch",
  "mote-win-war": "ck-smug",
  "mote-ahead": "ck-smug",
  "you-ahead": "worry",
  "mote-low": "worry",
  "you-low": "ck-smug",
  "mote-win": "ck-win",
  "you-win": "ck-lose",
};

export const WAR_CHANCE: Record<WarEvent, number> = {
  start: 1,
  resume: 1,
  "you-take": 0.06,
  "mote-take": 0.08,
  war: 1,
  "you-win-war": 0.9,
  "mote-win-war": 0.9,
  "mote-ahead": 0.8,
  "you-ahead": 0.8,
  "mote-low": 0.9,
  "you-low": 0.9,
  "mote-win": 1,
  "you-win": 1,
  pause: 1,
};

const LINES: Record<WarEvent, string[]> = {
  start: ["War! Highest card wins.", "Cards down. Let’s go!", "War! No skill, all heart."],
  resume: ["Back to the war!", "My cards were waiting for you.", "Where were we? Oh, right. Winning."],
  "you-take": ["Hmph.", "Fine, have it.", "Lucky."],
  "mote-take": ["Mine!", "Ooh, thank you.", "Yoink."],
  war: ["WAR!", "It’s war!", "Uh oh. War.", "Three down, one up. Here we go…"],
  "you-win-war": ["Noooo, all my cards!", "You won the war. Ugh.", "That was a whole army!"],
  "mote-win-war": ["Victory! All mine.", "I win the war!", "Look at this pile!"],
  "mote-ahead": ["I’m winning! For now.", "Look at my big pile.", "The cards like me today."],
  "you-ahead": ["Hey, where did my cards go?", "You’re pulling ahead…", "Okay, I need some aces."],
  "mote-low": ["I’m running out!", "Just a few cards left… be gentle.", "Uh oh. My pile is tiny."],
  "you-low": ["You’re nearly out!", "Your pile’s looking thin.", "Almost got you…"],
  "mote-win": ["I won the war! I won ALL of it!", "Every card is mine! Good game."],
  "you-win": ["You won the war! I surrender.", "All my cards… gone. Good game!", "So close! Rematch?"],
  pause: ["We’ll finish the war later.", "Cards down. I’ll keep them safe."],
};

/** A line for this moment, avoiding recent ones. */
export function pickWarLine(
  event: WarEvent,
  recent: string[],
  rand: () => number = Math.random,
): { id: string; text: string } {
  const all = LINES[event].map((text, i) => ({ id: `war-${event}-${i}`, text }));
  const fresh = all.filter((l) => !recent.includes(l.id));
  const from = fresh.length ? fresh : all;
  return from[Math.floor(rand() * from.length)] ?? from[0];
}
