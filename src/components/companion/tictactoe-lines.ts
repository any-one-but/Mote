import type { Level } from "../../lib/checkers/ai.ts";

// What Mote says over a game of tic-tac-toe, and the face that goes with it.

export type TicTacToeEvent =
  | "start"
  | "mote-first"
  | "resume"
  | "you-block"
  | "mote-block"
  | "you-fork"
  | "mote-fork"
  | "mote-threat"
  | "slip"
  | "mote-win"
  | "you-win"
  | "draw"
  | "resign"
  | "pause"
  | "assist-start"
  | "assist-mistake"
  | "assist-good";

export const TICTACTOE_FACE: Partial<Record<TicTacToeEvent, string>> = {
  start: "delight",
  "mote-first": "cute",
  resume: "cute",
  "you-block": "ck-ouch",
  "mote-block": "ck-smug",
  "you-fork": "ch-checked",
  "mote-fork": "ch-check",
  "mote-threat": "ch-check",
  slip: "uhoh",
  "mote-win": "ck-win",
  "you-win": "ck-lose",
  draw: "cute",
  resign: "cute",
  "assist-start": "delight",
  "assist-mistake": "think",
  "assist-good": "delight",
};

export const TICTACTOE_CHANCE: Record<TicTacToeEvent, number> = {
  start: 1,
  "mote-first": 1,
  resume: 1,
  "you-block": 0.7,
  "mote-block": 0.5,
  "you-fork": 1,
  "mote-fork": 1,
  "mote-threat": 0.35,
  slip: 0.7,
  "mote-win": 1,
  "you-win": 1,
  draw: 1,
  resign: 1,
  pause: 1,
  "assist-start": 1,
  "assist-mistake": 0,
  "assist-good": 0,
};

type Pool = string[] | Record<Level, string[]>;

const LINES: Record<TicTacToeEvent, Pool> = {
  start: {
    close: ["Tic-tac-toe! Your move.", "X goes first. That’s you.", "Okay, I’m watching every square this time."],
    easy: ["Tic-tac-toe! You go first.", "Ooh, I like this one. Your turn.", "Three in a row wins, right? Okay!"],
    normal: ["Tic-tac-toe! Your move.", "X goes first. That’s you.", "Let’s see. Your turn."],
    hard: ["Hard? I don’t lose at this one. Your move.", "Fair warning: I know every trick.", "Go ahead. I’m ready."],
  },
  "mote-first": ["My turn to go first!", "I’ll start this time.", "Me first! Okay…"],
  resume: ["Back to our game!", "Where were we? Oh, right."],
  "you-block": ["Hey! I was going to go there.", "You saw that, huh.", "Blocked. Hmph."],
  "mote-block": ["Nope! Not today.", "I saw that coming.", "Blocked!"],
  "you-fork": ["Oh no. Two ways to win.", "Wait… I can’t block both.", "That’s sneaky. I like it. (I don’t.)"],
  "mote-fork": ["Two ways to win. Hehe.", "Pick one to block. Go on."],
  "mote-threat": ["Hmm hm hm.", "Watch that corner."],
  slip: ["Wait, was that a mistake?", "Oops. I didn’t see that."],
  "mote-win": {
    close: ["Three in a row! Finally!", "I got one! Good game."],
    easy: ["Three in a row! I did it!", "I won?! Yay!"],
    normal: ["Three in a row! Good game.", "Got you! Again?"],
    hard: ["Told you. Good game, though.", "Three in a row. That’s how it goes."],
  },
  "you-win": {
    close: ["Ugh, so close! You got me.", "I didn’t see that coming. Well played.", "You were one step ahead the whole time."],
    easy: ["You got three! Good game.", "Aw. You win! Again?"],
    normal: ["Three in a row. You got me!", "Well played. Rematch?"],
    hard: ["You beat me on Hard?! How?!", "That shouldn’t be possible. Well played."],
  },
  draw: ["A draw! Nobody wins.", "Cat’s game!", "Even again. Classic tic-tac-toe."],
  resign: ["Giving up already? Okay.", "Aw. Next time, then."],
  pause: ["I’ll keep the board just like this.", "We can finish later."],
  "assist-start": [
    "Let’s learn tic-tac-toe together! I’ll explain as we go.",
    "Learning mode! Watch the notes under the board.",
  ],
  "assist-mistake": [""],
  "assist-good": [""],
};

export function pickTicTacToeLine(
  event: TicTacToeEvent,
  level: Level,
  recent: string[],
  rand: () => number = Math.random,
): { id: string; text: string } {
  const pool = LINES[event];
  const list = Array.isArray(pool) ? pool : pool[level];
  const all = list.map((text, i) => ({ id: `ttt-${event}-${Array.isArray(pool) ? "" : `${level}-`}${i}`, text }));
  const fresh = all.filter((l) => !recent.includes(l.id));
  const from = fresh.length ? fresh : all;
  return from[Math.floor(rand() * from.length)] ?? from[0];
}
