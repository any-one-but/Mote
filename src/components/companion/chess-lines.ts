// What Mote says over a game of chess, and the face that goes with it.
// `{piece}` is the piece of Mote's you took; `{yours}` is the piece of yours
// Mote took.

export type ChessEvent =
  | "start"
  | "resume"
  | "you-capture"
  | "you-take-queen"
  | "you-check"
  | "you-castle"
  | "you-promote"
  | "mote-capture"
  | "mote-take-queen"
  | "mote-check"
  | "mote-castle"
  | "mote-promote"
  | "mote-ahead"
  | "mote-behind"
  | "in-check"
  | "mote-win"
  | "you-win"
  | "stalemate"
  | "repetition"
  | "fifty"
  | "material"
  | "resign"
  | "pause";

export const CHESS_FACE: Partial<Record<ChessEvent, string>> = {
  start: "delight",
  resume: "cute",
  "you-capture": "ck-ouch",
  "you-take-queen": "ck-ouch",
  "you-check": "ch-checked",
  "you-castle": "glance",
  "you-promote": "surprise",
  "mote-capture": "ck-smug",
  "mote-take-queen": "ck-smug",
  "mote-check": "ch-check",
  "mote-castle": "cute",
  "mote-promote": "ck-crown",
  "mote-ahead": "ck-smug",
  "mote-behind": "worry",
  "mote-win": "ck-win",
  "you-win": "ck-lose",
  stalemate: "surprise",
  repetition: "cute",
  fifty: "cute",
  material: "cute",
  resign: "cute",
};

export const CHESS_CHANCE: Record<ChessEvent, number> = {
  start: 1,
  resume: 1,
  "you-capture": 0.45,
  "you-take-queen": 1,
  "you-check": 0.7,
  "you-castle": 0.4,
  "you-promote": 1,
  "mote-capture": 0.4,
  "mote-take-queen": 1,
  "mote-check": 0.7,
  "mote-castle": 0.6,
  "mote-promote": 1,
  "mote-ahead": 1,
  "mote-behind": 1,
  "in-check": 0.6,
  "mote-win": 1,
  "you-win": 1,
  stalemate: 1,
  repetition: 1,
  fifty: 1,
  material: 1,
  resign: 1,
  pause: 1,
};

const LINES: Record<ChessEvent, string[]> = {
  start: ["Chess! Your move.", "Ooh, a proper game. White goes first.", "Let’s see your opening. I’ve been practicing.", "Your move, {name}."],
  resume: ["Back to our game!", "I left everything exactly where it was.", "Now, where was I going with this…"],
  "you-capture": [
    "Hey, that was my {piece}!",
    "Not my {piece}!",
    "Ow. I liked that {piece}.",
    "Fine. Take the {piece}.",
    "My poor {piece}.",
  ],
  "you-take-queen": ["My queen! Nooo.", "I needed her!", "That was my best piece!"],
  "you-check": ["Eep! Check!", "Okay, okay, I see it.", "My king!", "Hey, leave my king alone."],
  "you-castle": ["Ooh, castling. Very proper.", "Tucking your king in? Smart.", "Fancy king hop."],
  "you-promote": ["A whole new queen?! Unfair.", "Your pawn made it all the way. Wow.", "Where did that queen come from?!"],
  "mote-capture": [
    "I’ll take that {yours}.",
    "Yoink. One {yours}.",
    "Thanks for the {yours}!",
    "Your {yours} looked lonely.",
    "Your {yours} is mine now.",
  ],
  "mote-take-queen": ["Got your queen!", "Your queen! Sorry. (Not sorry.)", "I can’t believe I got your queen."],
  "mote-check": ["Check!", "Check. Your move.", "Watch your king!", "Check, please. Hehe."],
  "mote-castle": ["Tucking my king away.", "Castle time!", "My king’s going somewhere safe."],
  "mote-promote": ["New queen for me!", "My pawn grew up!", "Look! She’s a queen now!"],
  "mote-ahead": ["I’m ahead, I think…", "This is going well for me.", "I like how my pieces look."],
  "mote-behind": ["I’m down some pieces. Thinking hard now.", "Hmm. I need a plan.", "This isn’t going my way."],
  "in-check": ["Your king’s in check!", "You have to get out of check first."],
  "mote-win": ["Checkmate! I finally got you!", "Checkmate. That was a tough one!", "Checkmate! Good game, {name}."],
  "you-win": ["Checkmate… so close! Well played.", "You were always one move ahead. Good game.", "Aw. I nearly had you.", "Well played, {name}. Really."],
  stalemate: ["Stalemate! Nobody wins.", "No moves, but no check… it’s a draw!"],
  repetition: ["Same moves again and again… draw!", "We keep going in circles. Draw!"],
  fifty: ["Fifty moves and nothing happened. Draw!", "Nobody’s getting anywhere. Draw!"],
  material: ["Not enough left to checkmate. Draw!", "Just kings, basically. Draw!"],
  resign: ["You resign? Good game!", "Aw. Rematch sometime?"],
  pause: ["I’ll keep the board just like this.", "Our game will be here when you’re back."],
};

export const CHESS_SPEECH_COUNT = Object.values(LINES).reduce((n, list) => n + list.length, 0);

/** Something to say, avoiding the last few lines, with the pieces filled in. */
export function pickChessLine(
  event: ChessEvent,
  recent: string[],
  words: { piece?: string; yours?: string } = {},
  rand: () => number = Math.random,
): { id: string; text: string } {
  const list = LINES[event];
  const all = list.map((text, i) => ({ id: `chess-${event}-${i}`, text }));
  const fresh = all.filter((l) => !recent.includes(l.id));
  const from = fresh.length ? fresh : all;
  const pick = from[Math.floor(rand() * from.length)] ?? from[0];
  const fill = (t: string) =>
    t.replaceAll("{piece}", words.piece ?? "piece").replaceAll("{yours}", words.yours ?? "piece");
  const text = fill(pick.text);
  // A line that starts with a piece name gets a capital letter.
  return { id: pick.id, text: text.charAt(0).toUpperCase() + text.slice(1) };
}
