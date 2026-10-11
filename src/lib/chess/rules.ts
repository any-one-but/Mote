// Chess, with every rule: castling, en passant, promotion, check, checkmate,
// stalemate, the fifty-move rule, threefold repetition, and not enough
// pieces left to mate.
//
// The board is the "0x88" kind: 128 slots, of which the 64 with no 0x88 bits
// set are real squares. Square = row × 16 + column, with row 0 at the top
// (rank 8, Mote's side) and row 7 at the bottom (rank 1, yours). You play
// white and move first, up the board; Mote plays black.
//
// Pieces are numbers: 1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king;
// positive is yours (white), negative is Mote's (black), 0 is empty.

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

/** 1 is white (you), −1 is black (Mote). */
export type Color = 1 | -1;

export type Position = {
  board: number[];
  turn: Color;
  /** Castling still allowed: 1 white short, 2 white long, 4 black short, 8 black long. */
  castle: number;
  /** The square a pawn could capture onto en passant, or −1. */
  ep: number;
  /** Moves (by either side) since the last capture or pawn move. */
  half: number;
  /** Starts at 1, goes up after each of Mote's moves. */
  full: number;
  /** Where each king is: [white, black]. */
  kings: [number, number];
};

/**
 * A move packed into one number: from (7 bits), to (7 bits), the piece a
 * pawn becomes (3 bits), and a flag (2 bits): 1 a pawn's double step,
 * 2 en passant, 3 castling.
 */
export type Move = number;

export const moveFrom = (m: Move) => m & 0x7f;
export const moveTo = (m: Move) => (m >> 7) & 0x7f;
export const movePromo = (m: Move) => (m >> 14) & 7;
export const moveFlag = (m: Move) => (m >> 17) & 3;
const pack = (from: number, to: number, promo = 0, flag = 0): Move =>
  from | (to << 7) | (promo << 14) | (flag << 17);

export const DOUBLE = 1;
export const EN_PASSANT = 2;
export const CASTLE = 3;

export const rowOf = (sq: number) => sq >> 4;
export const colOf = (sq: number) => sq & 7;
export const squareAt = (row: number, col: number) => row * 16 + col;
export const onBoard = (sq: number) => (sq & 0x88) === 0;

const KNIGHT_STEPS = [-33, -31, -18, -14, 14, 18, 31, 33];
const KING_STEPS = [-17, -16, -15, -1, 1, 15, 16, 17];
const DIAGONALS = [-17, -15, 15, 17];
const LINES = [-16, -1, 1, 16];

const E1 = 0x74;
const E8 = 0x04;

/** Castling rights left after something moves from or to a square. */
const KEEP = new Array<number>(128).fill(15);
KEEP[E1] = 15 & ~3;
KEEP[0x77] = 15 & ~1;
KEEP[0x70] = 15 & ~2;
KEEP[E8] = 15 & ~12;
KEEP[0x07] = 15 & ~4;
KEEP[0x00] = 15 & ~8;

export const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const LETTERS = " pnbrqk";

export function fromFen(fen: string): Position {
  const [placement, turn, castling, ep, half, full] = fen.trim().split(/\s+/);
  const board = new Array<number>(128).fill(0);
  const kings: [number, number] = [-1, -1];
  placement.split("/").forEach((rank, row) => {
    let col = 0;
    for (const ch of rank) {
      if (/\d/.test(ch)) {
        col += Number(ch);
        continue;
      }
      const type = LETTERS.indexOf(ch.toLowerCase());
      const white = ch !== ch.toLowerCase();
      const sq = squareAt(row, col);
      board[sq] = white ? type : -type;
      if (type === KING) kings[white ? 0 : 1] = sq;
      col++;
    }
  });
  let castle = 0;
  if (castling.includes("K")) castle |= 1;
  if (castling.includes("Q")) castle |= 2;
  if (castling.includes("k")) castle |= 4;
  if (castling.includes("q")) castle |= 8;
  const epSq = ep && ep !== "-" ? squareAt(8 - Number(ep[1]), ep.charCodeAt(0) - 97) : -1;
  return {
    board,
    turn: turn === "b" ? -1 : 1,
    castle,
    ep: epSq,
    half: Number(half) || 0,
    full: Number(full) || 1,
    kings,
  };
}

export function toFen(pos: Position): string {
  const rows: string[] = [];
  for (let row = 0; row < 8; row++) {
    let line = "";
    let gap = 0;
    for (let col = 0; col < 8; col++) {
      const p = pos.board[squareAt(row, col)];
      if (!p) {
        gap++;
        continue;
      }
      if (gap) line += gap;
      gap = 0;
      const ch = LETTERS[Math.abs(p)];
      line += p > 0 ? ch.toUpperCase() : ch;
    }
    if (gap) line += gap;
    rows.push(line);
  }
  const c = pos.castle;
  const castling = (c & 1 ? "K" : "") + (c & 2 ? "Q" : "") + (c & 4 ? "k" : "") + (c & 8 ? "q" : "") || "-";
  return `${rows.join("/")} ${pos.turn === 1 ? "w" : "b"} ${castling} ${squareName(pos.ep)} ${pos.half} ${pos.full}`;
}

export const squareName = (sq: number) =>
  sq < 0 ? "-" : `${String.fromCharCode(97 + colOf(sq))}${8 - rowOf(sq)}`;

export const copyPosition = (pos: Position): Position => ({
  ...pos,
  board: pos.board.slice(),
  kings: [pos.kings[0], pos.kings[1]],
});

/** Is `sq` attacked by any piece of color `by`? */
export function attacked(board: number[], sq: number, by: Color): boolean {
  // Pawns attack diagonally forward: white pawns from below, black from above.
  const pawnFrom = by === 1 ? [sq + 15, sq + 17] : [sq - 15, sq - 17];
  for (const s of pawnFrom) if (onBoard(s) && board[s] === by * PAWN) return true;
  for (const d of KNIGHT_STEPS) {
    const s = sq + d;
    if (onBoard(s) && board[s] === by * KNIGHT) return true;
  }
  for (const d of KING_STEPS) {
    const s = sq + d;
    if (onBoard(s) && board[s] === by * KING) return true;
  }
  for (const d of DIAGONALS) {
    for (let s = sq + d; onBoard(s); s += d) {
      const p = board[s];
      if (!p) continue;
      if (p === by * BISHOP || p === by * QUEEN) return true;
      break;
    }
  }
  for (const d of LINES) {
    for (let s = sq + d; onBoard(s); s += d) {
      const p = board[s];
      if (!p) continue;
      if (p === by * ROOK || p === by * QUEEN) return true;
      break;
    }
  }
  return false;
}

export const inCheck = (pos: Position, color: Color = pos.turn) =>
  attacked(pos.board, pos.kings[color === 1 ? 0 : 1], (-color) as Color);

/** Moves that follow how pieces move, before checking they don't leave the king in check. */
export function pseudoMoves(pos: Position, capturesOnly = false): Move[] {
  const out: Move[] = [];
  const { board, turn } = pos;
  const forward = turn === 1 ? -16 : 16;
  const startRow = turn === 1 ? 6 : 1;
  const lastRow = turn === 1 ? 0 : 7;
  const promote = (from: number, to: number) => {
    for (const p of [QUEEN, KNIGHT, ROOK, BISHOP]) out.push(pack(from, to, p));
  };
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = board[sq] * turn;
    if (p <= 0) continue;
    if (p === PAWN) {
      const one = sq + forward;
      if (!capturesOnly && onBoard(one) && !board[one]) {
        if (rowOf(one) === lastRow) promote(sq, one);
        else {
          out.push(pack(sq, one));
          const two = one + forward;
          if (rowOf(sq) === startRow && !board[two]) out.push(pack(sq, two, 0, DOUBLE));
        }
      } else if (capturesOnly && onBoard(one) && !board[one] && rowOf(one) === lastRow) {
        // Promoting counts as forcing enough to look at with the captures.
        out.push(pack(sq, one, QUEEN));
      }
      for (const side of [-1, 1]) {
        const to = one + side;
        if (!onBoard(to)) continue;
        if (board[to] * turn < 0) {
          if (rowOf(to) === lastRow) promote(sq, to);
          else out.push(pack(sq, to));
        } else if (to === pos.ep) out.push(pack(sq, to, 0, EN_PASSANT));
      }
      continue;
    }
    if (p === KNIGHT || p === KING) {
      for (const d of p === KNIGHT ? KNIGHT_STEPS : KING_STEPS) {
        const to = sq + d;
        if (!onBoard(to)) continue;
        const there = board[to] * turn;
        if (there > 0 || (capturesOnly && !there)) continue;
        out.push(pack(sq, to));
      }
      if (p === KING && !capturesOnly) castles(pos, sq, out);
      continue;
    }
    const dirs = p === BISHOP ? DIAGONALS : p === ROOK ? LINES : [...DIAGONALS, ...LINES];
    for (const d of dirs) {
      for (let to = sq + d; onBoard(to); to += d) {
        const there = board[to] * turn;
        if (there > 0) break;
        if (there < 0) {
          out.push(pack(sq, to));
          break;
        }
        if (!capturesOnly) out.push(pack(sq, to));
      }
    }
  }
  return out;
}

function castles(pos: Position, king: number, out: Move[]) {
  const { board, turn, castle } = pos;
  const home = turn === 1 ? E1 : E8;
  if (king !== home) return;
  const enemy = (-turn) as Color;
  const short = turn === 1 ? 1 : 4;
  const long = turn === 1 ? 2 : 8;
  if (castle & (short | long) && attacked(board, home, enemy)) return;
  if (
    castle & short &&
    !board[home + 1] &&
    !board[home + 2] &&
    board[home + 3] === turn * ROOK &&
    !attacked(board, home + 1, enemy) &&
    !attacked(board, home + 2, enemy)
  ) {
    out.push(pack(home, home + 2, 0, CASTLE));
  }
  if (
    castle & long &&
    !board[home - 1] &&
    !board[home - 2] &&
    !board[home - 3] &&
    board[home - 4] === turn * ROOK &&
    !attacked(board, home - 1, enemy) &&
    !attacked(board, home - 2, enemy)
  ) {
    out.push(pack(home, home - 2, 0, CASTLE));
  }
}

export type Undo = { captured: number; castle: number; ep: number; half: number };

/** Plays a move on the position in place. Returns what's needed to take it back. */
export function makeMove(pos: Position, m: Move): Undo {
  const { board } = pos;
  const from = moveFrom(m);
  const to = moveTo(m);
  const flag = moveFlag(m);
  const piece = board[from];
  const undo: Undo = { captured: board[to], castle: pos.castle, ep: pos.ep, half: pos.half };
  board[to] = movePromo(m) ? movePromo(m) * pos.turn : piece;
  board[from] = 0;
  if (flag === EN_PASSANT) {
    const behind = to - (pos.turn === 1 ? -16 : 16);
    undo.captured = board[behind];
    board[behind] = 0;
  } else if (flag === CASTLE) {
    const short = to > from;
    const rookFrom = short ? from + 3 : from - 4;
    const rookTo = short ? from + 1 : from - 1;
    board[rookTo] = board[rookFrom];
    board[rookFrom] = 0;
  }
  if (Math.abs(piece) === KING) pos.kings[pos.turn === 1 ? 0 : 1] = to;
  pos.castle &= KEEP[from] & KEEP[to];
  pos.ep = flag === DOUBLE ? (from + to) >> 1 : -1;
  pos.half = Math.abs(piece) === PAWN || undo.captured ? 0 : pos.half + 1;
  if (pos.turn === -1) pos.full++;
  pos.turn = (-pos.turn) as Color;
  return undo;
}

export function unmakeMove(pos: Position, m: Move, undo: Undo) {
  const { board } = pos;
  pos.turn = (-pos.turn) as Color;
  if (pos.turn === -1) pos.full--;
  const from = moveFrom(m);
  const to = moveTo(m);
  const flag = moveFlag(m);
  const piece = movePromo(m) ? PAWN * pos.turn : board[to];
  board[from] = piece;
  if (flag === EN_PASSANT) {
    board[to] = 0;
    board[to - (pos.turn === 1 ? -16 : 16)] = undo.captured;
  } else {
    board[to] = undo.captured;
  }
  if (flag === CASTLE) {
    const short = to > from;
    const rookFrom = short ? from + 3 : from - 4;
    const rookTo = short ? from + 1 : from - 1;
    board[rookFrom] = board[rookTo];
    board[rookTo] = 0;
  }
  if (Math.abs(piece) === KING) pos.kings[pos.turn === 1 ? 0 : 1] = from;
  pos.castle = undo.castle;
  pos.ep = undo.ep;
  pos.half = undo.half;
}

/** Every legal move for the side to move. */
export function legalMoves(pos: Position, capturesOnly = false): Move[] {
  const out: Move[] = [];
  const mover = pos.turn;
  for (const m of pseudoMoves(pos, capturesOnly)) {
    const undo = makeMove(pos, m);
    if (!attacked(pos.board, pos.kings[mover === 1 ? 0 : 1], pos.turn)) out.push(m);
    unmakeMove(pos, m, undo);
  }
  return out;
}

/** The position after a move, leaving the original alone. */
export function after(pos: Position, m: Move): Position {
  const next = copyPosition(pos);
  makeMove(next, m);
  return next;
}

/** What's on the board, for spotting a repeated position (clocks left out). */
export const positionKey = (pos: Position) => toFen(pos).split(" ").slice(0, 4).join(" ");

export type Ending =
  | { winner: Color; reason: "checkmate" }
  | { winner: null; reason: "stalemate" | "fifty" | "repetition" | "material" };

/** Not enough left on the board for anyone to checkmate. */
export function deadPosition(board: number[]): boolean {
  const minors: Array<{ type: number; dark: boolean }> = [];
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) continue;
    const t = Math.abs(board[sq]);
    if (!t || t === KING) continue;
    if (t !== KNIGHT && t !== BISHOP) return false;
    minors.push({ type: t, dark: (rowOf(sq) + colOf(sq)) % 2 === 1 });
  }
  if (minors.length <= 1) return true;
  // Bishops only, all on the same color of square.
  return minors.every((m) => m.type === BISHOP && m.dark === minors[0].dark);
}

/** Whether the game is over. `history` is every position so far, as keys. */
export function ending(pos: Position, history: string[]): Ending | null {
  if (!legalMoves(pos).length) {
    return inCheck(pos) ? { winner: (-pos.turn) as Color, reason: "checkmate" } : { winner: null, reason: "stalemate" };
  }
  if (deadPosition(pos.board)) return { winner: null, reason: "material" };
  if (pos.half >= 100) return { winner: null, reason: "fifty" };
  const key = positionKey(pos);
  if (history.filter((k) => k === key).length >= 3) return { winner: null, reason: "repetition" };
  return null;
}

/** How many positions are reachable in `depth` moves (for checking the rules). */
export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of legalMoves(pos)) {
    const undo = makeMove(pos, m);
    n += depth === 1 ? 1 : perft(pos, depth - 1);
    unmakeMove(pos, m, undo);
  }
  return n;
}
