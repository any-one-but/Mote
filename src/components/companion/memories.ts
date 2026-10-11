import type { Level } from "../../lib/checkers/ai.ts";
import type { Effects } from "./mind.ts";

// What Mote remembers about the games you've played together: who won, by
// how much, whether it was a comeback, and when. Mote brings these up later
// the way a person would: a rematch nods to the last game, a run of losses
// gets mentioned, and now and then a memorable game comes back to mind. Old
// or unremarkable games are left alone, and nothing gets brought up over
// and over.

export type GameName = "checkers" | "chess" | "tictactoe";
export type Margin = "crushing" | "clear" | "close";
export type GameWinner = "mote" | "you" | "draw";

export type GameMemory = {
  id: string;
  game: GameName;
  level: Level;
  winner: GameWinner;
  /** How it ended: "checkmate", "no-moves", "resign", "stalemate"… */
  how: string;
  margin: Margin;
  /** The winner was well behind at some point. */
  comeback: boolean;
  /** Moves played, both sides. */
  moves: number;
  at: number;
  /** How many times Mote has brought it up since, and when last. */
  mentioned: number;
  mentionedAt: number | null;
};

/** What a board game tells Mote when it ends. */
export type GameResult = {
  game: GameName;
  level: Level;
  winner: GameWinner;
  how: string;
  /** The winner's lead at the end (checkers: pieces, a king counting 1½;
   * chess: pawns' worth; tic-tac-toe: squares left empty). For a draw,
   * Mote's lead. */
  lead: number;
  /** The winner's lowest lead during the game (negative means behind). */
  worst: number;
  moves: number;
};

const KEY = "mote.memories.games";
const KEEP = 60;

export const GAME_NAME: Record<GameName, string> = { checkers: "checkers", chess: "chess", tictactoe: "tic-tac-toe" };

export function loadMemories(): GameMemory[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? (raw as GameMemory[]).filter((m) => m && typeof m.at === "number") : [];
  } catch {
    return [];
  }
}

function saveMemories(list: GameMemory[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-KEEP)));
  } catch {
    // Not remembered; nothing breaks.
  }
}

export function clearMemories() {
  saveMemories([]);
}

/** How decisive a result was. */
export function marginOf(game: GameName, lead: number): Margin {
  const [crushing, clear] = game === "checkers" ? [6, 3] : game === "chess" ? [12, 5] : [4, 2];
  if (lead >= crushing) return "crushing";
  if (lead >= clear) return "clear";
  return "close";
}

/** Games in a row (of this kind, in the last day) won by the same side as the latest. */
export function streak(list: GameMemory[], game: GameName, now = Date.now()): { winner: GameWinner; count: number } {
  const recent = list.filter((m) => m.game === game && now - m.at < 24 * 3_600_000);
  const last = recent[recent.length - 1];
  if (!last) return { winner: "draw", count: 0 };
  let count = 0;
  for (let i = recent.length - 1; i >= 0 && recent[i].winner === last.winner; i--) count++;
  return { winner: last.winner, count };
}

/**
 * What a finished game does to Mote's mood. Playing at all is satisfying.
 * Winning is a joy (most of all a close one); losing is frustrating (most of
 * all a thrashing), and more so each time it happens again.
 */
export function resultEffects(m: GameMemory, lossesBefore: number): Effects {
  const peace = 1.2;
  if (m.winner === "draw") return { peace, joy: 0.4 };
  if (m.winner === "mote") {
    if (m.how === "resign") return { peace, joy: 0.6 };
    const joy = { close: 2.5, clear: 2, crushing: 1.5 }[m.margin] + (m.comeback ? 0.5 : 0);
    return { peace, joy };
  }
  const sting = { close: 1, clear: 1.5, crushing: 2.2 }[m.margin] + (m.comeback ? 0.5 : 0);
  return { peace, joy: -sting * Math.min(2, 1 + 0.5 * lossesBefore) };
}

/** Remembers a finished game. Returns it, what it does to the mood, and the streak it's part of. */
export function recordGame(r: GameResult, now = Date.now()) {
  const list = loadMemories();
  const before = streak(list, r.game, now);
  const lossesBefore = before.winner === "you" ? before.count : 0;
  const memory: GameMemory = {
    id: `${r.game}-${now}`,
    game: r.game,
    level: r.level,
    winner: r.winner,
    how: r.how,
    margin: r.winner === "draw" ? "close" : marginOf(r.game, r.lead),
    comeback: r.winner !== "draw" && r.worst <= -3,
    moves: r.moves,
    at: now,
    mentioned: 0,
    mentionedAt: null,
  };
  list.push(memory);
  saveMemories(list);
  return { memory, effects: resultEffects(memory, lossesBefore), streak: streak(list, r.game, now) };
}

export function markMentioned(id: string, now = Date.now()) {
  const list = loadMemories();
  const m = list.find((x) => x.id === id);
  if (!m) return;
  m.mentioned += 1;
  m.mentionedAt = now;
  saveMemories(list);
}

/** When it was, said the way a person would. Null if it's too long ago to bring up. */
export function whenWords(at: number, now = Date.now()): string | null {
  const then = new Date(at);
  const today = new Date(now);
  const mins = (now - at) / 60_000;
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((dayStart(today) - dayStart(then)) / 86_400_000);
  if (days === 0) {
    if (mins < 20) return "just now";
    if (then.getHours() < 12 && today.getHours() >= 13) return "this morning";
    return "earlier";
  }
  if (days === 1) return then.getHours() >= 20 ? "last night" : "yesterday";
  if (days <= 4) return "the other day";
  if (days <= 10) return "last week";
  return null;
}

type Fill = { game: string; when: string; n: number };

const fill = (t: string, f: Fill) =>
  t.replaceAll("{game}", f.game).replaceAll("{when}", f.when).replaceAll("{n}", String(f.n));

const pick = <T,>(list: T[], rand: () => number) => list[Math.floor(rand() * list.length)];

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** A line for starting a game, if the last one is worth a nod. */
export function startLine(
  game: GameName,
  level: Level,
  opts: { friendly: boolean; rand?: () => number; now?: number } = { friendly: false },
): { id: string; text: string } | null {
  const rand = opts.rand ?? Math.random;
  const now = opts.now ?? Date.now();
  const list = loadMemories();
  const last = [...list].reverse().find((m) => m.game === game);
  if (!last) return null;
  const when = whenWords(last.at, now);
  if (!when) return null;
  const mins = (now - last.at) / 60_000;
  // The further back, the less likely it comes up.
  const chance = mins < 15 ? 0.85 : mins < 24 * 60 ? 0.55 : 0.3;
  if (rand() > chance) return null;
  const s = streak(list, game, now);
  const f: Fill = { game: GAME_NAME[game], when, n: s.count };
  const levels = ["easy", "normal", "hard"];
  const up = levels.indexOf(level) > levels.indexOf(last.level);
  const down = levels.indexOf(level) < levels.indexOf(last.level);
  let lines: string[];

  if (s.count >= 3 && s.winner === "you") {
    lines = opts.friendly
      ? ["That’s {n} in a row for you. I’m taking notes.", "{n} wins in a row! Okay, this one’s mine."]
      : ["{n} in a row for you. Not this time.", "{n} in a row. I’m not counting. (I am.)"];
  } else if (s.count >= 3 && s.winner === "mote") {
    lines = ["I’ve won the last {n}. Feeling lucky?", "{n} in a row for me… want me to go easier?"];
  } else if (down && last.winner === "you") {
    lines = [];
  } else if (down && last.winner === "mote") {
    lines = ["Trying an easier one? Fair.", "Taking it down a notch? Okay."];
  } else if (up && last.winner === "you") {
    lines = ["Moving up? Brave.", "Harder this time? Okay, no holding back."];
  } else if (mins < 15 && last.how === "resign") {
    lines = ["Again! Stay for a whole game this time?", "Back for more? No giving up this time."];
  } else if (mins < 15) {
    lines =
      last.winner === "you"
        ? ["Rematch. I’m ready this time.", "Again! I know what I did wrong."]
        : last.winner === "mote"
          ? ["Rematch? Sure!", "Another one? I’m on a roll."]
          : ["Let’s settle it this time.", "Tiebreaker!"];
  } else if (last.winner === "draw") {
    lines = ["We tied {when}. Let’s settle it.", "Last time was a draw. Not this time."];
  } else if (last.winner === "mote" && last.how === "resign") {
    lines = ["You gave up {when}. Stick around this time?", "No giving up this time, okay?"];
  } else if (last.winner === "mote") {
    lines =
      last.comeback
        ? ["Last time I came back from way behind. Still proud of that."]
        : last.margin === "close"
          ? ["That game {when} was close. Let’s see if I can do it again.", "That last one was tight. Ready?"]
          : last.margin === "crushing"
            ? ["Last time went pretty well for me…", "Ready? Last time was a bit one-sided."]
            : ["I won {when}. Just saying."];
  } else {
    lines =
      last.margin === "crushing"
        ? ["You crushed me {when}. I’ve been practicing since.", "Go easy? You wiped the floor with me {when}."]
        : last.margin === "close"
          ? ["So close {when}. I want this one.", "I almost had you {when}."]
          : last.comeback
            ? ["I was winning {when}, and then I wasn’t. Not again."]
            : ["You got me {when}. My turn now."];
  }
  if (!lines.length) return null;
  return { id: last.id, text: capital(fill(pick(lines, rand), f)) };
}

/** A line for the end of a game, if there's a streak worth mentioning. */
export function streakLine(
  game: GameName,
  opts: { friendly: boolean; rand?: () => number; now?: number } = { friendly: false },
): string | null {
  const rand = opts.rand ?? Math.random;
  const s = streak(loadMemories(), game, opts.now);
  if (s.count < 3 || rand() > 0.7) return null;
  const f: Fill = { game: GAME_NAME[game], when: "", n: s.count };
  const lines =
    s.winner === "you"
      ? opts.friendly
        ? ["That’s {n} in a row for you. Wow.", "{n} in a row! You’re really good at this."]
        : ["{n} in a row?! Okay. I need a minute.", "That’s {n} in a row for you. Hmph."]
      : s.winner === "mote"
        ? ["That’s {n} in a row for me!", "{n} straight! I’m on fire."]
        : ["Another draw. That’s {n} in a row!"];
  return capital(fill(pick(lines, rand), f));
}

/**
 * Something about a past game, said out of nowhere while just chatting. Only
 * memorable games (close, one-sided, comebacks), only from the last few
 * days, at most twice each, and not again for hours after.
 */
export function chatLine(
  opts: { friendly: boolean; rand?: () => number; now?: number } = { friendly: false },
): { id: string; text: string } | null {
  const rand = opts.rand ?? Math.random;
  const now = opts.now ?? Date.now();
  const list = loadMemories();
  // Not right after playing: it's still fresh, nothing to reminisce about.
  const latest = list[list.length - 1];
  if (latest && now - latest.at < 30 * 60_000) return null;
  const candidates = list.filter((m) => {
    const age = now - m.at;
    if (age > 4 * 86_400_000 || m.mentioned >= 2) return false;
    if (m.mentionedAt && now - m.mentionedAt < 6 * 3_600_000) return false;
    return m.comeback || m.margin !== "clear" || m.winner === "draw";
  });
  if (!candidates.length) return null;
  const m = candidates[Math.floor(rand() * candidates.length)];
  const when = whenWords(m.at, now);
  if (!when) return null;
  const f: Fill = { game: GAME_NAME[m.game], when, n: 0 };
  let lines: string[];
  if (m.winner === "draw") lines = ["We tied at {game} {when}. Unfinished business.", "Still thinking about that {game} draw."];
  else if (m.winner === "mote")
    lines = m.comeback
      ? ["I was so far behind at {game} {when}. And then I won!", "That {game} comeback {when}… I think about it a lot."]
      : m.margin === "close"
        ? ["That {game} game {when} was so close. I loved it.", "The {game} game {when} was a good one."]
        : ["Remember the {game} game {when}? I don’t want to brag. (I do.)"];
  else
    lines = m.comeback
      ? ["I had you at {game} {when}. How did that slip away?"]
      : m.margin === "close"
        ? ["We should play {game} again. That one {when} was close.", "I almost beat you at {game} {when}."]
        : opts.friendly
          ? ["You were so good at {game} {when}.", "I’ve been secretly practicing {game}. Just so you know."]
          : ["Still a little sore about {game} {when}.", "I keep thinking about that {game} game {when}. How did you do that?"];
  return { id: m.id, text: capital(fill(pick(lines, rand), f)) };
}
