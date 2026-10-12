import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickClose } from "./close-game.ts";

const opts = { unit: 100, progress: 0, won: 50_000, spread: 2000, mayWin: false };
const moves = (...scores: number[]) => scores.map((score, i) => ({ move: `m${i}`, score }));

describe("close games", () => {
  it("plays the best move when behind or about even", () => {
    for (const r of [0, 0.5, 0.99]) {
      assert.equal(pickClose(moves(-200, -300, -900), opts, () => r).pick.move, "m0");
      assert.equal(pickClose(moves(20, -150, -400), opts, () => r).pick.move, "m0");
    }
  });

  it("gives a lead back, a bit at a time, preferring a mistake that looks fine", () => {
    // A little ahead: about two and a half pieces' worth back at most.
    const some = pickClose(moves(300, 100, -40, -600), opts, () => 0);
    assert.equal(some.slip, true);
    assert.ok(some.pick.score >= -100 && some.pick.score < 300);
    // Way ahead: more than half of it goes back at once, but not all of it.
    const big = pickClose(moves(900, 650, 400, 100, -500), opts, () => 0);
    assert.equal(big.pick.score, 400);
    // Two equally sized mistakes: the one that looks fine at a glance wins out.
    const glance = (m: string) => (m === "m2" ? 300 : m === "m1" ? 0 : 310);
    const counts = { m1: 0, m2: 0 };
    for (let i = 0; i < 200; i++) {
      const pick = pickClose(moves(300, -40, -40, -600), { ...opts, glance }, () => (i + 0.5) / 200).pick.move;
      if (pick === "m1" || pick === "m2") counts[pick]++;
    }
    assert.ok(counts.m2 > counts.m1 * 2, JSON.stringify(counts));
  });

  it("never takes a forced win, unless it's a game Mote may win late on", () => {
    // (With a forced win found, the other moves get scored in full.)
    const won = moves(99_000, 150, -100, -400);
    const all = { ...opts, spread: Infinity };
    assert.notEqual(pickClose(won, all, () => 0.5).pick.move, "m0");
    assert.equal(pickClose(won, { ...all, mayWin: true, progress: 0.8 }, () => 0.5).pick.move, "m0");
  });

  it("lets itself fall further behind as the game goes on", () => {
    // Half a piece down: fine early, too good once the game is nearly over
    // and nothing's happening.
    const scored = moves(-50, -250, -400);
    assert.equal(pickClose(scored, opts, () => 0.1).pick.move, "m0");
    assert.notEqual(pickClose(scored, { ...opts, progress: 1.5 }, () => 0.1).pick.move, "m0");
  });
});
