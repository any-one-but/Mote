import { useCallback, useEffect, useRef, useState } from "react";
import type { ChessEvent } from "@/components/companion/chess-lines";
import { ChessPieceArt } from "@/components/companion/chess-pieces";
import type { FaceEngine } from "@/components/companion/engine";
import { material, PIECE_NAME } from "@/lib/chess/ai";
import {
  BISHOP,
  CASTLE,
  EN_PASSANT,
  KNIGHT,
  QUEEN,
  ROOK,
  START,
  after,
  colOf,
  ending,
  fromFen,
  inCheck,
  legalMoves,
  moveFlag,
  moveFrom,
  movePromo,
  moveTo,
  positionKey,
  rowOf,
  squareAt,
  toFen,
  type Ending,
  type Move,
  type Position,
} from "@/lib/chess/rules";
import { think } from "@/lib/chess/think";
import { rollMayWin } from "@/lib/close-game";
import { BoardHead, EndPanel, StartPick } from "./board-ui";
import {
  addToStats,
  load,
  readStats,
  sleep,
  store,
  type Phase,
  margins,
  noteSwing,
  type Stats,
  type Swing,
  type Winner,
} from "./board-store";

type Props = {
  engine: () => FaceEngine | null;
  onClose: () => void;
};

/** A piece on the board as drawn: `p` is positive for yours, negative for Mote's. */
type Piece = { id: number; sq: number; p: number; gone?: boolean; lifted?: boolean };
type Saved = { fen: string; history: string[]; swing?: Swing; mayWin?: boolean };

const SAVE = "mote.chess";
const STATS = "mote.chess.stats";
const SLIDE_MS = 320;

let nextId = 1;
function piecesOf(pos: Position): Piece[] {
  const out: Piece[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = squareAt(row, col);
      if (pos.board[sq]) out.push({ id: nextId++, sq, p: pos.board[sq] });
    }
  }
  return out;
}

function revive(saved: Saved | null): { pos: Position; history: string[] } | null {
  if (!saved || typeof saved.fen !== "string") return null;
  try {
    const pos = fromFen(saved.fen);
    if (pos.kings[0] < 0 || pos.kings[1] < 0) return null;
    return { pos, history: Array.isArray(saved.history) ? saved.history : [positionKey(pos)] };
  } catch {
    return null;
  }
}

/** What a move does, for Mote to react to. */
function describe(pos: Position, m: Move) {
  const to = moveTo(m);
  const flag = moveFlag(m);
  const taken = flag === EN_PASSANT ? 1 : Math.abs(pos.board[to]);
  return { taken, castled: flag === CASTLE, promoted: movePromo(m) };
}

const ENDING_WORDS: Record<Ending["reason"], string> = {
  checkmate: "Checkmate.",
  stalemate: "Stalemate.",
  fifty: "Fifty moves without a capture.",
  repetition: "The same position three times.",
  material: "Not enough left to checkmate.",
};

/** A game of chess against Mote, played in Mote's window. */
export function Chess({ engine, onClose }: Props) {
  const saved = useRef(load<Saved>(SAVE));
  const resumed = useRef(revive(saved.current));
  const [phase, setPhase] = useState<Phase>(resumed.current ? "playing" : "pick");
  const [pos, setPos] = useState<Position>(resumed.current?.pos ?? fromFen(START));
  const [history, setHistory] = useState<string[]>(resumed.current?.history ?? [positionKey(fromFen(START))]);
  const [pieces, setPieces] = useState<Piece[]>(() => piecesOf(pos));
  const [selected, setSelected] = useState<number | null>(null);
  const [promoting, setPromoting] = useState<{ from: number; to: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<number[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<{ winner: Winner; reason: Ending["reason"] | "resigned" } | null>(null);
  const [stats, setStats] = useState<Stats>(() => readStats(STATS));

  const alive = useRef(true);
  const posRef = useRef(pos);
  posRef.current = pos;
  const historyRef = useRef(history);
  historyRef.current = history;
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const standing = useRef<"even" | "ahead" | "behind">("even");
  const swing = useRef<Swing>(saved.current?.swing ?? { min: 0, max: 0 });
  const lastNag = useRef(0);
  // Whether this is one of the games Mote may win (see close-game.ts).
  const mayWin = useRef(saved.current?.mayWin === true);

  const tell = useCallback(
    (event: ChessEvent, words?: { piece?: string; yours?: string }) =>
      engine()?.chess(event, words),
    [engine],
  );

  useEffect(() => {
    const e = engine();
    if (phase !== "playing") e?.setBoardGame("idle");
    else e?.setBoardGame(pos.turn === -1 || busy ? "mote" : "you");
  }, [engine, phase, pos.turn, busy]);

  useEffect(() => {
    if (phase === "playing") store(SAVE, { fen: toFen(pos), history, swing: swing.current, mayWin: mayWin.current });
  }, [phase, pos, history]);

  /** Slides a piece (and a castling rook), and takes whatever it lands on. */
  const animate = async (m: Move, lift: boolean) => {
    const from = moveFrom(m);
    const to = moveTo(m);
    const flag = moveFlag(m);
    const id = piecesRef.current.find((p) => p.sq === from && !p.gone)?.id;
    if (lift && id !== undefined) {
      setPieces((ps) => ps.map((p) => (p.id === id ? { ...p, lifted: true } : p)));
      await sleep(380);
    }
    const takenAt = flag === EN_PASSANT ? to + (to > from ? -16 : 16) : to;
    const rook = flag === CASTLE ? (to > from ? [from + 3, from + 1] : [from - 4, from - 1]) : null;
    setPieces((ps) =>
      ps.map((p) => {
        if (p.id === id) return { ...p, sq: to };
        if (!p.gone && p.sq === takenAt && p.id !== id) return { ...p, gone: true };
        if (rook && !p.gone && p.sq === rook[0]) return { ...p, sq: rook[1] };
        return p;
      }),
    );
    await sleep(SLIDE_MS);
    const promo = movePromo(m);
    setPieces((ps) =>
      ps.map((p) => (p.id === id ? { ...p, lifted: false, p: promo ? promo * Math.sign(p.p) : p.p } : p)),
    );
    setTimeout(() => alive.current && setPieces((ps) => ps.filter((p) => !p.gone)), 400);
  };

  /** Mote's lead in pawns' worth. */
  const moteLead = (p: Position) => -material(p.board) / 100;

  /** Mote remembers how it went: who won, by how much, from how far behind. */
  const report = (winner: Winner, how: string, p: Position, moves: number, event: ChessEvent) =>
    engine()?.gameOver(
      { game: "chess", winner, how, moves, ...margins(winner, moteLead(p), swing.current) },
      event,
    );

  /** The game's over: say how, and add it to the record. */
  const finish = (next: Position, hist: string[]) => {
    swing.current = noteSwing(swing.current, moteLead(next));
    const end = ending(next, hist);
    if (!end) return false;
    const winner: Winner = end.winner === 1 ? "you" : end.winner === -1 ? "mote" : "draw";
    setResult({ winner, reason: end.reason });
    setPhase("over");
    store(SAVE, null);
    setStats(addToStats(STATS, winner));
    const event: ChessEvent = end.reason === "checkmate" ? (winner === "mote" ? "mote-win" : "you-win") : end.reason;
    report(winner, end.reason, next, hist.length - 1, event);
    return true;
  };

  const commit = (m: Move) => {
    const next = after(posRef.current, m);
    const hist = [...historyRef.current, positionKey(next)];
    setLast([moveFrom(m), moveTo(m)]);
    setPos(next);
    setHistory(hist);
    return { next, hist };
  };

  const moteMoves = async (start: Position) => {
    setBusy(true);
    const begun = performance.now();
    const choice = await think(start, historyRef.current, { mayWin: mayWin.current });
    if (!alive.current || !choice) return;
    const least = 1000 + Math.random() * 800;
    const waited = performance.now() - begun;
    if (waited < least) await sleep(least - waited);
    if (!alive.current) return;
    const what = describe(start, choice.move);
    await animate(choice.move, true);
    if (!alive.current) return;
    const { next, hist } = commit(choice.move);
    setBusy(false);
    if (finish(next, hist)) return;

    const was = standing.current;
    const lead = -material(next.board);
    if (lead >= 300) standing.current = "ahead";
    else if (lead <= -300) standing.current = "behind";
    else if (Math.abs(lead) < 100) standing.current = "even";
    const yours = PIECE_NAME[what.taken];
    if (inCheck(next)) tell("mote-check");
    else if (what.taken === QUEEN) tell("mote-take-queen");
    else if (what.promoted) tell("mote-promote");
    else if (what.castled) tell("mote-castle");
    else if (standing.current !== was && standing.current !== "even") {
      tell(standing.current === "ahead" ? "mote-ahead" : "mote-behind");
    } else if (what.taken) tell("mote-capture", { yours });
  };

  const yourMove = async (m: Move) => {
    const start = posRef.current;
    const what = describe(start, m);
    setSelected(null);
    setPromoting(null);
    setNote(null);
    setBusy(true);
    await animate(m, false);
    if (!alive.current) return;
    const { next, hist } = commit(m);
    if (finish(next, hist)) {
      setBusy(false);
      return;
    }
    if (inCheck(next)) tell("you-check");
    else if (what.taken === QUEEN) tell("you-take-queen");
    else if (what.promoted) tell("you-promote");
    else if (what.castled) tell("you-castle");
    else if (what.taken) tell("you-capture", { piece: PIECE_NAME[what.taken] });
    await sleep(250);
    if (alive.current) void moteMoves(next);
  };

  const yourTurn = phase === "playing" && pos.turn === 1 && !busy;
  const moves = yourTurn ? legalMoves(pos) : [];
  const checked = phase !== "pick" && inCheck(pos);
  const options = selected === null ? [] : moves.filter((m) => moveFrom(m) === selected);
  const targets = new Map(options.map((m) => [moveTo(m), m]));
  const movable = new Set(moves.map(moveFrom));

  const tap = (sq: number) => {
    if (!yourTurn || promoting) return;
    const m = targets.get(sq);
    if (m !== undefined) {
      // A pawn reaching the far side: you choose what it becomes.
      if (movePromo(m)) setPromoting({ from: moveFrom(m), to: sq });
      else void yourMove(m);
      return;
    }
    const mine = pos.board[sq] > 0;
    if (mine && movable.has(sq)) {
      setSelected(sq === selected ? null : sq);
      setNote(null);
    } else if (mine) {
      setSelected(null);
      setNote(checked ? "You’re in check." : "That piece can’t move right now.");
      if (checked && Date.now() - lastNag.current > 20_000) {
        lastNag.current = Date.now();
        tell("in-check");
      }
    } else setSelected(null);
  };

  const promote = (type: number) => {
    if (!promoting) return;
    const m = moves.find((x) => moveFrom(x) === promoting.from && moveTo(x) === promoting.to && movePromo(x) === type);
    if (m !== undefined) void yourMove(m);
  };

  const kicked = useRef(false);
  useEffect(() => {
    alive.current = true;
    if (resumed.current && !kicked.current) {
      kicked.current = true;
      tell("resume");
      if (posRef.current.turn === -1) void moteMoves(posRef.current);
    }
    return () => {
      alive.current = false;
      engine()?.setBoardGame(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelected(null);
      setPromoting(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const begin = () => {
    const fresh = fromFen(START);
    store(SAVE, null);
    standing.current = "even";
    setPos(fresh);
    setHistory([positionKey(fresh)]);
    setPieces(piecesOf(fresh));
    setSelected(null);
    setPromoting(null);
    setLast([]);
    setNote(null);
    setResult(null);
    setBusy(false);
    setPhase("playing");
    swing.current = { min: 0, max: 0 };
    mayWin.current = rollMayWin();
    engine()?.gameStart("chess");
  };

  const resign = () => {
    setResult({ winner: "mote", reason: "resigned" });
    setPhase("over");
    store(SAVE, null);
    setStats(addToStats(STATS, "mote"));
    report("mote", "resign", pos, history.length - 1, "resign");
  };

  const close = () => {
    if (phase === "playing" && history.length > 1 && !busy) tell("pause");
    onClose();
  };

  if (phase === "pick") {
    return <StartPick title="Chess" lede="You’re white and go first." onPlay={begin} onClose={close} />;
  }

  const kingInCheck = checked ? pos.kings[pos.turn === 1 ? 0 : 1] : -1;
  const status = note
    ? note
    : yourTurn
      ? checked
        ? "Your move. You’re in check!"
        : "Your move"
      : "Mote is thinking…";

  return (
    <div className="ck">
      <BoardHead record={stats} playing={phase === "playing"} onResign={resign} onClose={close} />

      <div className="ck-board cs-board" role="grid" aria-label="Chess board">
        {Array.from({ length: 64 }, (_, i) => {
          const row = Math.floor(i / 8);
          const col = i % 8;
          const sq = squareAt(row, col);
          const target = targets.get(sq);
          const cls = [
            "ck-sq",
            (row + col) % 2 === 1 ? "is-dark" : "",
            last.includes(sq) ? "is-last" : "",
            target !== undefined ? (pos.board[sq] || moveFlag(target) === EN_PASSANT ? "is-capture" : "is-target") : "",
            sq === kingInCheck ? "is-check" : "",
          ].join(" ");
          return <button key={i} type="button" className={cls} aria-label={squareLabel(sq)} onClick={() => tap(sq)} />;
        })}
        {pieces.map((p) => (
          <PieceView
            key={p.id}
            piece={p}
            selected={p.sq === selected && !p.gone}
            canMove={yourTurn && movable.has(p.sq) && !promoting}
            lookAt={selected}
            onTap={() => tap(p.sq)}
          />
        ))}
        {promoting ? (
          <div className="cs-promote" role="dialog" aria-label="Choose what your pawn becomes">
            {[QUEEN, ROOK, BISHOP, KNIGHT].map((t) => (
              <button key={t} type="button" aria-label={PIECE_NAME[t]} onClick={() => promote(t)}>
                <ChessPieceArt piece={t} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {phase === "over" && result ? (
        <EndPanel onAgain={() => setPhase("pick")} onDone={onClose}>
          {result.winner === "you" ? "You win!" : result.winner === "mote" ? "Mote wins." : "A draw."}
          {result.reason !== "resigned" && result.reason !== "checkmate" ? (
            <small className="cs-why">{ENDING_WORDS[result.reason]}</small>
          ) : null}
        </EndPanel>
      ) : (
        <p className={`ck-status${note || (checked && yourTurn) ? " is-note" : ""}`} aria-live="polite">
          {promoting ? "Pick what your pawn becomes." : status}
        </p>
      )}
    </div>
  );
}

const squareLabel = (sq: number) => `${"abcdefgh"[colOf(sq)]}${8 - rowOf(sq)}`;

function PieceView({
  piece,
  selected,
  canMove,
  lookAt,
  onTap,
}: {
  piece: Piece;
  selected: boolean;
  canMove: boolean;
  lookAt: number | null;
  onTap: () => void;
}) {
  const row = rowOf(piece.sq);
  const col = colOf(piece.sq);
  const mote = piece.p < 0;
  // Mote's pieces look at the piece you picked up, or else down the board at you.
  let look = { x: 0, y: 0 };
  if (mote && lookAt !== piece.sq) {
    const dx = (lookAt === null ? 3.5 : colOf(lookAt)) - col;
    const dy = (lookAt === null ? 9 : rowOf(lookAt)) - row;
    look = { x: Math.max(-4, Math.min(4, dx * 1.6)), y: Math.max(-3, Math.min(3, dy * 0.8)) };
  }
  const cls = [
    "ck-piece",
    "cs-piece",
    mote ? "is-mote" : "is-you",
    piece.gone ? "is-gone" : "",
    piece.lifted ? "is-lifted" : "",
    selected ? "is-selected" : "",
    canMove ? "can-move" : "",
  ].join(" ");
  return (
    <div
      className={cls}
      style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}
      onClick={onTap}
      aria-hidden="true"
    >
      <div className="ck-disc">
        <ChessPieceArt piece={piece.p} look={look} shut={piece.gone} blinkDelay={(piece.id * 1.37) % 6} />
      </div>
    </div>
  );
}
