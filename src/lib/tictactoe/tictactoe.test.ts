import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseCell, emptyGrid, isFork, outcome, winningCells, type Grid } from "./game.ts";

const grid = (s: string): Grid => [...s].map((c) => (c === "x" ? "you" : c === "o" ? "mote" : null));

describe("tic-tac-toe", () => {
  it("spots wins, draws and forks", () => {
    assert.deepEqual(outcome(grid("xxxoo....")), { winner: "you", line: [0, 1, 2] });
    assert.deepEqual(outcome(grid("xoxxoooxx")), { winner: "draw" });
    assert.equal(outcome(grid("x...o....")), null);
    assert.deepEqual(winningCells(grid("oo.x.x..."), "mote"), [2]);
    assert.equal(isFork(grid("x.x.o.x.o"), "you"), true);
  });

  it("never loses on Hard, against every possible opponent", () => {
    // Every line of play by you, both with you starting and with Mote starting.
    let losses = 0;
    const walk = (g: Grid, turn: "you" | "mote") => {
      const end = outcome(g);
      if (end) {
        if (end.winner === "you") losses++;
        return;
      }
      if (turn === "mote") {
        const next = g.slice();
        next[chooseCell(g, "hard", () => 0)!.cell] = "mote";
        walk(next, "you");
        return;
      }
      for (let i = 0; i < 9; i++) {
        if (g[i]) continue;
        const next = g.slice();
        next[i] = "you";
        walk(next, "mote");
      }
    };
    walk(emptyGrid(), "you");
    walk(emptyGrid(), "mote");
    assert.equal(losses, 0);
  });

  it("takes a win on Normal, and blocks yours", () => {
    assert.equal(chooseCell(grid("oo.xx...."), "normal", () => 0.5)!.cell, 2);
    assert.equal(chooseCell(grid("xx..o...."), "normal", () => 0.5)!.cell, 2);
  });

  it("always blocks in a close game, but leaves you a way to win", () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      assert.equal(chooseCell(grid("xx..o...."), "close", () => r)!.cell, 2);
    }
    // You took a corner and Mote the middle; you took the opposite corner.
    // An edge is the only safe reply, and Mote sometimes plays a corner instead.
    const g = grid("x...o...x");
    const picks = new Set([0.1, 0.3, 0.5].map((r) => chooseCell(g, "close", () => r)!.cell));
    assert.ok([...picks].some((c) => c === 2 || c === 6));
    // In a game Mote may win, they play it straight.
    assert.ok([1, 3, 5, 7].includes(chooseCell(g, "close", () => 0.1, { mayWin: true })!.cell));
  });
});
