import { useEffect, useRef, useState, type ReactNode } from "react";
import { LEVELS, type Level } from "@/lib/checkers/ai";
import { LEVEL_NAME, type Record3 } from "./board-store";
import "./board.css";

// The parts every board game against Mote shares: picking a level, the row
// along the top, and the end-of-game panel. (Saving games and records is in
// board-store.ts.)

const LEVEL_HINT: Record<Level, string> = {
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
}: {
  title: string;
  lede: string;
  level: Level;
  onLevel: (l: Level) => void;
  onPlay: () => void;
  onClose: () => void;
}) {
  return (
    <div className="ck ck-pick">
      <div className="ck-head">
        <h2>{title}</h2>
        <CloseButton onClick={onClose} />
      </div>
      <p className="ck-lede">{lede}</p>
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
}: {
  level: Level;
  record: Record3;
  playing: boolean;
  onResign: () => void;
  onClose: () => void;
}) {
  const [sure, setSure] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div className="ck-head">
      <p className="ck-meta">
        <strong>{LEVEL_NAME[level]}</strong>
        {record.you + record.mote + record.draw > 0 ? (
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
