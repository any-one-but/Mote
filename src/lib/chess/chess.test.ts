import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseMove } from "./ai.ts";
import {
  after,
  ending,
  fromFen,
  inCheck,
  legalMoves,
  moveFrom,
  moveTo,
  perft,
  positionKey,
  squareName,
  START,
  toFen,
} from "./rules.ts";

const name = (m: number) => squareName(moveFrom(m)) + squareName(moveTo(m));

describe("chess rules", () => {
  // Counts of every position reachable in a few moves, from positions chess
  // programmers use to catch rule mistakes (castling, en passant, promotion,
  // pins, discovered checks).
  const cases: Array<[string, number[]]> = [
    [START, [20, 400, 8902]],
    ["r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039]],
    ["8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812]],
    ["r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
    ["rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486]],
  ];
  for (const [fen, want] of cases) {
    it(`counts moves right from ${fen.split(" ")[0].slice(0, 20)}…`, () => {
      const pos = fromFen(fen);
      assert.deepEqual(
        want.map((_, i) => perft(pos, i + 1)),
        want,
      );
      assert.equal(toFen(pos), fen);
    });
  }

  it("knows checkmate, stalemate and a dead position", () => {
    const fools = fromFen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
    assert.ok(inCheck(fools));
    assert.deepEqual(ending(fools, []), { winner: -1, reason: "checkmate" });
    const stale = fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    assert.deepEqual(ending(stale, []), { winner: null, reason: "stalemate" });
    const bare = fromFen("8/8/4k3/8/8/2B5/4K3/8 w - - 0 1");
    assert.deepEqual(ending(bare, []), { winner: null, reason: "material" });
  });

  it("calls a draw on the third repetition", () => {
    let pos = fromFen(START);
    const history = [positionKey(pos)];
    const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    for (let i = 0; i < 8; i++) {
      const m = legalMoves(pos).find((x) => name(x) === shuffle[i % 4])!;
      pos = after(pos, m);
      history.push(positionKey(pos));
    }
    assert.equal(ending(pos, history)?.reason, "repetition");
  });
});

describe("Mote's chess moves", () => {
  it("keeps it close: no mate in one this early, in a game Mote isn't to win", () => {
    const pos = fromFen("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2");
    const pick = chooseMove(pos, () => 0.99, [], { mayWin: false }, 400);
    assert.ok(pick);
    assert.notEqual(name(pick.move), "d8h4");
  });

  it("takes a queen left hanging when behind", () => {
    const pos = fromFen("rnb1kb1r/pppp1ppp/8/4pn2/3Q4/8/PPP1PPPP/RNB1KBNR b KQkq - 0 1");
    assert.equal(squareName(moveTo(chooseMove(pos, Math.random, [], { mayWin: false }, 600)!.move)), "d4");
  });
});
