import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { FaceEngine } from "@/components/companion/engine";
import {
  BYE,
  DELETE_RULES,
  FOLDER_JOBS,
  JOBS,
  NEXT,
  STOPPED,
  VIDEO_JOBS,
  describeRule,
  greet,
  parseSize,
  report,
  size,
  type JobId,
} from "@/components/companion/assistant";
import type { Pace } from "@/lib/companion/settings";
import {
  cancelJob,
  inspect,
  installTools,
  missingTools,
  onWork,
  previewDelete,
  startJob,
  type DeletePreview,
  type DeleteRule,
  type Finished,
  type Given,
  type Missing,
  type Progress,
  type Step,
} from "@/lib/companion/work";

// The conversation when you give Mote something to work on. Mote works out
// what it is and offers what they can do with it; you pick one, Mote does
// it and tells you how it went, then offers everything again until you say
// you're done. Like the cleaner script it grew from, every option has a
// number, and pressing that number picks it.

type Work =
  { folder: Extract<Given, { kind: "folder" }> } | { videos: Extract<Given, { kind: "videos" }> };

/** A job with its options settled, ready to run (a delete still needs its list). */
type Planned =
  | { id: Exclude<JobId, "delete" | "compress" | "trim-start" | "trim-end"> }
  | { id: "delete"; rule: DeleteRule }
  | { id: "compress"; method: "optimage" | "encode" }
  | { id: "trim-start" | "trim-end"; seconds: number };

type Phase =
  | { at: "closed" }
  | { at: "looking" }
  | { at: "menu" }
  | { at: "ask-delete"; forAll: boolean; need?: (typeof DELETE_RULES)[number] }
  | { at: "ask-compress"; forAll: boolean; rule?: DeleteRule | null }
  | { at: "ask-trim"; id: "trim-start" | "trim-end" }
  | { at: "confirm-delete"; preview: DeletePreview; rule: DeleteRule }
  | { at: "tools"; missing: Missing; job: Planned; optional: boolean }
  | { at: "installing" }
  | { at: "working"; label: string; progress: Progress | null }
  | { at: "bye" };

export type Gift = { paths: string[]; seq: number };

type Props = {
  engine: () => FaceEngine | null;
  pace: Pace;
  gift: Gift | null;
  onOpen: (open: boolean) => void;
};

export function Helper({ engine, pace, gift, onOpen }: Props) {
  const [phase, setPhase] = useState<Phase>({ at: "closed" });
  const [work, setWork] = useState<Work | null>(null);
  const [say, setSay] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [done, setDone] = useState<JobId[]>([]);
  const [field, setField] = useState("");
  // "Do all of these": the jobs still to go, and what each one did.
  const plan = useRef<Planned[]>([]);
  const summary = useRef<Array<{ text: string; issues: string[] }>>([]);
  const running = useRef<Planned | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const workRef = useRef(work);
  workRef.current = work;
  // Read when a job starts (the finished-job listener outlives renders).
  const paceRef = useRef(pace);
  paceRef.current = pace;

  const open = phase.at !== "closed";
  useEffect(() => onOpen(open), [open, onOpen]);

  const helping = (state: "busy" | "talking" | null) => engine()?.setHelping(state);

  const talk = (text: string, next: Phase, issues: string[] = []) => {
    setSay(text);
    setProblems(issues);
    setPhase(next);
    if (next.at !== "working" && next.at !== "closed") helping("talking");
  };

  const close = useCallback(() => {
    if (phaseRef.current.at === "working") return;
    plan.current = [];
    setPhase({ at: "closed" });
    setWork(null);
    helping(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Something new to work on. (Apps aren't work: Mote plays the game or has
  // something to say about the app, and the options go away.)
  useEffect(() => {
    if (!gift) return;
    const busy = phaseRef.current.at === "working" || phaseRef.current.at === "installing";
    if (gift.paths.some((p) => /\.app\/?$/i.test(p))) {
      void inspect(gift.paths).then((g) => {
        if (g.kind !== "app") return;
        if (!busy) close();
        engine()?.offerApp({ name: g.name, bundle: g.bundle, game: g.game });
      });
      return;
    }
    if (busy) {
      setProblems(["One thing at a time! I’m still busy with this."]);
      return;
    }
    setPhase({ at: "looking" });
    setSay("Ooh, what’s this?");
    setProblems([]);
    helping("talking");
    void inspect(gift.paths).then((g) => {
      engine()?.react(
        g.kind === "folder" ? "given-folder" : g.kind === "videos" ? "given-videos" : "given-other",
      );
      plan.current = [];
      setDone([]);
      if (g.kind === "app") {
        close();
        engine()?.offerApp({ name: g.name, bundle: g.bundle, game: g.game });
        return;
      }
      if (g.kind === "other") {
        setWork(null);
        talk(greet(g), { at: "bye" });
        return;
      }
      setWork(g.kind === "folder" ? { folder: g } : { videos: g });
      talk(greet(g), { at: "menu" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gift?.seq]);

  // Hearing how the running job goes.
  useEffect(
    () =>
      onWork({
        progress: (p) => {
          const ph = phaseRef.current;
          if (ph.at === "working") setPhase({ ...ph, progress: p });
        },
        finished: (f) => finished(f),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const stepFor = (job: Planned, files?: string[]): Step => {
    switch (job.id) {
      case "delete":
        return { step: "delete", list: files ?? [] };
      case "compress":
        return { step: "compress", method: job.method };
      case "trim-start":
      case "trim-end":
        return { step: job.id, seconds: job.seconds };
      default:
        return { step: job.id };
    }
  };

  /** Runs a job: checks its tools, asks before deleting, then goes. */
  const run = async (job: Planned, skipTools = false, deleteFiles?: string[]) => {
    const w = workRef.current;
    if (!w) return;
    if (!skipTools) {
      const missing = await missingTools(job.id, job.id === "compress" ? job.method : undefined);
      if (missing.formulas.length || missing.apps.length) {
        const optional = job.id === "archives";
        const needs = [...missing.formulas, ...missing.apps].join(" and ");
        if (missing.apps.length) {
          talk(
            `I need the *${missing.apps.join(", ")}* app for that, and it isn’t in your Applications folder.`,
            {
              at: "menu",
            },
          );
          plan.current = [];
          return;
        }
        if (!missing.brew) {
          talk(
            `I need *${needs}* for that, which comes from Homebrew, and Homebrew isn’t installed. Get it from brew.sh, then try me again!`,
            optional ? { at: "tools", missing, job, optional } : { at: "menu" },
          );
          if (!optional) plan.current = [];
          return;
        }
        talk(
          optional
            ? `To open rar, 7z and other kinds of archive I need *${needs}*. Shall I install it with Homebrew? (Without it I can still open zip and tar.)`
            : `I need *${needs}* for that. Shall I install it with Homebrew? It can take a minute or two.`,
          { at: "tools", missing, job, optional },
        );
        return;
      }
    }
    if (job.id === "delete" && !deleteFiles && "folder" in w) {
      setPhase({ at: "working", label: "Looking for matches…", progress: null });
      helping("busy");
      const preview = await previewDelete(w.folder.path, job.rule);
      if (!preview.count) {
        next(`No ${describeRule(job.rule)} in there, so nothing to delete.`);
        return;
      }
      talk(
        `I found ${preview.count.toLocaleString()} ${describeRule(job.rule)} (${size(preview.bytes)}). Delete ${preview.count === 1 ? "it" : "them"} for good? This can’t be undone.`,
        { at: "confirm-delete", preview, rule: job.rule },
      );
      return;
    }
    running.current = job;
    setPhase({ at: "working", label: JOBS[job.id].doing, progress: null });
    setSay(JOBS[job.id].doing);
    setProblems([]);
    helping("busy");
    try {
      await startJob({
        ...stepFor(job, deleteFiles),
        pace: paceRef.current,
        ...("folder" in w ? { folder: w.folder.path } : { files: w.videos.paths }),
      });
    } catch (e) {
      running.current = null;
      engine()?.jobDone(false);
      plan.current = [];
      talk(String(e), { at: "menu" });
    }
  };

  /** After a job (or a skipped one): the next in the plan, or back to the menu. */
  const next = (text: string, issues: string[] = []) => {
    const queued = plan.current.shift();
    if (queued) {
      summary.current.push({ text, issues });
      void run(queued);
      return;
    }
    if (summary.current.length) {
      const all = [...summary.current, { text, issues }];
      summary.current = [];
      talk(`All done! ${pickOne(NEXT)}`, { at: "menu" }, [
        ...all.map((s) => `• ${plain(s.text)}`),
        ...all.flatMap((s) => s.issues),
      ]);
      return;
    }
    talk(`${text} ${pickOne(NEXT)}`, { at: "menu" }, issues);
  };

  const finished = (f: Finished) => {
    const job = running.current;
    running.current = null;
    if (!job) return;
    if (f.cancelled) {
      plan.current = [];
      summary.current = [];
      engine()?.jobDone(false);
      talk(`${pickOne(STOPPED)} ${pickOne(NEXT)}`, { at: "menu" });
      return;
    }
    engine()?.jobDone(f.ok);
    setDone((d) => (d.includes(job.id) ? d : [...d, job.id]));
    const r = f.report;
    const text = r
      ? report(job.id, r, "seconds" in job ? job.seconds : undefined)
      : (f.error ?? "Done!");
    next(text, r?.problems ?? []);
  };

  // ── Choosing ────────────────────────────────────────────────────────

  const choose = (id: JobId | "all" | "done") => {
    if (id === "done") {
      talk(pickOne(BYE), { at: "bye" });
      window.setTimeout(() => phaseRef.current.at === "bye" && close(), 2200);
      return;
    }
    setField("");
    if (id === "all") {
      talk("All of it! First: should I delete anything along the way?", {
        at: "ask-delete",
        forAll: true,
      });
      return;
    }
    if (id === "delete") talk("Which files should I delete?", { at: "ask-delete", forAll: false });
    else if (id === "compress")
      talk("Smaller files, or better quality?", { at: "ask-compress", forAll: false });
    else if (id === "trim-start" || id === "trim-end")
      talk(`How many seconds off the ${id === "trim-start" ? "start" : "end"}?`, {
        at: "ask-trim",
        id,
      });
    else void run({ id });
  };

  const chooseRule = (rule: DeleteRule | null, forAll: boolean) => {
    if (forAll) {
      talk("And how should I compress things at the end?", {
        at: "ask-compress",
        forAll: true,
        rule,
      });
    } else if (rule) void run({ id: "delete", rule });
  };

  const chooseCompress = (
    method: "optimage" | "encode",
    ph: Extract<Phase, { at: "ask-compress" }>,
  ) => {
    if (!ph.forAll) {
      void run({ id: "compress", method });
      return;
    }
    plan.current = FOLDER_JOBS.flatMap((id): Planned[] => {
      if (id === "delete") return ph.rule ? [{ id, rule: ph.rule }] : [];
      if (id === "compress") return [{ id, method }];
      return [{ id }];
    });
    summary.current = [];
    const first = plan.current.shift();
    if (first) void run(first);
  };

  // ── What's on screen ─────────────────────────────────────────────────

  type Option = {
    key: string;
    label: string;
    hint?: string;
    tone?: "danger" | "quiet";
    done?: boolean;
    act: () => void;
  };
  let options: Option[] = [];
  let form: ReactNode = null;
  const w = work;

  if (phase.at === "menu" && w) {
    const jobs = "folder" in w ? FOLDER_JOBS : VIDEO_JOBS;
    options = [
      ...("folder" in w
        ? [
            {
              key: "all",
              label: "Do all of these",
              hint: "In this order, top to bottom",
              act: () => choose("all"),
            },
          ]
        : []),
      ...jobs.map((id) => ({
        key: id,
        label: JOBS[id].label,
        hint: JOBS[id].hint,
        done: done.includes(id),
        act: () => choose(id),
      })),
      { key: "done", label: "Done", tone: "quiet" as const, act: () => choose("done") },
    ];
  } else if (phase.at === "ask-delete") {
    const ph = phase;
    if (ph.need) {
      const need = ph.need;
      const ruleFrom = (): DeleteRule | null => {
        const t = field.trim();
        if (need.needs === "size") {
          const bytes = parseSize(t);
          return bytes ? ({ kind: need.rule, bytes } as DeleteRule) : null;
        }
        if (need.needs === "days") {
          const days = Number.parseInt(t, 10);
          return days > 0 ? ({ kind: need.rule, days } as DeleteRule) : null;
        }
        if (need.needs === "extensions") {
          const list = t
            .split(/[\s,]+/)
            .map((e) => e.replace(/^\.+/, "").toLowerCase())
            .filter(Boolean);
          return list.length ? { kind: "extensions", list } : null;
        }
        return t ? { kind: "name-contains", text: t.toLowerCase() } : null;
      };
      const rule = ruleFrom();
      form = (
        <form
          className="helper-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (rule) chooseRule(rule, ph.forAll);
          }}
        >
          <input
            autoFocus
            className="helper-input"
            value={field}
            onChange={(e) => setField(e.target.value)}
            placeholder={
              need.needs === "size"
                ? "like 500MB or 2GB"
                : need.needs === "days"
                  ? "number of days"
                  : need.needs === "extensions"
                    ? "like mov, webm, gif"
                    : "some text"
            }
            aria-label={need.label}
          />
          <button type="submit" className="helper-go" disabled={!rule}>
            OK
          </button>
        </form>
      );
      options = [
        {
          key: "back",
          label: "Back",
          tone: "quiet",
          act: () => setPhase({ at: "ask-delete", forAll: ph.forAll }),
        },
      ];
    } else {
      options = [
        ...(ph.forAll
          ? [{ key: "none", label: "Don’t delete anything", act: () => chooseRule(null, true) }]
          : []),
        ...DELETE_RULES.map((d) => ({
          key: d.rule,
          label: d.label,
          tone: d.rule === "everything" ? ("danger" as const) : undefined,
          act: () => {
            if (d.needs) {
              setField("");
              const asks = {
                size: "How big?",
                days: "How many days?",
                extensions: "Which endings?",
                text: "What text?",
              };
              talk(asks[d.needs], { at: "ask-delete", forAll: ph.forAll, need: d });
            } else chooseRule({ kind: d.rule } as DeleteRule, ph.forAll);
          },
        })),
        {
          key: "back",
          label: "Never mind",
          tone: "quiet",
          act: () => talk(pickOne(NEXT), { at: "menu" }),
        },
      ];
    }
  } else if (phase.at === "ask-compress") {
    const ph = phase;
    options = [
      {
        key: "encode",
        label: "Smaller files",
        hint: "Pictures to AVIF, videos to AV1. A bit lower quality",
        act: () => chooseCompress("encode", ph),
      },
      {
        key: "optimage",
        label: "Better quality",
        hint: "Optimage, at its own settings. Bigger files",
        act: () => chooseCompress("optimage", ph),
      },
      {
        key: "back",
        label: "Never mind",
        tone: "quiet",
        act: () => talk(pickOne(NEXT), { at: "menu" }),
      },
    ];
  } else if (phase.at === "ask-trim") {
    const ph = phase;
    const seconds = Number.parseFloat(field);
    const go = (s: number) => void run({ id: ph.id, seconds: s });
    form = (
      <form
        className="helper-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (seconds > 0) go(seconds);
        }}
      >
        <input
          autoFocus
          className="helper-input"
          inputMode="decimal"
          value={field}
          onChange={(e) => setField(e.target.value)}
          placeholder="seconds, like 10 or 3.5"
          aria-label="Seconds"
        />
        <button type="submit" className="helper-go" disabled={!(seconds > 0)}>
          OK
        </button>
      </form>
    );
    options = [
      ...[2, 5, 10, 30].map((s) => ({ key: `s${s}`, label: `${s} seconds`, act: () => go(s) })),
      {
        key: "back",
        label: "Never mind",
        tone: "quiet" as const,
        act: () => talk(pickOne(NEXT), { at: "menu" }),
      },
    ];
  } else if (phase.at === "confirm-delete") {
    const ph = phase;
    options = [
      {
        key: "yes",
        label: `Delete ${ph.preview.count.toLocaleString()} file${ph.preview.count === 1 ? "" : "s"}`,
        tone: "danger",
        act: () => void run({ id: "delete", rule: ph.rule }, true, ph.preview.files),
      },
      {
        key: "no",
        label: "Don’t delete them",
        tone: "quiet",
        act: () => next("Okay, I didn’t delete anything."),
      },
    ];
  } else if (phase.at === "tools") {
    const ph = phase;
    options = [
      ...(ph.missing.brew
        ? [
            {
              key: "install",
              label: `Install ${ph.missing.formulas.join(" and ")}`,
              act: () => {
                setPhase({ at: "installing" });
                setSay(`Installing ${ph.missing.formulas.join(" and ")}… (this can take a minute)`);
                helping("busy");
                installTools(ph.missing.formulas)
                  .then(() => run(ph.job))
                  .catch((e) => {
                    plan.current = [];
                    engine()?.jobDone(false);
                    talk(`That didn’t work: ${String(e)}`, { at: "menu" });
                  });
              },
            },
          ]
        : []),
      ...(ph.optional
        ? [{ key: "without", label: "Carry on without it", act: () => void run(ph.job, true) }]
        : []),
      {
        key: "back",
        label: "Never mind",
        tone: "quiet" as const,
        act: () => {
          plan.current = [];
          summary.current = [];
          talk(pickOne(NEXT), { at: "menu" });
        },
      },
    ];
  } else if (phase.at === "working") {
    options = [{ key: "stop", label: "Stop", tone: "quiet", act: () => void cancelJob() }];
  } else if (phase.at === "bye") {
    options = [{ key: "ok", label: "Okay", tone: "quiet", act: close }];
  }

  // Number keys pick options, like the terminal version; Escape closes.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") close();
      const n = Number.parseInt(e.key, 10);
      const opt = Number.isNaN(n) ? null : optionsRef.current[n === 0 ? 9 : n - 1];
      if (opt) {
        e.preventDefault();
        opt.act();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;
  const progress = phase.at === "working" ? phase.progress : null;
  const pct = progress ? Math.min(100, (progress.done / Math.max(1, progress.total)) * 100) : null;

  return (
    <>
      <span className="helper-tail" aria-hidden="true" />
      <section className={`helper is-${phase.at}`} aria-label="Mote is helping" aria-live="polite">
        {phase.at !== "working" && phase.at !== "installing" ? (
          <button type="button" className="helper-close" aria-label="Close" onClick={close}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        ) : null}
        <p className="helper-say">{emphasise(say)}</p>
        {problems.length ? (
          <ul className="helper-problems">
            {problems.map((p, i) => (
              <li key={i}>{emphasise(p)}</li>
            ))}
          </ul>
        ) : null}
        {phase.at === "confirm-delete" ? (
          <ul className="helper-problems is-examples">
            {phase.preview.examples.map((e) => (
              <li key={e}>{e}</li>
            ))}
            {phase.preview.count > phase.preview.examples.length ? (
              <li>
                …and {(phase.preview.count - phase.preview.examples.length).toLocaleString()} more
              </li>
            ) : null}
          </ul>
        ) : null}
        {phase.at === "working" || phase.at === "installing" ? (
          <div className="helper-progress">
            <div className="helper-bar" data-busy={pct === null ? "" : undefined}>
              <span style={{ width: pct === null ? undefined : `${pct}%` }} />
            </div>
            <span className="helper-progress-label">
              {progress
                ? `${progress.label} · ${progress.done.toLocaleString()}/${progress.total.toLocaleString()}`
                : " "}
            </span>
          </div>
        ) : null}
        {form}
        {options.length ? (
          <ol className="helper-options">
            {options.map((o, i) => (
              <li key={o.key}>
                <button
                  type="button"
                  className={`helper-option${o.tone ? ` is-${o.tone}` : ""}${o.done ? " is-done" : ""}`}
                  onClick={o.act}
                >
                  <span className="helper-num" aria-hidden="true">
                    {i < 9 ? i + 1 : i === 9 ? 0 : ""}
                  </span>
                  <span className="helper-label">
                    <span>
                      {o.label}
                      {o.done ? <span className="helper-tick"> ✓</span> : null}
                    </span>
                    {o.hint ? <span className="helper-hint">{o.hint}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </>
  );
}

function pickOne<T>(xs: T[]) {
  return xs[Math.floor(Math.random() * xs.length)];
}

const plain = (t: string) => t.replace(/\*/g, "");

/** `*word*` shown emphasised. */
function emphasise(text: string): ReactNode[] {
  return text
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part, i) =>
      part.startsWith("*") && part.endsWith("*") ? (
        <em key={i}>{part.slice(1, -1)}</em>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
}
