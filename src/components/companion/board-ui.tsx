import { useEffect, useRef, useState, type ReactNode } from "react";
import { LEVELS, type Level } from "@/lib/checkers/ai";
import { LEVEL_NAME, type Record3 } from "./board-store";
import "./board.css";

// The parts every board game against Mote shares: picking a level, the row
// along the top, and the end-of-game panel. (Saving games and records is in
// board-store.ts.)

const LEVEL_HINT: Record<Level, string> = {
  close: "Mote keeps it close, and you just stay ahead.",
  easy: "Mote is still learning.",
  normal: "A fair game.",
  hard: "Mote plays to win.",
};


export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="ck-x" aria-label="Put the board away" onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7l10 10M17 7L7 17" />
      </svg>
    </button>
  );
}

export function LevelPick({
  title,
  lede,
  level,
  onLevel,
  onPlay,
  onClose,
  assist,
  onAssist,
}: {
  title: string;
  lede: string;
  level: Level;
  /** Picking a level (left out, Mote plays the usual close game). */
  onLevel?: (l: Level) => void;
  onPlay: () => void;
  onClose: () => void;
  /** Learning with Mote (for games that have it). */
  assist?: boolean;
  onAssist?: (on: boolean) => void;
}) {
  return (
    <div className="ck ck-pick">
      <div className="ck-head">
        <h2>{title}</h2>
        <CloseButton onClick={onClose} />
      </div>
      <p className="ck-lede">{lede}</p>
      {onLevel ? (
        <>
          <div className="ck-levels" role="radiogroup" aria-label="Level">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={level === l}
                className={level === l ? "is-on" : ""}
                onClick={() => onLevel(l)}
              >
                {LEVEL_NAME[l]}
              </button>
            ))}
          </div>
          <p className="ck-hint">{LEVEL_HINT[level]}</p>
        </>
      ) : null}
      {onAssist ? (
        <>
          <div className="ck-levels" role="radiogroup" aria-label="How to play">
            <button type="button" role="radio" aria-checked={!assist} className={!assist ? "is-on" : ""} onClick={() => onAssist(false)}>
              Play
            </button>
            <button type="button" role="radio" aria-checked={!!assist} className={assist ? "is-on" : ""} onClick={() => onAssist(true)}>
              Learn with Mote
            </button>
          </div>
          <p className="ck-hint">
            {assist
              ? "Mote explains as you go: tips on your turn, your mistakes (with a take-back), and their own plans. Doesn’t count toward your record."
              : "A real game. It counts toward your record."}
          </p>
        </>
      ) : null}
      <button type="button" className="ck-primary" onClick={onPlay} autoFocus>
        Play
      </button>
    </div>
  );
}

/** The level and your record, with Resign (it asks once) and close. */
export function BoardHead({
  level,
  record,
  playing,
  onResign,
  onClose,
  assist = false,
}: {
  level: Level;
  record: Record3;
  playing: boolean;
  onResign: () => void;
  onClose: () => void;
  /** A learning game: says so, instead of showing your record. */
  assist?: boolean;
}) {
  const [sure, setSure] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div className="ck-head">
      <p className="ck-meta">
        {assist ? (
          <strong>Learning · {LEVEL_NAME[level]}</strong>
        ) : level !== "close" ? (
          <strong>{LEVEL_NAME[level]}</strong>
        ) : null}
        {!assist && record.you + record.mote + record.draw > 0 ? (
          <span>
            You {record.you} · Mote {record.mote}
          </span>
        ) : null}
      </p>
      {playing ? (
        <button
          type="button"
          className={`ck-quiet${sure ? " is-sure" : ""}`}
          onClick={() => {
            if (!sure) {
              setSure(true);
              timer.current = window.setTimeout(() => setSure(false), 3000);
              return;
            }
            setSure(false);
            onResign();
          }}
        >
          {sure ? "Resign?" : "Resign"}
        </button>
      ) : null}
      <CloseButton onClick={onClose} />
    </div>
  );
}

export function EndPanel({ children, onAgain, onDone }: { children: ReactNode; onAgain: () => void; onDone: () => void }) {
  return (
    <div className="ck-end">
      <p className="ck-result">{children}</p>
      <div className="ck-buttons">
        <button type="button" className="ck-primary" onClick={onAgain}>
          Play again
        </button>
        <button type="button" className="ck-secondary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

/** One thing Mote has to say in a learning game. */
export type CoachLine = { kind: "mote" | "tip" | "mistake" | "good"; text: string };

const COACH_LABEL: Record<CoachLine["kind"], string> = {
  mote: "My move",
  tip: "Tip",
  mistake: "Hmm",
  good: "Nice",
};

/**
 * Mote's notes under the board in a learning game: what they just did, a
 * tip for your turn, or a word about your move. "Show me" marks the squares
 * on the board; after a mistake, you can take the move back.
 */
export function Coach({
  lines,
  showing,
  onShow,
  onUndo,
  onKeep,
}: {
  lines: CoachLine[];
  showing: boolean;
  onShow?: () => void;
  onUndo?: () => void;
  onKeep?: () => void;
}) {
  if (!lines.length) return null;
  return (
    <div className="coach" aria-live="polite">
      <svg viewBox="0 0 40 40" className="coach-face" aria-hidden="true">
        <circle cx="20" cy="20" r="17" />
        <rect x="13" y="14" width="4.5" height="10" rx="2.25" />
        <rect x="22.5" y="14" width="4.5" height="10" rx="2.25" />
      </svg>
      <div className="coach-body">
        {lines.map((l, i) => (
          <p key={i} className={`coach-line is-${l.kind}`}>
            <span className="coach-label">{COACH_LABEL[l.kind]}</span> {l.text}
          </p>
        ))}
        {onShow || onUndo ? (
          <div className="coach-buttons">
            {onUndo ? (
              <button type="button" className="coach-btn is-main" onClick={onUndo}>
                Take it back
              </button>
            ) : null}
            {onKeep ? (
              <button type="button" className="coach-btn" onClick={onKeep}>
                Keep going
              </button>
            ) : null}
            {onShow ? (
              <button type="button" className="coach-btn" aria-pressed={showing} onClick={onShow}>
                {showing ? "Hide" : "Show me"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
