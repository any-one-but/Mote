import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseMove, evaluate } from "./ai.ts";
import {
  applyToBoard,
  legalMoves,
  newGame,
  outcome,
  play,
  squareAt,
  type Board,
  type Cell,
  type Game,
} from "./rules.ts";

/** A board from a picture: rows top to bottom, `o`/`O` yours, `x`/`X` Mote's. */
function draw(rows: string[]): Board {
  const board: Board = Array(32).fill(0);
  rows.forEach((line, r) => {
    [...line.replace(/\s/g, "")].forEach((ch, c) => {
      const sq = squareAt(r, c);
      if (sq < 0) return;
      const cell: Cell = ch === "o" ? 1 : ch === "O" ? 2 : ch === "x" ? -1 : ch === "X" ? -2 : 0;
      board[sq] = cell;
    });
  });
  return board;
}

const at = (r: number, c: number) => squareAt(r, c);

describe("checkers rules", () => {
  it("starts with twelve each and seven opening moves for you", () => {
    const g = newGame();
    assert.equal(g.board.filter((c) => c === 1).length, 12);
    assert.equal(g.board.filter((c) => c === -1).length, 12);
    assert.equal(legalMoves(g.board, "you").length, 7);
  });

  it("makes jumping compulsory", () => {
    const board = draw([
      "........",
      "........",
      "........",
      "........",
      "...x....",
      "....o...",
      "o.......",
      "........",
    ]);
    const moves = legalMoves(board, "you");
    assert.equal(moves.length, 1);
    assert.deepEqual(moves[0].captures, [at(4, 3)]);
    assert.deepEqual(moves[0].path, [at(3, 2)]);
  });

  it("keeps jumping while it can, and the crowning row ends the move", () => {
    const board = draw([
      "........",
      "..x.....",
      "........",
      "..x.....",
      ".o......",
      "........",
      "........",
      "........",
    ]);
    const moves = legalMoves(board, "you");
    assert.equal(moves.length, 1);
    assert.equal(moves[0].captures.length, 2);
    const { board: after, crowned } = applyToBoard(board, moves[0]);
    assert.equal(crowned, true);
    assert.equal(after[at(0, 1)], 2);
    assert.equal(after.filter((c) => c < 0).length, 0);
  });

  it("only lets kings move backward", () => {
    const board = draw([
      "........",
      "........",
      "........",
      "....O...",
      "........",
      "..o.....",
      "........",
      "........",
    ]);
    const king = legalMoves(board, "you").filter((m) => m.from === at(3, 4));
    const man = legalMoves(board, "you").filter((m) => m.from === at(5, 2));
    assert.equal(king.length, 4);
    assert.equal(man.length, 2);
  });

  it("ends when a side can't move, and on forty quiet moves each", () => {
    const stuck: Game = {
      board: draw(["........", "........", "........", "........", "........", "........", ".x......", "o.o....."]),
      turn: "mote",
      quiet: 0,
      ply: 10,
    };
    assert.deepEqual(outcome(stuck), { winner: "you", reason: "no-moves" });
    const g = newGame();
    assert.equal(outcome({ ...g, quiet: 80 })?.winner, null);
    const after = play(g, legalMoves(g.board, "you")[0]).game;
    assert.equal(after.turn, "mote");
    assert.equal(after.quiet, 0);
  });
});

describe("Mote's checkers moves", () => {
  it("takes a free piece and avoids giving one away", () => {
    // Mote's man at (2,3) can jump yours at (3,4).
    const board = draw([
      "........",
      "........",
      "...x....",
      "....o...",
      "........",
      "........",
      "........",
      "o.......",
    ]);
    const pick = chooseMove(board, "mote", () => 0.99, { mayWin: false }, 200);
    assert.equal(pick?.move.captures.length, 1);
  });

  it("sees a two-for-one", () => {
    // Moving (2,1)→(3,2) gives a man away but sets up a double jump back.
    const board = draw([
      "........",
      "........",
      ".x......",
      "........",
      ".o.o....",
      "x.......",
      "........",
      "........",
    ]);
    const pick = chooseMove(board, "mote", Math.random, { mayWin: true }, 400);
    assert.ok(pick);
    assert.ok(pick.score > -100);
  });

  it("likes being ahead", () => {
    const board = draw([".x.x....", "........", "........", "........", "........", "........", "........", "o......."]);
    assert.ok(evaluate(board, "mote") > 50);
    assert.ok(evaluate(board, "you") < -50);
  });

  it("plays a long game against itself without breaking the rules", () => {
    let g = newGame();
    for (let i = 0; i < 120; i++) {
      if (outcome(g)) break;
      const pick = chooseMove(g.board, g.turn, Math.random, { mayWin: false, ply: g.ply, quiet: g.quiet }, 20);
      assert.ok(pick);
      assert.ok(legalMoves(g.board, g.turn).some((m) => m.from === pick.move.from));
      g = play(g, pick.move).game;
    }
  });
});
