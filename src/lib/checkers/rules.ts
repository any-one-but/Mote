// Checkers (English draughts) on the 32 dark squares of an 8 × 8 board.
//
// Squares are numbered 0–31, four to a row, from the top-left. Row 0 is
// Mote's back row (the top of the board); row 7 is yours (the bottom). You
// play the dark pieces and move first, up the board; Mote plays the light
// ones, down the board.
//
// The rules: men move one square diagonally forward, kings one square any
// diagonal way. Jumping is compulsory, and a jump keeps going while it can.
// A man that reaches the far row is crowned, and that ends the move. If you
// can't move, you lose. Forty moves each with no capture and no man moving is
// a draw.

/** 0 empty; 1 your man, 2 your king; −1 Mote's man, −2 Mote's king. */
export type Cell = -2 | -1 | 0 | 1 | 2;
export type Side = "you" | "mote";
export type Board = Cell[];

export type Move = {
  from: number;
  /** Every square the piece lands on, in order. The last one is where it ends. */
  path: number[];
  /** The squares of the pieces jumped, in order. */
  captures: number[];
};

export type Game = {
  board: Board;
  turn: Side;
  /** Moves in a row (both sides counted) with no capture and no man moving. */
  quiet: number;
  /** Moves played so far, both sides. */
  ply: number;
};

export type Outcome = { winner: Side | null; reason: "no-moves" | "quiet" };

/** Forty moves each with nothing happening. */
export const QUIET_LIMIT = 80;

export const rowOf = (sq: number) => Math.floor(sq / 4);
export const colOf = (sq: number) => (sq % 4) * 2 + (rowOf(sq) % 2 === 0 ? 1 : 0);

/** The square at a row and column, or −1 if it's off the board or a light square. */
export function squareAt(row: number, col: number): number {
  if (row < 0 || row > 7 || col < 0 || col > 7) return -1;
  if ((row + col) % 2 === 0) return -1;
  return row * 4 + Math.floor(col / 2);
}

const DIRS: Array<[number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** For each square and direction: the next square along, and the one after. */
const STEP: number[][] = [];
const LEAP: number[][] = [];
for (let sq = 0; sq < 32; sq++) {
  STEP[sq] = DIRS.map(([dr, dc]) => squareAt(rowOf(sq) + dr, colOf(sq) + dc));
  LEAP[sq] = DIRS.map(([dr, dc]) => squareAt(rowOf(sq) + 2 * dr, colOf(sq) + 2 * dc));
}

export const sideOf = (cell: Cell): Side | null => (cell > 0 ? "you" : cell < 0 ? "mote" : null);
export const isKing = (cell: Cell) => cell === 2 || cell === -2;
export const other = (side: Side): Side => (side === "you" ? "mote" : "you");

/** Directions a piece can move in: up for your men, down for Mote's, all four for kings. */
const dirsFor = (cell: Cell) => (isKing(cell) ? [0, 1, 2, 3] : cell > 0 ? [0, 1] : [2, 3]);

const crownRow = (side: Side) => (side === "you" ? 0 : 7);

export function newGame(): Game {
  const board: Board = Array.from({ length: 32 }, (_, sq) => (sq < 12 ? -1 : sq >= 20 ? 1 : 0));
  return { board, turn: "you", quiet: 0, ply: 0 };
}

function jumpsFrom(board: Board, from: number, cell: Cell): Move[] {
  const out: Move[] = [];
  const side = sideOf(cell)!;
  const walk = (at: number, path: number[], captures: number[]) => {
    let more = false;
    for (const d of dirsFor(cell)) {
      const over = STEP[at][d];
      const land = LEAP[at][d];
      if (over < 0 || land < 0) continue;
      const victim = board[over];
      if (sideOf(victim) !== other(side) || captures.includes(over)) continue;
      // The jumping piece has left its square, so it can land back there.
      if (board[land] !== 0 && land !== from) continue;
      more = true;
      const nextPath = [...path, land];
      const nextCaps = [...captures, over];
      // Being crowned ends the move.
      if (!isKing(cell) && rowOf(land) === crownRow(side)) out.push({ from, path: nextPath, captures: nextCaps });
      else walk(land, nextPath, nextCaps);
    }
    if (!more && captures.length) out.push({ from, path, captures });
  };
  walk(from, [], []);
  return out;
}

/** Every legal move for a side. If any jump is possible, only jumps are legal. */
export function legalMoves(board: Board, side: Side): Move[] {
  const jumps: Move[] = [];
  const steps: Move[] = [];
  for (let sq = 0; sq < 32; sq++) {
    const cell = board[sq];
    if (sideOf(cell) !== side) continue;
    jumps.push(...jumpsFrom(board, sq, cell));
    if (jumps.length) continue;
    for (const d of dirsFor(cell)) {
      const to = STEP[sq][d];
      if (to >= 0 && board[to] === 0) steps.push({ from: sq, path: [to], captures: [] });
    }
  }
  return jumps.length ? jumps : steps;
}

/** The board after a move (the move is assumed legal). */
export function applyToBoard(board: Board, move: Move): { board: Board; crowned: boolean } {
  const next = board.slice();
  const cell = next[move.from];
  const to = move.path[move.path.length - 1];
  next[move.from] = 0;
  for (const c of move.captures) next[c] = 0;
  const side = sideOf(cell)!;
  const crowned = !isKing(cell) && rowOf(to) === crownRow(side);
  next[to] = crowned ? ((cell * 2) as Cell) : cell;
  return { board: next, crowned };
}

export function play(game: Game, move: Move): { game: Game; crowned: boolean } {
  const moved = game.board[move.from];
  const { board, crowned } = applyToBoard(game.board, move);
  const eventful = move.captures.length > 0 || !isKing(moved);
  return {
    game: {
      board,
      turn: other(game.turn),
      quiet: eventful ? 0 : game.quiet + 1,
      ply: game.ply + 1,
    },
    crowned,
  };
}

/** Whether the game is over, and who won (null for a draw). */
export function outcome(game: Game): Outcome | null {
  if (!legalMoves(game.board, game.turn).length) return { winner: other(game.turn), reason: "no-moves" };
  if (game.quiet >= QUIET_LIMIT) return { winner: null, reason: "quiet" };
  return null;
}

export function count(board: Board, side: Side) {
  let men = 0;
  let kings = 0;
  for (const cell of board) {
    if (sideOf(cell) !== side) continue;
    if (isKing(cell)) kings++;
    else men++;
  }
  return { men, kings, all: men + kings };
}

export const sameMove = (a: Move, b: Move) =>
  a.from === b.from && a.path.length === b.path.length && a.path.every((sq, i) => sq === b.path[i]);

/** A saved game read back from storage, or null if it doesn't look right. */
export function reviveGame(raw: unknown): Game | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<Game>;
  if (!Array.isArray(g.board) || g.board.length !== 32) return null;
  if (!g.board.every((c) => [-2, -1, 0, 1, 2].includes(c as number))) return null;
  if (g.turn !== "you" && g.turn !== "mote") return null;
  return {
    board: g.board as Board,
    turn: g.turn,
    quiet: Number.isFinite(g.quiet) ? Number(g.quiet) : 0,
    ply: Number.isFinite(g.ply) ? Number(g.ply) : 0,
  };
}
