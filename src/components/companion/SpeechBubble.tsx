import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Bubble, Direction } from "@/components/companion/speech";

type Props = {
  bubble: Bubble | null;
  /** Where the bubble's tail should point to: px from the top and left of the window. */
  anchor: { x: number; y: number };
  onAnswer: (yes: boolean) => void;
  onDismiss: () => void;
  /** In a conversation: what you typed (Enter), a choice clicked, and each
   * keystroke (so Mote waits). */
  onSubmit: (text: string) => void;
  onChoose: (id: string) => void;
  onTyping: () => void;
};

const TYPE_MS = 32;
const LEAVE_MS = 200;

/**
 * Mote's speech bubble. Words type out, questions get a green and a red
 * button, and requests show a small hint. In a conversation there's a box to
 * type in, and sometimes choices, one per line. Bubbles swap with a little
 * exit animation so a reply never jumps straight over the last thing said.
 */
export function SpeechBubble({ bubble, anchor, onAnswer, onDismiss, onSubmit, onChoose, onTyping }: Props) {
  const [shown, setShown] = useState<Bubble | null>(bubble);
  const [leaving, setLeaving] = useState(false);
  const [typed, setTyped] = useState(0);
  const [text, setText] = useState("");
  // A tall bubble would go off the top of the window: it comes down a bit
  // (over Mote's face) instead.
  const [nudge, setNudge] = useState(0);
  const timer = useRef<number | null>(null);
  const self = useRef<HTMLDivElement>(null);

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

  useEffect(() => setText(""), [shown?.id]);

  useLayoutEffect(() => {
    const el = self.current;
    if (!el) return setNudge(0);
    // Where its top would be without the nudge (layout only, so the pop-in
    // animation's scaling doesn't count).
    const top = el.offsetTop - nudge;
    const want = top < 8 ? 8 - top : 0;
    if (Math.abs(want - nudge) > 0.5) setNudge(want);
  });

  if (!shown) return null;
  const done = typed >= plain(shown.text).length;
  const talking = shown.kind === "talk" || shown.kind === "choose";
  const timed = shown.kind !== "flavor" && !talking;
  const choices = shown.choices ?? [];

  return (
    <div
      ref={self}
      className={`speech is-${shown.kind}${leaving ? " is-leaving" : ""}${nudge ? " is-nudged" : ""}`}
      style={{ left: anchor.x, bottom: `calc(100% - ${anchor.y}px)`, marginBottom: -nudge }}
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
          <button
            type="button"
            className="speech-yes"
            aria-label="Yes"
            onClick={() => onAnswer(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 12.5l4 4 8-9" />
            </svg>
          </button>
          <button
            type="button"
            className="speech-no"
            aria-label="No"
            onClick={() => onAnswer(false)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        </div>
      ) : null}

      {shown.kind === "choose" && done && choices.length ? (
        <div className={`speech-choices${choices.length > 4 ? " is-two" : ""}`}>
          {choices.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className="speech-choice"
              style={{ animationDelay: `${i * 40}ms` }}
              onClick={() => onChoose(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}

      {talking ? (
        <form
          className="speech-type"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onSubmit(text);
          }}
        >
          <input
            // A fresh box for each thing Mote says.
            key={shown.id}
            className="speech-input"
            aria-label={plain(shown.text)}
            placeholder={shown.placeholder ?? "Tell me…"}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onDismiss();
            }}
          />
        </form>
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
