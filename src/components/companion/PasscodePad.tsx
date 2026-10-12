import { useEffect, useRef, useState } from "react";
import "./passcode.css";

// The one passcode pad: on Mote's window when you open Local Gallery, and in
// Settings for setting, changing or turning off the passcode. Four dots that
// fill as you type (the keyboard or the keys on the pad), a shake when it's
// wrong. While it's up it has the keyboard to itself.

const LENGTH = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

type Props = {
  /** Small, at the top: what this is for ("Local Gallery", "Change passcode"). */
  title: string;
  /** What to type now ("Enter your passcode", "Type them again"). */
  prompt: string;
  /** Under the dots: what went wrong, or (calm) just a note. */
  message?: string | null;
  calm?: boolean;
  /** Goes up by one for each wrong entry: the dots shake and clear. */
  wrong?: number;
  /** Goes up by one to clear the dots for the next step. */
  step?: number;
  /** Waiting on an answer: typing is ignored. */
  busy?: boolean;
  /** Four digits typed. */
  onEnter: (pin: string) => void;
  /** Each digit typed (Mote flinches a little). */
  onDigit?: () => void;
  onCancel: () => void;
  className?: string;
};

export function PasscodePad({
  title,
  prompt,
  message,
  calm,
  wrong = 0,
  step = 0,
  busy,
  onEnter,
  onDigit,
  onCancel,
  className,
}: Props) {
  const [digits, setDigits] = useState("");
  const [shaking, setShaking] = useState(false);
  const live = useRef({ digits, busy, shaking, onEnter, onDigit, onCancel });
  live.current = { digits, busy, shaking, onEnter, onDigit, onCancel };

  // Wrong: shake, then clear (the fourth dot is seen to fill first).
  useEffect(() => {
    if (!wrong) return;
    setShaking(true);
    const t = window.setTimeout(() => {
      setShaking(false);
      setDigits("");
    }, 440);
    return () => window.clearTimeout(t);
  }, [wrong]);
  useEffect(() => setDigits(""), [step]);

  const press = (key: string) => {
    const now = live.current;
    if (now.busy || now.shaking) return;
    if (key === "back") {
      setDigits(now.digits.slice(0, -1));
      return;
    }
    if (now.digits.length >= LENGTH) return;
    const next = now.digits + key;
    setDigits(next);
    now.onDigit?.();
    if (next.length === LENGTH) window.setTimeout(() => live.current.onEnter(next), 110);
  };

  // The pad owns the keyboard while it's up: nothing reaches what's behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") live.current.onCancel();
      else if (e.key === "Backspace" || e.key === "Delete") press("back");
      else if (/^[0-9]$/.test(e.key)) press(e.key);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const key = (k: string) => (
    <button
      key={k}
      type="button"
      className="pc-key"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => press(k)}
    >
      {k}
    </button>
  );

  return (
    <div className={`pc-pad${className ? ` ${className}` : ""}`} role="dialog" aria-label={title}>
      <div className="pc-top">
        <span className="pc-title">{title}</span>
        <button type="button" className="pc-x" aria-label="Cancel" onClick={onCancel}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 7l10 10M17 7L7 17" />
          </svg>
        </button>
      </div>
      <p className="pc-prompt">{prompt}</p>
      <div
        className={`pc-dots${shaking ? " is-wrong" : ""}${busy ? " is-busy" : ""}`}
        aria-label={`${digits.length} of ${LENGTH} digits`}
      >
        {Array.from({ length: LENGTH }, (_, i) => (
          <span key={i} className={`pc-dot${i < digits.length ? " is-filled" : ""}`} />
        ))}
      </div>
      <p className={`pc-message${calm ? " is-calm" : ""}`} aria-live="polite">
        {/* Gone once you start typing again. */}
        {(digits.length && !shaking ? null : message) ?? "\u00a0"}
      </p>
      <div className="pc-keys">
        {KEYS.map(key)}
        <span />
        {key("0")}
        <button
          type="button"
          className="pc-key is-back"
          aria-label="Delete"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => press("back")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6h10v12H9l-5-6z M12.5 9.5l5 5M17.5 9.5l-5 5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
