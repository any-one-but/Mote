import { useCallback, useEffect, useRef, useState } from "react";
import type { CheckersEvent } from "@/components/companion/checkers-lines";
import type { FaceEngine, Look } from "@/components/companion/engine";
import { MoteMark, useLook } from "./MoteMark";
import {
  colOf,
  count,
  isKing,
  legalMoves,
  newGame,
  outcome,
  play,
  reviveGame,
  rowOf,
  sideOf,
  type Cell,
  type Game,
  type Move,
} from "@/lib/checkers/rules";
import { think } from "@/lib/checkers/think";
import { rollMayWin } from "@/lib/close-game";
import { BoardHead, EndPanel } from "./board-ui";
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

type Piece = { id: number; sq: number; cell: Cell; gone?: boolean; lifted?: boolean };

const SAVE = "mote.checkers";
const STATS = "mote.checkers.stats";
const STEP_MS = 280;

let nextId = 1;
const piecesOf = (board: Cell[]): Piece[] =>
  board.flatMap((cell, sq) => (cell ? [{ id: nextId++, sq, cell }] : []));

/**
 * The drawn pieces, checked against the board itself once a move is over:
 * any that don't match are dropped and whatever's missing is drawn, so what
 * you see can never drift from the real game (taken pieces still fading out
 * are left to fade).
 */
const settle = (ps: Piece[], board: Cell[]): Piece[] => {
  const kept: Piece[] = [];
  const covered = new Set<number>();
  for (const p of ps) {
    if (p.gone) kept.push(p);
    else if (board[p.sq] === p.cell && !covered.has(p.sq)) {
      kept.push({ ...p, lifted: false });
      covered.add(p.sq);
    }
  }
  board.forEach((cell, sq) => {
    if (cell && !covered.has(sq)) kept.push({ id: nextId++, sq, cell });
  });
  return kept;
};

/** A game of checkers against Mote, played in Mote's window. */
export function Checkers({ engine, onClose }: Props) {
  const saved = useRef(
    load<{ game: unknown; swing?: Swing; mayWin?: boolean }>(SAVE),
  );
  const resumed = useRef(reviveGame(saved.current?.game));
  const [phase, setPhase] = useState<Phase>("playing");
  const [game, setGame] = useState<Game>(resumed.current ?? newGame());
  const [pieces, setPieces] = useState<Piece[]>(() => piecesOf(game.board));
  const [selected, setSelected] = useState<number | null>(null);
  // Squares landed on so far, part-way through a jump of yours.
  const [steps, setSteps] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<number[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<Winner | null>(null);
  const [stats, setStats] = useState<Stats>(() => readStats(STATS));
  // Whether this is one of the games Mote may win (see close-game.ts).
  const mayWin = useRef(saved.current?.mayWin === true);
  const alive = useRef(true);
  const gameRef = useRef(game);
  gameRef.current = game;
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const standing = useRef<"even" | "ahead" | "behind">("even");
  const swing = useRef<Swing>(saved.current?.swing ?? { min: 0, max: 0 });
  const lastForced = useRef(0);

  const tell = useCallback(
    (event: CheckersEvent) => engine()?.checkers(event),
    [engine],
  );

  // Whose turn it is shows on Mote's face; putting the board away ends that.
  useEffect(() => {
    const e = engine();
    if (phase !== "playing") e?.setBoardGame("idle");
    else e?.setBoardGame(game.turn === "mote" || busy ? "mote" : "you");
  }, [engine, phase, game.turn, busy]);

  const kicked = useRef(false);
  useEffect(() => {
    alive.current = true;
    // A game picked back up: say so, and if it's Mote's turn, carry on. (Once,
    // even if this runs twice while developing.)
    if (resumed.current && !kicked.current) {
      kicked.current = true;
      tell("resume");
      if (gameRef.current.turn === "mote") void moteMoves(gameRef.current);
    } else if (!kicked.current) {
      // A new game starts straight away.
      kicked.current = true;
      begin();
    }
    return () => {
      alive.current = false;
      engine()?.setBoardGame(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "playing") store(SAVE, { game, swing: swing.current, mayWin: mayWin.current });
  }, [phase, game]);

  /** Slides a piece along a move, taking pieces as it goes. */
  const animate = async (move: Move, crowned: boolean, lift: boolean) => {
    const id = piecesRef.current.find((p) => p.sq === move.from && !p.gone)?.id;
    if (lift && id !== undefined) {
      setPieces((ps) => ps.map((p) => (p.id === id ? { ...p, lifted: true } : p)));
      await sleep(380);
    }
    for (let i = 0; i < move.path.length; i++) {
      const to = move.path[i];
      const taken = move.captures[i];
      setPieces((ps) =>
        ps.map((p) =>
          p.id === id ? { ...p, sq: to } : taken !== undefined && p.sq === taken && !p.gone ? { ...p, gone: true } : p,
        ),
      );
      await sleep(STEP_MS);
    }
    setPieces((ps) =>
      ps.map((p) => (p.id === id ? { ...p, lifted: false, cell: crowned ? ((p.cell * 2) as Cell) : p.cell } : p)),
    );
    // The taken pieces have faded by now.
    setTimeout(() => alive.current && setPieces((ps) => ps.filter((p) => !p.gone)), 400);
  };

  /** Mote's lead in pieces (a king counts as one and a half). */
  const moteLead = (board: Cell[]) => {
    const worth = (side: "you" | "mote") => {
      const c = count(board, side);
      return c.men + 1.5 * c.kings;
    };
    return worth("mote") - worth("you");
  };

  /** Mote remembers how it went: who won, by how much, from how far behind. */
  const report = (winner: Winner, how: string, board: Cell[], moves: number, event: CheckersEvent) =>
    engine()?.gameOver(
      { game: "checkers", winner, how, moves, ...margins(winner, moteLead(board), swing.current) },
      event,
    );

  const finish = (g: Game) => {
    swing.current = noteSwing(swing.current, moteLead(g.board));
    const end = outcome(g);
    if (!end) return false;
    const winner = end.winner ?? "draw";
    setResult(winner);
    setPhase("over");
    store(SAVE, null);
    setStats(addToStats(STATS, winner));
    report(winner, end.reason, g.board, g.ply, winner === "mote" ? "mote-win" : winner === "you" ? "you-win" : "draw");
    return true;
  };

  /** Mote works out a move and plays it. */
  const moteMoves = async (g: Game) => {
    setBusy(true);
    const begun = performance.now();
    const choice = await think(g.board, "mote", { mayWin: mayWin.current, ply: g.ply, quiet: g.quiet });
    if (!alive.current || !choice) return;
    // However quick the answer, Mote takes a moment over it.
    const least = 900 + Math.random() * 700;
    const waited = performance.now() - begun;
    if (waited < least) await sleep(least - waited);
    if (!alive.current) return;
    const { game: after, crowned } = play(g, choice.move);
    await animate(choice.move, crowned, true);
    if (!alive.current) return;
    setPieces((ps) => settle(ps, after.board));
    setLast([choice.move.from, ...choice.move.path]);
    setGame(after);
    setBusy(false);
    if (finish(after)) return;

    // One thing to react to: the biggest.
    const was = standing.current;
    if (choice.score > 250) standing.current = "ahead";
    else if (choice.score < -250) standing.current = "behind";
    else if (Math.abs(choice.score) < 80) standing.current = "even";
    const n = choice.move.captures.length;
    if (crowned) tell("mote-crown");
    else if (n > 1) tell("mote-multi");
    else if (standing.current !== was && standing.current !== "even") {
      tell(standing.current === "ahead" ? "mote-ahead" : "mote-behind");
    } else if (n === 1) tell("mote-capture");
  };

  const yourMove = async (move: Move, already: number) => {
    const g = gameRef.current;
    const { game: after, crowned } = play(g, move);
    setSelected(null);
    setSteps([]);
    setBusy(true);
    // Hops you've already made by clicking are shown; play out the rest.
    const rest: Move = {
      from: already ? move.path[already - 1] : move.from,
      path: move.path.slice(already),
      captures: move.captures.slice(already),
    };
    if (rest.path.length) await animate(rest, crowned, false);
    else {
      const to = move.path[move.path.length - 1];
      setPieces((ps) =>
        ps.map((p) => (crowned && p.sq === to && !p.gone ? { ...p, cell: (p.cell * 2) as Cell } : p)),
      );
      setTimeout(() => alive.current && setPieces((ps) => ps.filter((p) => !p.gone)), 400);
    }
    if (!alive.current) return;
    setPieces((ps) => settle(ps, after.board));
    setLast([move.from, ...move.path]);
    setGame(after);
    setNote(null);
    if (finish(after)) {
      setBusy(false);
      return;
    }
    const n = move.captures.length;
    if (crowned) tell("you-crown");
    else if (n > 1) tell("you-multi");
    else if (n === 1) tell("you-capture");
    await sleep(250);
    if (alive.current) void moteMoves(after);
  };

  const yourTurn = phase === "playing" && game.turn === "you" && !busy;
  const moves = yourTurn ? legalMoves(game.board, "you") : [];
  const mustJump = moves.length > 0 && moves[0].captures.length > 0;
  const fits = (m: Move) => m.from === selected && steps.every((sq, i) => m.path[i] === sq);
  const options = selected === null ? [] : moves.filter(fits);
  const targets = new Set(options.map((m) => m.path[steps.length]).filter((sq) => sq !== undefined));
  const movable = new Set(moves.map((m) => m.from));

  const tap = (sq: number) => {
    if (!yourTurn) return;
    if (targets.has(sq)) {
      const nextSteps = [...steps, sq];
      const left = options.filter((m) => m.path[steps.length] === sq);
      // Show this hop, and the piece it takes.
      const hop = steps.length;
      const from = hop ? steps[hop - 1] : selected!;
      const taken = left[0].captures[hop];
      // Noted straight away (not just on the next draw): if this hop finishes
      // the jump for you, the rest of it starts from here.
      const next = piecesRef.current.map((p) =>
        p.sq === from && !p.gone ? { ...p, sq } : taken !== undefined && p.sq === taken ? { ...p, gone: true } : p,
      );
      piecesRef.current = next;
      setPieces(next);
      const done = left.find((m) => m.path.length === nextSteps.length);
      // Only one way to finish the jump: finish it for you.
      if (done || left.length === 1) void yourMove(done ?? left[0], nextSteps.length);
      else setSteps(nextSteps);
      return;
    }
    if (steps.length) return; // Part-way through a jump: it has to be finished.
    const mine = sideOf(game.board[sq]) === "you";
    if (mine && movable.has(sq)) {
      setSelected(sq === selected ? null : sq);
      setNote(null);
    } else if (mine && mustJump) {
      setSelected(null);
      setNote("You have to jump.");
      if (Date.now() - lastForced.current > 20_000) {
        lastForced.current = Date.now();
        tell("forced");
      }
    } else setSelected(null);
  };

  const begin = () => {
    const g = newGame();
    store(SAVE, null);
    standing.current = "even";
    setGame(g);
    setPieces(piecesOf(g.board));
    setSelected(null);
    setSteps([]);
    setLast([]);
    setNote(null);
    setResult(null);
    setBusy(false);
    setPhase("playing");
    swing.current = { min: 0, max: 0 };
    mayWin.current = rollMayWin();
    engine()?.gameStart("checkers");
  };

  const resign = () => {
    setResult("mote");
    setPhase("over");
    store(SAVE, null);
    setStats(addToStats(STATS, "mote"));
    report("mote", "resign", game.board, game.ply, "resign");
  };

  const close = () => {
    if (phase === "playing" && game.ply > 0 && !busy) tell("pause");
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || steps.length) return;
      setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  // Mote's pieces look at the piece you've picked up, or else at you.
  const lookAt = selected ?? null;
  // ...and are little Motes in whatever look Mote has.
  const look = useLook();

  return (
    <div className="ck">
      <BoardHead
        record={stats}
        playing={phase === "playing"}
        onResign={resign}
        onClose={close}
      />

      <div className="ck-board" role="grid" aria-label="Checkers board">
        {Array.from({ length: 64 }, (_, i) => {
          const row = Math.floor(i / 8);
          const col = i % 8;
          const dark = (row + col) % 2 === 1;
          const sq = dark ? row * 4 + Math.floor(col / 2) : -1;
          const cls = [
            "ck-sq",
            dark ? "is-dark" : "",
            dark && last.includes(sq) ? "is-last" : "",
            dark && targets.has(sq) ? "is-target" : "",
          ].join(" ");
          return dark ? (
            <button
              key={i}
              type="button"
              className={cls}
              aria-label={`Square ${sq + 1}`}
              onClick={() => tap(sq)}
            />
          ) : (
            <div key={i} className={cls} />
          );
        })}
        {pieces.map((p) => (
          <PieceView
            key={p.id}
            piece={p}
            selected={p.sq === selected && !p.gone}
            hint={yourTurn && selected === null && mustJump && movable.has(p.sq)}
            canMove={yourTurn && movable.has(p.sq)}
            lookAt={lookAt}
            look={look}
            onTap={() => tap(p.sq)}
          />
        ))}
      </div>

      {phase === "over" ? (
        <EndPanel onAgain={begin} onDone={onClose}>
          {result === "you" ? "You win!" : result === "mote" ? "Mote wins." : "A draw."}
        </EndPanel>
      ) : (
        <p className={`ck-status${note ? " is-note" : ""}`} aria-live="polite">
          {note ?? (yourTurn ? (mustJump ? "Your move. You have a jump." : "Your move") : "Mote is thinking…")}
        </p>
      )}
    </div>
  );
}

function PieceView({
  piece,
  selected,
  hint,
  canMove,
  lookAt,
  look,
  onTap,
}: {
  piece: Piece;
  selected: boolean;
  hint: boolean;
  canMove: boolean;
  lookAt: number | null;
  look: Look;
  onTap: () => void;
}) {
  const row = rowOf(piece.sq);
  const col = colOf(piece.sq);
  const mote = piece.cell < 0;
  const king = isKing(piece.cell);
  // Where this little Mote's eyes point: at the piece you picked up, or else
  // down the board at you.
  let lx = 0;
  let ly = 0;
  if (mote && lookAt !== piece.sq) {
    const dx = (lookAt === null ? 3.5 : colOf(lookAt)) - col;
    const dy = (lookAt === null ? 9 : rowOf(lookAt)) - row;
    // Sideways glances are exaggerated, or everything just looks down.
    lx = Math.max(-10, Math.min(10, dx * 4));
    ly = Math.max(-8, Math.min(8, dy * 2));
  }
  const cls = [
    "ck-piece",
    mote ? "is-mote" : "is-you",
    piece.gone ? "is-gone" : "",
    piece.lifted ? "is-lifted" : "",
    selected ? "is-selected" : "",
    hint ? "is-hint" : "",
    canMove ? "can-move" : "",
  ].join(" ");
  return (
    <div
      className={cls}
      style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}
      onClick={onTap}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="ck-disc">
        <ellipse cx="50" cy="58" rx="38" ry="36" className="ck-shadow" />
        {mote ? (
          // A little Mote, in Mote's whole look (see MoteMark).
          <MoteMark
            look={look}
            cx={50}
            cy={50}
            r={38}
            drop={5}
            gaze={{ x: lx, y: ly }}
            shut={piece.gone}
            blinkDelay={(piece.id * 1.37) % 6}
          />
        ) : (
          <>
            {/* The piece's thickness, a deeper tone just below it (no outlines). */}
            <circle cx="50" cy="55" r="38" className="ck-rim" />
            <circle cx="50" cy="50" r="38" className="ck-body" />
            <circle cx="50" cy="50" r="29" className="ck-ring" />
          </>
        )}
        {king ? (
          <path
            className="ck-crown"
            d={mote ? "M36 30 L36 18 L43 25 L50 15 L57 25 L64 18 L64 30 Z" : "M34 58 L34 42 L42 50 L50 38 L58 50 L66 42 L66 58 Z"}
          />
        ) : null}
      </svg>
    </div>
  );
}
