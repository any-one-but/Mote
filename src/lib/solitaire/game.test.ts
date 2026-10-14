import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apply,
  canFinish,
  deal,
  finishMove,
  fitsColumn,
  moveFor,
  keyOf,
  placements,
  rearrangement,
  relabel,
  unseen,
  winnable,
  fitsFoundation,
  hint,
  isLegal,
  isWon,
  reviveGame,
  stuck,
  type Card,
  type Game,
  type Move,
  type Suit,
} from "./game.ts";
import { solve, type Step } from "./solve.ts";

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const c = (rank: number, suit: Suit, up = true): Card => ({ rank, suit, up });
const empty = (): Game => ({ stock: [], waste: [], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], []], moves: 0 });

test("a deal is the whole deck, laid out properly", () => {
  const g = deal(seeded(1));
  const all = [...g.stock, ...g.waste, ...g.foundations.flat(), ...g.tableau.flat()];
  assert.equal(all.length, 52);
  assert.equal(new Set(all.map((x) => `${x.suit}${x.rank}`)).size, 52);
  g.tableau.forEach((col, i) => {
    assert.equal(col.length, i + 1);
    col.forEach((x, k) => assert.equal(x.up, k === col.length - 1));
  });
  assert.equal(g.stock.length, 24);
  assert.ok(reviveGame(JSON.parse(JSON.stringify(g))));
});

/** Plays a solver's win through the real game, turning the deck over to
 * reach each card it takes from there. */
function playOut(g: Game, steps: Step[]): Game {
  for (const s of steps) {
    let m = moveFor(g, s);
    for (let n = 0; m.type !== "move"; n++) {
      assert.ok(n < 60, "the card is in the deck");
      g = apply(g, m);
      m = moveFor(g, s);
    }
    assert.ok(isLegal(g, m), "every step of the win is allowed");
    g = apply(g, m);
  }
  return g;
}

test("every deal can be won, and the win really plays out", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = deal(seeded(seed));
    const win = solve(g);
    assert.ok(win, `deal ${seed} has a win`);
    assert.ok(isWon(playOut(g, win!)), `deal ${seed} plays out to a win`);
  }
});

test("a game that can't be won is turned down", () => {
  // Black cards on top of every column, none of which fit on another, and
  // the aces buried under them: nothing can ever move.
  const g = empty();
  const tops = [c(13, "spades"), c(13, "clubs"), c(12, "spades"), c(12, "clubs"), c(11, "spades"), c(11, "clubs"), c(10, "spades")];
  g.tableau = tops.map((t, i) => [...(i < 4 ? [c(1, (["spades", "hearts", "diamonds", "clubs"] as Suit[])[i], false)] : []), t]);
  assert.equal(solve(g), null);
});

test("a move that would lose the game deals the unseen cards differently, and nothing seen changes", () => {
  // Play deals with a careless player until a move would leave no way to win.
  const rand = seeded(7);
  let found = false;
  for (let n = 0; n < 60 && !found; n++) {
    let g = deal(rand);
    for (let t = 0; t < 400 && !isWon(g) && !found; t++) {
      const options: Move[] = [...placements(g), g.stock.length ? { type: "draw" } : { type: "recycle" }];
      const m = options[Math.floor(rand() * options.length)];
      if (!isLegal(g, m)) break;
      const swap = rearrangement(g, m, rand);
      if (!swap) {
        g = apply(g, m);
        continue;
      }
      found = true;
      assert.ok(!winnable(apply(g, m)), "it would have been lost");
      const hidden = new Set(unseen(g).map(keyOf));
      for (const k of swap.keys()) assert.ok(hidden.has(k), "only unseen cards change");
      const after = relabel(g, swap);
      const looks = (x: Game) =>
        JSON.stringify([x.tableau.map((col) => col.map((c) => (c.up ? keyOf(c) : "?"))), x.waste, x.foundations, x.stock.length]);
      assert.equal(looks(after), looks(g), "the table looks just the same");
      assert.ok(winnable(apply(after, m)), "and it can still be won");
    }
  }
  assert.ok(found);
});

test("a card once seen is never dealt differently, even after an undo", () => {
  const g = deal(seeded(3));
  const drawn = apply(g, { type: "draw" });
  // Undo: back to the deal, but still knowing the card that came up.
  const undone = { ...g, seen: drawn.seen };
  const card = drawn.waste[0];
  assert.ok(unseen(g).some((c) => keyOf(c) === keyOf(card)));
  assert.ok(!unseen(undone).some((c) => keyOf(c) === keyOf(card)));
  // A save from before this was kept: the deck is taken as seen.
  assert.equal(unseen({ ...g, seen: undefined }).length, 21);
});

test("columns build down in alternating colours; only kings go in empty ones", () => {
  assert.ok(fitsColumn(c(6, "hearts"), [c(7, "spades")]));
  assert.ok(!fitsColumn(c(6, "clubs"), [c(7, "spades")]));
  assert.ok(!fitsColumn(c(5, "hearts"), [c(7, "spades")]));
  assert.ok(!fitsColumn(c(6, "hearts"), [c(7, "spades", false)]));
  assert.ok(fitsColumn(c(13, "hearts"), []));
  assert.ok(!fitsColumn(c(12, "hearts"), []));
});

test("foundations build up by suit from the ace", () => {
  assert.ok(fitsFoundation(c(1, "hearts"), []));
  assert.ok(!fitsFoundation(c(2, "hearts"), []));
  assert.ok(fitsFoundation(c(2, "hearts"), [c(1, "hearts")]));
  assert.ok(!fitsFoundation(c(2, "diamonds"), [c(1, "hearts")]));
});

test("moving off a column turns the card underneath over", () => {
  const g = empty();
  g.tableau[0] = [c(9, "clubs", false), c(4, "hearts")];
  g.tableau[1] = [c(5, "spades")];
  const m = { type: "move" as const, from: { pile: "tableau" as const, i: 0 }, to: { pile: "tableau" as const, i: 1 }, count: 1 };
  assert.ok(isLegal(g, m));
  const after = apply(g, m);
  assert.equal(after.tableau[0][0].up, true);
  assert.equal(after.tableau[1].length, 2);
  // The original is left alone.
  assert.equal(g.tableau[0][0].up, false);
});

test("a run moves together, but only an ordered, face-up one", () => {
  const g = empty();
  g.tableau[0] = [c(8, "hearts"), c(7, "spades"), c(6, "diamonds")];
  g.tableau[1] = [c(9, "clubs")];
  const run = { type: "move" as const, from: { pile: "tableau" as const, i: 0 }, to: { pile: "tableau" as const, i: 1 }, count: 3 };
  assert.ok(isLegal(g, run));
  g.tableau[0][1] = c(7, "hearts");
  assert.ok(!isLegal(g, run));
});

test("drawing and turning the waste back over", () => {
  const g = empty();
  g.stock = [c(1, "clubs", false), c(2, "clubs", false)];
  const a = apply(g, { type: "draw" });
  assert.equal(a.waste[0].rank, 2);
  assert.equal(a.waste[0].up, true);
  const b = apply(apply(a, { type: "draw" }), { type: "recycle" });
  assert.equal(b.stock.length, 2);
  assert.equal(b.waste.length, 0);
  assert.ok(b.stock.every((x) => !x.up));
  // The same order comes round again.
  assert.equal(apply(b, { type: "draw" }).waste[0].rank, 2);
});

test("Mote's hint: an ace home first", () => {
  const g = empty();
  g.tableau[0] = [c(5, "clubs", false), c(1, "hearts")];
  g.tableau[1] = [c(9, "spades")];
  g.waste = [c(8, "hearts")];
  const h = hint(g);
  assert.ok(h && h.type === "move" && h.to.pile === "foundation" && h.from.pile === "tableau");
});

test("Mote's hint: uncover a hidden card before anything else", () => {
  const g = empty();
  g.tableau[0] = [c(3, "clubs", false), c(6, "hearts")];
  g.tableau[1] = [c(7, "spades")];
  g.waste = [c(10, "clubs")];
  g.tableau[2] = [c(11, "hearts")];
  const h = hint(g);
  assert.ok(h && h.type === "move" && h.from.pile === "tableau" && h.from.i === 0);
});

test("Mote's hint: the deck when nothing on the table helps", () => {
  const g = empty();
  g.tableau[0] = [c(9, "spades")];
  g.stock = [c(8, "hearts", false)];
  assert.deepEqual(hint(g), { type: "draw" });
  // Nothing anywhere would help: stuck.
  const s = empty();
  s.tableau[0] = [c(9, "spades")];
  s.stock = [c(4, "hearts", false)];
  assert.equal(hint(s), null);
  assert.ok(stuck(s));
});

test("finishing off, card by card, wins", () => {
  let g = empty();
  // Two suits left on the table, everything else home.
  for (const suit of ["spades", "diamonds"] as Suit[]) {
    const i = suit === "spades" ? 0 : 1;
    g.foundations[i] = Array.from({ length: 13 }, (_, k) => c(k + 1, suit));
  }
  g.tableau[0] = Array.from({ length: 13 }, (_, k) => c(13 - k, k % 2 ? "hearts" : "clubs"));
  g.tableau[1] = Array.from({ length: 13 }, (_, k) => c(13 - k, k % 2 ? "clubs" : "hearts"));
  assert.ok(canFinish(g));
  for (let n = 0; n < 30 && !isWon(g); n++) {
    const m = finishMove(g);
    assert.ok(m);
    g = apply(g, m!);
  }
  assert.ok(isWon(g));
});

test("a broken save isn't revived", () => {
  assert.equal(reviveGame(null), null);
  assert.equal(reviveGame({ stock: [], waste: [], foundations: [[], [], [], []], tableau: [] }), null);
});
