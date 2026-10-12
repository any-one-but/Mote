import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceEngine } from "@/components/companion/engine";
import type { LiarsDiceEvent } from "@/components/companion/liarsdice-lines";
import {
  ALL,
  FACES,
  bidHolds,
  bidWords,
  chooseMove,
  countOf,
  isRaise,
  lowestRaise,
  roll,
  sharpness,
  type Bid,
} from "@/lib/liarsdice/game";
import { CloseButton } from "./board-ui";
import { load, sleep, store } from "./board-store";
import "./liarsdice.css";

type Props = {
  engine: () => FaceEngine | null;
  onClose: () => void;
};

type Who = "you" | "mote";
type Placed = { by: Who; bid: Bid };
type Round = { you: number[]; mote: number[]; bids: Placed[]; turn: Who };
/** The running score, which never resets, and who won the last rounds. */
type Score = { you: number; mote: number; recent: Who[] };
type Reveal = { caller: Who; bid: Placed; total: number; winner: Who };

const ROUND = "mote.liarsdice.round";
const SCORE = "mote.liarsdice.score";
/** Who opens the next round: whoever lost the last one. */
const OPENER = "mote.liarsdice.opener";

const validDice = (d: unknown): d is number[] =>
  Array.isArray(d) && d.length === 5 && d.every((n) => Number.isInteger(n) && n >= 1 && n <= 6);

function savedRound(): Round | null {
  const r = load<Round>(ROUND);
  if (!r || !validDice(r.you) || !validDice(r.mote) || !Array.isArray(r.bids)) return null;
  return { ...r, turn: r.turn === "mote" ? "mote" : "you" };
}

function savedScore(): Score {
  const s = load<Score>(SCORE);
  return {
    you: Number(s?.you) || 0,
    mote: Number(s?.mote) || 0,
    recent: Array.isArray(s?.recent) ? s.recent.filter((w) => w === "you" || w === "mote") : [],
  };
}

/** Liar's Dice against Mote, round after round, for as long as you like. */
export function LiarsDice({ engine, onClose }: Props) {
  const resumed = useRef(savedRound());
  const [round, setRound] = useState<Round>(
    () => resumed.current ?? { you: roll(), mote: roll(), bids: [], turn: load<Who>(OPENER) === "mote" ? "mote" : "you" },
  );
  const [score, setScore] = useState<Score>(savedScore);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<Bid>({ count: 1, face: 1 });
  const alive = useRef(true);
  const roundRef = useRef(round);
  roundRef.current = round;
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const tell = useCallback(
    (event: LiarsDiceEvent, bid?: Bid) => engine()?.liarsDice(event, bid ? bidWords(bid) : undefined),
    [engine],
  );

  const last = round.bids[round.bids.length - 1] ?? null;
  const yourTurn = !reveal && round.turn === "you" && !busy;

  useEffect(() => {
    const e = engine();
    if (reveal) e?.setBoardGame("idle");
    else e?.setBoardGame(round.turn === "mote" || busy ? "mote" : "you");
  }, [engine, reveal, round.turn, busy]);

  useEffect(() => {
    if (!reveal) store(ROUND, round);
  }, [round, reveal]);

  /** On your turn: start the picker on the number you have most of, at the
   * smallest raise (or as many as you hold, if that's more). */
  const readyPicker = (r: Round) => {
    const prev = r.bids[r.bids.length - 1]?.bid ?? null;
    const faces = [...FACES].sort((a, b) => countOf(r.you, b) - countOf(r.you, a) || b - a);
    for (const face of faces) {
      const low = lowestRaise(face, prev);
      if (low) {
        setPick({ face, count: Math.max(low.count, countOf(r.you, face)) });
        return;
      }
    }
  };

  /** The dice come out: whose bid held, and a point to the winner. */
  const showDice = (r: Round, caller: Who) => {
    const placed = r.bids[r.bids.length - 1];
    if (!placed) return;
    const total = countOf(r.you, placed.bid.face) + countOf(r.mote, placed.bid.face);
    const held = bidHolds(placed.bid, r.you, r.mote);
    const winner: Who = held ? placed.by : caller;
    setReveal({ caller, bid: placed, total, winner });
    store(ROUND, null);
    // The loser opens the next round.
    store(OPENER, winner === "you" ? "mote" : "you");
    const s = scoreRef.current;
    const next: Score = {
      you: s.you + (winner === "you" ? 1 : 0),
      mote: s.mote + (winner === "mote" ? 1 : 0),
      recent: [...s.recent, winner].slice(-20),
    };
    setScore(next);
    store(SCORE, next);
    const tail = next.recent.slice(-3);
    const streak = tail.length === 3 && tail.every((w) => w === winner) && next.recent.at(-4) !== winner;
    if (streak) tell(winner === "mote" ? "mote-streak" : "you-streak");
    else if (caller === "mote") tell(held ? "mote-called-wrong" : "mote-caught-you");
    else tell(held ? "you-called-wrong" : "you-caught-mote");
  };

  const moteTurn = async (r: Round) => {
    setBusy(true);
    await sleep(900 + Math.random() * 900);
    if (!alive.current) return;
    const prev = r.bids[r.bids.length - 1]?.bid ?? null;
    const yourFaces = r.bids.filter((b) => b.by === "you").map((b) => b.bid.face);
    const move = chooseMove(r.mote, prev, { sharp: sharpness(scoreRef.current.recent), yourFaces });
    setBusy(false);
    if (move.kind === "call") {
      tell("mote-calls");
      await sleep(700);
      if (!alive.current) return;
      showDice(r, "mote");
      return;
    }
    const next: Round = { ...r, bids: [...r.bids, { by: "mote", bid: move.bid }], turn: "you" };
    setRound(next);
    readyPicker(next);
    tell(move.bluff ? "mote-bluffs" : "mote-bids", move.bid);
  };

  const bid = () => {
    if (!yourTurn || !isRaise(pick, last?.bid ?? null)) return;
    const next: Round = { ...round, bids: [...round.bids, { by: "you", bid: pick }], turn: "mote" };
    setRound(next);
    void moteTurn(next);
  };

  const callLiar = async () => {
    if (!yourTurn || !last) return;
    setBusy(true);
    tell("you-call");
    await sleep(800);
    if (!alive.current) return;
    setBusy(false);
    showDice(round, "you");
  };

  const nextRound = () => {
    const opener: Who = load<Who>(OPENER) === "mote" ? "mote" : "you";
    const r: Round = { you: roll(), mote: roll(), bids: [], turn: opener };
    setReveal(null);
    setRound(r);
    if (opener === "mote") void moteTurn(r);
    else readyPicker(r);
  };

  useEffect(() => {
    alive.current = true;
    const r = roundRef.current;
    tell(resumed.current ? "resume" : "start");
    if (r.turn === "mote") void moteTurn(r);
    else readyPicker(r);
    return () => {
      alive.current = false;
      engine()?.setBoardGame(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (!reveal && round.bids.length && !busy) tell("pause");
    onClose();
  };

  // Changing the number keeps the bid legal: at least the smallest raise.
  const setFace = (face: number) => {
    const low = lowestRaise(face, last?.bid ?? null);
    if (!low) return;
    setPick((p) => ({ face, count: Math.max(low.count, p.count) }));
  };
  const step = (by: number) => {
    const low = lowestRaise(pick.face, last?.bid ?? null);
    if (!low) return;
    setPick((p) => ({ ...p, count: Math.min(ALL, Math.max(low.count, p.count + by)) }));
  };
  const legal = isRaise(pick, last?.bid ?? null);
  const matchFace = reveal ? reveal.bid.bid.face : yourTurn ? pick.face : null;

  return (
    <div className="ck ld">
      <div className="ck-head">
        <p className="ck-meta">
          <strong>Liar’s Dice</strong>
          {score.you + score.mote > 0 ? (
            <span>
              You {score.you} · Mote {score.mote}
            </span>
          ) : null}
        </p>
        <CloseButton onClick={close} />
      </div>

      <div className="ld-row" aria-label={reveal ? "Mote’s dice" : "Mote’s dice, hidden"}>
        {round.mote.map((d, i) =>
          reveal ? (
            <Die key={i} face={d} side="mote" match={d === matchFace} delay={i * 70} />
          ) : (
            <HiddenDie key={i} index={i} />
          ),
        )}
      </div>

      <div className="ld-bid" aria-live="polite">
        {reveal ? (
          <>
            <p className="ld-who">
              {reveal.caller === "you" ? "You called" : "Mote called"} liar on {reveal.bid.by === "you" ? "your" : "Mote’s"}{" "}
              {bidWords(reveal.bid.bid)}
            </p>
            <p className="ld-big">
              {reveal.total === 0
                ? `No ${reveal.bid.bid.face}s at all`
                : `${reveal.total === 1 ? "Just one" : `There are ${reveal.total}`}`}
              {reveal.total > 0 ? <MiniDie face={reveal.bid.bid.face} /> : null}
            </p>
            <p className={`ld-point is-${reveal.winner}`}>{reveal.winner === "you" ? "Point to you!" : "Point to Mote."}</p>
          </>
        ) : last ? (
          <>
            <p className="ld-who">{last.by === "you" ? "You bid" : "Mote bids"}</p>
            <p className="ld-big">
              {bidWords(last.bid).split(" ")[0]} <MiniDie face={last.bid.face} />
              <span className="ld-of">out of {ALL}</span>
            </p>
          </>
        ) : (
          <>
            <p className="ld-who">New round</p>
            <p className="ld-big is-quiet">{round.turn === "you" ? "You open the bidding" : "Mote opens…"}</p>
          </>
        )}
      </div>

      <div className="ld-row" aria-label="Your dice">
        {round.you.map((d, i) => (
          <Die key={i} face={d} side="you" match={d === matchFace} />
        ))}
      </div>

      {reveal ? (
        <div className="ck-buttons ld-next">
          <button type="button" className="ck-primary" onClick={nextRound} autoFocus>
            Next round
          </button>
        </div>
      ) : yourTurn ? (
        <div className="ld-pick">
          <div className="ld-picker">
            <div className="ld-count" role="group" aria-label="How many">
              <button type="button" aria-label="Fewer" onClick={() => step(-1)}>
                −
              </button>
              <span>{pick.count}</span>
              <button type="button" aria-label="More" onClick={() => step(1)} disabled={pick.count >= ALL}>
                +
              </button>
            </div>
            <div className="ld-faces" role="radiogroup" aria-label="Which number">
              {FACES.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={pick.face === f}
                  aria-label={`${f}s`}
                  className={pick.face === f ? "is-on" : ""}
                  disabled={!lowestRaise(f, last?.bid ?? null)}
                  onClick={() => setFace(f)}
                >
                  <MiniDie face={f} />
                </button>
              ))}
            </div>
          </div>
          <div className="ck-buttons">
            <button type="button" className="ck-primary" disabled={!legal} onClick={bid}>
              Bid {bidWords(pick)}
            </button>
            {last ? (
              <button type="button" className="ck-secondary ld-liar" onClick={() => void callLiar()}>
                Liar!
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="ck-status" aria-live="polite">
          {busy && round.turn === "you" ? "Let’s see…" : "Mote is thinking…"}
        </p>
      )}
    </div>
  );
}

/** Where the pips go on a 100 × 100 die. */
const PIPS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [
    [30, 30],
    [70, 70],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [30, 30],
    [70, 30],
    [30, 70],
    [70, 70],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [30, 26],
    [70, 26],
    [30, 50],
    [70, 50],
    [30, 74],
    [70, 74],
  ],
};

function Die({ face, side, match, delay = 0 }: { face: number; side: Who; match: boolean; delay?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`ld-die is-${side}${match ? " is-match" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
      role="img"
      aria-label={String(face)}
    >
      <rect x="6" y="6" width="88" height="88" rx="22" className="ld-body" />
      {PIPS[face].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" className="ld-pip" />
      ))}
    </svg>
  );
}

/** A small ink die, for bids and the number picker. */
function MiniDie({ face }: { face: number }) {
  return (
    <svg viewBox="0 0 100 100" className="ld-mini" aria-hidden="true">
      <rect x="6" y="6" width="88" height="88" rx="24" className="ld-body" />
      {PIPS[face].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="10" className="ld-pip" />
      ))}
    </svg>
  );
}

/** One of Mote's dice, face down: blank, with a tiny pair of Mote eyes. */
function HiddenDie({ index }: { index: number }) {
  return (
    <svg viewBox="0 0 100 100" className="ld-die is-hidden" aria-hidden="true">
      <rect x="6" y="6" width="88" height="88" rx="22" className="ld-body" />
      <g className="ck-eyes" style={{ animationDelay: `${(index * 1.3) % 5}s`, transformOrigin: "50% 50px" }}>
        <rect x="35" y="38" width="9" height="20" rx="4.5" />
        <rect x="56" y="38" width="9" height="20" rx="4.5" />
      </g>
    </svg>
  );
}
