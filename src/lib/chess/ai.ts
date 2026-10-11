// How Mote picks a chess move: a look-ahead search (alpha-beta, deepening a
// move at a time until time's up), which keeps following captures past the
// horizon so it doesn't stop counting halfway through a trade. Positions are
// scored by material plus where each piece stands. The level sets how far
// ahead Mote looks and how often they go with something other than their
// best move.

import type { Level } from "../checkers/ai.ts";
import {
  KING,
  PAWN,
  QUEEN,
  ROOK,
  inCheck,
  legalMoves,
  makeMove,
  moveFrom,
  movePromo,
  moveTo,
  unmakeMove,
  type Move,
  type Position,
  copyPosition,
  positionKey,
} from "./rules.ts";

export type { Level };

export type Choice = {
  move: Move;
  /** How good it looks for Mote after this move (100 ≈ a pawn up). */
  score: number;
  depth: number;
  /** Mote went with something other than their best move on purpose. */
  slip: boolean;
  /** How much worse that was than the best move (0 if it was the best). */
  loss: number;
};

export const VALUE = [0, 100, 320, 330, 500, 900, 0];

const MATE = 100_000;

// Where each piece likes to stand, from white's side, top row = rank 8.
// (The well-known "simplified evaluation" tables.)
const PST: number[][] = [
  [],
  // pawn
  [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0,
    0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  // knight
  [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15,
    20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  // bishop
  [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10,
    5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10,
    -10, -10, -10, -10, -10, -20,
  ],
  // rook
  [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0,
    0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
  ],
  // queen
  [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0,
    -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10,
    -10, -20,
  ],
  // king, while there's plenty on the board: stay tucked away
  [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40,
    -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20,
    -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
];

// The king in the endgame: come out and help.
const KING_LATE = [
  -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30,
  -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0,
  0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50,
];

/** How good the position is for the side to move. */
export function evaluate(pos: Position): number {
  const { board } = pos;
  let score = 0;
  let mat = 0;
  let phase = 0;
  let kingW = 0;
  let kingB = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = board[sq];
    if (!p) continue;
    const t = Math.abs(p);
    const i = p > 0 ? (sq >> 4) * 8 + (sq & 7) : (7 - (sq >> 4)) * 8 + (sq & 7);
    if (t === KING) {
      if (p > 0) kingW = i;
      else kingB = i;
      continue;
    }
    if (t !== PAWN) phase += t === QUEEN ? 4 : t === ROOK ? 2 : 1;
    const v = VALUE[t] + PST[t][i];
    score += p > 0 ? v : -v;
    mat += p > 0 ? VALUE[t] : -VALUE[t];
  }
  // Blend the two king tables by how much is left on the board.
  const mid = Math.min(phase, 24) / 24;
  const king = (i: number) => PST[KING][i] * mid + KING_LATE[i] * (1 - mid);
  score += king(kingW) - king(kingB);
  // Well ahead with little left: herd the other king to the edge and walk
  // yours over to it, which is how a won endgame actually gets finished.
  if (phase <= 6 && Math.abs(mat) >= 300) {
    const whiteAhead = mat > 0;
    const loser = pos.kings[whiteAhead ? 1 : 0];
    const winner = pos.kings[whiteAhead ? 0 : 1];
    const edge = (sq: number) => Math.max(3 - (sq >> 4), (sq >> 4) - 4) + Math.max(3 - (sq & 7), (sq & 7) - 4);
    const apart = Math.abs((loser >> 4) - (winner >> 4)) + Math.abs((loser & 7) - (winner & 7));
    const herd = edge(loser) * 12 + (14 - apart) * 5;
    score += whiteAhead ? herd : -herd;
  }
  return score * pos.turn;
}

type Search = { deadline: number; nodes: number; stopped: boolean; killers: Move[][] };

const victimValue = (pos: Position, m: Move) => VALUE[Math.abs(pos.board[moveTo(m)])];

/** Captures of big pieces by small ones first, then promotions, then the rest. */
function order(pos: Position, moves: Move[], ply: number, s: Search, first?: Move): Move[] {
  const killers = s.killers[ply] ?? [];
  const key = (m: Move) => {
    if (m === first) return 1e9;
    const victim = victimValue(pos, m);
    if (victim) return 1e6 + victim * 10 - VALUE[Math.abs(pos.board[moveFrom(m)])] / 10;
    if (movePromo(m) === QUEEN) return 9e5;
    if (killers.includes(m)) return 8e5;
    return 0;
  };
  return moves
    .map((m) => ({ m, k: key(m) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.m);
}

function quiesce(pos: Position, alpha: number, beta: number, s: Search, depth = 0): number {
  if ((++s.nodes & 2047) === 0 && performance.now() > s.deadline) s.stopped = true;
  if (s.stopped) return 0;
  const stand = evaluate(pos);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (depth > 8) return stand;
  for (const m of order(pos, legalMoves(pos, true), 0, s)) {
    const undo = makeMove(pos, m);
    const v = -quiesce(pos, -beta, -alpha, s, depth + 1);
    unmakeMove(pos, m, undo);
    if (s.stopped) return 0;
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function negamax(pos: Position, depth: number, alpha: number, beta: number, ply: number, s: Search, quiet: boolean): number {
  if ((++s.nodes & 2047) === 0 && performance.now() > s.deadline) s.stopped = true;
  if (s.stopped) return 0;
  const checked = inCheck(pos);
  // In check, look one move further so a checking sequence isn't cut short.
  if (checked) depth++;
  if (depth <= 0) return quiet ? evaluate(pos) : quiesce(pos, alpha, beta, s);
  const moves = legalMoves(pos);
  if (!moves.length) return checked ? -MATE + ply : 0;
  if (pos.half >= 100) return 0;
  let best = -Infinity;
  for (const m of order(pos, moves, ply, s)) {
    const undo = makeMove(pos, m);
    const v = -negamax(pos, depth - 1, -beta, -alpha, ply + 1, s, quiet);
    unmakeMove(pos, m, undo);
    if (s.stopped) return 0;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) {
      if (!undo.captured) {
        const k = (s.killers[ply] ??= []);
        if (!k.includes(m)) {
          k.unshift(m);
          k.length = Math.min(k.length, 2);
        }
      }
      break;
    }
  }
  return best;
}

const SETTINGS: Record<Level, { depth: number; ms: number; slip: number; spread: number; quiet: boolean }> = {
  // One move ahead and no follow-through on trades: hangs pieces now and then,
  // and often picks something that only looks about right.
  easy: { depth: 1, ms: 300, slip: 0.35, spread: 200, quiet: true },
  // Three moves ahead, follows trades through, sometimes a near-best move.
  normal: { depth: 3, ms: 900, slip: 0.15, spread: 30, quiet: false },
  // As far ahead as it can in about a second and a half.
  hard: { depth: 30, ms: 1500, slip: 0, spread: 0, quiet: false },
};

/** Moves this close to the best count as just as good. */
const TIE = 5;

/**
 * Mote's move. `history` is every position so far (see `positionKey`), so Mote
 * knows which moves would repeat one: a third time is a draw.
 */
export function chooseMove(
  start: Position,
  level: Level,
  rand: () => number = Math.random,
  history: string[] = [],
): Choice | null {
  const pos = copyPosition(start);
  const moves = legalMoves(pos);
  if (!moves.length) return null;
  const cfg = SETTINGS[level];
  // Moves within this much of the best get exact scores; the rest are only
  // shown to be worse. It has to cover the ties picked between below.
  const spread = Math.max(cfg.spread, TIE);
  const s: Search = { deadline: performance.now() + cfg.ms, nodes: 0, stopped: false, killers: [] };
  const repeats = new Map<Move, number>();
  if (history.length) {
    for (const m of moves) {
      const undo = makeMove(pos, m);
      const key = positionKey(pos);
      unmakeMove(pos, m, undo);
      const n = history.filter((k) => k === key).length;
      if (n) repeats.set(m, n);
    }
  }
  let scored: Array<{ move: Move; score: number }> | null = null;
  let reached = 0;
  if (moves.length > 1) {
    for (let depth = 1; depth <= cfg.depth; depth++) {
      const round: Array<{ move: Move; score: number }> = [];
      let best = -Infinity;
      for (const m of order(pos, moves, 0, s, scored?.[0]?.move)) {
        const undo = makeMove(pos, m);
        const floor = best - spread - 1;
        const seen = repeats.get(m) ?? 0;
        // A third time is a draw. A second is a step toward one: fine when
        // behind, not when ahead.
        let v = seen >= 2 ? 0 : -negamax(pos, depth - 1, -Infinity, -floor, 1, s, cfg.quiet);
        if (seen === 1 && v > 50) v -= 40;
        unmakeMove(pos, m, undo);
        if (s.stopped) break;
        round.push({ move: m, score: v });
        if (v > best) best = v;
      }
      if (s.stopped) break;
      scored = round.sort((a, b) => b.score - a.score);
      reached = depth;
      if (Math.abs(scored[0].score) > MATE / 2) break;
    }
  }
  if (!scored) return { move: moves[0], score: 0, depth: 0, slip: false, loss: 0 };
  const best = scored[0];
  // Equal-looking best moves are picked between at random, so games vary.
  const ties = scored.filter((r) => r.score >= best.score - TIE);
  let pick = ties[Math.floor(rand() * ties.length)] ?? best;
  if (cfg.slip > 0 && rand() < cfg.slip) {
    const near = scored.filter((r) => best.score - r.score <= cfg.spread && r.score > -MATE / 2);
    pick = near[Math.floor(rand() * near.length)] ?? best;
  }
  return {
    move: pick.move,
    score: pick.score,
    depth: reached,
    slip: pick.score < best.score - TIE,
    loss: Math.max(0, best.score - pick.score),
  };
}

/** Plain material count, for knowing who's ahead. Positive = white is up. */
export function material(board: number[]): number {
  let n = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) continue;
    const p = board[sq];
    if (p) n += Math.sign(p) * VALUE[Math.abs(p)];
  }
  return n;
}

export const PIECE_NAME = ["", "pawn", "knight", "bishop", "rook", "queen", "king"];
