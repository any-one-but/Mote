// How Mote picks a checkers move: a look-ahead search (alpha-beta) over the
// moves, scoring each position by pieces, kings, how far men have come, and
// a few habits good players have. The level sets how far ahead Mote looks
// and how often they go with something other than the best move; "close" (the
// usual) keeps the game close instead (see close-game.ts).

import {
  applyToBoard,
  colOf,
  isKing,
  legalMoves,
  other,
  rowOf,
  sameMove,
  sideOf,
  QUIET_LIMIT,
  type Board,
  type Move,
  type Side,
} from "./rules.ts";
import { pickClose, type CloseInfo } from "../close-game.ts";

export type Level = "close" | "easy" | "normal" | "hard";

export const LEVELS: Level[] = ["close", "easy", "normal", "hard"];

export type Choice = {
  move: Move;
  /** How good the position is for Mote after this move (about 100 = a man up). */
  score: number;
  /** How far ahead Mote looked. */
  depth: number;
  /** Mote went with something other than their best move on purpose. */
  slip: boolean;
  /** How much worse that was than the best move (0 if it was the best). */
  loss: number;
};

const WIN = 100_000;

const moveKey = (m: Move) => `${m.from}:${m.path.join(",")}`;
const MAN = 100;
const KING = 170;

const CENTER = new Set([13, 14, 17, 18]);

/** How good the board is for `side`. */
export function evaluate(board: Board, side: Side): number {
  let mine = 0;
  let theirs = 0;
  let pieces = 0;
  for (let sq = 0; sq < 32; sq++) {
    const cell = board[sq];
    if (!cell) continue;
    pieces++;
    const owner = sideOf(cell)!;
    const row = rowOf(sq);
    let v: number;
    if (isKing(cell)) {
      v = KING;
      // Kings like the middle of the board, where they reach more.
      const col = colOf(sq);
      v -= (Math.abs(3.5 - row) + Math.abs(3.5 - col)) * 2;
    } else {
      v = MAN;
      // Men are worth more the closer they are to being crowned.
      const ahead = owner === "you" ? 7 - row : row;
      v += ahead * ahead * 0.9;
      // Holding the back row keeps the other side from crowning.
      if (ahead === 0) v += 8;
    }
    if (CENTER.has(sq)) v += 6;
    if (owner === side) mine += v;
    else theirs += v;
  }
  let score = mine - theirs;
  // Ahead, trade down: fewer pieces left makes the lead count for more.
  if (pieces < 24 && score !== 0) score += Math.sign(score) * (24 - pieces) * 3;
  return score;
}

type Search = {
  deadline: number;
  nodes: number;
  stopped: boolean;
};

function order(moves: Move[], board: Board, side: Side): Move[] {
  // Longer jumps and crowning moves first; they cut the search down fastest.
  const crownRow = side === "you" ? 0 : 7;
  const key = (m: Move) => {
    const to = m.path[m.path.length - 1];
    const crowns = !isKing(board[m.from]) && rowOf(to) === crownRow;
    return m.captures.length * 10 + (crowns ? 5 : 0);
  };
  return moves.slice().sort((a, b) => key(b) - key(a));
}

function negamax(
  board: Board,
  side: Side,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  s: Search,
): number {
  if ((++s.nodes & 1023) === 0 && performance.now() > s.deadline) s.stopped = true;
  if (s.stopped) return 0;
  const moves = legalMoves(board, side);
  if (!moves.length) return -WIN + ply;
  // Keep going while jumps are forced, so a trade isn't judged halfway.
  const forced = moves[0].captures.length > 0;
  if (depth <= 0 && (!forced || depth < -8)) return evaluate(board, side);
  let best = -Infinity;
  for (const m of order(moves, board, side)) {
    const next = applyToBoard(board, m).board;
    const v = -negamax(next, other(side), depth - 1, -beta, -alpha, ply + 1, s);
    if (s.stopped) return 0;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Every move with its score, searched `depth` moves ahead. Scores are exact
 * for moves within `spread` of the best; worse ones only promise they're worse.
 */
function scoreMoves(board: Board, side: Side, depth: number, spread: number, s: Search, first?: Move) {
  const moves = order(legalMoves(board, side), board, side);
  if (first) {
    const i = moves.findIndex((m) => sameMove(m, first));
    if (i > 0) moves.unshift(...moves.splice(i, 1));
  }
  const scored: Array<{ move: Move; score: number }> = [];
  let best = -Infinity;
  for (const m of moves) {
    const next = applyToBoard(board, m).board;
    const floor = best - spread - 1;
    const v = -negamax(next, other(side), depth - 1, -Infinity, -floor, 1, s);
    if (s.stopped) return null;
    scored.push({ move: m, score: v });
    if (v > best) best = v;
  }
  return scored.sort((a, b) => b.score - a.score);
}

const SETTINGS: Record<Level, { depth: number; ms: number; slip: number; spread: number }> = {
  // Looks well ahead, scoring every move exactly enough to pick a mistake of
  // just the right size.
  close: { depth: 8, ms: 900, slip: 0, spread: 1200 },
  // Looks two moves ahead and often goes with something that just looks fine.
  easy: { depth: 2, ms: 200, slip: 0.35, spread: 140 },
  // A fair game: looks a few moves ahead, now and then picks a near-best move.
  normal: { depth: 5, ms: 500, slip: 0.12, spread: 30 },
  // Looks as far ahead as it can in about a second, and always plays the best.
  hard: { depth: 20, ms: 1100, slip: 0, spread: 0 },
};

export function chooseMove(
  board: Board,
  side: Side,
  level: Level,
  rand: () => number = Math.random,
  close: CloseInfo = { mayWin: false },
): Choice | null {
  const moves = legalMoves(board, side);
  if (!moves.length) return null;
  const cfg = SETTINGS[level];
  if (moves.length === 1) {
    return { move: moves[0], score: evaluate(applyToBoard(board, moves[0]).board, side), depth: 0, slip: false, loss: 0 };
  }
  const s: Search = { deadline: performance.now() + cfg.ms, nodes: 0, stopped: false };
  let scored: Array<{ move: Move; score: number }> | null = null;
  let glance: Map<string, number> | null = null;
  let reached = 0;
  for (let depth = 1; depth <= cfg.depth; depth++) {
    const result = scoreMoves(board, side, depth, cfg.spread, s, scored?.[0]?.move);
    if (!result) break;
    scored = result;
    reached = depth;
    // How each move looks two moves ahead: what seems fine at a glance.
    if (depth === 2) glance = new Map(result.map((r) => [moveKey(r.move), r.score]));
    // A forced win or loss is found; looking further won't change it.
    if (Math.abs(result[0].score) > WIN / 2) break;
  }
  if (!scored) return { move: moves[0], score: 0, depth: 0, slip: false, loss: 0 };
  const best = scored[0];
  if (level === "close") {
    const pieces = board.filter(Boolean).length;
    const looks = glance;
    let spread = cfg.spread;
    // A forced win shows every other move only as "worse". Mote may not want
    // the win, so score the rest properly, looking a little less far.
    if (best.score > WIN / 2) {
      const again: Search = { deadline: performance.now() + 500, nodes: 0, stopped: false };
      const all = scoreMoves(board, side, Math.min(reached, 6), Infinity, again, best.move);
      if (all) {
        scored = all;
        spread = Infinity;
      }
    }
    const { pick, slip } = pickClose(
      scored,
      {
        unit: MAN,
        // By what's been taken or moves played, plus how long since anything happened.
        progress:
          Math.min(1, Math.max((24 - pieces) / 16, (close.ply ?? 0) / 100)) + (3 * (close.quiet ?? 0)) / QUIET_LIMIT,
        won: WIN / 2,
        spread,
        glance: looks ? (m) => looks.get(moveKey(m)) : undefined,
        mayWin: close.mayWin,
      },
      rand,
    );
    return { move: pick.move, score: pick.score, depth: reached, slip, loss: Math.max(0, scored[0].score - pick.score) };
  }
  // Slipping: pick among the moves that look roughly as good.
  if (cfg.slip > 0 && rand() < cfg.slip) {
    const near = scored.filter((r) => best.score - r.score <= cfg.spread && r.score > -WIN / 2);
    const pick = near[Math.floor(rand() * near.length)] ?? best;
    return { move: pick.move, score: pick.score, depth: reached, slip: pick !== best, loss: best.score - pick.score };
  }
  return { move: best.move, score: best.score, depth: reached, slip: false, loss: 0 };
}

/**
 * Every move for `side`, scored for that side (about 100 = a man), looking as
 * far ahead as it can in `ms`. Used for teaching: moves within 300 of the
 * best get exact scores, so a mistake can be measured.
 */
export function rankMoves(board: Board, side: Side, ms = 300): Array<{ move: Move; score: number }> {
  const moves = legalMoves(board, side);
  if (moves.length <= 1) return moves.map((move) => ({ move, score: 0 }));
  const s: Search = { deadline: performance.now() + ms, nodes: 0, stopped: false };
  let scored: Array<{ move: Move; score: number }> | null = null;
  for (let depth = 1; depth <= 12; depth++) {
    const result = scoreMoves(board, side, depth, 300, s, scored?.[0]?.move);
    if (!result) break;
    scored = result;
    if (Math.abs(result[0].score) > WIN / 2) break;
  }
  return scored ?? moves.map((move) => ({ move, score: 0 }));
}
