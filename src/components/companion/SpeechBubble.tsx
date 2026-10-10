import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Bubble, Direction } from "@/components/companion/speech";

type Props = {
  bubble: Bubble | null;
  /** Where the bubble's tail should point to: px from the top and left of the window. */
  anchor: { x: number; y: number };
  onAnswer: (yes: boolean) => void;
  onDismiss: () => void;
};

const TYPE_MS = 32;
const LEAVE_MS = 200;

/**
 * Mote's speech bubble. Words type out, questions get a green and a red
 * button, and requests show a small hint. Bubbles swap with a little exit
 * animation so a reply never jumps straight over the last thing said.
 */
export function SpeechBubble({ bubble, anchor, onAnswer, onDismiss }: Props) {
  const [shown, setShown] = useState<Bubble | null>(bubble);
  const [leaving, setLeaving] = useState(false);
  const [typed, setTyped] = useState(0);
  const timer = useRef<number | null>(null);

  // Swap bubbles with a short exit in between.
  useEffect(() => {
    if (bubble?.id === shown?.id) return;
    if (!shown) {
      setShown(bubble);
      return;
    }
    setLeaving(true);
    const t = window.setTimeout(() => {
      setLeaving(false);
      setShown(bubble);
    }, LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [bubble, shown]);

  // Type the words out.
  useEffect(() => {
    if (!shown) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = plain(shown.text).length;
    if (reduced) {
      setTyped(total);
      return;
    }
    setTyped(0);
    let n = 0;
    timer.current = window.setInterval(() => {
      n++;
      setTyped(n);
      if (n >= total && timer.current) window.clearInterval(timer.current);
    }, TYPE_MS);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [shown]);

  if (!shown) return null;
  const done = typed >= plain(shown.text).length;
  const timed = shown.kind !== "flavor";

  return (
    <div
      className={`speech is-${shown.kind}${leaving ? " is-leaving" : ""}`}
      style={{ left: anchor.x, bottom: `calc(100% - ${anchor.y}px)` }}
      role="status"
      aria-live="polite"
      // Moving the window is the answer to a move request, so the bubble
      // itself can be dragged.
      data-tauri-drag-region={shown.kind === "move" ? true : undefined}
      onClick={shown.kind === "flavor" ? onDismiss : undefined}
    >
      <span className="sr-only">{plain(shown.text)}</span>
      <p className="speech-text" aria-hidden="true">
        {render(shown.text, typed)}
      </p>

      {shown.kind === "ask" && done ? (
        <div className="speech-answers">
          <button type="button" className="speech-yes" aria-label="Yes" onClick={() => onAnswer(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 12.5l4 4 8-9" />
            </svg>
          </button>
          <button type="button" className="speech-no" aria-label="No" onClick={() => onAnswer(false)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        </div>
      ) : null}

      {shown.kind === "move" && done ? (
        <span className="speech-hint">
          <Arrow direction={shown.direction ?? "left"} />
          drag my window
        </span>
      ) : null}

      {shown.kind === "pet" && done ? (
        <span className="speech-hint">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="speech-stroke">
            <path d="M3 14c3-4 6 4 9 0s6 4 9 0" />
          </svg>
          stroke my face
        </span>
      ) : null}

      {timed ? (
        <span className="speech-timer" aria-hidden="true">
          <span key={shown.id} style={{ animationDuration: `${shown.ttl}ms` }} />
        </span>
      ) : null}
    </div>
  );
}

function Arrow({ direction }: { direction: Direction }) {
  const turn = { right: 0, down: 90, left: 180, up: 270 }[direction];
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`speech-arrow is-${direction}`}
      style={{ transform: `rotate(${turn}deg)` }}
    >
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

const plain = (text: string) => text.replace(/\*/g, "");

/** The first `count` characters, with `*emphasis*` shown in colour. */
function render(text: string, count: number): ReactNode[] {
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  const out: ReactNode[] = [];
  let left = count;
  parts.forEach((part, i) => {
    if (left <= 0) return;
    const em = part.startsWith("*") && part.endsWith("*");
    const words = em ? part.slice(1, -1) : part;
    const slice = words.slice(0, left);
    left -= words.length;
    out.push(em ? <em key={i}>{slice}</em> : <span key={i}>{slice}</span>);
  });
  return out;
}
