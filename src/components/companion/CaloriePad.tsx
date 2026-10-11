import { useEffect, useState } from "react";

type Props = {
  total: number;
  goal: number;
  onAdd: (amount: number) => void;
  onSub: (amount: number) => void;
  onSet: (total: number) => void;
  onClose: () => void;
  onShowDays: () => void;
};

/** Today's calories, edited here. The days window only shows them. */
export function CaloriePad({ total, goal, onAdd, onSub, onSet, onClose, onShowDays }: Props) {
  const [amount, setAmount] = useState("");
  const [draft, setDraft] = useState(String(total));

  useEffect(() => {
    setDraft(String(total));
  }, [total]);

  const parsed = Math.round(Number(amount));
  const ready = goal > 0 && Number.isFinite(parsed) && parsed > 0;
  const left = Math.max(0, goal - total);
  const over = Math.max(0, total - goal);

  const apply = (dir: "add" | "sub") => {
    if (!ready) return;
    if (dir === "add") onAdd(parsed);
    else onSub(parsed);
    setAmount("");
  };

  const commitDraft = () => {
    const n = Math.max(0, Math.round(Number(draft) || 0));
    setDraft(String(n));
    if (n !== total) onSet(n);
  };

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
          <p className="cal-pad-kicker">Today</p>
          <p className="cal-pad-total">
            {goal > 0 ? (
              <>
                <strong>{total.toLocaleString()}</strong>
                <span> of {goal.toLocaleString()}</span>
              </>
            ) : (
              <span>Set a daily goal in Settings</span>
            )}
          </p>
          {goal > 0 ? (
            <p className="cal-pad-left">{over > 0 ? `${over.toLocaleString()} over` : `${left.toLocaleString()} left`}</p>
          ) : null}
        </div>
        <button type="button" className="cal-pad-x" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 7l10 10M17 7L7 17" />
          </svg>
        </button>
      </div>

      <div className="cal-pad-row">
        <input
          className="cal-pad-amount"
          inputMode="numeric"
          aria-label="Calories to add or take away"
          placeholder="Calories"
          value={amount}
          disabled={goal <= 0}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
        />
        <button
          type="button"
          className="cal-pad-chip"
          disabled={!ready}
          aria-label="Take away"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply("sub")}
        >
          −
        </button>
        <button
          type="submit"
          className="cal-pad-chip"
          disabled={!ready}
          aria-label="Add"
          onMouseDown={(e) => e.preventDefault()}
        >
          +
        </button>
      </div>

      <label className="cal-pad-set">
        <span>Set today’s total</span>
        <input
          inputMode="numeric"
          aria-label="Today’s total"
          value={draft}
          disabled={goal <= 0}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
            }
          }}
        />
      </label>

      <button type="button" className="cal-pad-days" onClick={onShowDays}>
        Show the days
      </button>
    </form>
  );
}
