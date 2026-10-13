import { test } from "node:test";
import assert from "node:assert/strict";
import { deal, fight, playOut, reviveWar, value, winnerOf, type WarGame } from "./game.ts";
import type { Card, Suit } from "../cards.ts";

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const c = (rank: number, suit: Suit = "spades"): Card => ({ rank, suit, up: false });
const game = (you: Card[], mote: Card[]): WarGame => ({ you, mote, rounds: 0, rng: 7 });

test("a deal is the whole deck, half each", () => {
  const g = deal({ mayWin: false }, seeded(3));
  assert.equal(g.you.length, 26);
  assert.equal(g.mote.length, 26);
  assert.equal(new Set([...g.you, ...g.mote].map((x) => `${x.suit}${x.rank}`)).size, 52);
  assert.ok(reviveWar(JSON.parse(JSON.stringify(g))));
});

test("the higher card takes both, aces high", () => {
  assert.equal(value(c(1)), 14);
  const { game: after, battle } = fight(game([c(9), c(2)], [c(4), c(3)]));
  assert.equal(battle.winner, "you");
  assert.equal(after.you.length, 3);
  assert.equal(after.mote.length, 1);
  const ace = fight(game([c(13)], [c(1), c(5)]));
  assert.equal(ace.battle.winner, "mote");
});

test("a tie is a war: three down, one up, winner takes all", () => {
  const you = [c(7, "hearts"), c(2), c(3), c(4), c(12), c(5)];
  const mote = [c(7, "clubs"), c(2, "hearts"), c(3, "hearts"), c(4, "hearts"), c(9), c(6)];
  const { game: after, battle } = fight(game(you, mote));
  assert.equal(battle.wars, 1);
  assert.equal(battle.winner, "you");
  assert.equal(battle.you.length, 5);
  assert.equal(after.you.length, 1 + 10);
  assert.equal(after.mote.length, 1);
});

test("short in a war: lay what you have; nothing to turn up loses it", () => {
  // Mote has only the tied card: no card left to turn up.
  const { game: after, battle } = fight(game([c(8), c(2), c(3)], [c(8, "hearts")]));
  assert.equal(battle.winner, "you");
  assert.equal(winnerOf(after), "you");
});

test("the shuffle is picked so you win a close game (or Mote, when they may)", () => {
  for (const [mayWin, want] of [
    [false, "you"],
    [true, "mote"],
  ] as const) {
    for (let n = 0; n < 5; n++) {
      const o = playOut(deal({ mayWin }, seeded(100 + n)));
      assert.equal(o.winner, want);
      assert.ok(o.rounds <= 200);
    }
  }
});

test("a saved game picks up exactly where it was", () => {
  const g = deal({ mayWin: false }, seeded(9));
  const a = fight(fight(g).game).game;
  const b = fight(fight(reviveWar(JSON.parse(JSON.stringify(g)))!).game).game;
  assert.deepEqual(a, b);
});
