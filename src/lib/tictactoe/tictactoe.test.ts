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
});
