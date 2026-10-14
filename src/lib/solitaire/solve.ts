// Can a game be won from here? A search that knows where every card is. It
// keeps every deal (and every game, as it's played) one that can be won.
//
// Turning one card at a time with the waste turned back as often as you like
// means any card in the stock or waste can be brought up whenever it's
// wanted, so the deck is treated as a pile you can take any card from. The
// search only makes moves the real game allows, so a game it wins really can
// be won; it gives up on ones that take too long to work out, which only
// means it sometimes can't say.

import { SUITS, type Card } from "../cards.ts";

/** One step of a win: a card from the deck or a foundation, or a run off a
 * column, going home or onto a column. */
export type Step =
  | { from: "deck"; card: Card; to: "foundation" | number }
  | { from: "foundation"; card: Card; to: number }
  | { from: number; count: number; to: "foundation" | number };

/** Where every card is: just the piles of a game. */
export type Position = { stock: Card[]; waste: Card[]; foundations: Card[][]; tableau: Card[][] };

// Cards as numbers: suit * 13 + rank - 1.
const suitOf = (c: number) => Math.floor(c / 13);
const rankOf = (c: number) => (c % 13) + 1;
const red = (c: number) => suitOf(c) === 1 || suitOf(c) === 2;
const toCard = (c: number): Card => ({ suit: SUITS[suitOf(c)], rank: rankOf(c), up: true });
const idOf = (c: Card) => SUITS.indexOf(c.suit) * 13 + c.rank - 1;

type Col = { down: number[]; up: number[] };
type State = { cols: Col[]; found: number[]; deck: boolean[] };

const fitsOn = (c: number, under: number | undefined) =>
  under === undefined ? rankOf(c) === 13 : rankOf(under) === rankOf(c) + 1 && red(under) !== red(c);
const goesHome = (s: State, c: number) => s.found[suitOf(c)] === rankOf(c) - 1;
/** Home for good: nothing could still want to sit on it. */
function safeHome(s: State, c: number) {
  if (!goesHome(s, c)) return false;
  const r = rankOf(c);
  if (r <= 2) return true;
  const other = red(c) ? [0, 3] : [1, 2];
  return other.every((f) => s.found[f] >= r - 1);
}

const copy = (s: State): State => ({
  cols: s.cols.map((c) => ({ down: c.down, up: c.up.slice() })),
  found: s.found.slice(),
  deck: s.deck.slice(),
});

/** Takes `count` off a column, turning over what's underneath. */
function lift(col: Col, count: number): number[] {
  const run = col.up.splice(col.up.length - count, count);
  if (!col.up.length && col.down.length) {
    col.up.push(col.down[col.down.length - 1]);
    col.down = col.down.slice(0, -1);
  }
  return run;
}

function play(s: State, step: Step): State {
  const n = copy(s);
  let cards: number[];
  if (step.from === "deck") {
    cards = [idOf(step.card)];
    n.deck[cards[0]] = false;
  } else if (step.from === "foundation") {
    cards = [idOf(step.card)];
    n.found[suitOf(cards[0])] -= 1;
  } else cards = lift(n.cols[step.from], step.count);
  if (step.to === "foundation") n.found[suitOf(cards[0])] += 1;
  else n.cols[step.to].up.push(...cards);
  return n;
}

type Option = { step: Step; rank: number };

function options(s: State): Option[] {
  const out: Option[] = [];
  const firstEmpty = s.cols.findIndex((c) => !c.up.length);
  s.cols.forEach((col, i) => {
    if (!col.up.length) return;
    const topCard = col.up[col.up.length - 1];
    const reveals = col.up.length === 1 && col.down.length > 0;
    if (goesHome(s, topCard)) out.push({ step: { from: i, count: 1, to: "foundation" }, rank: reveals ? 0 : 2 });
    s.cols.forEach((target, j) => {
      if (j === i) return;
      const under = target.up[target.up.length - 1];
      if (under === undefined) {
        // A king and what's on it, into the first empty column, if that
        // uncovers something.
        if (j === firstEmpty && rankOf(col.up[0]) === 13 && col.down.length)
          out.push({ step: { from: i, count: col.up.length, to: j }, rank: 1 });
        return;
      }
      const k = col.up.findIndex((c) => fitsOn(c, under));
      if (k < 0) return;
      const count = col.up.length - k;
      if (k === 0) out.push({ step: { from: i, count, to: j }, rank: col.down.length ? 1 : 4 });
      // Splitting a run is only worth it to send the card it frees home.
      else if (goesHome(s, col.up[k - 1])) out.push({ step: { from: i, count, to: j }, rank: 3 });
    });
  });
  const fits = (c: number, j: number) => {
    const under = s.cols[j].up[s.cols[j].up.length - 1];
    return under === undefined ? j === firstEmpty && rankOf(c) === 13 : fitsOn(c, under);
  };
  s.deck.forEach((inDeck, c) => {
    if (!inDeck) return;
    if (goesHome(s, c)) out.push({ step: { from: "deck", card: toCard(c), to: "foundation" }, rank: 2 });
    for (let j = 0; j < 7; j++) if (fits(c, j)) out.push({ step: { from: "deck", card: toCard(c), to: j }, rank: 3 });
  });
  // A card back down off a foundation, to build on.
  s.found.forEach((n, suit) => {
    if (!n) return;
    const c = suit * 13 + n - 1;
    if (safeHome({ ...s, found: s.found.map((f, k) => (k === suit ? f - 1 : f)) }, c)) return;
    for (let j = 0; j < 7; j++)
      if (s.cols[j].up.length && fits(c, j)) out.push({ step: { from: "foundation", card: toCard(c), to: j }, rank: 5 });
  });
  return out.sort((a, b) => a.rank - b.rank);
}

/** Sends home everything that's safe to, without asking. */
function autoplay(s: State, path: Step[]): State {
  for (let moved = true; moved; ) {
    moved = false;
    for (let i = 0; i < 7; i++) {
      const up = s.cols[i].up;
      if (up.length && safeHome(s, up[up.length - 1])) {
        const step: Step = { from: i, count: 1, to: "foundation" };
        s = play(s, step);
        path.push(step);
        moved = true;
      }
    }
    for (let c = 0; c < 52; c++) {
      if (s.deck[c] && safeHome(s, c)) {
        const step: Step = { from: "deck", card: toCard(c), to: "foundation" };
        s = play(s, step);
        path.push(step);
        moved = true;
      }
    }
  }
  return s;
}

/** With every card face up, the lowest one not home can always go home. */
function finish(s: State, path: Step[]) {
  while (s.found.some((f) => f < 13)) {
    let low: Step | null = null;
    let lowRank = 99;
    s.cols.forEach((col, i) => {
      const c = col.up[col.up.length - 1];
      if (c !== undefined && goesHome(s, c) && rankOf(c) < lowRank) {
        low = { from: i, count: 1, to: "foundation" };
        lowRank = rankOf(c);
      }
    });
    s.deck.forEach((inDeck, c) => {
      if (inDeck && goesHome(s, c) && rankOf(c) < lowRank) {
        low = { from: "deck", card: toCard(c), to: "foundation" };
        lowRank = rankOf(c);
      }
    });
    if (!low) return false;
    s = play(s, low);
    path.push(low);
  }
  return true;
}

const keyOf = (s: State) =>
  s.found.join(",") +
  "/" +
  s.cols
    .map((c) => `${c.down.length}:${c.up.join(".")}`)
    .sort()
    .join("|");

/** How many positions the search looks at before giving up. */
export const BUDGET = 20000;

/**
 * A way to win from here, or null if none turned up within `budget`
 * positions. The foundations are taken to be built by suit, as they always
 * are.
 */
export function solve(p: Position, budget = BUDGET): Step[] | null {
  const start: State = {
    cols: p.tableau.map((col) => ({
      down: col.filter((c) => !c.up).map(idOf),
      up: col.filter((c) => c.up).map(idOf),
    })),
    found: [0, 0, 0, 0],
    deck: Array(52).fill(false),
  };
  for (const f of p.foundations) if (f.length) start.found[SUITS.indexOf(f[0].suit)] = f.length;
  for (const c of [...p.stock, ...p.waste]) start.deck[idOf(c)] = true;

  const seen = new Set<string>();
  const path: Step[] = [];
  let left = budget;

  const search = (s: State): boolean => {
    if (--left < 0) return false;
    const mark = path.length;
    s = autoplay(s, path);
    if (s.cols.every((c) => !c.down.length)) {
      if (finish(s, path)) return true;
      path.length = mark;
      return false;
    }
    const key = keyOf(s);
    if (!seen.has(key)) {
      seen.add(key);
      for (const o of options(s)) {
        path.push(o.step);
        if (search(play(s, o.step))) return true;
        path.length = path.length - 1;
        if (left < 0) break;
      }
    }
    path.length = mark;
    return false;
  };

  return search(start) ? path : null;
}
