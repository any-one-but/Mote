// Solitaire (Klondike, turning one card at a time), played with Mote helping
// rather than against them.
//
// Seven columns are dealt, one card in the first up to seven in the last,
// with only the top card of each face up. The rest of the deck is the stock.
// Turn cards from the stock onto the waste one at a time; when the stock runs
// out, turn the waste back over (as often as you like). Build the columns
// down in alternating colours (a red 6 on a black 7); a run of face-up cards
// moves together, and only a king (or a run starting with one) goes into an
// empty column. Build the four foundations up by suit from ace to king. A
// face-down card left on top of a column turns over by itself. Every card on
// the foundations wins.
//
// Mote's part is `hint`: the most useful thing to do next, or nothing if
// there's nothing left that helps (`stuck`).

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
export type Card = { suit: Suit; rank: number; up: boolean };

/** Where a card can be: the waste's top, a foundation, or a column. */
export type Place = { pile: "waste" } | { pile: "foundation"; i: number } | { pile: "tableau"; i: number };

export type Move =
  | { type: "draw" }
  | { type: "recycle" }
  /** `count` cards off the top of `from` (more than one only from a column). */
  | { type: "move"; from: Place; to: Place; count: number };

export type Game = {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  tableau: Card[][];
  moves: number;
};

export const isRed = (c: Card) => c.suit === "hearts" || c.suit === "diamonds";
export const RANK_NAME = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_WORD = ["", "ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king"];
export const cardWords = (c: Card) => `${RANK_WORD[c.rank]} of ${c.suit}`;
const top = <T,>(pile: T[]): T | undefined => pile[pile.length - 1];

/** A shuffled deal. */
export function deal(rand: () => number = Math.random): Game {
  const deck: Card[] = SUITS.flatMap((suit) =>
    Array.from({ length: 13 }, (_, i) => ({ suit, rank: i + 1, up: false })),
  );
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tableau: Card[][] = [];
  for (let col = 0; col < 7; col++) {
    const cards = deck.splice(0, col + 1);
    cards[cards.length - 1].up = true;
    tableau.push(cards);
  }
  return { stock: deck, waste: [], foundations: [[], [], [], []], tableau, moves: 0 };
}

/** Can `card` go on top of this column? */
export function fitsColumn(card: Card, column: Card[]): boolean {
  const under = top(column);
  if (!under) return card.rank === 13;
  return under.up && under.rank === card.rank + 1 && isRed(under) !== isRed(card);
}

/** Can `card` go on this foundation? */
export function fitsFoundation(card: Card, foundation: Card[]): boolean {
  const under = top(foundation);
  if (!under) return card.rank === 1;
  return under.suit === card.suit && under.rank === card.rank - 1;
}

/** The cards a move would pick up, or null if it can't pick those up. */
function lifted(g: Game, from: Place, count: number): Card[] | null {
  if (count < 1) return null;
  if (from.pile === "waste") return count === 1 && g.waste.length ? [g.waste[g.waste.length - 1]] : null;
  if (from.pile === "foundation") {
    const f = g.foundations[from.i];
    return count === 1 && f?.length ? [f[f.length - 1]] : null;
  }
  const col = g.tableau[from.i];
  if (!col || count > col.length) return null;
  const run = col.slice(col.length - count);
  // A run has to be face up and already in order.
  for (let k = 0; k < run.length; k++) {
    if (!run[k].up) return null;
    if (k > 0 && !(run[k - 1].rank === run[k].rank + 1 && isRed(run[k - 1]) !== isRed(run[k]))) return null;
  }
  return run;
}

export function isLegal(g: Game, m: Move): boolean {
  if (m.type === "draw") return g.stock.length > 0;
  if (m.type === "recycle") return g.stock.length === 0 && g.waste.length > 0;
  const cards = lifted(g, m.from, m.count);
  if (!cards) return false;
  if (m.to.pile === "waste") return false;
  if (m.from.pile === m.to.pile && "i" in m.from && "i" in m.to && m.from.i === m.to.i) return false;
  if (m.to.pile === "foundation") return cards.length === 1 && fitsFoundation(cards[0], g.foundations[m.to.i] ?? []);
  return fitsColumn(cards[0], g.tableau[m.to.i] ?? []);
}

const clone = (g: Game): Game => ({
  stock: g.stock.map((c) => ({ ...c })),
  waste: g.waste.map((c) => ({ ...c })),
  foundations: g.foundations.map((f) => f.map((c) => ({ ...c }))),
  tableau: g.tableau.map((t) => t.map((c) => ({ ...c }))),
  moves: g.moves,
});

/** The game after a move (which must be legal). A face-down card left on top
 * of a column turns over. */
export function apply(g: Game, m: Move): Game {
  const n = clone(g);
  n.moves += 1;
  if (m.type === "draw") {
    const c = n.stock.pop()!;
    n.waste.push({ ...c, up: true });
    return n;
  }
  if (m.type === "recycle") {
    n.stock = n.waste.reverse().map((c) => ({ ...c, up: false }));
    n.waste = [];
    return n;
  }
  const source =
    m.from.pile === "waste" ? n.waste : m.from.pile === "foundation" ? n.foundations[m.from.i] : n.tableau[m.from.i];
  const cards = source.splice(source.length - m.count, m.count);
  const target = m.to.pile === "foundation" ? n.foundations[m.to.i] : n.tableau[(m.to as { i: number }).i];
  target.push(...cards);
  if (m.from.pile === "tableau") {
    const t = top(source);
    if (t && !t.up) t.up = true;
  }
  return n;
}

export const isWon = (g: Game) => g.foundations.every((f) => f.length === 13);

/** Where this card can go on a foundation, if anywhere. */
export function foundationFor(g: Game, card: Card): number {
  // Its own suit's pile first, then the first empty one for an ace.
  const own = g.foundations.findIndex((f) => f.length && f[0].suit === card.suit);
  if (own >= 0) return fitsFoundation(card, g.foundations[own]) ? own : -1;
  return card.rank === 1 ? g.foundations.findIndex((f) => f.length === 0) : -1;
}

/** Every move of a card or run onto a column or foundation (not draws). */
export function placements(g: Game): Array<Extract<Move, { type: "move" }>> {
  const out: Array<Extract<Move, { type: "move" }>> = [];
  const sources: Array<{ from: Place; counts: number[] }> = [];
  if (g.waste.length) sources.push({ from: { pile: "waste" }, counts: [1] });
  g.tableau.forEach((col, i) => {
    const counts: number[] = [];
    for (let k = 1; k <= col.length; k++) if (lifted(g, { pile: "tableau", i }, k)) counts.push(k);
    if (counts.length) sources.push({ from: { pile: "tableau", i }, counts });
  });
  g.foundations.forEach((f, i) => {
    if (f.length) sources.push({ from: { pile: "foundation", i }, counts: [1] });
  });
  for (const { from, counts } of sources) {
    for (const count of counts) {
      if (count === 1 && from.pile !== "foundation") {
        const card = from.pile === "waste" ? top(g.waste)! : top(g.tableau[from.i])!;
        const f = foundationFor(g, card);
        if (f >= 0) out.push({ type: "move", from, to: { pile: "foundation", i: f }, count });
      }
      for (let i = 0; i < 7; i++) {
        const m = { type: "move" as const, from, to: { pile: "tableau" as const, i }, count };
        if (isLegal(g, m)) out.push(m);
      }
    }
  }
  return out;
}

/** What a move is worth as advice: higher is better, 0 isn't worth doing. */
function worth(g: Game, m: Extract<Move, { type: "move" }>): number {
  const col = m.from.pile === "tableau" ? g.tableau[m.from.i] : null;
  const left = col ? col.length - m.count : 0;
  const reveals = !!col && left > 0 && !col[left - 1].up;
  const empties = !!col && left === 0;
  const card =
    m.from.pile === "waste"
      ? top(g.waste)!
      : m.from.pile === "foundation"
        ? top(g.foundations[m.from.i])!
        : col![col!.length - m.count];
  if (m.to.pile === "foundation") {
    if (card.rank <= 2) return 100;
    return reveals ? 90 : m.from.pile === "waste" ? 60 : 55;
  }
  // Onto a column.
  if (m.from.pile === "foundation") return 0;
  if (reveals) return 80 + (col ? left : 0);
  if (m.from.pile === "waste") return card.rank === 13 ? 45 : 50;
  // A king to an empty column only helps if it uncovers something.
  if (card.rank === 13 && g.tableau[(m.to as { i: number }).i].length === 0) return reveals ? 70 : 0;
  // Emptying a column is worth it when there's a king waiting for it.
  if (empties) {
    const kingWaiting =
      (top(g.waste)?.rank === 13) ||
      g.tableau.some((c, i) => i !== (m.from as { i: number }).i && c.findIndex((x) => x.up && x.rank === 13) > 0);
    return kingWaiting ? 40 : 0;
  }
  // Otherwise shuffling a run between columns doesn't get anywhere.
  return 0;
}

/** Can any card in the stock or waste be played somewhere right now? */
function deckHelps(g: Game): boolean {
  const cards = [...g.waste, ...g.stock];
  return cards.some(
    (c) => foundationFor(g, c) >= 0 || g.tableau.some((col) => fitsColumn(c, col)),
  );
}

/**
 * Mote's advice: the most useful move, or a card from the stock (or turning
 * the waste over) if nothing on the table helps but the deck might. Null when
 * nothing helps at all.
 */
export function hint(g: Game): Move | null {
  let best: Extract<Move, { type: "move" }> | null = null;
  let bestWorth = 0;
  for (const m of placements(g)) {
    const w = worth(g, m);
    if (w > bestWorth) {
      best = m;
      bestWorth = w;
    }
  }
  if (best) return best;
  if (!deckHelps(g)) return null;
  if (g.stock.length) return { type: "draw" };
  if (g.waste.length) return { type: "recycle" };
  return null;
}

/** Nothing left that helps. */
export const stuck = (g: Game) => !isWon(g) && hint(g) === null;

/** Every card is face up and out of the deck: it can only go one way. */
export const canFinish = (g: Game) =>
  !isWon(g) && g.stock.length === 0 && g.waste.length === 0 && g.tableau.every((c) => c.every((x) => x.up));

/** The next card home, when finishing off: the lowest one that fits. */
export function finishMove(g: Game): Move | null {
  let best: Extract<Move, { type: "move" }> | null = null;
  let low = 99;
  g.tableau.forEach((col, i) => {
    const c = top(col);
    if (!c) return;
    const f = foundationFor(g, c);
    if (f >= 0 && c.rank < low) {
      low = c.rank;
      best = { type: "move", from: { pile: "tableau", i }, to: { pile: "foundation", i: f }, count: 1 };
    }
  });
  return best;
}

/** The card a move picks up first (the bottom of a run), for saying it. */
export function movingCard(g: Game, m: Extract<Move, { type: "move" }>): Card {
  if (m.from.pile === "waste") return top(g.waste)!;
  if (m.from.pile === "foundation") return top(g.foundations[m.from.i])!;
  const col = g.tableau[m.from.i];
  return col[col.length - m.count];
}

/** Checks a saved game is whole (52 cards, all where they could be). */
export function reviveGame(raw: unknown): Game | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<Game>;
  const okCard = (c: unknown): c is Card =>
    !!c &&
    typeof c === "object" &&
    SUITS.includes((c as Card).suit) &&
    Number.isInteger((c as Card).rank) &&
    (c as Card).rank >= 1 &&
    (c as Card).rank <= 13 &&
    typeof (c as Card).up === "boolean";
  const okPile = (p: unknown): p is Card[] => Array.isArray(p) && p.every(okCard);
  if (!okPile(g.stock) || !okPile(g.waste)) return null;
  if (!Array.isArray(g.foundations) || g.foundations.length !== 4 || !g.foundations.every(okPile)) return null;
  if (!Array.isArray(g.tableau) || g.tableau.length !== 7 || !g.tableau.every(okPile)) return null;
  const all = [...g.stock, ...g.waste, ...g.foundations.flat(), ...g.tableau.flat()];
  if (all.length !== 52 || new Set(all.map((c) => `${c.suit}${c.rank}`)).size !== 52) return null;
  return {
    stock: g.stock,
    waste: g.waste,
    foundations: g.foundations,
    tableau: g.tableau,
    moves: Number.isFinite(g.moves) ? Number(g.moves) : 0,
  };
}
