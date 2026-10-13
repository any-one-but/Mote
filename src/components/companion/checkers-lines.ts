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
  | "forced"
  | "mote-win"
  | "you-win"
  | "draw"
  | "resign"
  | "pause"
  // Learning together: an opener, and faces (no words: the notes say it)
  // for your mistakes and your good moves.;

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
  forced: 0.6,
  "mote-win": 1,
  "you-win": 1,
  draw: 1,
  resign: 1,
  pause: 1,
};

const LINES: Record<CheckersEvent, string[]> = {
  start: ["Checkers! Your move.", "Let’s play! I’ve got a good feeling about this one.", "Your move. I’m right behind you.", "Let’s play, {name}!"],
  resume: ["Back to our game!", "Where were we? Oh, right.", "I kept the board just how you left it."],
  "you-capture": ["Hey! I needed that.", "Ow.", "Okay, I sort of saw that coming.", "Rude!", "That one was my favorite.", "Hmph."],
  "you-multi": ["Two?! Come on.", "Whoa, a double jump!", "That’s… a lot of my pieces.", "Okay, that was good."],
  "you-crown": ["A king! Uh oh.", "Now you’ve got a king. Great.", "Crowned! I don’t like where this is going."],
  "mote-capture": ["Yoink!", "Mine now.", "Thank you!", "Hehe.", "Didn’t see that, did you?", "Gotcha."],
  "mote-multi": ["Double jump!", "Hop, hop!", "Wheee!", "Two for me!"],
  "mote-crown": ["Crown me!", "I’m a king now. Bow.", "Look at my little crown!"],
  "mote-ahead": ["This is going well for me…", "I like this board.", "I think I’m winning?"],
  "mote-behind": ["Hmm. I might be in trouble.", "Okay, I need a plan.", "This isn’t going how I planned."],
  forced: ["You have to jump! It’s the rules.", "There’s a jump waiting for you."],
  "mote-win": ["I won! I actually got you!", "Got you this time! Good game.", "Good game, {name}!"],
  "you-win": ["So close! Good game.", "Aw, I almost had you.", "You just stayed ahead the whole time. Rematch?", "Good game, {name}. You got me."],
  draw: ["A draw! Nobody loses.", "Even! Good game."],
  resign: ["Giving up? Okay. Good game.", "Aw, already? Rematch sometime."],
  pause: ["We’ll finish later. I’ll keep the board.", "Okay! I saved our game."],
};

export const CHECKERS_SPEECH_COUNT = Object.values(LINES).reduce((n, list) => n + list.length, 0);

/** Something to say, avoiding the last few lines. */
export function pickCheckersLine(
  event: CheckersEvent,
  recent: string[],
  rand: () => number = Math.random,
): { id: string; text: string } {
  const list = LINES[event];
  const ids = list.map((_, i) => `${event}-${i}`);
  const fresh = ids.map((id, i) => ({ id, text: list[i] })).filter((l) => !recent.includes(l.id));
  const from = fresh.length ? fresh : ids.map((id, i) => ({ id, text: list[i] }));
  return from[Math.floor(rand() * from.length)] ?? from[0];
}
