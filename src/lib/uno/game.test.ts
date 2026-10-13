import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catchable,
  chooseMove,
  deal,
  draw,
  fits,
  fullDeck,
  pass,
  penalty,
  play,
  playable,
  reviveUno,
  sayUno,
  top,
  type Uno,
  type UnoCard,
} from "./game.ts";

const card = (id: number, kind: UnoCard["kind"], color: UnoCard["color"], n?: number): UnoCard => ({ id, kind, color, n });

/** A small made-up game: the pile shows a red 5. */
function game(you: UnoCard[], mote: UnoCard[], extra: Partial<Uno> = {}): Uno {
  return {
    deck: [card(900, "number", "green", 1), card(901, "number", "blue", 2), card(902, "number", "yellow", 3), card(903, "number", "green", 4)],
    pile: [card(800, "number", "red", 5)],
    hands: { you, mote },
    color: "red",
    turn: "you",
    drawn: null,
    said: { you: false, mote: false },
    winner: null,
    moves: 0,
    ...extra,
  };
}

describe("Uno", () => {
  it("has the usual 108 cards", () => {
    const d = fullDeck();
    assert.equal(d.length, 108);
    assert.equal(d.filter((c) => c.kind === "wild4").length, 4);
    assert.equal(d.filter((c) => c.color === "red" && c.n === 0).length, 1);
    assert.equal(d.filter((c) => c.color === "blue" && c.n === 7).length, 2);
  });

  it("deals seven each and starts on a number", () => {
    for (let i = 0; i < 20; i++) {
      const g = deal();
      assert.equal(g.hands.you.length, 7);
      assert.equal(g.hands.mote.length, 7);
      assert.equal(top(g).kind, "number");
      assert.equal(g.deck.length + g.pile.length + 14, 108);
    }
  });

  it("matches colour, number or symbol, and wilds go anywhere", () => {
    const g = game([], []);
    assert.ok(fits(g, card(1, "number", "red", 9), []));
    assert.ok(fits(g, card(2, "number", "blue", 5), []));
    assert.ok(!fits(g, card(3, "number", "blue", 6), []));
    assert.ok(fits(g, card(4, "wild", null), []));
    // A Wild Draw Four only with nothing of the colour asked for.
    const red = card(5, "number", "red", 1);
    assert.ok(!fits(g, card(6, "wild4", null), [red]));
    assert.ok(fits(g, card(6, "wild4", null), [card(7, "number", "blue", 1)]));
  });

  it("skips, draws two and four, and names a colour with a wild", () => {
    const skip = card(1, "skip", "red");
    let g = play(game([skip, card(9, "number", "blue", 1)], [card(2, "number", "red", 2)]), "you", 1);
    assert.equal(g.turn, "you");
    const two = card(3, "draw2", "red");
    g = play(game([two, card(9, "number", "blue", 1)], [card(2, "number", "red", 2)]), "you", 3);
    assert.equal(g.hands.mote.length, 3);
    assert.equal(g.turn, "you");
    const wild = card(4, "wild", null);
    g = play(game([wild, card(9, "number", "blue", 1)], [card(2, "number", "red", 2)]), "you", 4, "blue");
    assert.equal(g.color, "blue");
    assert.equal(g.turn, "mote");
  });

  it("lets you play a card you just drew, or keep it", () => {
    let g = draw(game([card(1, "number", "blue", 9)], [card(2, "number", "red", 2)]), "you");
    // Drew a yellow 3 (no match): the turn passes.
    assert.equal(g.turn, "mote");
    g = draw(game([card(1, "number", "blue", 9)], [card(2, "number", "red", 2)], {
      deck: [card(905, "number", "red", 8)],
    }), "you");
    assert.equal(g.drawn, 905);
    assert.deepEqual(playable(g, "you").map((c) => c.id), [905]);
    assert.equal(pass(g, "you").turn, "mote");
  });

  it("catches a forgotten Uno", () => {
    const two = [card(1, "number", "red", 1), card(2, "number", "blue", 2)];
    const forgot = play(game(two, [card(3, "number", "red", 3)]), "you", 1);
    assert.ok(catchable(forgot, "you"));
    assert.equal(penalty(forgot, "you").hands.you.length, 3);
    const said = play(sayUno(game(two, [card(3, "number", "red", 3)]), "you"), "you", 1);
    assert.ok(!catchable(said, "you"));
  });

  it("is won by the first one out", () => {
    const g = play(game([card(1, "number", "red", 1)], [card(2, "number", "red", 2)]), "you", 1);
    assert.equal(g.winner, "you");
  });

  it("Mote plays something that fits, and draws when nothing does", () => {
    const g = game([card(1, "number", "red", 1)], [card(2, "number", "blue", 9), card(3, "number", "red", 4)], { turn: "mote" });
    const m = chooseMove(g, { mayWin: true }, () => 0.5);
    assert.ok("play" in m && m.play.id === 3);
    const none = game([card(1, "number", "red", 1)], [card(2, "number", "blue", 9)], { turn: "mote" });
    assert.ok("draw" in chooseMove(none, { mayWin: true }));
  });

  it("picks a saved game back up, and not a broken one", () => {
    const g = deal();
    assert.ok(reviveUno(JSON.parse(JSON.stringify(g))));
    assert.equal(reviveUno({ ...g, deck: [] }), null);
    assert.equal(reviveUno(null), null);
  });
});
