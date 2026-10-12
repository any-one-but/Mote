import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { explain, review, tip } from "./coach.ts";
import type { Grid } from "./game.ts";

const grid = (s: string): Grid => [...s].map((c) => (c === "x" ? "you" : c === "o" ? "mote" : null));

describe("learning tic-tac-toe", () => {
  it("points out a win, a block, and a strong opening", () => {
    assert.deepEqual(tip(grid("xx.oo....")).cells, [2]);
    assert.match(tip(grid("xx.oo....")).text, /win/);
    assert.match(tip(grid("oo.x.....")).text, /Block me at the top-right corner/);
    assert.match(tip(grid(".........")).text, /center/);
  });

  it("calls a missed block a mistake, and a good block a good block", () => {
    const missed = review(grid("oo..x...."), 8);
    assert.equal(missed.mistake, true);
    assert.match(missed.text ?? "", /block/);
    assert.deepEqual(missed.better, [2]);
    const blocked = review(grid("oo..x...."), 2);
    assert.equal(blocked.mistake, false);
    assert.equal(blocked.text, "Good block.");
  });

  it("catches the classic trap: an edge reply to a corner opening loses to perfect play", () => {
    // You took a corner, Mote took the opposite corner... here: Mote in a
    // corner, you answer on an edge, which lets Mote force a win.
    const r = review(grid("o........"), 1);
    assert.equal(r.mistake, true);
    assert.ok(r.better.includes(4));
  });

  it("explains Mote's own moves", () => {
    assert.match(explain(grid("xx.o.....") , 2, false), /blocked your top row/);
    assert.match(explain(grid("o...x...."), 8, false), /lining up|Nothing|even/);
    assert.match(explain(grid("oo.xx...."), 2, false), /Three in a row/);
  });
});
