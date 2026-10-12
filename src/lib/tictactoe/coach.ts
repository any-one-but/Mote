// Learning tic-tac-toe with Mote: a tip for your turn, a look at the move you
// just made, and Mote explaining their own. Everything comes from playing the
// game out perfectly (see scoreCells), so a "mistake" is a move that turns a
// win into a draw or a draw into a loss.

import { isFork, LINES, openCells, outcome, scoreCells, winningCells, type Grid } from "./game.ts";

const CELL_NAMES = ["top-left corner", "top edge", "top-right corner", "left edge", "center", "right edge", "bottom-left corner", "bottom edge", "bottom-right corner"];

export const cellName = (i: number) => CELL_NAMES[i];

const LINE_NAMES = ["top row", "middle row", "bottom row", "left column", "middle column", "right column", "diagonal", "diagonal"];

/** The name of the line through all of these cells. */
function lineName(cells: number[]): string {
  const i = LINES.findIndex((l) => cells.every((c) => l.includes(c)));
  return i >= 0 ? LINE_NAMES[i] : "line";
}

/** The line where `who` has two and the third (`cell`) is open. */
function lineThrough(g: Grid, who: "you" | "mote", cell: number): string {
  const line = LINES.find((l) => l.includes(cell) && l.filter((c) => c !== cell).every((c) => g[c] === who));
  return line ? lineName(line) : "line";
}

/** Win, draw or loss, for comparing moves. */
const verdict = (score: number) => Math.sign(score);

/** Cells where placing `who` would give them two ways to win. */
function forkCells(g: Grid, who: "you" | "mote"): number[] {
  return openCells(g).filter((i) => {
    const next = g.slice();
    next[i] = who;
    return isFork(next, who);
  });
}

export type Advice = { text: string; cells: number[] };

/** What to think about on your turn. */
export function tip(g: Grid): Advice {
  const open = openCells(g);
  const wins = winningCells(g, "you");
  if (wins.length) return { text: `You can win right now: take the ${cellName(wins[0])}.`, cells: wins };
  const blocks = winningCells(g, "mote");
  if (blocks.length) {
    return {
      text: `I’m one away on the ${lineThrough(g, "mote", blocks[0])}. Block me at the ${cellName(blocks[0])}.`,
      cells: blocks,
    };
  }
  const myForks = forkCells(g, "you");
  if (myForks.length) {
    return {
      text: "There’s a square that gives you two ways to win at once. I can only block one of them. Can you find it?",
      cells: myForks,
    };
  }
  const best = bestCells(g);
  const theirForks = forkCells(g, "mote");
  if (theirForks.length) {
    return {
      text: `Careful: if I get the ${cellName(theirForks[0])}, I’d have two ways to win. Take it first, or make a threat so I have to block instead.`,
      cells: best,
    };
  }
  if (open.length === 9) {
    return {
      text: "The center is part of four lines, each corner three, each edge two. The center or a corner is a strong start.",
      cells: best,
    };
  }
  if (!g[4]) return { text: "The center is still open, and it’s part of four lines.", cells: best };
  return { text: "No threats right now. Pick a square that lines up with the ones you have.", cells: best };
}

/** The cells that keep your best possible result. */
export function bestCells(g: Grid): number[] {
  const scored = scoreCells(g, "you");
  const top = Math.max(...scored.map((s) => verdict(s.score)));
  return scored.filter((s) => verdict(s.score) === top).map((s) => s.cell);
}

export type Review = { mistake: boolean; text: string | null; better: number[] };

/** How the move you just made (`cell`, on the board as it was) compares. */
export function review(before: Grid, cell: number): Review {
  const scored = scoreCells(before, "you");
  const mine = verdict(scored.find((s) => s.cell === cell)!.score);
  const top = Math.max(...scored.map((s) => verdict(s.score)));
  const better = scored.filter((s) => verdict(s.score) === top).map((s) => s.cell);
  const after = before.slice();
  after[cell] = "you";

  if (mine >= top) {
    // Only worth a word when it took some finding.
    if (outcome(after)) return { mistake: false, text: null, better };
    if (winningCells(before, "mote").includes(cell)) return { mistake: false, text: "Good block.", better };
    if (isFork(after, "you")) return { mistake: false, text: "Two ways to win at once. Nicely done.", better };
    return { mistake: false, text: null, better };
  }

  const wins = winningCells(before, "you");
  if (wins.length) {
    return { mistake: true, text: `You could have won at the ${cellName(wins[0])}.`, better: wins };
  }
  const blocks = winningCells(before, "mote");
  if (blocks.length) {
    return {
      mistake: true,
      text: `I can win at the ${cellName(blocks[0])} now. You needed to block there.`,
      better: blocks,
    };
  }
  const myFork = forkCells(after, "mote");
  if (myFork.length) {
    return {
      mistake: true,
      text: `Now I can take the ${cellName(myFork[0])} and have two ways to win, and you can only block one.`,
      better,
    };
  }
  if (top > 0) {
    return { mistake: true, text: "You had a sure win there. The marked square sets up two threats at once.", better };
  }
  return { mistake: true, text: "That gives me the upper hand. The marked squares were safer.", better };
}

/** Why Mote just played `cell` (on the board as it was). */
export function explain(before: Grid, cell: number, slip: boolean): string {
  const after = before.slice();
  after[cell] = "mote";
  if (outcome(after)?.winner === "mote") return "Three in a row: that’s the game.";
  if (slip && winningCells(after, "you").length) return "Hmm, I think that was a mistake of mine. Look closely.";
  if (isFork(after, "mote")) return "I made two threats at once. You can only block one of them.";
  if (winningCells(before, "you").includes(cell)) return `I blocked your ${lineThrough(before, "you", cell)}.`;
  const threats = winningCells(after, "mote");
  if (threats.length) {
    return `I’m lining up the ${lineThrough(after, "mote", threats[0])}. I need the ${cellName(threats[0])} next.`;
  }
  if (cell === 4) return "I took the center: it’s part of four lines.";
  if (openCells(before).length >= 8 && [0, 2, 6, 8].includes(cell)) return "Corners are strong: each is part of three lines.";
  return "Nothing to win or block, so I’m keeping it even.";
}
