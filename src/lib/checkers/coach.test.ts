import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { explain, review, tip } from "./coach.ts";
import { legalMoves, squareAt, type Board, type Cell } from "./rules.ts";

function draw(rows: string[]): Board {
  const board: Board = Array(32).fill(0);
  rows.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      const sq = squareAt(r, c);
      if (sq < 0) return;
      board[sq] = (ch === "o" ? 1 : ch === "O" ? 2 : ch === "x" ? -1 : ch === "X" ? -2 : 0) as Cell;
    });
  });
  return board;
}

describe("learning checkers", () => {
  it("explains a forced jump", () => {
    const board = draw(["........", "........", "........", "........", "...x....", "....o...", "........", "........"]);
    assert.match(tip(board, 20).text, /have to jump/);
  });

  it("calls handing over a piece a mistake, and marks the danger", () => {
    // Your man on (5,2) stepping to (4,3) walks next to Mote's (3,4) with an
    // empty square behind: Mote jumps it.
    const board = draw(["........", "........", "........", "....x...", "........", "..o.....", ".......o", "........"]);
    const bad = legalMoves(board, "you").find((m) => m.from === squareAt(5, 2) && m.path[0] === squareAt(4, 3))!;
    const r = review(board, bad);
    assert.equal(r.mistake, true);
    assert.ok(r.marks.some((m) => m.kind === "danger"));
  });

  it("explains Mote getting a king", () => {
    const board = draw(["........", "........", "........", "........", "........", "........", ".x......", "........"]);
    const move = legalMoves(board, "mote")[0];
    assert.match(explain(board, move, 100), /king/);
  });
});
