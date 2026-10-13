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
  | "mote-win"
  | "you-win"
  | "draw"
  | "resign"
  | "pause";

export const TICTACTOE_FACE: Partial<Record<TicTacToeEvent, string>> = {
  start: "delight",
  "mote-first": "cute",
  resume: "cute",
  "you-block": "ck-ouch",
  "mote-block": "ck-smug",
  "you-fork": "ch-checked",
  "mote-fork": "ch-check",
  "mote-threat": "ch-check",
  "mote-win": "ck-win",
  "you-win": "ck-lose",
  draw: "cute",
  resign: "cute",
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
  "mote-win": 1,
  "you-win": 1,
  draw: 1,
  resign: 1,
  pause: 1,
};

const LINES: Record<TicTacToeEvent, string[]> = {
  start: ["Tic-tac-toe! Your move.", "X goes first. That’s you.", "Okay, I’m watching every square this time."],
  "mote-first": ["My turn to go first!", "I’ll start this time.", "Me first! Okay…"],
  resume: ["Back to our game!", "Where were we? Oh, right."],
  "you-block": ["Hey! I was going to go there.", "You saw that, huh.", "Blocked. Hmph."],
  "mote-block": ["Nope! Not today.", "I saw that coming.", "Blocked!"],
  "you-fork": ["Oh no. Two ways to win.", "Wait… I can’t block both.", "That’s sneaky. I like it. (I don’t.)"],
  "mote-fork": ["Two ways to win. Hehe.", "Pick one to block. Go on."],
  "mote-threat": ["Hmm hm hm.", "Watch that corner."],
  "mote-win": ["Three in a row! Finally!", "I got one! Good game."],
  "you-win": ["Ugh, so close! You got me.", "I didn’t see that coming. Well played.", "You were one step ahead the whole time."],
  draw: ["A draw! Nobody wins.", "Cat’s game!", "Even again. Classic tic-tac-toe."],
  resign: ["Giving up already? Okay.", "Aw. Next time, then."],
  pause: ["I’ll keep the board just like this.", "We can finish later."],
};

export function pickTicTacToeLine(
  event: TicTacToeEvent,
  recent: string[],
  rand: () => number = Math.random,
): { id: string; text: string } {
  const list = LINES[event];
  const all = list.map((text, i) => ({ id: `ttt-${event}-${i}`, text }));
  const fresh = all.filter((l) => !recent.includes(l.id));
  const from = fresh.length ? fresh : all;
  return from[Math.floor(rand() * from.length)] ?? from[0];
}
