// Tic-tac-toe: the rules, and how Mote picks a move.
//
// Cells are 0–8, left to right, top to bottom. You play X, Mote plays O.
// Mote keeps it close (see close-game.ts): they always block, but now and
// then play a square that lets you set up two ways to win at once, so you can
// win if you spot it; they only sometimes notice a win you've left them.

import type { CloseInfo } from "../close-game.ts";

export type Mark = "you" | "mote" | null;
export type Grid = Mark[];

export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const emptyGrid = (): Grid => Array(9).fill(null);

export const other = (who: "you" | "mote") => (who === "you" ? "mote" : "you");

export const openCells = (g: Grid) => g.flatMap((m, i) => (m ? [] : [i]));

/** The winner and their line, a draw, or null if the game goes on. */
export function outcome(g: Grid): { winner: "you" | "mote"; line: number[] } | { winner: "draw" } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (g[a] && g[a] === g[b] && g[a] === g[c]) return { winner: g[a] as "you" | "mote", line };
  }
  return openCells(g).length ? null : { winner: "draw" };
}

/** Cells where `who` would complete a line right now. */
export function winningCells(g: Grid, who: "you" | "mote"): number[] {
  return openCells(g).filter((i) => {
    const next = g.slice();
    next[i] = who;
    return outcome(next)?.winner === who;
  });
}

/** Perfect play: +10 for a win (sooner is better), −10 for a loss, 0 a draw. */
function minimax(g: Grid, turn: "you" | "mote", me: "you" | "mote", depth: number): number {
  const end = outcome(g);
  if (end) return end.winner === "draw" ? 0 : end.winner === me ? 10 - depth : depth - 10;
  const scores = openCells(g).map((i) => {
    const next = g.slice();
    next[i] = turn;
    return minimax(next, other(turn), me, depth + 1);
  });
  return turn === me ? Math.max(...scores) : Math.min(...scores);
}

/** Every open cell with how good it is for `me` under perfect play. */
export function scoreCells(g: Grid, me: "you" | "mote"): Array<{ cell: number; score: number }> {
  return openCells(g).map((cell) => {
    const next = g.slice();
    next[cell] = me;
    return { cell, score: minimax(next, other(me), me, 1) };
  });
}

export type Choice = { cell: number; slip: boolean };

export function chooseCell(
  g: Grid,
  rand: () => number = Math.random,
  close: CloseInfo = { mayWin: false },
): Choice | null {
  const open = openCells(g);
  if (!open.length) return null;
  const wins = winningCells(g, "mote");
  const blocks = winningCells(g, "you");
  const scored = scoreCells(g, "mote");
  const best = Math.max(...scored.map((s) => s.score));
  const bests = scored.filter((s) => s.score === best).map((s) => s.cell);
  const slip = (cell: number) => ({ cell, slip: !bests.includes(cell) });

  // A win left open: taken in the games Mote may win, otherwise only
  // sometimes (it does look like they just didn't see it).
  if (wins.length && (close.mayWin || rand() < 0.2)) return { cell: wins[0], slip: false };
  // And outside those games, no setting up two ways to win at once.
  const forks = (cell: number) => {
    const next = g.slice();
    next[cell] = "mote";
    return isFork(next, "mote");
  };
  const all = scored.filter((s) => !wins.includes(s.cell));
  const calm = close.mayWin ? all : all.filter((s) => !forks(s.cell));
  const others = calm.length ? calm : all;
  if (!others.length) return { cell: wins[0], slip: false };
  const pickOf = (cells: number[]) => cells[Math.floor(rand() * cells.length)];
  // A line about to be finished always gets blocked.
  const block = blocks.find((c) => !wins.includes(c));
  if (block !== undefined) return slip(block);
  // A square that hands you a way to win, if you find it. Never as the
  // opening move, which would look silly.
  const giving = others.filter((s) => s.score < 0).map((s) => s.cell);
  if (giving.length && open.length < 9 && !close.mayWin && rand() < 0.65) return slip(pickOf(giving));
  const top = Math.max(...others.map((s) => s.score));
  return slip(pickOf(others.filter((s) => s.score === top).map((s) => s.cell)));
}

/** Two ways to win at once: the other side can only block one. */
export const isFork = (g: Grid, who: "you" | "mote") => winningCells(g, who).length >= 2;

/** A saved game read back from storage, or null if it doesn't look right. */
export function reviveGrid(raw: unknown): Grid | null {
  if (!Array.isArray(raw) || raw.length !== 9) return null;
  if (!raw.every((m) => m === null || m === "you" || m === "mote")) return null;
  return raw as Grid;
}
