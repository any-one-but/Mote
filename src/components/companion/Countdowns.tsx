import { useEffect, useRef, useState } from "react";
import type { FaceEngine } from "@/components/companion/engine";
import {
  endsOn,
  inShort,
  inWords,
  loadCountdowns,
  madeLine,
  nameProblem,
  saveCountdowns,
  sorted,
  type Countdown,
} from "./countdown-store";
import "./board.css";
import "./countdowns.css";

type Props = {
  engine: () => FaceEngine | null;
  onClose: () => void;
  /** Open straight on a new one, with this name (or none) in it. */
  start: { name: string } | null;
};

/** What's in the form: a new one (id null) or one being changed. */
type Draft = { id: string | null; name: string; date: string; time: string };

const two = (n: number) => String(n).padStart(2, "0");
const dateOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};
const timeOf = (ms: number) => {
  const d = new Date(ms);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
};
/** The day and time picked, as a moment (null if the day isn't a real one). */
function whenOf(date: string, time: string): number | null {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  const [h, min] = time ? time.split(":").map(Number) : [0, 0];
  const at = new Date(y, m - 1, d, h || 0, min || 0).getTime();
  return Number.isFinite(at) ? at : null;
}

const blank = (name = ""): Draft => ({ id: null, name, date: "", time: "" });

/** The countdowns, in Mote's window: each one ticking down, and a form to
 * make a new one or change one. */
export function Countdowns({ engine, onClose, start }: Props) {
  const [list, setList] = useState<Countdown[]>(() => loadCountdowns());
  const [draft, setDraft] = useState<Draft | null>(() => (start ? blank(start.name) : null));
  const [now, setNow] = useState(() => Date.now());

  // A new start (asked for again while it's open) opens the form again.
  useEffect(() => {
    if (start) setDraft(blank(start.name));
  }, [start]);

  // Ticking. (Every second, so the last day counts down like a clock.)
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const commit = (next: Countdown[]) => {
    setList(next);
    saveCountdowns(next);
  };

  const save = (d: Draft, end: number) => {
    const name = d.name.trim();
    const timed = !!d.time;
    if (d.id === null) {
      const made: Countdown = { id: crypto.randomUUID(), name, end, timed, created: Date.now() };
      // Already run out (a day gone by): nothing left to tell.
      if (end <= Date.now()) made.told = true;
      commit([...list, made]);
      engine()?.talk({ kind: "flavor", text: madeLine(made) });
    } else {
      commit(
        list.map((c) =>
          c.id === d.id
            ? { ...c, name, end, timed, told: end <= Date.now() ? (c.end === end ? c.told : true) : false }
            : c,
        ),
      );
    }
    setDraft(null);
  };

  const remove = (id: string) => {
    commit(list.filter((c) => c.id !== id));
    setDraft(null);
  };

  const shown = sorted(list, now);

  return (
    <div className="ck cd" role="dialog" aria-label="Countdowns">
      <div className="ck-head">
        <h2>Countdowns</h2>
        <button type="button" className="ck-x" aria-label="Close countdowns" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 7l10 10M17 7L7 17" />
          </svg>
        </button>
      </div>

      <div className="cd-list">
        {shown.length === 0 && !draft ? (
          <p className="cd-empty">Nothing to count down to yet. A birthday, a trip, the first day of summer: pick a day worth waiting for.</p>
        ) : null}
        {shown.map((c) =>
          draft?.id === c.id ? (
            <Form key={c.id} draft={draft} list={list} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} onDelete={() => remove(c.id)} />
          ) : (
            <Row key={c.id} c={c} now={now} onEdit={() => setDraft({ id: c.id, name: c.name, date: dateOf(c.end), time: c.timed ? timeOf(c.end) : "" })} />
          ),
        )}
        {draft && draft.id === null ? (
          <Form draft={draft} list={list} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} />
        ) : null}
      </div>

      {draft ? null : (
        <button type="button" className="ck-primary cd-new" onClick={() => setDraft(blank())}>
          New countdown
        </button>
      )}
    </div>
  );
}

function Row({ c, now, onEdit }: { c: Countdown; now: number; onEdit: () => void }) {
  const left = c.end - now;
  const done = left <= 0;
  return (
    <button type="button" className={`cd-row${done ? " is-done" : ""}`} onClick={onEdit} aria-label={`${c.name}: change it`}>
      <span className="cd-what">
        <span className="cd-name">{c.name}</span>
        <span className="cd-when">{endsOn(c)}</span>
      </span>
      <span className="cd-left">
        {done ? (
          <>
            <span className="cd-big">Here!</span>
            <span className="cd-small">{left > -60_000 ? "just now" : `${inWords(-left).split(" and ")[0]} ago`}</span>
          </>
        ) : (
          <>
            <span className="cd-big">{inShort(left)}</span>
            <span className="cd-small">to go</span>
          </>
        )}
      </span>
    </button>
  );
}

function Form({
  draft,
  list,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: Draft;
  list: Countdown[];
  onChange: (d: Draft) => void;
  onSave: (d: Draft, end: number) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [problem, setProblem] = useState<{ field: "name" | "date"; text: string } | null>(null);
  const [sure, setSure] = useState(false);
  const sureTimer = useRef<number | undefined>(undefined);
  const nameBox = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => () => window.clearTimeout(sureTimer.current), []);
  useEffect(() => {
    // In view (it may open at the bottom of a long list), then the name
    // first, unless there's one already.
    formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (!draft.name) nameBox.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (part: Partial<Draft>) => {
    setProblem(null);
    onChange({ ...draft, ...part });
  };

  const submit = () => {
    const wrongName = nameProblem(draft.name, list, draft.id);
    if (wrongName) return setProblem({ field: "name", text: wrongName });
    const end = whenOf(draft.date, draft.time);
    if (end === null) return setProblem({ field: "date", text: "Pick the day it counts down to." });
    // A new one has to be ahead of us; changing an old one, anything goes.
    if (draft.id === null && end <= Date.now()) {
      return setProblem({ field: "date", text: "That’s already gone by. Pick a day still to come." });
    }
    onSave(draft, end);
  };

  return (
    <form
      ref={formRef}
      className="cd-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <label className="cd-field">
        <span className="cd-label">Name</span>
        <input
          ref={nameBox}
          className="cd-input"
          value={draft.name}
          maxLength={60}
          placeholder="Birthday, the trip, summer…"
          onChange={(e) => set({ name: e.target.value })}
        />
        {problem?.field === "name" ? <span className="cd-problem">{problem.text}</span> : null}
      </label>
      <div className="cd-pair">
        <label className="cd-field">
          <span className="cd-label">Day</span>
          <input className="cd-input" type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <label className="cd-field cd-time">
          <span className="cd-label">Time (if it matters)</span>
          <input className="cd-input" type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} />
        </label>
      </div>
      {problem?.field === "date" ? <span className="cd-problem">{problem.text}</span> : null}
      <div className="cd-actions">
        <button type="submit" className="ck-primary">
          {draft.id === null ? "Start counting" : "Save"}
        </button>
        <button type="button" className="ck-secondary" onClick={onCancel}>
          Cancel
        </button>
        {onDelete ? (
          <button
            type="button"
            className={`ck-quiet cd-delete${sure ? " is-sure" : ""}`}
            onClick={() => {
              if (!sure) {
                setSure(true);
                sureTimer.current = window.setTimeout(() => setSure(false), 3000);
                return;
              }
              onDelete();
            }}
          >
            {sure ? "Delete it?" : "Delete"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
