import { useState } from "react";

type Props = {
  total: number;
  goal: number;
  onAdd: (amount: number) => void;
  onSub: (amount: number) => void;
  onSet: (total: number) => void;
  onClose: () => void;
};

function Mark({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const digits = (text: string) => text.replace(/[^\d]/g, "");

/** Today's calories. Type an amount and add or take it away; click the big
 * number to set the total outright. */
export function CaloriePad({ total, goal, onAdd, onSub, onSet, onClose }: Props) {
  const [amount, setAmount] = useState("");
  // While the total is being typed over, this holds the typing.
  const [draft, setDraft] = useState<string | null>(null);

  const parsed = Number(amount);
  const ready = goal > 0 && parsed > 0;
  const left = goal - total;

  const apply = (dir: "add" | "sub") => {
    if (!ready) return;
    if (dir === "add") onAdd(parsed);
    else onSub(parsed);
    setAmount("");
  };

  const commitDraft = () => {
    if (draft === null) return;
    const n = Number(draft || 0);
    setDraft(null);
    if (n !== total) onSet(n);
  };

  if (goal <= 0) {
    return (
      <div className="cal-pad">
        <div className="cal-pad-top">
          <p className="cal-pad-empty">Set a daily goal in Settings first.</p>
          <button type="button" className="cal-pad-x" aria-label="Close" onClick={onClose}>
            <Mark d="M7 7l10 10M17 7L7 17" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="cal-pad"
      onSubmit={(e) => {
        e.preventDefault();
        apply("add");
      }}
    >
      <div className="cal-pad-top">
        <div>
          <input
            className="cal-pad-total"
            inputMode="numeric"
            aria-label="Today’s total"
            title="Click to change today’s total"
            value={draft ?? total.toLocaleString()}
            style={{ width: `${Math.max(1, (draft ?? total.toLocaleString()).length) + 0.6}ch` }}
            onFocus={(e) => {
              setDraft(String(total));
              e.currentTarget.select();
            }}
            onChange={(e) => setDraft(digits(e.target.value))}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                e.stopPropagation();
                setDraft(null);
                e.currentTarget.blur();
              }
            }}
          />
          <p className={`cal-pad-left${left < 0 ? " is-over" : ""}`}>
            {left >= 0
              ? `${left.toLocaleString()} left of ${goal.toLocaleString()}`
              : `${(-left).toLocaleString()} over ${goal.toLocaleString()}`}
          </p>
        </div>
        <button type="button" className="cal-pad-x" aria-label="Close" onClick={onClose}>
          <Mark d="M7 7l10 10M17 7L7 17" />
        </button>
      </div>

      <div className="cal-pad-row">
        <input
          className="cal-pad-amount"
          inputMode="numeric"
          aria-label="Calories to add or take away"
          placeholder="Calories"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(digits(e.target.value))}
        />
        <button
          type="button"
          className="cal-pad-chip"
          disabled={!ready}
          aria-label="Take away"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply("sub")}
        >
          <Mark d="M6 12h12" />
        </button>
        <button
          type="submit"
          className="cal-pad-chip is-add"
          disabled={!ready}
          aria-label="Add"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Mark d="M12 6v12M6 12h12" />
        </button>
      </div>
    </form>
  );
}
