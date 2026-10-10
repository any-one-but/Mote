import { GEO } from "@/lib/companion/theme";

export type Mood =
  | "settle"
  | "glance"
  | "think"
  | "frustrate"
  | "cute"
  | "delight"
  | "surprise"
  | "doze"
  | "sleep"
  | "wake";

/**
 * Everything Mote can do with his face. The eyes are pills; expression comes
 * from two curved cuts per eye: the brow (from above) and the cheek (from below).
 */
export type Pose = {
  /** Body offset, lean and squash/stretch (viewBox units / degrees / scale). */
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  /** Where the mood wants him to look, and how much it overrides the pointer. */
  lookX: number;
  lookY: number;
  lookMix: number;
  /** Pill height / width multipliers. */
  open: number;
  wide: number;
  /** + shrinks the left eye and grows the right one (a one-eyed squint). */
  openBias: number;
  /** Brow cut: depth at the eye's centre (fraction of eye height from the top). */
  lid: number;
  /** + drops the inner end (cross), − drops the outer end (worried). */
  lidTilt: number;
  /** + rounds the cut downward in the middle (sleepy), − arches it (alert). */
  lidCurve: number;
  /** + deepens the left brow and lifts the right one. */
  lidBias: number;
  /** Cheek cut: height at the eye's centre (fraction of eye height from the bottom). */
  cheek: number;
  /** + raises the inner end. */
  cheekTilt: number;
  /** + pushes the middle up into a smile, − flattens it. */
  cheekCurve: number;
  /** + raises the left cheek and lowers the right one. */
  cheekBias: number;
  /** 0..1 happy wink per eye. */
  winkL: number;
  winkR: number;
};

type Keys = Array<[number, Partial<Pose>]>;

export type EngineHooks = {
  /** Screen-reader description of what he's doing, or null for nothing notable. */
  onMood: (label: string | null) => void;
  /** Plain-text happenings (mood changes, pokes, blinks) for the debug log. */
  onEvent?: (text: string) => void;
};

export type Energy = "calm" | "normal" | "lively";

export type EngineOptions = {
  followPointer: boolean;
  naps: boolean;
  energy: Energy;
};

/** A hand-set face for the debug window: springs and moods are bypassed. */
export type ManualFace = { pose: Pose; gazeX: number; gazeY: number; blink: number };

export type EngineSnapshot = {
  mood: Mood;
  moodMs: number;
  fps: number;
  gazeX: number;
  gazeY: number;
  attention: number;
  blink: number;
  idleMs: number;
  pose: Pose;
};

export type FaceEngine = {
  destroy: () => void;
  configure: (opts: Partial<EngineOptions>) => void;
  poke: () => void;
  force: (mood: Mood) => void;
  blink: (double?: boolean) => void;
  setTimeScale: (scale: number) => void;
  setFrozen: (frozen: boolean) => void;
  setAutoMoods: (on: boolean) => void;
  setLoop: (on: boolean) => void;
  setGuides: (on: boolean) => void;
  setManual: (face: ManualFace | null) => void;
  snapshot: () => EngineSnapshot;
};

export const MOOD_LIST: Mood[] = [
  "settle",
  "glance",
  "think",
  "frustrate",
  "cute",
  "delight",
  "surprise",
  "doze",
  "sleep",
  "wake",
];

export const REST: Pose = {
  x: 0,
  y: 0,
  rot: 0,
  sx: 1,
  sy: 1,
  lookX: 0,
  lookY: 0,
  lookMix: 0,
  open: 1,
  wide: 1,
  openBias: 0,
  lid: 0,
  lidTilt: 0,
  lidCurve: 0,
  lidBias: 0,
  cheek: 0,
  cheekTilt: 0,
  cheekCurve: 0,
  cheekBias: 0,
  winkL: 0,
  winkR: 0,
};

export const POSE_KEYS = Object.keys(REST) as Array<keyof Pose>;

/** Spring stiffness (k) and damping ratio (z) per channel. Lower z = more bounce. */
const SPRING: Record<keyof Pose, [number, number]> = {
  x: [150, 0.62],
  y: [190, 0.56],
  rot: [120, 0.58],
  sx: [380, 0.5],
  sy: [380, 0.5],
  lookX: [300, 1],
  lookY: [300, 1],
  lookMix: [300, 1],
  open: [420, 0.5],
  wide: [420, 0.5],
  openBias: [300, 0.7],
  lid: [300, 0.72],
  lidTilt: [280, 0.72],
  lidCurve: [280, 0.72],
  lidBias: [260, 0.75],
  cheek: [300, 0.66],
  cheekTilt: [280, 0.72],
  cheekCurve: [300, 0.66],
  cheekBias: [260, 0.75],
  winkL: [520, 0.7],
  winkR: [520, 0.7],
};

/** Mood length (ms) and how fast springs move while it plays (1 = normal). */
const MOODS: Record<Exclude<Mood, "settle" | "sleep">, { dur: number; tempo: number }> = {
  glance: { dur: 1700, tempo: 1 },
  think: { dur: 3400, tempo: 0.7 },
  frustrate: { dur: 2100, tempo: 1 },
  cute: { dur: 2500, tempo: 1 },
  delight: { dur: 1400, tempo: 1.15 },
  surprise: { dur: 1800, tempo: 1.1 },
  doze: { dur: 4200, tempo: 0.18 },
  wake: { dur: 1100, tempo: 1 },
};

const BAG: Mood[] = [
  "glance",
  "glance",
  "glance",
  "think",
  "think",
  "cute",
  "cute",
  "surprise",
  "frustrate",
  "doze",
];

const LABELS: Partial<Record<Mood, string>> = {
  sleep: "Mote is sleeping. Click to wake.",
  think: "Mote is thinking.",
  frustrate: "Mote is grumpy.",
  cute: "Mote is feeling cute.",
  surprise: "Mote is surprised.",
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function keyed(t: number, keys: Keys): Partial<Pose> {
  let cur: Partial<Pose> = {};
  for (const [at, p] of keys) {
    if (t < at) break;
    cur = p;
  }
  return cur;
}

/** Target pose for a mood `t` ms in, plus offsets that skip the springs (shakes). */
export function poseFor(mood: Mood, t: number, seed: number): { pose: Pose; shakeX: number; shakeRot: number } {
  const dir = seed > 0.5 ? 1 : -1;
  const variant = (seed * 7.31) % 1;
  let keys: Keys = [];
  let shakeX = 0;
  let shakeRot = 0;

  if (mood === "glance") {
    const look: Partial<Pose> =
      variant < 0.25
        ? { lookX: dir * 0.3, lookY: -0.85, lookMix: 1, open: 1.05, y: -2, sy: 1.02 }
        : variant > 0.85
          ? { lookX: dir * 0.4, lookY: 0.75, lookMix: 1, y: 1.5 }
          : { lookX: dir * 0.95, lookY: -0.05, lookMix: 1, rot: dir * 3.5, x: dir * 2 };
    keys = [
      [0, look],
      [1150, {}],
    ];
  } else if (mood === "think") {
    const base: Partial<Pose> = {
      lookY: -0.8,
      lookMix: 1,
      openBias: dir * 0.16,
      lid: 0.09,
      lidTilt: 0.26,
      lidBias: dir * 0.09,
      wide: 0.97,
      rot: dir * 7,
      y: -2,
    };
    keys = [
      [0, { ...base, lookX: dir * 0.25 }],
      [900, { ...base, lookX: dir * 0.58 }],
      [1900, { ...base, lookX: dir * 0.32, lookY: -0.62 }],
      [2750, { open: 1.07, wide: 1.02, y: -3, sy: 1.03, sx: 0.98 }],
      [3050, {}],
    ];
  } else if (mood === "frustrate") {
    const cross: Partial<Pose> = {
      lid: 0.26,
      lidTilt: 0.56,
      lidCurve: 0.08,
      open: 0.94,
      wide: 1.05,
      lookY: 0.12,
      lookMix: 0.9,
    };
    keys = [
      [0, { open: 1.06, sy: 1.04, sx: 0.97, y: -2 }],
      [140, { ...cross, sy: 0.95, sx: 1.04, y: 3 }],
      [460, { ...cross, sy: 0.98, sx: 1.02, y: 1 }],
      [1000, { ...cross, lid: 0.2, sy: 1.03, sx: 0.98, y: -1 }],
      [1250, { ...cross, y: 1 }],
      [1750, {}],
    ];
    if (t > 160 && t < 680) {
      const decay = 1 - (t - 160) / 520;
      const wobble = Math.sin(((t - 160) / 1000) * Math.PI * 2 * 9);
      shakeX = wobble * 2.2 * decay;
      shakeRot = wobble * 1.4 * decay;
    }
  } else if (mood === "cute") {
    const happy: Partial<Pose> = {
      cheek: 0.54,
      cheekCurve: 0.15,
      open: 1.1,
      wide: 1.05,
      lookY: -0.12,
      lookMix: 0.5,
    };
    const wink: Partial<Pose> = dir > 0 ? { winkR: 1 } : { winkL: 1 };
    keys = [
      [0, { sy: 0.94, sx: 1.05, y: 2.5, open: 0.92 }],
      [130, { ...happy, y: -9, sy: 1.05, sx: 0.96, rot: dir * 5 }],
      [400, { ...happy, y: 1.5, sy: 0.96, sx: 1.03, rot: dir * 6 }],
      [540, { ...happy, ...wink, rot: dir * 7 }],
      [1450, { ...happy, rot: dir * 5 }],
      [2000, {}],
    ];
  } else if (mood === "delight") {
    const joy: Partial<Pose> = { cheek: 0.7, cheekCurve: 0.26, open: 1.04, wide: 1.06 };
    keys = [
      [0, { ...joy, sy: 0.91, sx: 1.07, y: 3 }],
      [100, { ...joy, y: -12, sy: 1.06, sx: 0.96 }],
      [360, { ...joy, y: 1.5, sy: 0.94, sx: 1.05 }],
      [500, joy],
      [1050, {}],
    ];
  } else if (mood === "surprise") {
    keys = [
      [0, { open: 0.85, sy: 0.95, sx: 1.04, y: 2 }],
      [90, { open: 1.24, wide: 0.9, y: -6, sy: 1.05, sx: 0.96, lookY: -0.15, lookMix: 0.6 }],
      [700, { open: 1.12, wide: 0.95, y: -2 }],
      [1300, {}],
    ];
  } else if (mood === "doze") {
    keys = [
      [0, { lid: 0.3, lidCurve: 0.05, lidTilt: -0.08, y: 2, lookY: 0.3, lookMix: 0.6 }],
      [1200, { lid: 0.5, lidCurve: 0.05, lidTilt: -0.1, y: 5, rot: 3, lookY: 0.45, lookMix: 0.8, sy: 0.99 }],
      [2200, { lid: 0.26, lidCurve: 0.05, lidTilt: -0.06, y: 1, rot: 1, lookY: 0.2, lookMix: 0.6 }],
      [2900, { lid: 0.6, lidCurve: 0.06, lidTilt: -0.12, y: 7, rot: 5, lookY: 0.5, lookMix: 0.9 }],
    ];
  } else if (mood === "sleep") {
    keys = [[0, SLEEP]];
  } else if (mood === "wake") {
    keys = [
      [0, { ...SLEEP, lid: 0.5, cheek: 0.06, y: 5, rot: 3 }],
      [160, { open: 1.16, wide: 0.98, y: -7, sy: 1.05, sx: 0.96 }],
      [520, { open: 1.04 }],
      [800, {}],
    ];
  }

  return { pose: { ...REST, ...keyed(t, keys) }, shakeX, shakeRot };
}

/**
 * Closed, contented eyes: a soft ‿ of even thickness. The brow sags into the
 * eye and the cheek cut bows the same way underneath, so both edges run
 * parallel instead of a curved top over a flat bottom.
 */
const SLEEP: Partial<Pose> = {
  open: 0.72,
  wide: 1.1,
  lid: 0.64,
  lidCurve: 0.3,
  cheek: 0.1,
  cheekCurve: -0.3,
  y: 7,
  rot: 5,
  sy: 0.985,
  lookY: 0.2,
  lookMix: 1,
};

/** Blink curve: quick accelerating close, short hold, softer open with a tiny pop. */
function blinkCurve(t: number, slow: boolean) {
  const close = slow ? 170 : 72;
  const hold = slow ? 200 : 40;
  const open = slow ? 420 : 190;
  if (t < 0) return 0;
  if (t < close) {
    const u = t / close;
    return u * u;
  }
  if (t < close + hold) return 1;
  const u = (t - close - hold) / open;
  if (u >= 1) return 0;
  const c = 1.3;
  const back = 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
  return 1 - back;
}

const CHEEK_SPAN = 1.8;
const CHEEK_STEPS = 24;

export type EyeShape = {
  pill: { x: number; y: number; w: number; h: number; r: number };
  lid: string;
  cheek: string;
  /** Just the cut edges, for the debug guides. */
  lidEdge: string;
  cheekEdge: string;
};

const f = (n: number) => n.toFixed(2);

/** Builds one eye's pill and its two cuts. */
export function eyeShape(
  side: "l" | "r",
  pose: Pose,
  gazeX: number,
  gazeY: number,
  blink: number,
): EyeShape {
  const inward = side === "l" ? 1 : -1;
  const sideSign = side === "l" ? -1 : 1;
  const wink = side === "l" ? pose.winkL : pose.winkR;

  // Turning toward one side foreshortens the eye on that side a touch.
  const edge = clamp(gazeX * sideSign, 0, 1);
  const away = clamp(-gazeX * sideSign, 0, 1);

  const bias = side === "l" ? 1 : -1;
  const open = pose.open * (1 - bias * pose.openBias);
  const baseH = GEO.eyeH * Math.max(0.05, open) * (1 - 0.14 * wink);
  const h = Math.max(6.5, baseH * (1 - 0.86 * blink));
  const w = GEO.eyeW * pose.wide * (1 + 0.08 * blink) * (1 - 0.1 * edge + 0.03 * away);
  const cx = (side === "l" ? GEO.eyeLX : GEO.eyeRX) + gazeX * (15 - 3 * edge);
  const cy = GEO.eyeY + gazeY * 12 + (baseH - h) * 0.14;
  const top = cy - h / 2;
  const bottom = cy + h / 2;

  const lid =
    lerp(pose.lid, 0, wink) + bias * pose.lidBias + 0.14 * clamp(gazeY, 0, 1);
  const lidTilt = pose.lidTilt;
  const lidCurve = pose.lidCurve;
  const cheek =
    lerp(pose.cheek, 0.78, wink) + bias * pose.cheekBias + 0.05 * clamp(-gazeY, 0, 1);
  const cheekTilt = lerp(pose.cheekTilt, 0, wink);
  const cheekCurve = lerp(pose.cheekCurve, 0.3, wink);

  // Cut edges are cubic curves sampled outer → inner at s = 0, ⅓, ⅔, 1.
  const half = w / 2 + 1;
  const xs = [0, 1, 2, 3].map((i) => cx + inward * (-half + (i / 3) * half * 2));
  const curveAt = (k: number, i: number) => (i === 0 || i === 3 ? -k : k / 3);
  const tiltAt = (k: number, i: number) => k * (i / 3 - 0.5);

  const lidY = xs.map((_, i) => top + h * (lid + curveAt(lidCurve, i) + tiltAt(lidTilt, i)));

  const far = 80;
  const lidPath = `M${f(xs[0])} ${f(top - far)}L${f(xs[0])} ${f(lidY[0])}C${f(xs[1])} ${f(lidY[1])} ${f(xs[2])} ${f(lidY[2])} ${f(xs[3])} ${f(lidY[3])}L${f(xs[3])} ${f(top - far)}Z`;

  // The cheek is a wide, shallow swell that reaches well past the eye, so it
  // meets the pill's sides at a soft angle instead of leaving sharp tips.
  // `cheekCurve` is how far the swell has dropped by the time it reaches the
  // eye's edge.
  const span = (w / 2) * CHEEK_SPAN;
  const reach = (Math.PI / 2) / CHEEK_SPAN;
  const norm = 1 - Math.cos(reach);
  let cheekEdge = "";
  for (let i = 0; i <= CHEEK_STEPS; i++) {
    const u = -1 + (2 * i) / CHEEK_STEPS;
    const d = Math.abs(u) * CHEEK_SPAN;
    const drop = (1 - Math.cos(d * reach)) / norm;
    const s = (u * CHEEK_SPAN + 1) / 2;
    const y = bottom - h * (cheek - cheekCurve * drop + cheekTilt * (s - 0.5));
    const x = cx + inward * u * span;
    cheekEdge += `${i === 0 ? "M" : "L"}${f(x)} ${f(y)}`;
  }
  const cheekPath = cheekEdge + `L${f(cx + inward * span)} ${f(bottom + far)}L${f(cx - inward * span)} ${f(bottom + far)}Z`;

  return {
    pill: { x: cx - w / 2, y: top, w, h, r: Math.min(w, h) / 2 },
    lid: lidPath,
    cheek: cheekPath,
    lidEdge: `M${f(xs[0])} ${f(lidY[0])}C${f(xs[1])} ${f(lidY[1])} ${f(xs[2])} ${f(lidY[2])} ${f(xs[3])} ${f(lidY[3])}`,
    cheekEdge,
  };
}

function q<T extends Element>(svg: SVGSVGElement, name: string) {
  return svg.querySelector(`[data-part="${name}"]`) as T | null;
}

const ENERGY_GAP: Record<Energy, number> = { calm: 1.8, normal: 1, lively: 0.5 };

export function startFaceEngine(svg: SVGSVGElement, hooks: EngineHooks): FaceEngine {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = mq.matches;
  const onMq = () => {
    reduced = mq.matches;
  };
  mq.addEventListener("change", onMq);

  const parts = {
    body: q<SVGGElement>(svg, "body"),
    eyes: q<SVGGElement>(svg, "eyes"),
    shadow: q<SVGEllipseElement>(svg, "shadow"),
    pillL: q<SVGRectElement>(svg, "pill-l"),
    pillR: q<SVGRectElement>(svg, "pill-r"),
    lidL: q<SVGPathElement>(svg, "lid-l"),
    lidR: q<SVGPathElement>(svg, "lid-r"),
    cheekL: q<SVGPathElement>(svg, "cheek-l"),
    cheekR: q<SVGPathElement>(svg, "cheek-r"),
    guides: q<SVGGElement>(svg, "guides"),
    gPillL: q<SVGRectElement>(svg, "guide-pill-l"),
    gPillR: q<SVGRectElement>(svg, "guide-pill-r"),
    gLidL: q<SVGPathElement>(svg, "guide-lid-l"),
    gLidR: q<SVGPathElement>(svg, "guide-lid-r"),
    gCheekL: q<SVGPathElement>(svg, "guide-cheek-l"),
    gCheekR: q<SVGPathElement>(svg, "guide-cheek-r"),
  };

  const options: EngineOptions = { followPointer: true, naps: true, energy: "normal" };
  const debug = {
    timeScale: 1,
    frozen: false,
    autoMoods: true,
    loop: false,
    guides: false,
    manual: null as ManualFace | null,
  };

  // `clock` is Mote's own time, so the debug window can slow it down or stop it.
  let clock = 0;
  let realLast = performance.now();
  let fps = 60;
  const pointer = { x: 0, y: 0, at: 0, has: false };
  let mood: Mood = "settle";
  let moodStart = 0;
  let moodSeed = Math.random();
  let lastAct: Mood = "glance";
  let nextAct = 2200;
  let pokeQueued = false;
  const pokes: number[] = [];
  let blinks: number[] = [];
  let lastBlink = 0;
  let nextBlink = 1400;
  let wander = { x: 0, y: 0, next: 1600 };
  let gazeTarget = { x: 0, y: 0 };
  let twitchStart = -1;
  let nextTwitch = 5000;
  let announced: string | null = null;
  let lastAttention = 0;
  let lastBlinkAmt = 0;

  const view: Pose = { ...REST };
  const vel = Object.fromEntries(POSE_KEYS.map((k) => [k, 0])) as Record<keyof Pose, number>;
  const gaze = { x: 0, y: 0, vx: 0, vy: 0 };
  const lag = { x: 0, y: 0, vx: 0, vy: 0 };

  const log = (text: string) => hooks.onEvent?.(text);

  const announce = (label: string | null) => {
    if (label === announced) return;
    announced = label;
    hooks.onMood(label);
  };

  const blinkAt = (at: number, double = false) => {
    blinks.push(at);
    if (double) blinks.push(at + 230);
    lastBlink = at;
  };

  const start = (next: Mood, now: number) => {
    const prev = mood;
    mood = next;
    moodStart = now;
    moodSeed = Math.random();
    if (next !== "settle" && next !== "sleep") lastAct = next;
    svg.dataset.mood = next;
    announce(LABELS[next] ?? null);
    log(`mood → ${next}`);
    nextBlink = Math.max(nextBlink, now + 900);
    if (next === "glance" && Math.random() < 0.4) blinkAt(now + 20);
    if (next === "wake") blinkAt(now + 620, true);
    if (next === "settle" && prev === "doze") blinkAt(now + 60, true);
  };

  const pick = (): Mood => {
    const bag = options.naps ? BAG : BAG.filter((m) => m !== "doze");
    const opts = bag.filter((m) => m !== lastAct);
    return opts[Math.floor(Math.random() * opts.length)] ?? "glance";
  };

  const restGap = () => (3500 + Math.random() * 5000) * ENERGY_GAP[options.energy];

  const onMove = (e: PointerEvent) => {
    const dist = pointer.has ? Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) : 0;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.at = clock;
    pointer.has = true;
    if (mood === "sleep" && dist > 2 && !debug.manual) start("wake", clock);
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  let raf = 0;
  let running = true;
  let hidden = document.hidden;

  const onVis = () => {
    hidden = document.hidden;
    if (!hidden) {
      realLast = performance.now();
      pointer.at = clock;
      if (!raf) raf = requestAnimationFrame(loop);
    }
  };
  document.addEventListener("visibilitychange", onVis);

  const spring = (x: number, v: number, target: number, k: number, z: number, dt: number) => {
    const a = -k * (x - target) - 2 * z * Math.sqrt(k) * v;
    const nv = v + a * dt;
    return [x + nv * dt, nv] as const;
  };

  const setPill = (el: SVGRectElement | null, p: EyeShape["pill"]) => {
    if (!el) return;
    el.setAttribute("x", f(p.x));
    el.setAttribute("y", f(p.y));
    el.setAttribute("width", f(p.w));
    el.setAttribute("height", f(p.h));
    el.setAttribute("rx", f(p.r));
  };

  // Pokes: a happy hop, unless you keep pestering him.
  const handlePoke = (now: number) => {
    log("poke");
    pokes.push(now);
    while (pokes.length && now - pokes[0] > 2200) pokes.shift();
    if (mood === "sleep" || mood === "doze") start("wake", now);
    else if (pokes.length >= 4 && mood !== "frustrate") {
      pokes.length = 0;
      start("frustrate", now);
    } else if (mood !== "frustrate") start("delight", now);
  };

  const step = (dt: number, now: number) => {
    if (pokeQueued) {
      pokeQueued = false;
      handlePoke(now);
    }

    // Mood scheduling.
    const idleFor = pointer.has ? now - pointer.at : 0;
    if (debug.autoMoods && options.naps && mood === "settle" && pointer.has && idleFor > 30000) {
      start("doze", now);
    }
    if (mood !== "settle" && mood !== "sleep" && now >= moodStart + MOODS[mood].dur) {
      if (debug.loop) start(mood, now);
      else if (mood === "doze" && options.naps && pointer.has && idleFor > 8000) start("sleep", now);
      else {
        start("settle", now);
        nextAct = now + restGap();
      }
    }
    if (debug.autoMoods && mood === "settle" && now >= nextAct) start(pick(), now);
    if (!debug.autoMoods && mood === "settle") nextAct = Math.max(nextAct, now + 1000);

    const t = now - moodStart;
    const { pose: target, shakeX, shakeRot } = poseFor(mood, t, moodSeed);
    const tempo = mood === "sleep" ? 0.12 : mood === "settle" ? 1 : MOODS[mood].tempo;

    // Pointer & idle gaze.
    const rect = svg.getBoundingClientRect();
    let px = 0;
    let py = 0;
    if (pointer.has && rect.width > 0) {
      px = clamp((pointer.x - (rect.left + rect.width * 0.5)) / (rect.width * 0.6), -1, 1);
      py = clamp((pointer.y - (rect.top + rect.height * 0.5)) / (rect.height * 0.6), -1, 1);
    }
    const attention =
      !pointer.has || !options.followPointer
        ? 0
        : idleFor < 2000
          ? 1
          : clamp(1 - (idleFor - 2000) / 1000, 0, 1);
    lastAttention = attention;
    if (now > wander.next) {
      const home = Math.random() < 0.45;
      wander = {
        x: home ? 0 : (Math.random() - 0.5) * 0.9,
        y: home ? 0 : (Math.random() - 0.5) * 0.5,
        next: now + 1200 + Math.random() * 2400,
      };
    }
    const freeX = lerp(wander.x, px, attention);
    const freeY = lerp(wander.y, py, attention);
    const nextGX = lerp(freeX, target.lookX, target.lookMix);
    const nextGY = lerp(freeY, target.lookY, target.lookMix);
    if (
      Math.hypot(nextGX - gazeTarget.x, nextGY - gazeTarget.y) > 0.6 &&
      now - lastBlink > 700 &&
      mood !== "sleep" &&
      Math.random() < 0.35
    ) {
      blinkAt(now);
    }
    gazeTarget = { x: nextGX, y: nextGY };

    // Looking straight at you up close makes his eyes a touch bigger.
    if (mood === "settle" && attention > 0.6 && Math.hypot(px, py) < 0.45) {
      target.open += 0.05;
      target.wide += 0.03;
    }

    if (mood === "sleep") {
      if (twitchStart < 0 && now >= nextTwitch) twitchStart = now;
      if (twitchStart >= 0) {
        const u = (now - twitchStart) / 600;
        if (u >= 1) {
          twitchStart = -1;
          nextTwitch = now + 5000 + Math.random() * 8000;
        } else target.lid -= Math.sin(u * Math.PI) * 0.12;
      }
    }

    // Natural blinks.
    const blinkFree = mood !== "sleep" && mood !== "wake" && mood !== "delight" && mood !== "cute";
    if (blinkFree && now >= nextBlink) {
      blinkAt(now, Math.random() < 0.16);
      nextBlink = now + 2400 + Math.random() * 3600;
    }
    const slow = mood === "doze";
    let blink = 0;
    blinks = blinks.filter((b) => now - b < 900);
    for (const b of blinks) blink = Math.max(blink, blinkCurve(now - b, slow));
    if (mood === "sleep") blink = 0;
    lastBlinkAmt = blink;

    // Body follows the gaze a little.
    target.x += gaze.x * 2.5;
    target.rot += gaze.x * 2.5;
    target.y += gaze.y * 1.2;

    // Breathing.
    if (!reduced) {
      const period = mood === "sleep" ? 3400 : mood === "think" ? 1600 : 2600;
      const b = Math.sin((now / period) * Math.PI * 2);
      const deep = mood === "sleep" ? 1.4 : 1;
      target.sy += b * 0.012 * deep;
      target.sx -= b * 0.008 * deep;
      target.y -= b * 0.8 * deep;
    }

    // Integrate springs in small steps so fast motion stays stable.
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (const key of POSE_KEYS) {
        const [k, z] = SPRING[key];
        const [x, v] = spring(view[key], vel[key], target[key], k * tempo, z, h);
        view[key] = x;
        vel[key] = v;
      }
      [gaze.x, gaze.vx] = spring(gaze.x, gaze.vx, gazeTarget.x, 900, 0.82, h);
      [gaze.y, gaze.vy] = spring(gaze.y, gaze.vy, gazeTarget.y, 900, 0.82, h);
      [lag.x, lag.vx] = spring(lag.x, lag.vx, view.x, 110, 0.45, h);
      [lag.y, lag.vy] = spring(lag.y, lag.vy, view.y, 110, 0.45, h);
    }

    return { blink, shakeX, shakeRot };
  };

  let shake = { x: 0, rot: 0 };

  const render = (blink: number) => {
    const m = reduced ? 0.2 : 1;
    const bx = (view.x + shake.x * m) * m;
    const by = view.y * m;
    const br = (view.rot + shake.rot * m) * m;
    const bsx = 1 + (view.sx - 1) * m;
    const bsy = 1 + (view.sy - 1) * m;
    parts.body?.setAttribute(
      "transform",
      `translate(${f(bx)} ${f(by)}) rotate(${f(br)} ${GEO.cx} ${GEO.pivotY}) translate(${GEO.cx} ${GEO.groundY}) scale(${bsx.toFixed(4)} ${bsy.toFixed(4)}) translate(${-GEO.cx} ${-GEO.groundY})`,
    );
    const ex = clamp((lag.x - view.x) * 0.35, -3, 3) * m;
    const ey = clamp((lag.y - view.y) * 0.35, -4, 4) * m;
    const eyeShift = `translate(${f(ex)} ${f(ey)})`;
    parts.eyes?.setAttribute("transform", eyeShift);

    const lift = clamp(-by, 0, 40);
    if (parts.shadow) {
      parts.shadow.setAttribute("rx", f(GEO.shadowRx * bsx * (1 - lift / 50)));
      parts.shadow.setAttribute("cx", f(GEO.cx + bx * 0.6));
      parts.shadow.style.opacity = (0.1 * (1 - lift / 60)).toFixed(3);
    }

    const l = eyeShape("l", view, gaze.x, gaze.y, blink);
    const r = eyeShape("r", view, gaze.x, gaze.y, blink);
    setPill(parts.pillL, l.pill);
    setPill(parts.pillR, r.pill);
    parts.lidL?.setAttribute("d", l.lid);
    parts.lidR?.setAttribute("d", r.lid);
    parts.cheekL?.setAttribute("d", l.cheek);
    parts.cheekR?.setAttribute("d", r.cheek);

    if (debug.guides) {
      parts.guides?.setAttribute("transform", eyeShift);
      setPill(parts.gPillL, l.pill);
      setPill(parts.gPillR, r.pill);
      parts.gLidL?.setAttribute("d", l.lidEdge);
      parts.gLidR?.setAttribute("d", r.lidEdge);
      parts.gCheekL?.setAttribute("d", l.cheekEdge);
      parts.gCheekR?.setAttribute("d", r.cheekEdge);
    }
  };

  const loop = (real: number) => {
    if (!running) return;
    if (hidden) {
      raf = 0;
      return;
    }
    const realDt = Math.min(0.05, (real - realLast) / 1000);
    realLast = real;
    if (realDt > 0) fps = lerp(fps, 1 / realDt, 0.05);

    let blink = 0;
    if (debug.manual) {
      const m = debug.manual;
      Object.assign(view, m.pose);
      for (const key of POSE_KEYS) vel[key] = 0;
      gaze.x = m.gazeX;
      gaze.y = m.gazeY;
      lag.x = view.x;
      lag.y = view.y;
      shake = { x: 0, rot: 0 };
      blink = m.blink;
      lastBlinkAmt = blink;
    } else if (debug.frozen) {
      blink = lastBlinkAmt;
    } else {
      const dt = realDt * debug.timeScale;
      clock += dt * 1000;
      const out = step(dt, clock);
      blink = out.blink;
      shake = { x: out.shakeX, rot: out.shakeRot };
    }
    render(blink);
    raf = requestAnimationFrame(loop);
  };

  svg.dataset.mood = "settle";
  raf = requestAnimationFrame(loop);

  return {
    destroy: () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onMq);
    },
    configure: (opts) => {
      Object.assign(options, opts);
      if (!options.naps && (mood === "doze" || mood === "sleep")) start("wake", clock);
    },
    poke: () => {
      pokeQueued = true;
    },
    force: (next) => start(next, clock),
    blink: (double = false) => {
      blinkAt(clock, double);
      log(double ? "double blink" : "blink");
    },
    setTimeScale: (scale) => {
      debug.timeScale = clamp(scale, 0, 4);
    },
    setFrozen: (frozen) => {
      debug.frozen = frozen;
    },
    setAutoMoods: (on) => {
      debug.autoMoods = on;
      if (on) nextAct = clock + restGap();
    },
    setLoop: (on) => {
      debug.loop = on;
    },
    setGuides: (on) => {
      debug.guides = on;
      if (on) svg.dataset.guides = "";
      else delete svg.dataset.guides;
    },
    setManual: (face) => {
      debug.manual = face;
    },
    snapshot: () => ({
      mood,
      moodMs: clock - moodStart,
      fps,
      gazeX: gaze.x,
      gazeY: gaze.y,
      attention: lastAttention,
      blink: lastBlinkAmt,
      idleMs: pointer.has ? clock - pointer.at : 0,
      pose: { ...view },
    }),
  };
}
