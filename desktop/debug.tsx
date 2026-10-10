import { StrictMode, useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  ACCESSORY_MOODS,
  MOOD_LIST,
  POSE_KEYS,
  REST,
  type EngineSnapshot,
  type ManualFace,
  type Mood,
  type Pose,
} from "@/components/companion/engine";
import {
  DEBUG_DEFAULTS,
  listenBus,
  send,
  type DebugCommand,
  type DebugState,
} from "@/lib/companion/bus";
import { ATTRS, LASTING_MOODS, type Attr } from "@/components/companion/mind";
import { REACTION_GROUPS, REACTIONS, type Reaction } from "@/components/companion/reactions";
import { LINES, type BubbleKind } from "@/components/companion/speech";
import { DEFAULT_SETTINGS, useSettings, type Settings } from "@/lib/companion/settings";
import { Button, Page, Row, Section, Segmented, Slider, Toggle } from "./ui";

// The debug window. Each tab is one entry in TABS, so new tools slot in as
// their own tab without touching the others.

type LogEntry = { id: number; at: number; text: string };

type Ctx = {
  snap: EngineSnapshot | null;
  debug: DebugState;
  command: (cmd: DebugCommand) => void;
  log: LogEntry[];
  clearLog: () => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  /** The hand-set face, kept here so it survives switching tabs. */
  face: ManualFace;
  setFace: (face: ManualFace) => void;
};

const TABS: Array<{ id: string; label: string; render: (ctx: Ctx) => ReactNode }> = [
  { id: "moods", label: "Moods", render: (ctx) => <MoodsTab {...ctx} /> },
  { id: "mind", label: "Mind", render: (ctx) => <MindTab {...ctx} /> },
  { id: "speech", label: "Speech", render: (ctx) => <SpeechTab {...ctx} /> },
  { id: "pose", label: "Pose", render: (ctx) => <PoseTab {...ctx} /> },
  { id: "motion", label: "Motion", render: (ctx) => <MotionTab {...ctx} /> },
  { id: "log", label: "Log", render: (ctx) => <LogTab {...ctx} /> },
  { id: "data", label: "Data", render: (ctx) => <DataTab {...ctx} /> },
];

const MOOD_NAMES: Record<Mood, string> = {
  settle: "Resting",
  glance: "Glance",
  think: "Think",
  frustrate: "Grumpy",
  cute: "Cute",
  delight: "Delight",
  surprise: "Surprise",
  doze: "Doze",
  sleep: "Sleep",
  wake: "Wake up",
  sniffle: "Sniffle",
  twirl: "Twirl",
  flutter: "Flutter",
  listen: "Listen",
  groove: "Groove",
  flick: "Ear flick",
  dizzy: "Dizzy",
  purr: "Purr",
  huff: "Huff",
  sulk: "Sulk",
  yawn: "Yawn",
  fidget: "Fidget",
  hum: "Hum",
  checkin: "Check in",
  startle: "Startled awake",
};

const TAB_KEY = "mote.debug.tab";

function readTab() {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return TABS.some((x) => x.id === t) ? (t as string) : "moods";
  } catch {
    return "moods";
  }
}

function DebugWindow() {
  const [snap, setSnap] = useState<EngineSnapshot | null>(null);
  const [debug, setDebug] = useState<DebugState>(DEBUG_DEFAULTS);
  const [lastSeen, setLastSeen] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [log, setLog] = useState<LogEntry[]>([]);
  const [tab, setTab] = useState(readTab);
  const [settings, updateSettings] = useSettings();
  const opened = useRef(Date.now());
  const nextId = useRef(0);
  const prevSettings = useRef<Settings | null>(null);
  const pending = useRef<Partial<DebugState>>({});
  const [face, setFace] = useState<ManualFace>(restFace);

  const addLog = (texts: string[]) => {
    if (!texts.length) return;
    const at = (Date.now() - opened.current) / 1000;
    setLog((old) =>
      [...texts.map((text) => ({ id: nextId.current++, at, text })).reverse(), ...old].slice(0, 400),
    );
  };

  useEffect(() => {
    const stop = listenBus((msg) => {
      if (msg.type === "state") {
        setSnap(msg.snap);
        // Keep what we just asked for until Mote's window confirms it.
        const merged = { ...msg.debug, ...pending.current };
        for (const k of Object.keys(pending.current) as Array<keyof DebugState>) {
          if (msg.debug[k] === pending.current[k]) delete pending.current[k];
        }
        setDebug(merged);
        setLastSeen(Date.now());
        addLog(msg.events);
      }
    });
    send({ type: "debug", cmd: { do: "hello" } });
    const tick = window.setInterval(() => setNow(Date.now()), 500);
    return () => {
      stop();
      window.clearInterval(tick);
    };
  }, []);

  // Note setting changes in the log, whichever window made them.
  useEffect(() => {
    const prev = prevSettings.current;
    prevSettings.current = settings;
    if (!prev) return;
    const changes = (Object.keys(settings) as Array<keyof Settings>)
      .filter((k) => prev[k] !== settings[k])
      .map((k) => `setting ${k} → ${String(settings[k])}`);
    addLog(changes);
  }, [settings]);

  const command = (cmd: DebugCommand) => {
    const local: Partial<DebugState> = {};
    if (cmd.do === "timeScale") local.timeScale = cmd.value;
    if (cmd.do === "frozen") local.frozen = cmd.value;
    if (cmd.do === "autoMoods") local.autoMoods = cmd.value;
    if (cmd.do === "loop") local.loop = cmd.value;
    if (cmd.do === "guides") local.guides = cmd.value;
    if (cmd.do === "sleepLine") local.sleepLine = cmd.value;
    if (cmd.do === "fakeAudio") local.fakeAudio = cmd.value;
    if (cmd.do === "fakeKind") local.fakeKind = cmd.value;
    if (cmd.do === "manual") local.manual = cmd.face !== null;
    Object.assign(pending.current, local);
    setDebug((d) => ({ ...d, ...local }));
    send({ type: "debug", cmd });
  };

  const connected = now - lastSeen < 1500;
  const ctx: Ctx = {
    snap,
    debug,
    command,
    log,
    clearLog: () => setLog([]),
    settings,
    updateSettings,
    face,
    setFace,
  };
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <Page wide>
      <header className="debug-header">
        <div>
          <h1>Debug</h1>
          <p>{connected ? "Connected to Mote" : "Waiting for Mote’s window…"}</p>
        </div>
        <div className="chips">
          <span className={`chip is-mood${connected ? "" : " is-off"}`}>
            <span className="chip-dot" />
            {snap ? MOOD_NAMES[snap.mood] : "—"}
          </span>
          <span className="chip mono">{snap ? `${(snap.moodMs / 1000).toFixed(1)}s` : "—"}</span>
          <span className="chip mono">{snap ? `${Math.round(snap.fps)} fps` : "—"}</span>
        </div>
      </header>

      <Segmented
        label="Debug section"
        options={TABS.map((t) => ({ value: t.id, label: t.label }))}
        value={current.id}
        onChange={(id) => {
          setTab(id);
          try {
            localStorage.setItem(TAB_KEY, id);
          } catch {
            // Fine: the tab just won't be remembered.
          }
        }}
      />

      {current.render(ctx)}
    </Page>
  );
}

/* Moods */

function MoodsTab({ snap, debug, command, settings, updateSettings }: Ctx) {
  const accessories = [
    {
      key: "mustache",
      title: "Mustache",
      wear: "Bushy mustache",
      about: "Mote twirls it, blows on it, and sometimes nearly sneezes.",
    },
    {
      key: "headphones",
      title: "Headphones",
      wear: "Cat-ear headphones",
      about: "Mote listens for sounds and bops along to music.",
    },
  ] as const;
  return (
    <>
      <Section title="Play a mood">
        <div className="mood-grid">
          {MOOD_LIST.map((m) => (
            <Button
              key={m}
              active={snap?.mood === m}
              onClick={() => command({ do: "force", mood: m })}
            >
              {MOOD_NAMES[m]}
            </Button>
          ))}
        </div>
      </Section>
      {accessories.map((a) => (
        <Section key={a.key} title={a.title}>
          <Row
            label={a.wear}
            hint={settings[a.key] ? a.about : `${a.about} Off right now, so its moods play unseen.`}
          >
            <Toggle
              label={a.wear}
              checked={settings[a.key]}
              onChange={(on) => updateSettings({ [a.key]: on })}
            />
          </Row>
          <div className="mood-grid">
            {ACCESSORY_MOODS[a.key].map((m) => (
              <Button key={m} active={snap?.mood === m} onClick={() => command({ do: "force", mood: m })}>
                {MOOD_NAMES[m]}
              </Button>
            ))}
          </div>
        </Section>
      ))}
      <Section title="Quick actions">
        <div className="button-row">
          <Button onClick={() => command({ do: "blink", double: false })}>Blink</Button>
          <Button onClick={() => command({ do: "blink", double: true })}>Double blink</Button>
          <Button onClick={() => command({ do: "poke" })}>Poke</Button>
        </div>
      </Section>
      <Section title="Behaviour">
        <Row label="Automatic moods" hint="Let Mote pick moods on their own.">
          <Toggle
            label="Automatic moods"
            checked={debug.autoMoods}
            onChange={(value) => command({ do: "autoMoods", value })}
          />
        </Row>
        <Row label="Loop the current mood" hint="Replays it each time it ends.">
          <Toggle
            label="Loop the current mood"
            checked={debug.loop}
            onChange={(value) => command({ do: "loop", value })}
          />
        </Row>
        <Row label="Flat sleeping eyes" hint="Sleep with plain straight lines instead of the curved eyes.">
          <Toggle
            label="Flat sleeping eyes"
            checked={debug.sleepLine}
            onChange={(value) => command({ do: "sleepLine", value })}
          />
        </Row>
      </Section>
    </>
  );
}

/* Mind */

const ATTR_NAME: Record<Attr, string> = { happy: "Happy", restless: "Restless", alert: "Alert" };

// Soft colours for each end of a feeling's track.
const TINT: Record<Attr, [string, string]> = {
  happy: ["#e7b7a2", "#b9cfa0"],
  restless: ["#b9cbd9", "#e9c08f"],
  alert: ["#c9bfdc", "#ead48f"],
};

const seconds = (ms: number) => `${Math.max(0, Math.ceil(ms / 1000))}s`;

const KIND_LABEL: Record<string, string> = {
  music: "music",
  speech: "talking",
  video: "a video",
  unknown: "something (can’t tell what)",
};

function MindTab({ snap, command, debug }: Ctx) {
  const [show, setShow] = useState<"all" | "live" | "idea">("all");
  if (!snap) return <p className="empty">Nothing yet. Is Mote’s window open?</p>;
  const asleep = snap.mood === "sleep";
  const list = REACTIONS.filter((r) => show === "all" || r.status === show);
  return (
    <>
      <Section title="Feelings">
        {ATTRS.map((a) => {
          const v = snap.mind[a.key];
          const note =
            a.key === "alert"
              ? asleep
                ? `Resting: recharges in ${seconds(snap.driftIn.alert)}`
                : `Wears off a step in ${seconds(snap.driftIn.alert)}`
              : v === a.toward
                ? "At rest"
                : `Settles a step toward 5 in ${seconds(snap.driftIn[a.key])}`;
          return (
            <div key={a.key} className="meter">
              <div className="meter-top">
                <span>{a.low}</span>
                <span className="mono meter-value">{v.toFixed(1)}</span>
                <span>{a.high}</span>
              </div>
              <div
                className="meter-track"
                style={{
                  ["--v" as string]: `${v * 10}%`,
                  ["--lo" as string]: TINT[a.key][0],
                  ["--hi" as string]: TINT[a.key][1],
                }}
              >
                <span className="meter-mid" />
                <span className="meter-dot" />
              </div>
              <div className="meter-foot">
                <span className="meter-note">{note}</span>
                <span className="meter-buttons">
                  <Button onClick={() => command({ do: "feeling", attr: a.key, value: v - 1 })}>−1</Button>
                  <Button onClick={() => command({ do: "feeling", attr: a.key, value: v + 1 })}>+1</Button>
                </span>
              </div>
            </div>
          );
        })}
        <div className="button-row">
          <Button onClick={() => command({ do: "resetFeelings" })}>All back to 5</Button>
        </div>
      </Section>

      <Section title="Interest">
        <Row
          label={
            snap.intrigued.length
              ? `Intrigued by ${snap.intrigued
                  .map((i) => (i === "media" ? "what’s playing" : i === "you" ? "you" : "your pointer"))
                  .join(" and ")}`
              : "Not intrigued by anything"
          }
          hint={
            snap.focus
              ? `Looking at ${snap.focus === "media" ? "what’s playing" : "your pointer"} right now.`
              : snap.intrigued.includes("you")
                ? "You’ve been using Mote’s window: fewer random moods, no getting tired."
                : "Doing their own thing. Alertness slowly wears off."
          }
        >
          <span className={`chip ${snap.intrigued.length ? "is-mood" : "is-off"}`}>
            <span className="chip-dot" />
            {snap.intrigued.length ? "On" : "Off"}
          </span>
        </Row>
        {snap.media ? (
          <Row
            label={`Playing: ${KIND_LABEL[snap.media.kind]}`}
            hint={[
              snap.nowPlaying ? `“${snap.nowPlaying}”` : null,
              snap.media.bpm ? `${Math.round(snap.media.bpm)} beats a minute` : null,
              `loudness ${Math.round(snap.media.intensity * 100)}%`,
              snap.dancing > 0.05 ? `dancing ${Math.round(snap.dancing * 100)}%` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            <span className="chip is-mood">
              <span className="chip-dot" />
              {snap.media.app ?? "Media"}
            </span>
          </Row>
        ) : null}
        {debug.permission === false ? (
          <p className="empty">
            Mote doesn’t have the Screen Recording permission, so they can tell where sound is coming
            from but not whether it’s music, talk or video, or what it’s called. You can allow it in
            System Settings → Privacy &amp; Security → Screen &amp; System Audio Recording.
          </p>
        ) : null}
      </Section>

      <Section title="Remembered media">
        {snap.memories.length ? (
          <>
            {snap.memories.slice(0, 20).map((m) => (
              <div key={m.key} className="memory">
                <div className="memory-text">
                  <span className="row-label">{m.name}</span>
                  <span className="row-hint">
                    {m.app ? `${m.app} · ` : ""}
                    {m.times}× ·{" "}
                    {m.score >= 2 ? "likes it" : m.score <= -2 ? "dislikes it" : "no strong feelings"}
                  </span>
                </div>
                <div className="memory-bar" style={{ ["--s" as string]: `${50 + (m.score / 6) * 50}%` }}>
                  <span />
                </div>
                <button type="button" className="link" onClick={() => command({ do: "forget", key: m.key })}>
                  Forget
                </button>
              </div>
            ))}
            <div className="button-row">
              <Button onClick={() => command({ do: "forget" })}>Forget everything</Button>
            </div>
          </>
        ) : (
          <p className="empty">Nothing yet. Things Mote watches or listens to with you show up here.</p>
        )}
      </Section>

      <Section title="Lasting moods">
        <div className="chips mood-chips">
          {snap.moods.length ? (
            snap.moods.map((m) => (
              <span key={m} className="chip is-mood">
                <span className="chip-dot" />
                {LASTING_MOODS.find((x) => x.id === m)?.label}
              </span>
            ))
          ) : (
            <span className="empty">None right now. Mote feels pretty even.</span>
          )}
        </div>
      </Section>

      <div className="reaction-head">
        <h2 className="section-title">Reactions</h2>
        <Segmented
          label="Which reactions"
          options={[
            { value: "all", label: "All" },
            { value: "live", label: "Built" },
            { value: "idea", label: "Ideas" },
          ]}
          value={show}
          onChange={setShow}
        />
      </div>
      {REACTION_GROUPS.map((g) => {
        const rows = list.filter((r) => r.group === g);
        if (!rows.length) return null;
        return (
          <Section key={g} title={g}>
            {rows.map((r) => (
              <ReactionRow
                key={r.id}
                r={r}
                fired={snap.reactions[r.id]}
                onApply={() => command({ do: "react", id: r.id })}
              />
            ))}
          </Section>
        );
      })}
    </>
  );
}

function ReactionRow({
  r,
  fired,
  onApply,
}: {
  r: Reaction;
  fired?: { count: number; ago: number };
  onApply: () => void;
}) {
  const recent = fired && fired.ago < 1500;
  const effects = Object.entries(r.effects ?? {}) as Array<[Attr, number]>;
  return (
    <div className={`reaction${recent ? " is-recent" : ""}${r.status === "idea" ? " is-idea" : ""}`}>
      <div className="reaction-title">
        <span className="row-label">{r.name}</span>
        <span className={`tag is-${r.status}`}>{r.status === "live" ? "Built" : "Idea"}</span>
      </div>
      <div className="reaction-rule">
        <span className="reaction-word">When</span> {r.when}
      </div>
      <div className="reaction-rule">
        <span className="reaction-word">Then</span> {r.then}
      </div>
      {effects.length || fired ? (
        <div className="reaction-foot">
          {effects.map(([k, n]) => (
            <span key={k} className="effect">
              {ATTR_NAME[k]} {n > 0 ? "↑" : "↓"} {Math.abs(n)}
            </span>
          ))}
          {fired ? (
            <span className="mono reaction-count">
              {fired.count}× · {seconds(fired.ago)} ago
            </span>
          ) : null}
          {effects.length && r.status === "live" ? (
            <button type="button" className="link" onClick={onApply}>
              Apply its feelings
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* Speech */

const KIND_NAME: Record<BubbleKind, string> = {
  flavor: "Remark",
  ask: "Question",
  move: "Move me",
  pet: "Pet me",
};

function SpeechTab({ snap, command }: Ctx) {
  if (!snap) return <p className="empty">Nothing yet. Is Mote’s window open?</p>;
  const groups = [...new Set(LINES.map((l) => l.group))];
  return (
    <>
      <Section title="Right now">
        <Row
          label={snap.speech ? `“${snap.speech.text.replace(/\*/g, "")}”` : "Not saying anything"}
          hint={
            snap.speech
              ? `${KIND_NAME[snap.speech.kind]}${snap.speech.reply ? " (a reply)" : ""}`
              : `Might say something in about ${seconds(snap.nextSpeechIn)}`
          }
        >
          <Button onClick={() => command({ do: "say" })}>Say something</Button>
        </Row>
      </Section>
      {groups.map((g) => (
        <Section key={g} title={g}>
          {LINES.filter((l) => l.group === g).map((l) => {
            const options = typeof l.say === "function" ? null : l.say;
            return (
              <div key={l.id} className="reaction">
                <div className="reaction-title">
                  <span className="row-label">{options ? `“${options[0]}”` : l.id}</span>
                  <span className="tag is-idea">{KIND_NAME[l.kind]}</span>
                </div>
                {options && options.length > 1 ? (
                  <div className="reaction-rule">
                    <span className="reaction-word">Or</span>
                    {options.slice(1).map((o) => `“${o}”`).join("  ")}
                  </div>
                ) : null}
                {l.replies ? (
                  <div className="reaction-rule">
                    <span className="reaction-word">Then</span>
                    {Object.entries(l.replies)
                      .map(([k, v]) => `${k}: “${v?.[0]}”`)
                      .join("  ·  ")}
                  </div>
                ) : null}
                <div className="reaction-foot">
                  <button type="button" className="link" onClick={() => command({ do: "say", id: l.id })}>
                    Say it now
                  </button>
                </div>
              </div>
            );
          })}
        </Section>
      ))}
    </>
  );
}

/* Pose */

const RANGES: Partial<Record<keyof Pose, [number, number]>> = {
  x: [-20, 20],
  y: [-20, 20],
  rot: [-15, 15],
  sx: [0.8, 1.2],
  sy: [0.8, 1.2],
  open: [0, 1.4],
  wide: [0.6, 1.4],
  openBias: [-0.5, 0.5],
  lid: [-0.3, 1],
  lidTilt: [-1, 1],
  lidCurve: [-0.5, 0.5],
  lidBias: [-0.5, 0.5],
  cheek: [-0.2, 1],
  cheekTilt: [-1, 1],
  cheekCurve: [-0.5, 1],
  cheekBias: [-0.5, 0.5],
  winkL: [0, 1],
  winkR: [0, 1],
  earPerk: [-1, 1.5],
  earTiltL: [-30, 30],
  earTiltR: [-30, 30],
  cupPulse: [0, 1],
  mLift: [-1, 1],
  mCurl: [0, 1],
  mPuff: [-0.5, 1],
  mRuffle: [0, 1],
  mFlutter: [0, 1],
  mShift: [-1, 1],
};

const GROUPS: Array<{ title: string; keys: Array<keyof Pose> }> = [
  { title: "Eyes", keys: ["open", "wide", "openBias", "winkL", "winkR"] },
  { title: "Brow cut", keys: ["lid", "lidTilt", "lidCurve", "lidBias"] },
  { title: "Cheek cut", keys: ["cheek", "cheekTilt", "cheekCurve", "cheekBias"] },
  { title: "Body", keys: ["x", "y", "rot", "sx", "sy"] },
  { title: "Headphones", keys: ["earPerk", "earTiltL", "earTiltR", "cupPulse"] },
  { title: "Mustache", keys: ["mLift", "mCurl", "mPuff", "mRuffle", "mFlutter", "mShift"] },
];

const restFace = (): ManualFace => ({ pose: { ...REST }, gazeX: 0, gazeY: 0, blink: 0 });

function PoseTab({ snap, debug, command, face, setFace }: Ctx) {
  const [copied, setCopied] = useState(false);

  const apply = (next: ManualFace) => {
    setFace(next);
    command({ do: "manual", face: next });
  };
  const fromCurrent = (): ManualFace =>
    snap
      ? { pose: { ...snap.pose }, gazeX: snap.gazeX, gazeY: snap.gazeY, blink: 0 }
      : restFace();
  const setKey = (key: keyof Pose, value: number) =>
    apply({ ...face, pose: { ...face.pose, [key]: value } });

  const copy = () => {
    const out: Record<string, number> = {};
    for (const k of POSE_KEYS) {
      if (Math.abs(face.pose[k] - REST[k]) > 0.005) out[k] = Number(face.pose[k].toFixed(2));
    }
    if (face.gazeX || face.gazeY) {
      out.gazeX = Number(face.gazeX.toFixed(2));
      out.gazeY = Number(face.gazeY.toFixed(2));
    }
    void navigator.clipboard?.writeText(JSON.stringify(out, null, 2)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <>
      <Section>
        <Row label="Pose by hand" hint="Freezes Mote and lets the sliders shape their face.">
          <Toggle
            label="Pose by hand"
            checked={debug.manual}
            onChange={(on) => {
              if (on) apply(fromCurrent());
              else command({ do: "manual", face: null });
            }}
          />
        </Row>
      </Section>
      {debug.manual ? (
        <>
          <div className="button-row">
            <Button onClick={() => apply(fromCurrent())}>Grab current face</Button>
            <Button onClick={() => apply(restFace())}>Back to rest</Button>
            <Button tone="accent" onClick={copy}>
              {copied ? "Copied!" : "Copy values"}
            </Button>
          </div>
          <Section title="Gaze">
            <div className="slider-grid">
              <Slider label="look x" min={-1} max={1} value={face.gazeX} onChange={(gazeX) => apply({ ...face, gazeX })} />
              <Slider label="look y" min={-1} max={1} value={face.gazeY} onChange={(gazeY) => apply({ ...face, gazeY })} />
              <Slider label="blink" min={0} max={1} value={face.blink} onChange={(blink) => apply({ ...face, blink })} />
            </div>
          </Section>
          {GROUPS.map((g) => (
            <Section key={g.title} title={g.title}>
              <div className="slider-grid">
                {g.keys.map((k) => {
                  const [min, max] = RANGES[k] ?? [-1, 1];
                  return (
                    <Slider key={k} label={k} min={min} max={max} value={face.pose[k]} onChange={(v) => setKey(k, v)} />
                  );
                })}
              </div>
            </Section>
          ))}
        </>
      ) : (
        <p className="empty">Turn on posing to shape Mote’s face one slider at a time.</p>
      )}
    </>
  );
}

/* Motion */

const SPEEDS = [
  { value: 0.1, label: "0.1×" },
  { value: 0.25, label: "¼×" },
  { value: 0.5, label: "½×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
];

function MotionTab({ snap, debug, command }: Ctx) {
  return (
    <>
      <Section title="Time">
        <Row label="Speed" hint="Slow everything down to study it." stacked>
          <Segmented
            label="Speed"
            options={SPEEDS}
            value={debug.timeScale}
            onChange={(value) => command({ do: "timeScale", value })}
          />
        </Row>
        <Row label="Freeze" hint="Stops Mote mid-motion.">
          <Toggle label="Freeze" checked={debug.frozen} onChange={(value) => command({ do: "frozen", value })} />
        </Row>
      </Section>
      <Section title="Pretend">
        <Row
          label="Sound in another window"
          hint={`Acts as if a window over there is playing sound: Mote stays awake and watches it.`}
          stacked
        >
          <Segmented
            label="Sound in another window"
            options={[
              { value: "off", label: "Off" },
              { value: "left", label: "On the left" },
              { value: "right", label: "On the right" },
            ]}
            value={debug.fakeAudio ?? "off"}
            onChange={(v) => command({ do: "fakeAudio", value: v === "off" ? null : v })}
          />
        </Row>
        <Row label="What it is" hint="Music makes Mote dance; talk makes them listen; video, watch." stacked>
          <Segmented
            label="What it is"
            options={[
              { value: "music", label: "Music" },
              { value: "speech", label: "Talk" },
              { value: "video", label: "Video" },
              { value: "unknown", label: "Can’t tell" },
            ]}
            value={debug.fakeKind}
            onChange={(value) => command({ do: "fakeKind", value })}
          />
        </Row>
      </Section>
      <Section title="Overlays">
        <Row label="Show cut guides" hint="Blue line is the brow cut, peach is the cheek cut.">
          <Toggle label="Show cut guides" checked={debug.guides} onChange={(value) => command({ do: "guides", value })} />
        </Row>
      </Section>
      <Section title="Live readout">
        {snap ? (
          <div className="readout">
            <Readout k="gaze x" v={snap.gazeX} />
            <Readout k="gaze y" v={snap.gazeY} />
            <Readout k="attention" v={snap.attention} />
            <Readout k="blink" v={snap.blink} />
            <Readout k="idle (s)" v={snap.idleMs / 1000} />
            <Readout k="petting" v={snap.petting ? 1 : 0} changed={snap.petting} />
            <Readout k="media playing" v={snap.media ? 1 : 0} changed={!!snap.media} />
            <Readout k="tempo" v={snap.media?.bpm ?? 0} changed={!!snap.media?.bpm} />
            <Readout k="dancing" v={snap.dancing} changed={snap.dancing > 0.05} />
            <Readout k="on screen x" v={snap.placement?.x ?? -1} />
            <Readout k="on screen y" v={snap.placement?.y ?? -1} />
            {POSE_KEYS.map((k) => (
              <Readout key={k} k={k} v={snap.pose[k]} changed={Math.abs(snap.pose[k] - REST[k]) > 0.01} />
            ))}
          </div>
        ) : (
          <p className="empty">Nothing yet. Is Mote’s window open?</p>
        )}
      </Section>
    </>
  );
}

function Readout({ k, v, changed = false }: { k: string; v: number; changed?: boolean }) {
  return (
    <div className={changed ? "readout-cell is-changed" : "readout-cell"}>
      <span>{k}</span>
      <span className="mono">{(Math.abs(v) < 0.005 ? 0 : v).toFixed(2)}</span>
    </div>
  );
}

/* Log */

function LogTab({ log, clearLog }: Ctx) {
  return (
    <>
      <div className="button-row">
        <Button onClick={clearLog}>Clear</Button>
      </div>
      <Section>
        {log.length ? (
          <ol className="log">
            {log.map((e) => (
              <li key={e.id}>
                <span className="mono log-time">{e.at.toFixed(1)}s</span>
                <span>{e.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty">Quiet so far. Moods, pokes, blinks and setting changes show up here.</p>
        )}
      </Section>
    </>
  );
}

/* Data */

function DataTab({ settings, updateSettings, snap }: Ctx) {
  return (
    <>
      <Section title="Version">
        <p className="mono data">Mote {__MOTE_VERSION__}</p>
      </Section>
      <Section title="Saved settings">
        <pre className="mono data">{JSON.stringify(settings, null, 2)}</pre>
      </Section>
      <div className="button-row">
        <Button onClick={() => updateSettings({ ...DEFAULT_SETTINGS, debug: true })}>
          Reset settings (keeps debug on)
        </Button>
        <Button
          onClick={() =>
            void navigator.clipboard?.writeText(JSON.stringify({ settings, snapshot: snap }, null, 2))
          }
        >
          Copy everything
        </Button>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DebugWindow />
  </StrictMode>,
);
