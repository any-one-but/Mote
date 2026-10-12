// Learning checkers with Mote: a tip for your turn, a look at the move you
// just made, and Mote explaining their own. Moves are judged by looking ahead
// (see rankMoves); a mistake is one that costs about a piece or more compared
// with the best move.

import { rankMoves } from "./ai.ts";
import { applyToBoard, count, isKing, legalMoves, rowOf, sameMove, type Board, type Move } from "./rules.ts";

/** Squares to mark on the board: a move worth making, or a piece in danger. */
export type Mark = { sq: number; kind: "go" | "danger" };

export type Advice = { text: string; marks: Mark[] };

const moveMarks = (m: Move): Mark[] => [m.from, ...m.path].map((sq) => ({ sq, kind: "go" as const }));

/** Squares of `side` that the other side could jump right now. */
function inDanger(board: Board, side: "you" | "mote"): number[] {
  const enemy = side === "you" ? "mote" : "you";
  const jumps = legalMoves(board, enemy).filter((m) => m.captures.length);
  return [...new Set(jumps.flatMap((m) => m.captures))];
}

const crowns = (board: Board, m: Move) => applyToBoard(board, m).crowned;

const backRowFull = (board: Board) => [28, 29, 30, 31].every((sq) => board[sq] > 0);

const lead = (board: Board) => {
  const worth = (side: "you" | "mote") => {
    const c = count(board, side);
    return c.men + 1.5 * c.kings;
  };
  return worth("you") - worth("mote");
};

/** What to think about on your turn. */
export function tip(board: Board, ply: number): Advice {
  const moves = legalMoves(board, "you");
  if (!moves.length) return { text: "No moves left…", marks: [] };
  const ranked = rankMoves(board, "you");
  const best = ranked[0].move;

  if (best.captures.length) {
    const most = Math.max(...moves.map((m) => m.captures.length));
    if (most > 1 && best.captures.length === most) {
      return { text: `You have to jump, and one jump here keeps going: it takes ${most} pieces.`, marks: moveMarks(best) };
    }
    if (moves.length > 1) {
      return { text: "You have to jump, but you get to choose which. The marked one leaves you safest.", marks: moveMarks(best) };
    }
    return { text: "You have to jump: it’s the rule. Take that piece.", marks: moveMarks(best) };
  }
  if (crowns(board, best)) {
    return { text: "You can get a king! Kings move backward too, which makes them strong.", marks: moveMarks(best) };
  }
  const danger = inDanger(board, "you");
  if (danger.length) {
    return {
      text: "One of your pieces can be jumped. Move it, or fill the empty square behind it so there’s nowhere for me to land.",
      marks: [...danger.map((sq) => ({ sq, kind: "danger" as const })), ...moveMarks(best)],
    };
  }
  if (ply < 4 && backRowFull(board) && rowOf(best.from) !== 7) {
    return {
      text: "Keep your back row filled for now: as long as it is, I can’t get a king.",
      marks: moveMarks(best),
    };
  }
  if (lead(board) >= 2) {
    return { text: "You’re ahead. Trading piece for piece helps you now: fewer pieces makes your lead count for more.", marks: moveMarks(best) };
  }
  const toward = best.path[best.path.length - 1];
  if ([13, 14, 17, 18].includes(toward)) {
    return { text: "Pieces in the middle of the board have the most options. The marked move heads there.", marks: moveMarks(best) };
  }
  return {
    text: "Keep your pieces close together: a piece on its own is the easiest to jump.",
    marks: moveMarks(best),
  };
}

export type Review = { mistake: boolean; text: string | null; marks: Mark[] };

/** How the move you just made (on the board as it was) compares with the best. */
export function review(before: Board, move: Move): Review {
  const ranked = rankMoves(before, "you");
  if (ranked.length <= 1) return { mistake: false, text: null, marks: [] };
  const best = ranked[0];
  const mine = ranked.find((r) => sameMove(r.move, move));
  const loss = best.score - (mine?.score ?? -Infinity);

  if (loss < 90) {
    if (sameMove(best.move, move) && move.captures.length > 1) return { mistake: false, text: "A double jump. Nice.", marks: [] };
    const danger = inDanger(before, "you");
    if (sameMove(best.move, move) && danger.length && !inDanger(applyToBoard(before, move).board, "you").length) {
      return { mistake: false, text: "Good: that got your piece out of danger.", marks: [] };
    }
    return { mistake: false, text: null, marks: [] };
  }

  const after = applyToBoard(before, move).board;
  const replies = legalMoves(after, "mote").filter((m) => m.captures.length);
  const most = Math.max(0, ...replies.map((m) => m.captures.length));
  const better = moveMarks(best.move);
  if (most >= 2) {
    const r = replies.find((m) => m.captures.length === most)!;
    return {
      mistake: true,
      text: "That lets me jump more than one of your pieces in a row. The marked move was safer.",
      marks: [...r.captures.map((sq) => ({ sq, kind: "danger" as const })), ...better],
    };
  }
  if (most === 1) {
    const victims = replies.flatMap((m) => m.captures);
    return {
      mistake: true,
      text: "That leaves a piece I can jump, with nothing to win it back. The marked move was safer.",
      marks: [...victims.map((sq) => ({ sq, kind: "danger" as const })), ...better],
    };
  }
  if (move.captures.length && best.move.captures.length > move.captures.length) {
    return { mistake: true, text: "A different jump would have taken more pieces.", marks: better };
  }
  if (crowns(before, best.move) && !crowns(before, move)) {
    return { mistake: true, text: "You could have got a king there.", marks: better };
  }
  return {
    mistake: true,
    text: "That one sets me up a few moves from now. The marked move was stronger.",
    marks: better,
  };
}

/** Why Mote just made `move` (on the board as it was). `score` is how it looks for Mote. */
export function explain(before: Board, move: Move, score: number): string {
  const { board: after, crowned } = applyToBoard(before, move);
  if (crowned) return "I made it to your side: a king! Kings can move backward too, so they’re hard to trap.";
  if (move.captures.length > 1) return "A double jump: a jump keeps going as long as there’s another piece to take.";
  const yourJumps = legalMoves(after, "you").filter((m) => m.captures.length);
  if (yourJumps.length && score > -40) {
    return "That’s a trap: you have to jump, and then I get to jump back. Jumping is always required in checkers.";
  }
  if (move.captures.length) return "I jumped the piece you left open.";
  const wasInDanger = inDanger(before, "mote");
  if (wasInDanger.includes(move.from) && !inDanger(after, "mote").length) {
    return "My piece was in danger, so I moved it out of the way.";
  }
  if (lead(after) <= -2) return "I’m ahead, so I’m happy to trade pieces now.";
  if (!isKing(before[move.from]) && rowOf(move.path[move.path.length - 1]) >= 5) {
    return "Pushing toward your side. If I get across, I get a king.";
  }
  return "Keeping my pieces close together, so none of them is easy to jump.";
}
