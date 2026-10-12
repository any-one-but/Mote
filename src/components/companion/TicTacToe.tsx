import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceEngine } from "@/components/companion/engine";
import type { TicTacToeEvent } from "@/components/companion/tictactoe-lines";
import type { Level } from "@/lib/checkers/ai";
import {
  chooseCell,
  emptyGrid,
  isFork,
  openCells,
  outcome,
  reviveGrid,
  winningCells,
  type Grid,
} from "@/lib/tictactoe/game";
import { explain, review, tip } from "@/lib/tictactoe/coach";
import { BoardHead, Coach, EndPanel, LevelPick, type CoachLine } from "./board-ui";
import { addToStats, load, readStats, savedLevel, sleep, store, type Phase, type Stats, type Winner } from "./board-store";

type Props = {
  engine: () => FaceEngine | null;
  onClose: () => void;
};

type Saved = { grid: Grid; turn: "you" | "mote"; level: Level; assist?: boolean };

const SAVE = "mote.tictactoe";
const STATS = "mote.tictactoe.stats";
/** Who goes first next time: you and Mote take turns. */
const FIRST = "mote.tictactoe.first";

/** A game of tic-tac-toe against Mote, played in Mote's window. */
export function TicTacToe({ engine, onClose }: Props) {
  const saved = useRef(load<Saved>(SAVE));
  const resumed = useRef(reviveGrid(saved.current?.grid));
  const [level, setLevel] = useState<Level>(savedLevel(saved.current?.level));
  const [phase, setPhase] = useState<Phase>(resumed.current ? "playing" : "pick");
  const [grid, setGrid] = useState<Grid>(resumed.current ?? emptyGrid());
  const [turn, setTurn] = useState<"you" | "mote">(saved.current?.turn === "mote" ? "mote" : "you");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ you: number | null; mote: number | null }>({ you: null, mote: null });
  const [result, setResult] = useState<{ winner: Winner; line: number[] | null } | null>(null);
  const [stats, setStats] = useState<Stats>(() => readStats(STATS));
  // Learning with Mote: their notes, the squares they've marked (shown on
  // "Show me"), a move of yours waiting on take-back-or-keep, and how many
  // mistakes so far.
  const [assist, setAssist] = useState(saved.current?.assist === true);
  const [notes, setNotes] = useState<CoachLine[]>([]);
  const [marks, setMarks] = useState<number[]>([]);
  const [showing, setShowing] = useState(false);
  const [pending, setPending] = useState<{ before: Grid; after: Grid } | null>(null);
  const mistakes = useRef(0);

  const alive = useRef(true);
  const levelRef = useRef(level);
  levelRef.current = level;
  const assistRef = useRef(assist);
  assistRef.current = assist;

  /** On your turn in a learning game: a tip, after whatever Mote just said. */
  const coachYourTurn = (g: Grid, before: CoachLine[] = []) => {
    const t = tip(g);
    setNotes([...before, { kind: "tip", text: t.text }]);
    setMarks(t.cells);
    setShowing(false);
  };

  const tell = useCallback(
    (event: TicTacToeEvent) => engine()?.tictactoe(event, levelRef.current),
    [engine],
  );

  useEffect(() => {
    const e = engine();
    if (phase !== "playing") e?.setBoardGame("idle");
    else e?.setBoardGame(turn === "mote" || busy ? "mote" : "you");
  }, [engine, phase, turn, busy]);

  useEffect(() => {
    if (phase === "playing") store(SAVE, { grid, turn, level, assist });
  }, [phase, grid, turn, level, assist]);

  /** The game's over: say so, add it to the record, and let Mote remember it. */
  const finish = (g: Grid, how = "") => {
    const end = outcome(g);
    if (!end && !how) return false;
    const winner: Winner = how === "resign" ? "mote" : end!.winner;
    setResult({ winner, line: end && end.winner !== "draw" ? end.line : null });
    setPhase("over");
    store(SAVE, null);
    setPending(null);
    setShowing(false);
    if (assistRef.current) {
      // A learning game: no record, nothing for Mote to remember. Just a word
      // about how it went.
      const n = mistakes.current;
      setNotes([
        {
          kind: n ? "tip" : "good",
          text: n
            ? `${n === 1 ? "One mistake" : `${n} mistakes`} this game. Every one of them is something to watch for next time.`
            : "No mistakes this game. You’re getting the hang of it.",
        },
      ]);
      tell(how === "resign" ? "resign" : winner === "mote" ? "mote-win" : winner === "you" ? "you-win" : "draw");
      return true;
    }
    setStats(addToStats(STATS, levelRef.current, winner));
    const left = openCells(g).length;
    engine()?.gameOver(
      {
        game: "tictactoe",
        level: levelRef.current,
        winner,
        how: how || (winner === "draw" ? "full" : "three"),
        lead: winner === "draw" || how ? 0 : left,
        worst: 0,
        moves: 9 - left,
      },
      how || (winner === "mote" ? "mote-win" : winner === "you" ? "you-win" : "draw"),
    );
    return true;
  };

  const moteMoves = async (g: Grid) => {
    setBusy(true);
    setTurn("mote");
    await sleep(600 + Math.random() * 700);
    if (!alive.current) return;
    const choice = chooseCell(g, levelRef.current);
    if (!choice) return;
    const next = g.slice();
    next[choice.cell] = "mote";
    setGrid(next);
    setLast((l) => ({ ...l, mote: choice.cell }));
    setTurn("you");
    setBusy(false);
    if (assistRef.current) {
      const said: CoachLine = { kind: "mote", text: explain(g, choice.cell, choice.slip) };
      if (finish(next)) {
        setNotes((n) => [said, ...n]);
        return;
      }
      coachYourTurn(next, [said]);
      return;
    }
    if (finish(next)) return;
    if (isFork(next, "mote")) tell("mote-fork");
    else if (winningCells(g, "you").includes(choice.cell)) tell("mote-block");
    else if (choice.slip && levelRef.current === "easy" && winningCells(next, "you").length && Math.random() < 0.6) {
      tell("slip");
    } else if (winningCells(next, "mote").length) tell("mote-threat");
  };

  const play = (cell: number) => {
    if (phase !== "playing" || turn !== "you" || busy || pending || grid[cell]) return;
    const next = grid.slice();
    next[cell] = "you";
    setGrid(next);
    setLast((l) => ({ ...l, you: cell }));
    if (assistRef.current) {
      const r = review(grid, cell);
      if (finish(next)) return;
      if (r.mistake) {
        // Mote waits: take it back, or keep going.
        mistakes.current += 1;
        setPending({ before: grid, after: next });
        setNotes([{ kind: "mistake", text: r.text ?? "That one costs you." }]);
        setMarks(r.better);
        setShowing(true);
        tell("assist-mistake");
        return;
      }
      setNotes(r.text ? [{ kind: "good", text: r.text }] : []);
      setShowing(false);
      if (r.text) tell("assist-good");
      void moteMoves(next);
      return;
    }
    if (finish(next)) return;
    if (isFork(next, "you")) tell("you-fork");
    else if (winningCells(grid, "mote").includes(cell)) tell("you-block");
    void moteMoves(next);
  };

  const begin = () => {
    const first = load<"you" | "mote">(FIRST) === "mote" ? "mote" : "you";
    store(FIRST, first === "you" ? "mote" : "you");
    const g = emptyGrid();
    store(SAVE, null);
    setGrid(g);
    setLast({ you: null, mote: null });
    setResult(null);
    setBusy(false);
    setTurn(first);
    setPhase("playing");
    setPending(null);
    mistakes.current = 0;
    if (assistRef.current) {
      tell("assist-start");
      setNotes([]);
      if (first === "you") coachYourTurn(g);
    } else {
      engine()?.gameStart("tictactoe", levelRef.current, first === "mote" ? "mote-first" : undefined);
    }
    if (first === "mote") void moteMoves(g);
  };

  /** After a mistake: undo your move and try again. */
  const takeBack = () => {
    if (!pending) return;
    setGrid(pending.before);
    setLast((l) => ({ ...l, you: null }));
    setPending(null);
    coachYourTurn(pending.before);
  };

  /** After a mistake: leave it, and let Mote answer. */
  const keepGoing = () => {
    if (!pending) return;
    const after = pending.after;
    setPending(null);
    setNotes([]);
    setShowing(false);
    void moteMoves(after);
  };

  const kicked = useRef(false);
  useEffect(() => {
    alive.current = true;
    if (resumed.current && !kicked.current) {
      kicked.current = true;
      tell("resume");
      if (assistRef.current && saved.current?.turn !== "mote") coachYourTurn(resumed.current);
      if (saved.current?.turn === "mote") void moteMoves(resumed.current);
    }
    return () => {
      alive.current = false;
      engine()?.setBoardGame(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (phase === "playing" && openCells(grid).length < 9 && !busy) tell("pause");
    onClose();
  };

  if (phase === "pick") {
    return (
      <LevelPick
        title="Tic-tac-toe"
        lede="You’re X. You and Mote take turns going first."
        level={level}
        onLevel={setLevel}
        assist={assist}
        onAssist={setAssist}
        onPlay={begin}
        onClose={close}
      />
    );
  }

  const yourTurn = phase === "playing" && turn === "you" && !busy;

  return (
    <div className={`ck${assist ? " is-assist" : ""}`}>
      <BoardHead
        assist={assist}
        level={level}
        record={stats[level]}
        playing={phase === "playing"}
        onResign={() => finish(grid, "resign")}
        onClose={close}
      />

      <div className="tt-board" role="grid" aria-label="Tic-tac-toe board">
        {grid.map((mark, i) => (
          <button
            key={i}
            type="button"
            className={`tt-cell${!mark && yourTurn && !pending ? " is-open" : ""}${result?.line?.includes(i) ? " is-win" : ""}${showing && marks.includes(i) ? " is-go" : ""}`}
            aria-label={`Square ${i + 1}${mark ? (mark === "you" ? ", X" : ", Mote") : ""}`}
            onClick={() => play(i)}
          >
            {mark === "you" ? <XMark /> : mark === "mote" ? <MoteMark cell={i} lookAt={last.you} /> : null}
          </button>
        ))}
        {result?.line ? <WinLine line={result.line} /> : null}
      </div>

      {assist ? (
        <Coach
          lines={notes}
          showing={showing}
          onShow={marks.length && phase === "playing" ? () => setShowing((v) => !v) : undefined}
          onUndo={pending ? takeBack : undefined}
          onKeep={pending ? keepGoing : undefined}
        />
      ) : null}

      {phase === "over" && result ? (
        <EndPanel onAgain={() => setPhase("pick")} onDone={onClose}>
          {result.winner === "you" ? "You win!" : result.winner === "mote" ? "Mote wins." : "A draw."}
        </EndPanel>
      ) : (
        <p className="ck-status" aria-live="polite">
          {pending
            ? "Take it back, or keep going?"
            : yourTurn
              ? "Your move"
              : openCells(grid).length === 9
                ? "Mote goes first…"
                : "Mote is thinking…"}
        </p>
      )}
    </div>
  );
}

const center = (i: number) => ({ x: (i % 3) * 100 + 50, y: Math.floor(i / 3) * 100 + 50 });

function XMark() {
  return (
    <svg viewBox="0 0 100 100" className="tt-x" aria-hidden="true">
      <path d="M30 30 L70 70" />
      <path d="M70 30 L30 70" />
    </svg>
  );
}

/** Mote's mark: a tiny Mote, looking at the square you just took. */
function MoteMark({ cell, lookAt }: { cell: number; lookAt: number | null }) {
  let lx = 0;
  let ly = 2;
  if (lookAt !== null && lookAt !== cell) {
    const a = center(cell);
    const b = center(lookAt);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    lx = ((b.x - a.x) / len) * 6;
    ly = ((b.y - a.y) / len) * 5;
  }
  return (
    <svg viewBox="0 0 100 100" className="tt-o" aria-hidden="true">
      <ellipse cx="50" cy="80" rx="22" ry="4" className="ck-shadow" />
      <circle cx="50" cy="50" r="27" className="tt-o-body" />
      <g className="ck-eyes" style={{ animationDelay: `${(cell * 1.7) % 6}s`, transformOrigin: "50% 50px" }}>
        <rect x={39 + lx} y={41 + ly} width="7" height="15" rx="3.5" />
        <rect x={54 + lx} y={41 + ly} width="7" height="15" rx="3.5" />
      </g>
    </svg>
  );
}

function WinLine({ line }: { line: number[] }) {
  const a = center(line[0]);
  const b = center(line[2]);
  // Run a little past the end squares' centres.
  const dx = (b.x - a.x) * 0.12;
  const dy = (b.y - a.y) * 0.12;
  return (
    <svg viewBox="0 0 300 300" className="tt-line" aria-hidden="true">
      <path d={`M${a.x - dx} ${a.y - dy} L${b.x + dx} ${b.y + dy}`} />
    </svg>
  );
}
