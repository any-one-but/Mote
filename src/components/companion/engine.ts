import {
  MUSTACHE_PUFFS,
  headphoneShape,
  mustacheShape,
} from "@/components/companion/accessories";
import {
  ATTRS,
  feelings,
  lastingMoods,
  loadMind,
  MIND_START,
  nudge,
  driftStep,
  saveMind,
  type Attr,
  type LastingMood,
  type MindValues,
} from "@/components/companion/mind";
import { reactionById } from "@/components/companion/reactions";
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
  | "wake"
  | "dizzy"
  | "purr"
  // Idles that come from lasting moods.
  | "huff"
  | "sulk"
  | "yawn"
  | "fidget"
  | "hum"
  // Looking out at you while watching something.
  | "checkin"
  // Only with the mustache on.
  | "sniffle"
  | "twirl"
  | "flutter"
  // Only with the headphones on.
  | "listen"
  | "groove"
  | "flick";

/**
 * Everything Mote can do with their face. The eyes are pills; expression comes
 * from two curved cuts per eye: the brow (from above) and the cheek (from below).
 */
export type Pose = {
  /** Body offset, lean and squash/stretch (viewBox units / degrees / scale). */
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  /** Where the mood wants Mote to look, and how much it overrides the pointer. */
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
  /** Headphone cat ears: + taller and perkier, − flatter. */
  earPerk: number;
  /** Extra ear lean in degrees, + outward. */
  earTiltL: number;
  earTiltR: number;
  /** 0..1 ear cups swelling on a beat. */
  cupPulse: number;
  /** Mustache: + ends rise (smile), − droop. */
  mLift: number;
  /** 0..1 tips hooked upward. */
  mCurl: number;
  /** + fluffier. */
  mPuff: number;
  /** 0..1 how hard it ruffles. */
  mRuffle: number;
  /** 0..1 fluttering, as if blown on. */
  mFlutter: number;
  /** −1..1 a sideways nose-wiggle. */
  mShift: number;
};

type Keys = Array<[number, Partial<Pose>]>;

export type EngineHooks = {
  /** Screen-reader description of what Mote is doing, or null for nothing notable. */
  onMood: (label: string | null) => void;
  /** Plain-text happenings (mood changes, pokes, blinks) for the debug log. */
  onEvent?: (text: string) => void;
};

export type Energy = "calm" | "normal" | "lively";

export type EngineOptions = {
  followPointer: boolean;
  naps: boolean;
  energy: Energy;
  headphones: boolean;
  mustache: boolean;
  /**
   * Another visible window is playing sound: where it is relative to Mote's
   * window, in screen points (null when nothing else is playing).
   */
  audio: { dx: number; dy: number } | null;
};

export type Accessory = "headphones" | "mustache";

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
  petting: boolean;
  audio: boolean;
  /** What Mote is intrigued by right now, if anything. */
  intrigued: "media" | "you" | null;
  /** Mote's feelings, 0–10, and the lasting moods they add up to. */
  mind: MindValues;
  moods: LastingMood[];
  /** ms until each feeling's next drift step. */
  driftIn: MindValues;
  /** How often each reaction has fired, and when last (ms of Mote's clock ago). */
  reactions: Record<string, { count: number; ago: number }>;
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
  setSleepLine: (on: boolean) => void;
  /** Is this screen point on Mote's body (not just the window around it)? */
  hitTest: (clientX: number, clientY: number) => boolean;
  /** A petting stroke at this screen point. */
  pet: (clientX: number, clientY: number) => void;
  /** The window moved by this much (CSS px), for inertia and dizziness. */
  windowMoved: (dx: number, dy: number) => void;
  /** Fire a reaction by id (see reactions.ts), applying its feelings. */
  react: (id: string) => void;
  /** Debug: set one feeling directly, or put them all back to 5. */
  setFeeling: (attr: Attr, value: number) => void;
  resetFeelings: () => void;
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
  "dizzy",
  "purr",
  "huff",
  "sulk",
  "yawn",
  "fidget",
  "hum",
  "checkin",
];

/** The extra idle moods each accessory brings with it. */
export const ACCESSORY_MOODS: Record<Accessory, Mood[]> = {
  mustache: ["sniffle", "twirl", "flutter"],
  headphones: ["listen", "groove", "flick"],
};

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
  earPerk: 0,
  earTiltL: 0,
  earTiltR: 0,
  cupPulse: 0,
  mLift: 0,
  mCurl: 0,
  mPuff: 0,
  mRuffle: 0,
  mFlutter: 0,
  mShift: 0,
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
  earPerk: [260, 0.5],
  earTiltL: [520, 0.32],
  earTiltR: [520, 0.32],
  cupPulse: [600, 0.45],
  mLift: [260, 0.55],
  mCurl: [220, 0.55],
  mPuff: [300, 0.5],
  mRuffle: [200, 0.8],
  mFlutter: [200, 0.8],
  mShift: [420, 0.4],
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
  sniffle: { dur: 2600, tempo: 1 },
  twirl: { dur: 2700, tempo: 1 },
  flutter: { dur: 2400, tempo: 1 },
  listen: { dur: 3400, tempo: 0.9 },
  groove: { dur: 3500, tempo: 1.1 },
  flick: { dur: 1700, tempo: 1 },
  dizzy: { dur: 3000, tempo: 1 },
  huff: { dur: 1600, tempo: 1 },
  sulk: { dur: 3200, tempo: 0.8 },
  yawn: { dur: 2600, tempo: 0.7 },
  fidget: { dur: 2000, tempo: 1.2 },
  hum: { dur: 3000, tempo: 0.9 },
  checkin: { dur: 1500, tempo: 0.9 },
  // Purring lasts as long as the petting does; see `PURR_AFTER`.
  purr: { dur: Number.POSITIVE_INFINITY, tempo: 0.8 },
};

/** How long a purr keeps going after the petting stops (ms). */
const PURR_AFTER = 1300;

const BAG: Mood[] = [
  "glance",
  "glance",
  "glance",
  "think",
  "think",
  "cute",
  "cute",
  "surprise",
  // Grumpiness and dozing are never picked at random; they come from how
  // Mote actually feels (see the scheduling in `step`).
];

const LABELS: Partial<Record<Mood, string>> = {
  sleep: "Mote is sleeping. Click to wake.",
  think: "Mote is thinking.",
  frustrate: "Mote is grumpy.",
  cute: "Mote is feeling cute.",
  surprise: "Mote is surprised.",
  sniffle: "Mote is about to sneeze.",
  twirl: "Mote is showing off the mustache.",
  flutter: "Mote is blowing on the mustache.",
  listen: "Mote is listening for something.",
  groove: "Mote is bopping along to music.",
  dizzy: "Mote is dizzy.",
  huff: "Mote huffs.",
  sulk: "Mote is sulking.",
  yawn: "Mote yawns.",
  fidget: "Mote is fidgeting.",
  hum: "Mote is humming happily.",
  checkin: "Mote checks in on you.",
  purr: "Mote is enjoying the pets.",
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
export type PoseExtras = {
  /** Debug: sleep with flat, line-shaped eyes instead of the curved ones. */
  sleepLine?: boolean;
  /** ms since the last petting stroke (negative while still petting). */
  sincePet?: number;
};

/**
 * Target pose for a mood `t` ms in, plus things that skip the springs: shakes,
 * the dizzy eye swirl (0..1) and the purr rumble (0..1).
 */
export function poseFor(
  mood: Mood,
  t: number,
  seed: number,
  extras: PoseExtras = {},
): { pose: Pose; shakeX: number; shakeRot: number; swirl: number; purr: number } {
  const dir = seed > 0.5 ? 1 : -1;
  const sleepPose = extras.sleepLine ? SLEEP_LINE : SLEEP;
  let swirl = 0;
  let purr = 0;
  let wobble: Partial<Pose> = {};
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
    // At the peak the cheeks push up into a squishy, bashful smile.
    const squish: Partial<Pose> = { ...happy, cheek: 0.66, cheekCurve: 0.2, open: 1.06, wide: 1.07 };
    keys = [
      [0, { sy: 0.94, sx: 1.05, y: 2.5, open: 0.92 }],
      [130, { ...happy, y: -9, sy: 1.05, sx: 0.96, rot: dir * 5 }],
      [400, { ...happy, y: 1.5, sy: 0.96, sx: 1.03, rot: dir * 6 }],
      [540, { ...squish, rot: dir * 7, sy: 0.98, sx: 1.02 }],
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
    keys = [[0, sleepPose]];
  } else if (mood === "wake") {
    keys = [
      [0, extras.sleepLine ? { ...SLEEP_LINE, open: 0.3, y: 5, rot: 3 } : { ...SLEEP, lid: 0.5, cheek: 0.06, y: 5, rot: 3 }],
      [160, { open: 1.16, wide: 0.98, y: -7, sy: 1.05, sx: 0.96 }],
      [520, { open: 1.04 }],
      [800, {}],
    ];
  } else if (mood === "sniffle") {
    // A tickle builds under the mustache, the eyes squeeze up cutely… achoo.
    const cute: Partial<Pose> = { cheek: 0.42, cheekCurve: 0.14, open: 1.04, lookY: 0.15, lookMix: 0.4 };
    keys = [
      [0, { ...cute, mRuffle: 0.5, mShift: 0.35 }],
      [260, { ...cute, mRuffle: 0.7, mShift: -0.35 }],
      [520, { ...cute, cheek: 0.5, mRuffle: 0.85, mShift: 0.45 }],
      [780, { ...cute, cheek: 0.56, cheekCurve: 0.16, mRuffle: 1, mShift: -0.45, mPuff: 0.2, sy: 1.03, sx: 0.985, y: -2 }],
      [1080, { cheek: 0.66, cheekCurve: 0.24, mRuffle: 1, mShift: 0.2, mPuff: 0.35, sy: 1.05, sx: 0.97, y: -4, rot: -dir * 3 }],
      [1340, { cheek: 0.8, cheekCurve: 0.3, open: 0.92, mPuff: 0.55, mLift: 0.5, mRuffle: 0.3, sy: 0.9, sx: 1.08, y: 5, rot: dir * 4 }],
      [1650, { cheek: 0.54, cheekCurve: 0.15, open: 1.06, mRuffle: 0.35, mLift: 0.2, y: -1 }],
      [2250, {}],
    ];
    if (t > 1340 && t < 1720) {
      const decay = 1 - (t - 1340) / 380;
      const wobble = Math.sin(((t - 1340) / 1000) * Math.PI * 2 * 11);
      shakeX = wobble * 2.4 * decay;
      shakeRot = wobble * 1.2 * decay;
    }
  } else if (mood === "twirl") {
    // Proud and a little smug, curling the tips up and giving them a waggle.
    const smug: Partial<Pose> = {
      lid: 0.42,
      lidCurve: 0,
      lidTilt: 0.1,
      mLift: 0.15,
      lookX: dir * 0.45,
      lookY: -0.2,
      lookMix: 0.7,
      rot: dir * 5,
    };
    keys = [
      [0, { ...smug, mCurl: 0.35, mLift: 0.05, rot: dir * 3 }],
      [450, { ...smug, mCurl: 1, sy: 1.04, sx: 0.98, y: -2, rot: dir * 6 }],
      [850, { ...smug, mCurl: 0.65, mShift: 0.3 }],
      [1100, { ...smug, mCurl: 1, mShift: -0.3 }],
      [1350, { ...smug, mCurl: 0.7, mShift: 0.3 }],
      [1600, { ...smug, mCurl: 1, mPuff: 0.15 }],
      [2250, {}],
    ];
  } else if (mood === "flutter") {
    // Looks down, puffs, and blows the mustache into a flutter. Delighted.
    keys = [
      [0, { lookY: 0.85, lookMix: 1, open: 1.06, sy: 1.04, sx: 0.98, y: -1.5, mPuff: 0.15 }],
      [380, { lookY: 0.9, lookMix: 1, open: 1.1, mFlutter: 1, mPuff: 0.25, sy: 0.97, sx: 1.03, y: 1 }],
      [1250, { lookY: 0.7, lookMix: 1, mFlutter: 0.35 }],
      [1500, { cheek: 0.72, cheekCurve: 0.26, mLift: 0.35, y: -6, sy: 1.04, sx: 0.97 }],
      [1700, { cheek: 0.72, cheekCurve: 0.26, mLift: 0.3, y: 0, sy: 0.97, sx: 1.03 }],
      [2050, {}],
    ];
  } else if (mood === "listen") {
    // Hears something: looks one way, then the other, ears growing to catch it.
    const ds = -dir;
    const toward = (side: number, deg: number): Partial<Pose> =>
      side < 0 ? { earTiltL: deg, earTiltR: -4 } : { earTiltR: deg, earTiltL: -4 };
    const curious: Partial<Pose> = { open: 1.08, earPerk: 0.8, lookMix: 1, lookY: -0.1 };
    keys = [
      [0, { ...curious, lookX: ds * 0.95, rot: ds * 6, x: ds * 2, openBias: ds * 0.06, ...toward(ds, 10) }],
      [700, { ...curious, earPerk: 1.1, lookX: ds, rot: ds * 7, x: ds * 2, openBias: ds * 0.06, ...toward(ds, 15) }],
      [1250, { ...curious, earPerk: 0.9, lookX: -ds * 0.95, rot: -ds * 6, x: -ds * 2, openBias: -ds * 0.06, ...toward(-ds, 12) }],
      [1950, { ...curious, earPerk: 1.15, lookX: -ds, rot: -ds * 7, x: -ds * 2, openBias: -ds * 0.06, ...toward(-ds, 16) }],
      [2450, { open: 1.14, wide: 0.96, earPerk: 1.25, lookX: 0, lookY: -0.45, lookMix: 1, y: -3, sy: 1.03, sx: 0.98 }],
      [3000, { earPerk: 0.3 }],
      [3200, {}],
    ];
  } else if (mood === "groove") {
    // Eyes closed happily, bopping to a beat; ears and cups bounce along.
    const vibe: Partial<Pose> = { cheek: 0.74, cheekCurve: 0.28, earPerk: 0.3 };
    keys = [[0, vibe]];
    for (let i = 0; i < 7; i++) {
      const at = 180 + i * 420;
      const s = i % 2 ? 1 : -1;
      keys.push([
        at,
        { ...vibe, y: 3, sy: 0.96, sx: 1.03, rot: s * 4, cupPulse: 1, earTiltL: s > 0 ? 10 : -4, earTiltR: s > 0 ? -4 : 10 },
      ]);
      keys.push([at + 170, { ...vibe, y: -1, sy: 1.02, sx: 0.99, rot: s * 3 }]);
    }
    keys.push([3200, {}]);
  } else if (mood === "flick") {
    // One ear twitches like a cat's; Mote glances up at it, and it twitches again.
    const ear: keyof Pose = dir < 0 ? "earTiltL" : "earTiltR";
    const look: Partial<Pose> = { lookX: dir * 0.55, lookY: -0.85, lookMix: 1, open: 1.07, rot: dir * 3 };
    keys = [
      [0, { [ear]: -16, earPerk: 0.2 }],
      [90, { [ear]: 8, earPerk: 0.2 }],
      [190, { [ear]: -12 }],
      [290, {}],
      [420, look],
      [900, { ...look, [ear]: -14 }],
      [990, { ...look, [ear]: 6 }],
      [1080, look],
      [1350, {}],
    ];
  } else if (mood === "huff") {
    // A big, cross breath in… and out through the nose.
    const cross: Partial<Pose> = { lid: 0.26, lidTilt: 0.6, lidCurve: 0.06, open: 0.96 };
    keys = [
      [0, { ...cross, sy: 1.05, sx: 0.97, y: -2 }],
      [450, { ...cross, sy: 0.93, sx: 1.06, y: 2.5, mFlutter: 0.8, mPuff: 0.3, earTiltL: 14, earTiltR: 14 }],
      [900, { ...cross, lid: 0.24, lidTilt: 0.55, y: 1 }],
      [1300, {}],
    ];
    if (t > 450 && t < 700) {
      const decay = 1 - (t - 450) / 250;
      shakeX = Math.sin(((t - 450) / 1000) * Math.PI * 2 * 12) * 1.2 * decay;
    }
  } else if (mood === "sulk") {
    // Turns away, sneaks a glance back, then turns away again. Hmph.
    const cross: Partial<Pose> = { lid: 0.22, lidTilt: 0.45, lidCurve: 0.04 };
    keys = [
      [0, { ...cross, lookX: dir * 0.95, lookY: 0.15, lookMix: 1, rot: dir * 8, x: dir * 3 }],
      [1400, { ...cross, lookX: -dir * 0.3, lookY: 0.05, lookMix: 1, rot: dir * 6, x: dir * 2 }],
      [1800, { ...cross, lookX: dir * 0.95, lookY: 0.2, lookMix: 1, rot: dir * 9, x: dir * 3, sy: 0.97, sx: 1.02 }],
      [2800, {}],
    ];
  } else if (mood === "yawn") {
    // A long stretch with eyes squeezed shut (edges kept parallel), then droops.
    keys = [
      [0, { sy: 1.02, lid: 0.2, lidCurve: 0.05 }],
      [250, { sy: 1.08, sx: 0.95, y: -4, lid: 0.58, lidCurve: 0.2, cheek: 0.2, cheekCurve: -0.2, earPerk: 0.4, mPuff: 0.2 }],
      [1500, { sy: 0.97, sx: 1.03, y: 2, lid: 0.4, lidCurve: 0.05, earPerk: -0.3 }],
      [2000, { lid: 0.36, lidCurve: 0.04 }],
      [2400, {}],
    ];
  } else if (mood === "fidget") {
    // Can’t sit still: little shuffles side to side and darting glances.
    keys = [];
    for (let i = 0; i < 6; i++) {
      const s = i % 2 ? 1 : -1;
      keys.push([
        i * 260,
        { x: s * 4, rot: s * 4, y: i % 3 === 0 ? -3 : 0, lookX: -s * 0.7, lookY: (i % 3) * 0.2 - 0.2, lookMix: 0.8 },
      ]);
    }
    keys.push([1600, {}]);
  } else if (mood === "hum") {
    // A contented little sway, as if humming a tune.
    const glad: Partial<Pose> = { cheek: 0.54, cheekCurve: 0.15, open: 1.06, wide: 1.04, mLift: 0.3 };
    keys = [[0, glad]];
    for (let i = 0; i < 6; i++) {
      const s = i % 2 ? 1 : -1;
      keys.push([150 + i * 380, { ...glad, rot: s * 4, x: s * 1.5, y: -1.5, sy: 1.02 }]);
    }
    keys.push([2600, {}]);
  } else if (mood === "checkin") {
    // Turns from what they're watching to look out at you for a moment.
    keys = [
      [0, { lookX: 0, lookY: -0.05, lookMix: 1, open: 1.05, wide: 1.02, rot: dir * 2.5, y: -1 }],
      [1150, {}],
    ];
  } else if (mood === "dizzy") {
    // Whoa — eyes swirl, Mote wobbles in little circles, then shakes it off.
    const woozy: Partial<Pose> = { open: 0.88, wide: 0.95, lookMix: 1, mLift: -0.3 };
    keys = [
      [0, { open: 1.15, wide: 0.95, y: -3, sy: 1.04, sx: 0.97 }],
      [220, woozy],
      [2300, { open: 1.02 }],
      [2700, {}],
    ];
    const up = Math.min(1, Math.max(0, (t - 150) / 350));
    const down = Math.min(1, Math.max(0, (2300 - t) / 400));
    swirl = up * down;
    const w = t / 1000;
    wobble = {
      x: Math.sin(w * 9) * 4 * swirl,
      rot: Math.sin(w * 9 + 1) * 7 * swirl,
      y: Math.cos(w * 18) * 1.5 * swirl,
      openBias: Math.sin(w * 11) * 0.18 * swirl,
      earTiltL: Math.sin(w * 20) * 12 * swirl,
      earTiltR: Math.sin(w * 20 + 2) * 12 * swirl,
      mShift: Math.sin(w * 13) * 0.4 * swirl,
    };
    if (t > 2300 && t < 2750) {
      const decay = 1 - (t - 2300) / 450;
      const shake = Math.sin(((t - 2300) / 1000) * Math.PI * 2 * 10);
      shakeX = shake * 3 * decay;
      shakeRot = shake * 2 * decay;
    }
  } else if (mood === "purr") {
    // Melts into the petting: blissful arcs, sinking and leaning in, a soft rumble.
    const bliss: Partial<Pose> = {
      cheek: 0.7,
      cheekCurve: 0.16,
      open: 0.98,
      wide: 1.06,
      sy: 0.97,
      sx: 1.03,
      y: 2.5,
      earPerk: -0.35,
      earTiltL: 10,
      earTiltR: 10,
      mLift: 0.3,
      mPuff: 0.15,
    };
    const since = extras.sincePet ?? 0;
    if (since <= 0) {
      keys = [[0, bliss]];
      purr = 1;
    } else {
      keys = [
        [0, bliss],
        [600, { ...bliss, cheek: 0.6, cheekCurve: 0.18, sy: 0.99, sx: 1.01, y: 1 }],
        [1000, {}],
      ];
      purr = Math.max(0, 1 - since / 700);
      t = since;
    }
  }

  const pose: Pose = { ...REST, ...keyed(t, keys) };
  for (const k of Object.keys(wobble) as Array<keyof Pose>) pose[k] += wobble[k] ?? 0;
  return { pose, shakeX, shakeRot, swirl, purr };
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

/** Debug option: sleeping eyes as plain flat lines, top and bottom parallel. */
const SLEEP_LINE: Partial<Pose> = {
  open: 0.12,
  wide: 1.12,
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
  /** Extra per-eye gaze nudge, used by the dizzy swirl. */
  offset: { x: number; y: number } = { x: 0, y: 0 },
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
  const cx = (side === "l" ? GEO.eyeLX : GEO.eyeRX) + gazeX * (15 - 3 * edge) + offset.x * 15;
  // Eyes travel less when looking down, so they never crowd the mustache.
  const cy = GEO.eyeY + gazeY * (gazeY > 0 ? 8 : 12) + offset.y * 10 + (baseH - h) * 0.14;
  const top = cy - h / 2;
  const bottom = cy + h / 2;

  const lid =
    lerp(pose.lid, 0, wink) + bias * pose.lidBias;
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

/**
 * Accessories react to whatever the face is doing: ears perk with wide eyes and
 * droop with heavy lids or a frown, the mustache lifts with a smile.
 */
export function coupleAccessories(target: Pose) {
  target.earPerk +=
    0.9 * (target.open - 1) -
    0.55 * Math.max(0, target.lid) +
    0.25 * Math.max(0, target.cheek - 0.3);
  target.earTiltL += target.lidTilt * 14;
  target.earTiltR += target.lidTilt * 14;
  target.mLift += 0.7 * target.cheek - 0.5 * target.lidTilt;
  target.mPuff += 0.4 * Math.max(0, target.open - 1);
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
    hp: q<SVGGElement>(svg, "headphones"),
    hpBand: q<SVGPathElement>(svg, "hp-band"),
    hpCupL: q<SVGRectElement>(svg, "hp-cup-l"),
    hpCupR: q<SVGRectElement>(svg, "hp-cup-r"),
    hpEarL: q<SVGGElement>(svg, "hp-ear-l"),
    hpEarR: q<SVGGElement>(svg, "hp-ear-r"),
    mu: q<SVGGElement>(svg, "mustache"),
    puffs: Array.from({ length: MUSTACHE_PUFFS }, (_, i) => q<SVGCircleElement>(svg, `puff-${i}`)),
  };

  const options: EngineOptions = {
    followPointer: true,
    naps: true,
    energy: "normal",
    headphones: false,
    mustache: false,
    audio: null,
  };
  const debug = {
    timeScale: 1,
    frozen: false,
    autoMoods: true,
    loop: false,
    guides: false,
    manual: null as ManualFace | null,
    sleepLine: false,
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
  // Accessories pop on and off, and trail a little behind the body.
  const presence = { hp: { x: 0, v: 0 }, mu: { x: 0, v: 0 } };
  const accLag = { y: 0, v: 0 };
  let nextEarTwitch = 4000;
  let earTwitch = { side: 1, until: 0 };
  let nextItch = 6000;
  let itchUntil = 0;
  // Petting, and too much shaking (of the pointer or the window) making Mote dizzy.
  const petAt = { t: Number.NEGATIVE_INFINITY, x: 0, y: 0 };
  const shakes: Record<"pointer" | "window", Array<{ t: number; d: number }>> = {
    pointer: [],
    window: [],
  };
  let dizzyReadyAt = 0;
  const lastScreen = { x: window.screenX, y: window.screenY };
  let swirlNow = 0;
  let purrNow = 0;

  // The mind: feelings, their drift timers, and a tally of reactions.
  let feel: MindValues = loadMind();
  const driftAt: MindValues = { happy: 40_000, restless: 40_000, alert: 60_000 };
  const fired: Record<string, { count: number; at: number }> = {};
  let moodsNow: LastingMood[] = lastingMoods(feel);
  let savedAt = 0;
  const tally = { pet: 0, company: 0, sound: 0 };
  let lastDragReact = Number.NEGATIVE_INFINITY;
  let watching = false;
  let wasClose = false;
  // Interest: Mote stays intrigued for a while after you last did something
  // with the window, and while sound keeps playing elsewhere (with a little
  // grace, since that report comes and goes).
  let youUntil = Number.NEGATIVE_INFINITY;
  let audioSeenAt = Number.NEGATIVE_INFINITY;
  let lastAudio: { dx: number; dy: number } | null = null;
  let interest: "media" | "you" | null = null;
  const engage = () => {
    youUntil = clock + 15_000;
  };

  const log = (text: string) => hooks.onEvent?.(text);

  const react = (id: string) => {
    const r = reactionById.get(id);
    if (!r) return;
    const tick = (fired[id] ??= { count: 0, at: 0 });
    tick.count++;
    tick.at = clock;
    if (r.effects) feel = nudge(feel, r.effects);
    log(`reaction: ${r.name.toLowerCase()}`);
  };

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
    if (next === "dizzy") blinkAt(now + 2680, true);
    if (next === "checkin") blinkAt(now + 40);
    if (prev === "dizzy") dizzyReadyAt = now + 4000;
    if (next === "settle" && prev === "doze") blinkAt(now + 60, true);
  };

  /** Which little idle moods are on the cards depends on how Mote feels. */
  const pick = (): Mood => {
    const has = (m: LastingMood) => moodsNow.includes(m);
    let bag: Mood[] = [...BAG];
    const more = (m: Mood, n: number) => {
      for (let i = 0; i < n; i++) bag.push(m);
    };
    if (has("frustrated")) {
      bag = bag.filter((m) => m !== "cute" && m !== "surprise");
      more("huff", 3);
      more("sulk", 3);
      more("frustrate", 1);
    } else if (has("annoyed")) {
      bag.splice(bag.indexOf("cute"), 1);
    }
    if (has("happy")) {
      more("hum", 2);
      more("cute", 2);
    }
    if (has("restless")) {
      more("fidget", 3);
      more("glance", 2);
    }
    if (has("calm")) bag = bag.filter((m) => m !== "surprise");
    if (has("sleepy")) more("yawn", 2);
    if (has("alert")) {
      more("glance", 1);
      more("surprise", 1);
    }
    if (options.mustache) bag.push(...ACCESSORY_MOODS.mustache);
    if (options.headphones) bag.push(...ACCESSORY_MOODS.headphones);
    const opts = bag.filter((m) => m !== lastAct);
    react("idle-mood");
    return opts[Math.floor(Math.random() * opts.length)] ?? "glance";
  };

  /** How long until Mote does something on their own next. */
  const actGap = (watchingMedia: boolean, engaged: boolean) => {
    if (watchingMedia) {
      const fl = feelings(feel);
      return (15_000 + Math.random() * 20_000) * (1 - 0.3 * fl.restless + 0.4 * fl.calm);
    }
    // Busy with you, Mote does fewer random things.
    return restGap() * (engaged ? 2 : 1);
  };

  const restGap = () => {
    const has = (m: LastingMood) => moodsNow.includes(m);
    const pace = has("restless") ? 0.55 : has("calm") ? 1.6 : 1;
    // Most of the time Mote just rests; little moods are the exception.
    return (7000 + Math.random() * 9000) * ENERGY_GAP[options.energy] * pace * (has("sleepy") ? 1.3 : 1);
  };

  /**
   * Adds up how far something has travelled in the last ~0.7s; going much too
   * far, too fast makes Mote dizzy.
   */
  const shaken = (kind: "pointer" | "window", d: number, limit: number) => {
    const list = shakes[kind];
    const t = performance.now();
    list.push({ t, d });
    while (list.length && t - list[0].t > 700) list.shift();
    const travelled = list.reduce((sum, s) => sum + s.d, 0);
    const calm = mood !== "sleep" && mood !== "doze" && mood !== "dizzy" && mood !== "purr";
    if (travelled > limit && calm && clock > dizzyReadyAt && !debug.manual) {
      list.length = 0;
      engage();
      react(kind === "pointer" ? "shake-pointer" : "throw");
      start("dizzy", clock);
    }
  };

  // Only a poke wakes Mote up; moving the pointer around doesn't.
  const onMove = (e: PointerEvent) => {
    const dist = pointer.has ? Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) : 0;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.at = clock;
    pointer.has = true;
    if (options.followPointer && dist > 0) {
      const size = svg.getBoundingClientRect().width || 300;
      shaken("pointer", dist, size * 4.5);
    }
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  const keepFeelings = () => saveMind(feel);
  window.addEventListener("pagehide", keepFeelings);

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

  // Pokes: a happy hop, unless Mote is cross or you keep pestering.
  const handlePoke = (now: number) => {
    engage();
    pokes.push(now);
    while (pokes.length && now - pokes[0] > 2200) pokes.shift();
    if (mood === "sleep" || mood === "doze") {
      react(feel.alert < 4 ? "wake-groggy" : "wake-rested");
      start("wake", now);
    } else if (pokes.length >= 4 && mood !== "frustrate") {
      pokes.length = 0;
      react("poke-spam");
      start("frustrate", now);
    } else if (moodsNow.includes("frustrated")) {
      react("poke-grumpy");
      if (mood !== "frustrate") start("frustrate", now);
    } else if (mood !== "frustrate") {
      react("poke");
      start("delight", now);
    }
  };

  /**
   * The slow side of the mind: feelings drift back toward their baselines
   * (alertness wears off, or recharges while asleep), timed stimuli tick up,
   * and lasting moods are re-read.
   */
  const think = (dt: number, now: number, attention: number, sincePet: number) => {
    const ms = dt * 1000;
    for (const a of ATTRS) {
      driftAt[a.key] -= ms;
      if (driftAt[a.key] > 0) continue;
      driftAt[a.key] += a.every;
      if (a.key === "alert") {
        if (mood === "sleep") react("resting");
        else if (!interest) react("tiring");
      } else {
        const before = feel[a.key];
        feel = { ...feel, [a.key]: driftStep(before, a.toward) };
        if (before !== feel[a.key]) react("drift");
      }
    }

    if (sincePet < 350) {
      tally.pet += ms;
      if (tally.pet >= 1000) {
        tally.pet -= 1000;
        react(mood === "sleep" ? "pet-asleep" : "pet");
      }
    } else tally.pet = 0;

    if (attention > 0.5 && mood !== "sleep") {
      tally.company += ms;
      if (tally.company >= 15_000) {
        tally.company = 0;
        react("company");
      }
    }
    if (attention > 0.5) engage();
    if (attention > 0.5 && !watching) {
      watching = true;
      react("follow");
    } else if (attention < 0.05 && watching) {
      watching = false;
      react("left-alone");
    }

    if (options.audio !== null) {
      tally.sound += ms;
      if (tally.sound >= 30_000) {
        tally.sound = 0;
        react("sound-ongoing");
      }
    } else tally.sound = 0;

    const next = lastingMoods(feel);
    for (const m of next) if (!moodsNow.includes(m)) react(`mood-${m}`);
    for (const m of moodsNow) if (!next.includes(m)) log(`no longer ${m}`);
    moodsNow = next;

    if (now - savedAt > 5000) {
      savedAt = now;
      saveMind(feel);
    }
  };

  const step = (dt: number, now: number) => {
    if (pokeQueued) {
      pokeQueued = false;
      handlePoke(now);
    }

    // What has Mote's interest: what's playing elsewhere, or you.
    const idleFor = pointer.has ? now - pointer.at : 0;
    const sincePet = now - petAt.t;
    if (options.audio !== null) {
      audioSeenAt = now;
      lastAudio = options.audio;
    }
    const media = now - audioSeenAt < 12_000;
    const you = now < youUntil;
    const was = interest;
    interest = media ? "media" : you ? "you" : null;
    if (interest && interest !== was) react(interest === "media" ? "intrigued-media" : "intrigued-you");
    const watchingMedia = media && !you;

    // Left completely alone (nothing playing, you away), a Mote that's actually
    // sleepy nods off. Otherwise never.
    const dozeAfter = feel.alert > 2 ? Number.POSITIVE_INFINITY : 30_000 + (feel.alert / 2) * 60_000;
    if (
      debug.autoMoods &&
      options.naps &&
      !interest &&
      mood === "settle" &&
      pointer.has &&
      idleFor > dozeAfter
    ) {
      react("doze");
      start("doze", now);
    }
    const over =
      mood === "settle" || mood === "sleep"
        ? false
        : mood === "purr"
          ? sincePet > PURR_AFTER
          : now >= moodStart + MOODS[mood].dur;
    if (over) {
      // A doze becomes real sleep only when Mote is properly tired; otherwise
      // they catch themself.
      const fallsAsleep = interest ? feel.alert <= 0.5 : feel.alert <= 2 && idleFor > 8000;
      // A tiny chance a check-in turns into something sweet, more when happy.
      const sweet = 0.03 + 0.12 * clamp((feel.happy - 5) / 5, 0, 1);
      if (debug.loop && mood !== "purr") start(mood, now);
      else if (mood === "doze" && options.naps && fallsAsleep) {
        if (interest) react("drop-off");
        start("sleep", now);
      } else if (mood === "checkin" && Math.random() < sweet) {
        react("check-in-happy");
        start(Math.random() < 0.5 ? "cute" : "delight", now);
      } else {
        start("settle", now);
        nextAct = now + actGap(watchingMedia, you);
      }
    }
    if (debug.autoMoods && mood === "settle" && now >= nextAct) {
      if (interest && options.naps && feel.alert <= 2 && Math.random() < 0.35) {
        react("nod-off");
        start("doze", now);
      } else if (watchingMedia) {
        // Watching something: the only thing Mote does is check in on you.
        react("check-in");
        start("checkin", now);
        nextAct = now + actGap(true, false);
      } else start(pick(), now);
    }
    if (!debug.autoMoods && mood === "settle") nextAct = Math.max(nextAct, now + 1000);

    const t = now - moodStart;
    const { pose: target, shakeX, shakeRot, swirl, purr } = poseFor(mood, t, moodSeed, {
      sleepLine: debug.sleepLine,
      sincePet: sincePet < 350 ? -1 : sincePet - 350,
    });
    swirlNow = swirl;
    // Petting a sleeping Mote gets a sleepy little purr without waking them.
    purrNow = mood === "sleep" && sincePet < 350 ? 0.6 : purr;

    // Lasting moods colour the idle face: a scowl when frustrated, heavy lids
    // when sleepy, brighter eyes when happy or alert. Moods with their own
    // expression mostly override it.
    const fl = feelings(feel);
    const tone = mood === "settle" ? 1 : mood === "glance" ? 0.7 : mood === "think" ? 0.5 : 0;
    if (tone > 0) {
      const heavy = fl.sleepy > 0.3 ? 0.36 + 0.08 * fl.sleepy : 0;
      const scowl = fl.frustrated > 0.2 ? 0.2 + 0.06 * fl.frustrated : 0;
      target.lid += Math.max(heavy, scowl) * tone;
      target.lidTilt += (scowl ? 0.5 * fl.frustrated : 0) * tone;
      target.lidCurve += 0.04 * fl.sleepy * tone;
      target.open += (0.05 * fl.happy + 0.06 * fl.alert - 0.04 * fl.sleepy) * tone;
      target.earPerk += (0.4 * fl.alert - 0.4 * fl.sleepy - 0.3 * fl.frustrated) * tone;
      target.earTiltL += 10 * fl.frustrated * tone;
      target.earTiltR += 10 * fl.frustrated * tone;
      target.mLift += (0.3 * fl.happy - 0.3 * fl.frustrated) * tone;
    }
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
    think(dt, now, attention, sincePet);
    if (now > wander.next) {
      const audio = interest === "media" ? lastAudio : null;
      if (audio) {
        // Watching along: look toward the window that's playing sound.
        wander = {
          x: clamp(audio.dx / 600, -1, 1) + (Math.random() - 0.5) * 0.15,
          y: clamp(audio.dy / 500, -0.8, 0.8) + (Math.random() - 0.5) * 0.1,
          next: now + 1800 + Math.random() * 3000,
        };
      } else {
        const fl = feelings(feel);
        const home = Math.random() < 0.45 - 0.25 * fl.restless;
        const reach = 1 + 0.5 * fl.restless;
        const pace = 1 - 0.5 * fl.restless + 0.6 * fl.calm;
        wander = {
          x: home ? 0 : (Math.random() - 0.5) * 0.9 * reach,
          y: home ? 0 : (Math.random() - 0.5) * 0.5 * reach,
          next: now + (1200 + Math.random() * 2400) * pace,
        };
      }
    }
    // A frustrated Mote doesn't want to look at you quite as much.
    const engaged = attention * (1 - 0.45 * feelings(feel).frustrated);
    const freeX = lerp(wander.x, px, engaged);
    const freeY = lerp(wander.y, py, engaged);
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

    // Looking straight at you up close makes the eyes a touch bigger.
    const close = mood === "settle" && attention > 0.6 && Math.hypot(px, py) < 0.45;
    if (close) {
      target.open += 0.05;
      target.wide += 0.03;
    }
    if (close && !wasClose) react("close");
    wasClose = close;

    // Leaning into the hand that's petting.
    if (mood === "purr" || (mood === "sleep" && sincePet < 600)) {
      const lean = clamp((petAt.x - (rect.left + rect.width / 2)) / (rect.width / 2), -1, 1);
      const fade = mood === "purr" ? 1 : 0.5;
      target.x += lean * 4 * fade;
      target.rot += lean * 6 * fade;
      if (mood === "sleep") target.mLift += 0.3;
    }

    coupleAccessories(target);

    // Little habits while they're worn: an ear flick, a twitchy mustache.
    if (options.headphones && mood === "settle" && now > nextEarTwitch) {
      earTwitch = { side: Math.random() < 0.5 ? -1 : 1, until: now + 130 };
      nextEarTwitch = now + 3500 + Math.random() * 6000;
    }
    if (now < earTwitch.until) {
      if (earTwitch.side < 0) target.earTiltL -= 12;
      else target.earTiltR -= 12;
    }
    if (options.mustache && mood === "settle" && now > nextItch) {
      itchUntil = now + 500;
      nextItch = now + 5000 + Math.random() * 7000;
    }
    if (now < itchUntil) {
      target.mRuffle += 0.45;
      target.mShift += 0.25 * Math.sin(now / 50);
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
    const blinkFree = !["sleep", "wake", "delight", "cute", "sniffle", "groove", "dizzy", "purr"].includes(
      mood,
    );
    const fb = feelings(feel);
    if (blinkFree && now >= nextBlink) {
      blinkAt(now, Math.random() < 0.16);
      nextBlink = now + (2400 + Math.random() * 3600) * (1 + 0.5 * fb.calm - 0.35 * fb.sleepy);
    }
    const slow = mood === "doze" || fb.sleepy > 0.5 || fb.calm > 0.6;
    let blink = 0;
    blinks = blinks.filter((b) => now - b < 900);
    for (const b of blinks) blink = Math.max(blink, blinkCurve(now - b, slow));
    if (mood === "sleep") blink = 0;
    lastBlinkAmt = blink;

    // When the window is dragged, Mote trails behind it a little and swings
    // back into place when it stops.
    const unit = GEO.vbW / (rect.width || 300);
    target.x += clamp(-winSpeed.x * unit * 0.012, -10, 10);
    target.y += clamp(-winSpeed.y * unit * 0.008, -7, 7);
    target.rot += clamp(-winSpeed.x * unit * 0.014, -8, 8);

    // Body follows the gaze a little.
    target.x += gaze.x * 2.5;
    target.rot += gaze.x * 2.5;
    target.y += gaze.y * 1.2;

    // Breathing.
    if (!reduced) {
      const base = mood === "sleep" ? 3400 : mood === "think" ? 1600 : 2600;
      const period = base * (1 + 0.35 * fb.calm - 0.2 * fb.restless);
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
    // A purr is a soft, fast rumble that skips the springs.
    const rumble = purrNow * Math.sin((clock / 1000) * Math.PI * 2 * 11) * m;
    const bx = (view.x + shake.x * m) * m;
    const by = view.y * m;
    const br = (view.rot + shake.rot * m) * m;
    const bsx = 1 + (view.sx - 1) * m - rumble * 0.004;
    const bsy = 1 + (view.sy - 1) * m + rumble * 0.007;
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

    // Dizzy eyes orbit in opposite directions.
    const spin = (clock / 1000) * 14;
    const orbit = 0.5 * swirlNow;
    const l = eyeShape("l", view, gaze.x, gaze.y, blink, {
      x: Math.cos(spin) * orbit,
      y: Math.sin(spin) * orbit,
    });
    const r = eyeShape("r", view, gaze.x, gaze.y, blink, {
      x: Math.cos(-spin + Math.PI / 2) * orbit,
      y: Math.sin(-spin + Math.PI / 2) * orbit,
    });
    setPill(parts.pillL, l.pill);
    setPill(parts.pillR, r.pill);
    parts.lidL?.setAttribute("d", l.lid);
    parts.lidR?.setAttribute("d", r.lid);
    parts.cheekL?.setAttribute("d", l.cheek);
    parts.cheekR?.setAttribute("d", r.cheek);

    const trail = accLag.y - view.y;
    const flop = clamp(trail * 1.6, -14, 14) * m;
    const bounce = clamp(trail * 0.3, -3, 3) * m;
    if (parts.hp) {
      const pr = presence.hp.x;
      parts.hp.style.display = pr < 0.003 ? "none" : "";
      if (pr >= 0.003) {
        const hp = headphoneShape(view, pr, flop);
        parts.hp.setAttribute("transform", hp.group);
        parts.hp.style.opacity = hp.opacity.toFixed(3);
        parts.hpBand?.setAttribute("d", hp.band);
        parts.hpCupL?.setAttribute("transform", hp.cupL);
        parts.hpCupR?.setAttribute("transform", hp.cupR);
        parts.hpEarL?.setAttribute("transform", hp.earL);
        parts.hpEarR?.setAttribute("transform", hp.earR);
      }
    }
    if (parts.mu) {
      const pr = presence.mu.x;
      parts.mu.style.display = pr < 0.003 ? "none" : "";
      if (pr >= 0.003) {
        mustacheShape(view, pr, clock, bounce).forEach((puff, i) => {
          const el = parts.puffs[i];
          el?.setAttribute("cx", f(puff.cx));
          el?.setAttribute("cy", f(puff.cy));
          el?.setAttribute("r", f(puff.r));
        });
      }
    }

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

  const force = (next: Mood) => {
    // A forced purr pretends someone pets Mote for a moment.
    if (next === "purr") petAt.t = clock + 1200;
    start(next, clock);
  };

  /** Inertia (Mote lags behind the window), and dizziness if it's thrown about. */
  // Moves arrive in uneven bursts while the window is dragged, so they're
  // collected here and turned into a smoothed speed once per frame.
  const winMoved = { x: 0, y: 0 };
  const winSpeed = { x: 0, y: 0 };
  const windowMoved = (dx: number, dy: number) => {
    const d = Math.hypot(dx, dy);
    if (d === 0 || d > 2000) return;
    winMoved.x += dx;
    winMoved.y += dy;
    engage();
    if (clock - lastDragReact > 5000) {
      lastDragReact = clock;
      react("drag");
    }
    if (!debug.manual) shaken("window", d, window.innerWidth * 3.5);
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

    // Notice the window itself being moved around the screen. (The Mac app
    // reports moves itself, through `windowMoved`.)
    const sx = "__TAURI_INTERNALS__" in window ? lastScreen.x : window.screenX;
    const sy = "__TAURI_INTERNALS__" in window ? lastScreen.y : window.screenY;
    if (sx !== lastScreen.x || sy !== lastScreen.y) {
      const dx = sx - lastScreen.x;
      const dy = sy - lastScreen.y;
      lastScreen.x = sx;
      lastScreen.y = sy;
      windowMoved(dx, dy);
    }
    if (realDt > 0) {
      const ease = 1 - Math.exp(-realDt * 8);
      winSpeed.x = lerp(winSpeed.x, winMoved.x / realDt, ease);
      winSpeed.y = lerp(winSpeed.y, winMoved.y / realDt, ease);
      winMoved.x = 0;
      winMoved.y = 0;
    }

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

    // Accessory pop-in and trailing run on real time, so they still respond
    // while the debug window has Mote frozen or hand-posed.
    const steps = Math.max(1, Math.ceil(realDt / (1 / 240)));
    const h = realDt / steps;
    for (let s = 0; s < steps; s++) {
      for (const [key, on] of [
        ["hp", options.headphones],
        ["mu", options.mustache],
      ] as const) {
        const pr = presence[key];
        [pr.x, pr.v] = spring(pr.x, pr.v, on ? 1 : 0, 220, 0.5, h);
      }
      [accLag.y, accLag.v] = spring(accLag.y, accLag.v, view.y, 140, 0.35, h);
    }
    render(blink);
    raf = requestAnimationFrame(loop);
  };

  svg.dataset.mood = "settle";
  // Lets a mood be played from the browser console while tuning: $0.mote("twirl").
  (svg as SVGSVGElement & { mote?: (m: Mood) => void }).mote = force;
  raf = requestAnimationFrame(loop);

  const api: FaceEngine = {
    destroy: () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pagehide", keepFeelings);
      keepFeelings();
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onMq);
    },
    configure: (opts) => {
      const before = { ...options };
      Object.assign(options, opts);
      if (before.audio === null && options.audio !== null) react("sound-start");
      // (Skips the first moments, when saved settings are just being restored.)
      if (clock > 1500) {
        if (!before.headphones && options.headphones) react("wear-headphones");
        if (!before.mustache && options.mustache) react("wear-mustache");
      }
      if (!options.naps && (mood === "doze" || mood === "sleep")) start("wake", clock);
      for (const a of ["headphones", "mustache"] as const) {
        if (!options[a] && ACCESSORY_MOODS[a].includes(mood)) start("settle", clock);
      }
    },
    poke: () => {
      pokeQueued = true;
    },
    force,
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
    setSleepLine: (on) => {
      debug.sleepLine = on;
    },
    hitTest: (clientX, clientY) => {
      const ctm = parts.body?.getScreenCTM();
      if (!ctm) return false;
      const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      const nx = (pt.x - GEO.cx) / GEO.faceRx;
      const ny = (pt.y - GEO.cy) / GEO.faceRy;
      return nx * nx + ny * ny <= 1.04;
    },
    pet: (clientX, clientY) => {
      engage();
      const fresh = clock - petAt.t > 350;
      petAt.t = clock;
      petAt.x = clientX;
      petAt.y = clientY;
      if (fresh) log("petting");
      // Petting doesn't wake a sleeping Mote; it just makes them comfy.
      if (mood !== "purr" && mood !== "sleep" && mood !== "dizzy") start("purr", clock);
    },
    windowMoved: (dx, dy) => windowMoved(dx, dy),
    react,
    setFeeling: (attr, value) => {
      feel = { ...feel, [attr]: clamp(value, 0, 10) };
      log(`set ${attr} to ${feel[attr].toFixed(1)}`);
    },
    resetFeelings: () => {
      feel = { ...MIND_START };
      log("feelings reset to 5");
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
      petting: clock - petAt.t < 350,
      audio: options.audio !== null,
      intrigued: interest,
      mind: { ...feel },
      moods: [...moodsNow],
      driftIn: { ...driftAt },
      reactions: Object.fromEntries(
        Object.entries(fired).map(([id, r]) => [id, { count: r.count, ago: clock - r.at }]),
      ),
    }),
  };
  // Also reachable from the console while tuning: $0.moteEngine.
  (svg as SVGSVGElement & { moteEngine?: FaceEngine }).moteEngine = api;
  return api;
}
