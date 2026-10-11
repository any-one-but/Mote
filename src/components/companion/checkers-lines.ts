import type { Level } from "../../lib/checkers/ai.ts";

// What Mote says over a game of checkers, and the face that goes with it.

export type CheckersEvent =
  | "start"
  | "resume"
  | "you-capture"
  | "you-multi"
  | "you-crown"
  | "mote-capture"
  | "mote-multi"
  | "mote-crown"
  | "mote-ahead"
  | "mote-behind"
  | "slip"
  | "hmm"
  | "forced"
  | "mote-win"
  | "you-win"
  | "draw"
  | "resign"
  | "pause";

/** The mood Mote shows for each, if any (otherwise the face stays as it is). */
export const CHECKERS_FACE: Partial<Record<CheckersEvent, string>> = {
  start: "delight",
  resume: "cute",
  "you-capture": "ck-ouch",
  "you-multi": "ck-ouch",
  "you-crown": "surprise",
  "mote-capture": "ck-smug",
  "mote-multi": "ck-smug",
  "mote-crown": "ck-crown",
  "mote-ahead": "ck-smug",
  "mote-behind": "worry",
  slip: "uhoh",
  "mote-win": "ck-win",
  "you-win": "ck-lose",
  draw: "cute",
  resign: "cute",
};

/** How likely Mote is to say something about each (the face always shows). */
export const CHECKERS_CHANCE: Record<CheckersEvent, number> = {
  start: 1,
  resume: 1,
  "you-capture": 0.55,
  "you-multi": 0.9,
  "you-crown": 0.9,
  "mote-capture": 0.5,
  "mote-multi": 0.9,
  "mote-crown": 0.9,
  "mote-ahead": 1,
  "mote-behind": 1,
  slip: 0.8,
  hmm: 0.5,
  forced: 0.6,
  "mote-win": 1,
  "you-win": 1,
  draw: 1,
  resign: 1,
  pause: 1,
};

type Pool = string[] | Record<Level, string[]>;

const LINES: Record<CheckersEvent, Pool> = {
  start: {
    easy: [
      "Checkers! Go easy on me, I’m still learning.",
      "Okay! I think I remember how this works.",
      "Your move! I’ll try my best.",
    ],
    normal: ["Checkers! Your move.", "Let’s play! You go first.", "Ooh, a fair fight. Your move."],
    hard: ["Hard mode? Okay. No mercy.", "I’ve been practicing. Your move.", "Alright. I’m winning this one."],
  },
  resume: ["Back to our game!", "Where were we? Oh, right.", "I kept the board just how you left it."],
  "you-capture": ["Hey! I needed that.", "Ow.", "Okay, I sort of saw that coming.", "Rude!", "That one was my favorite.", "Hmph."],
  "you-multi": ["Two?! Come on.", "Whoa, a double jump!", "That’s… a lot of my pieces.", "Okay, that was good."],
  "you-crown": ["A king! Uh oh.", "Now you’ve got a king. Great.", "Crowned! I don’t like where this is going."],
  "mote-capture": ["Yoink!", "Mine now.", "Thank you!", "Hehe.", "Didn’t see that, did you?", "Snack."],
  "mote-multi": ["Double jump!", "Hop, hop!", "Wheee!", "Two for me!"],
  "mote-crown": ["Crown me!", "I’m a king now. Bow.", "Look at my little crown!"],
  "mote-ahead": ["This is going well for me…", "I like this board.", "I think I’m winning?"],
  "mote-behind": ["Hmm. I might be in trouble.", "Okay, I need a plan.", "This isn’t going how I planned."],
  slip: ["Wait. Was that bad?", "Oops. I meant to do that.", "Hmm, maybe not that one."],
  hmm: ["Let me think…", "Hmm…", "Ooh, tricky."],
  forced: ["You have to jump! It’s the rules.", "There’s a jump waiting for you."],
  "mote-win": {
    easy: ["I won?! I actually won!", "Wait, I won? Yay!"],
    normal: ["I win! Good game.", "Got you! Good game."],
    hard: ["Told you. Good game, though.", "Victory! You put up a fight."],
  },
  "you-win": {
    easy: ["You win! Teach me your ways.", "Good game! You’re really good."],
    normal: ["You win! Good game.", "Aw. You got me. Rematch?"],
    hard: ["You beat me on Hard?! Wow.", "Okay, that was impressive. Good game."],
  },
  draw: ["A draw! Nobody loses.", "Even! Good game."],
  resign: ["Giving up? Okay. Good game.", "Aw, already? Rematch sometime."],
  pause: ["We’ll finish later. I’ll keep the board.", "Okay! I saved our game."],
};

export const CHECKERS_SPEECH_COUNT = Object.values(LINES).reduce(
  (n, pool) => n + (Array.isArray(pool) ? pool.length : Object.values(pool).flat().length),
  0,
);

/** Something to say, avoiding the last few lines. */
export function pickCheckersLine(
  event: CheckersEvent,
  level: Level,
  recent: string[],
  rand: () => number = Math.random,
): { id: string; text: string } {
  const pool = LINES[event];
  const list = Array.isArray(pool) ? pool : pool[level];
  const ids = list.map((_, i) => `${event}-${Array.isArray(pool) ? "" : `${level}-`}${i}`);
  const fresh = ids.map((id, i) => ({ id, text: list[i] })).filter((l) => !recent.includes(l.id));
  const from = fresh.length ? fresh : ids.map((id, i) => ({ id, text: list[i] }));
  return from[Math.floor(rand() * from.length)] ?? from[0];
}
