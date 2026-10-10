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
import { pronounsFor } from "@/lib/companion/pronouns";
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
  const p = pronounsFor(settings.gender);
  const accessories = [
    { key: "mustache", title: "Mustache", wear: "Wear the mustache" },
    { key: "headphones", title: "Headphones", wear: "Wear the headphones" },
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
            hint={settings[a.key] ? undefined : "Off right now. Its moods still play, just unseen."}
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
        <Row label="Automatic moods" hint={`Let ${p.them} pick moods on ${p.their} own.`}>
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
      </Section>
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

function PoseTab({ snap, debug, command, face, setFace, settings }: Ctx) {
  const p = pronounsFor(settings.gender);
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
        <Row label="Pose by hand" hint={`Freezes Mote and lets the sliders shape ${p.their} face.`}>
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
