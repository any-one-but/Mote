import { MUSTACHE_PUFFS, headphoneShape, mustacheShape } from "@/components/companion/accessories";
import {
  ATTRS,
  HUNGER,
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
import {
  DISLIKED,
  LIKED,
  loadMemories,
  mediaKey,
  saveMemories,
  type MediaMemory,
} from "@/components/companion/memory";
import { reactionById } from "@/components/companion/reactions";
import {
  chooseLine,
  lifetime,
  lineById,
  textFor,
  type Bubble,
  type Line,
  type Outcome,
  type SpeechContext,
  type SpeechEvent,
} from "@/components/companion/speech";
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
  // Jolted awake by sound starting.
  | "startle"
  // Things from the tray.
  | "snack"
  | "play"
  // A hungry tummy.
  | "rumble"
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
  /** A speech bubble appears (or goes away, with null). */
  onSpeech?: (bubble: Bubble | null) => void;
  /** The sleep set (earmuffs and mask) goes on or comes off. */
  onSleepSet?: (on: boolean) => void;
};

/** Things from the tray at the bottom of Mote's window. */
export type Item = "sleepset" | "snack" | "ball";

export type Energy = "calm" | "normal" | "lively";

export type EngineOptions = {
  followPointer: boolean;
  naps: boolean;
  energy: Energy;
  headphones: boolean;
  mustache: boolean;
  /**
   * Media playing in another window you can see (null when there's none):
   * where it is relative to Mote's window, what kind it is, and so on.
   */
  media: Media | null;
  /** Where Mote's window sits on its screen, 0..1 from the left / top. */
  placement: { x: number; y: number } | null;
  /** Friendly mode: Mote never gets cross or hurt. */
  friendly: boolean;
};

export type Accessory = "headphones" | "mustache";

export type MediaKind = "music" | "speech" | "video" | "unknown";

/** Something going on that Mote can turn to look at. */
export type Focus = "media" | "pointer" | "typing";

export type Media = {
  /** Where its window is, from the centre of Mote's window, in screen points. */
  dx: number;
  dy: number;
  kind: MediaKind;
  /** Tempo, for music. */
  bpm: number | null;
  /** Seconds since the last beat, as of this report. */
  beatAgo: number | null;
  /** How loud and lively it is, 0..1. */
  intensity: number;
  title: string | null;
  app: string | null;
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
  petting: boolean;
  /** The media Mote can see and hear, if any. */
  media: Media | null;
  /** Everything Mote is intrigued by right now, and which one they're looking at. */
  intrigued: Array<"media" | "you" | "pointer" | "typing">;
  focus: Focus | null;
  /** How hard Mote is dancing, 0..1. */
  dancing: number;
  /** Media Mote remembers, and how much they like each. */
  memories: MediaMemory[];
  sleepSet: boolean;
  /** What's playing now, as Mote remembers it (if it's playing). */
  nowPlaying: string | null;
  /** Mote's feelings, 0–10, and the lasting moods they add up to. */
  mind: MindValues;
  moods: LastingMood[];
  /** ms until each feeling's next drift step. */
  driftIn: MindValues;
  /** How often each reaction has fired, and when last (ms of Mote's clock ago). */
  reactions: Record<string, { count: number; ago: number }>;
  /** The speech bubble showing now, and ms until Mote next feels like talking. */
  speech: Bubble | null;
  nextSpeechIn: number;
  placement: { x: number; y: number } | null;
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
  /** Answer the question in the speech bubble: green (true) or red (false). */
  answer: (yes: boolean) => void;
  /** Close a remark bubble early. */
  dismissSpeech: () => void;
  /** Debug: say a particular line now (or anything fitting, with no id). */
  say: (lineId?: string) => void;
  /** The pointer, out on the rest of the screen: where, from Mote's centre. */
  pointerElsewhere: (dx: number, dy: number, inside: boolean) => void;
  /** You're typing in another app, whose window is this far from Mote's centre. */
  typingAt: (dx: number, dy: number) => void;
  /** Forget how Mote feels about one piece of media (or all of it). */
  forgetMedia: (key?: string) => void;
  /** Use something from the tray: the sleep set goes on or off, a snack, the ball. */
  useItem: (item: Item) => void;
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
  "startle",
  "snack",
  "play",
  "rumble",
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
  startle: { dur: 1600, tempo: 1.2 },
  snack: { dur: 2400, tempo: 1.1 },
  play: { dur: 2800, tempo: 1.1 },
  rumble: { dur: 1800, tempo: 0.9 },
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
  startle: "Mote jolts awake!",
  snack: "Mote munches a cookie.",
  play: "Mote bops the ball!",
  rumble: "Mote’s tummy rumbles.",
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
    const squish: Partial<Pose> = {
      ...happy,
      cheek: 0.66,
      cheekCurve: 0.2,
      open: 1.06,
      wide: 1.07,
    };
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
      [
        1200,
        {
          lid: 0.5,
          lidCurve: 0.05,
          lidTilt: -0.1,
          y: 5,
          rot: 3,
          lookY: 0.45,
          lookMix: 0.8,
          sy: 0.99,
        },
      ],
      [2200, { lid: 0.26, lidCurve: 0.05, lidTilt: -0.06, y: 1, rot: 1, lookY: 0.2, lookMix: 0.6 }],
      [2900, { lid: 0.6, lidCurve: 0.06, lidTilt: -0.12, y: 7, rot: 5, lookY: 0.5, lookMix: 0.9 }],
    ];
  } else if (mood === "sleep") {
    keys = [[0, sleepPose]];
  } else if (mood === "wake") {
    keys = [
      [
        0,
        extras.sleepLine
          ? { ...SLEEP_LINE, open: 0.3, y: 5, rot: 3 }
          : { ...SLEEP, lid: 0.5, cheek: 0.06, y: 5, rot: 3 },
      ],
      [160, { open: 1.16, wide: 0.98, y: -7, sy: 1.05, sx: 0.96 }],
      [520, { open: 1.04 }],
      [800, {}],
    ];
  } else if (mood === "sniffle") {
    // A tickle builds under the mustache, the eyes squeeze up cutely… achoo.
    const cute: Partial<Pose> = {
      cheek: 0.42,
      cheekCurve: 0.14,
      open: 1.04,
      lookY: 0.15,
      lookMix: 0.4,
    };
    keys = [
      [0, { ...cute, mRuffle: 0.5, mShift: 0.35 }],
      [260, { ...cute, mRuffle: 0.7, mShift: -0.35 }],
      [520, { ...cute, cheek: 0.5, mRuffle: 0.85, mShift: 0.45 }],
      [
        780,
        {
          ...cute,
          cheek: 0.56,
          cheekCurve: 0.16,
          mRuffle: 1,
          mShift: -0.45,
          mPuff: 0.2,
          sy: 1.03,
          sx: 0.985,
          y: -2,
        },
      ],
      [
        1080,
        {
          cheek: 0.66,
          cheekCurve: 0.24,
          mRuffle: 1,
          mShift: 0.2,
          mPuff: 0.35,
          sy: 1.05,
          sx: 0.97,
          y: -4,
          rot: -dir * 3,
        },
      ],
      [
        1340,
        {
          cheek: 0.8,
          cheekCurve: 0.3,
          open: 0.92,
          mPuff: 0.55,
          mLift: 0.5,
          mRuffle: 0.3,
          sy: 0.9,
          sx: 1.08,
          y: 5,
          rot: dir * 4,
        },
      ],
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
      [
        380,
        { lookY: 0.9, lookMix: 1, open: 1.1, mFlutter: 1, mPuff: 0.25, sy: 0.97, sx: 1.03, y: 1 },
      ],
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
      [
        0,
        {
          ...curious,
          lookX: ds * 0.95,
          rot: ds * 6,
          x: ds * 2,
          openBias: ds * 0.06,
          ...toward(ds, 10),
        },
      ],
      [
        700,
        {
          ...curious,
          earPerk: 1.1,
          lookX: ds,
          rot: ds * 7,
          x: ds * 2,
          openBias: ds * 0.06,
          ...toward(ds, 15),
        },
      ],
      [
        1250,
        {
          ...curious,
          earPerk: 0.9,
          lookX: -ds * 0.95,
          rot: -ds * 6,
          x: -ds * 2,
          openBias: -ds * 0.06,
          ...toward(-ds, 12),
        },
      ],
      [
        1950,
        {
          ...curious,
          earPerk: 1.15,
          lookX: -ds,
          rot: -ds * 7,
          x: -ds * 2,
          openBias: -ds * 0.06,
          ...toward(-ds, 16),
        },
      ],
      [
        2450,
        {
          open: 1.14,
          wide: 0.96,
          earPerk: 1.25,
          lookX: 0,
          lookY: -0.45,
          lookMix: 1,
          y: -3,
          sy: 1.03,
          sx: 0.98,
        },
      ],
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
        {
          ...vibe,
          y: 3,
          sy: 0.96,
          sx: 1.03,
          rot: s * 4,
          cupPulse: 1,
          earTiltL: s > 0 ? 10 : -4,
          earTiltR: s > 0 ? -4 : 10,
        },
      ]);
      keys.push([at + 170, { ...vibe, y: -1, sy: 1.02, sx: 0.99, rot: s * 3 }]);
    }
    keys.push([3200, {}]);
  } else if (mood === "flick") {
    // One ear twitches like a cat's; Mote glances up at it, and it twitches again.
    const ear: keyof Pose = dir < 0 ? "earTiltL" : "earTiltR";
    const look: Partial<Pose> = {
      lookX: dir * 0.55,
      lookY: -0.85,
      lookMix: 1,
      open: 1.07,
      rot: dir * 3,
    };
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
      [
        450,
        {
          ...cross,
          sy: 0.93,
          sx: 1.06,
          y: 2.5,
          mFlutter: 0.8,
          mPuff: 0.3,
          earTiltL: 14,
          earTiltR: 14,
        },
      ],
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
      [
        1800,
        {
          ...cross,
          lookX: dir * 0.95,
          lookY: 0.2,
          lookMix: 1,
          rot: dir * 9,
          x: dir * 3,
          sy: 0.97,
          sx: 1.02,
        },
      ],
      [2800, {}],
    ];
  } else if (mood === "yawn") {
    // A long stretch with eyes squeezed shut (edges kept parallel), then droops.
    keys = [
      [0, { sy: 1.02, lid: 0.2, lidCurve: 0.05 }],
      [
        250,
        {
          sy: 1.08,
          sx: 0.95,
          y: -4,
          lid: 0.58,
          lidCurve: 0.2,
          cheek: 0.2,
          cheekCurve: -0.2,
          earPerk: 0.4,
          mPuff: 0.2,
        },
      ],
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
        {
          x: s * 4,
          rot: s * 4,
          y: i % 3 === 0 ? -3 : 0,
          lookX: -s * 0.7,
          lookY: (i % 3) * 0.2 - 0.2,
          lookMix: 0.8,
        },
      ]);
    }
    keys.push([1600, {}]);
  } else if (mood === "hum") {
    // A contented little sway, as if humming a tune.
    const glad: Partial<Pose> = {
      cheek: 0.54,
      cheekCurve: 0.15,
      open: 1.06,
      wide: 1.04,
      mLift: 0.3,
    };
    keys = [[0, glad]];
    for (let i = 0; i < 6; i++) {
      const s = i % 2 ? 1 : -1;
      keys.push([150 + i * 380, { ...glad, rot: s * 4, x: s * 1.5, y: -1.5, sy: 1.02 }]);
    }
    keys.push([2600, {}]);
  } else if (mood === "startle") {
    // From fast asleep to wide awake in a blink: eyes huge, a jump, a shiver.
    keys = [
      [0, { ...sleepPose, open: 0.3 }],
      [
        70,
        {
          open: 1.4,
          wide: 0.85,
          y: -16,
          sy: 1.12,
          sx: 0.9,
          earPerk: 1.5,
          mPuff: 0.5,
          lookY: -0.1,
          lookMix: 1,
        },
      ],
      [450, { open: 1.25, wide: 0.9, y: -5, sy: 1.04, sx: 0.98, earPerk: 1.1 }],
      [900, { open: 1.12, earPerk: 0.6 }],
      [1300, {}],
    ];
    if (t > 70 && t < 520) {
      const decay = 1 - (t - 70) / 450;
      const shiver = Math.sin(((t - 70) / 1000) * Math.PI * 2 * 14);
      shakeX = shiver * 1.6 * decay;
      shakeRot = shiver * 1.2 * decay;
    }
  } else if (mood === "snack") {
    // Leans in to the cookie and munches it, three happy chomps.
    const munch: Partial<Pose> = { cheek: 0.56, cheekCurve: 0.15, lookY: 0.45, lookMix: 1 };
    keys = [
      [0, { lookY: 0.6, lookMix: 1, open: 1.1, wide: 1.04 }],
      [450, { ...munch, y: 3, sy: 0.97, sx: 1.02 }],
      [700, { ...munch, y: 4, sy: 0.92, sx: 1.06, mPuff: 0.3 }],
      [830, { ...munch, y: 1, sy: 1.02, sx: 0.99 }],
      [1050, { ...munch, y: 4, sy: 0.92, sx: 1.06, mPuff: 0.3 }],
      [1180, { ...munch, y: 1, sy: 1.02, sx: 0.99 }],
      [1400, { ...munch, y: 4, sy: 0.92, sx: 1.06, mPuff: 0.3 }],
      [1530, { ...munch, y: 1, sy: 1.02 }],
      [1800, { cheek: 0.7, cheekCurve: 0.26, y: -3, mLift: 0.4 }],
      [2200, {}],
    ];
  } else if (mood === "play") {
    // Watches the ball bounce in, crouches, and bops it with their head.
    keys = [
      [0, { open: 1.1, wide: 1.05, earPerk: 0.6 }],
      [1000, { open: 1.12, sy: 0.92, sx: 1.06, y: 3, earPerk: 0.8 }],
      [1150, { open: 1.05, y: -14, sy: 1.08, sx: 0.95, earPerk: 1 }],
      [1420, { y: 1, sy: 0.95, sx: 1.04 }],
      [1650, { cheek: 0.7, cheekCurve: 0.26, y: -4, mLift: 0.4 }],
      [2400, {}],
    ];
  } else if (mood === "rumble") {
    // A tummy rumble: a low wobble, a worried look down, a little sigh.
    const worried: Partial<Pose> = { lidTilt: -0.35, lookY: 0.7, lookMix: 1, mLift: -0.4, earPerk: -0.4 };
    keys = [
      [0, { ...worried, sy: 1.02 }],
      [300, { ...worried, sy: 0.96, sx: 1.03, y: 2 }],
      [1100, { ...worried, lookY: 0.2, lookX: dir * 0.4, sy: 0.98, y: 1 }],
      [1500, {}],
    ];
    if (t > 300 && t < 1000) {
      const fade = 1 - (t - 300) / 700;
      const wobble = Math.sin(((t - 300) / 1000) * Math.PI * 2 * 7);
      shakeX = wobble * 1.4 * fade;
    }
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

/** Where the ball is, `t` ms into a game, coming in from side `dir`. */
export function ballAt(t: number, dir: number) {
  const cx = GEO.cx;
  const lerp2 = (a: number, b: number, u: number) => a + (b - a) * u;
  if (t < 1150) {
    const u = t / 1150;
    const x = lerp2(cx + dir * 170, cx + dir * 12, u);
    // One bounce along the ground, then a rising arc to the top of Mote's head.
    const y =
      u < 0.35
        ? 238 - Math.abs(Math.sin((Math.PI * u) / 0.35)) * 45
        : lerp2(238, 22, (u - 0.35) / 0.65) - Math.sin((Math.PI * (u - 0.35)) / 0.65) * 30;
    return { x, y, spin: t / 4 };
  }
  // Bopped: up and away the other way.
  const v = (t - 1150) / 1450;
  return { x: cx + dir * 12 - dir * v * 280, y: 22 - v * 200 + v * v * 140, spin: t / 3 };
}

/** Where the cookie is, and how much of it is left, `t` ms into a snack. */
export function cookieAt(t: number) {
  const u = Math.min(1, t / 450);
  const ease = 1 - (1 - u) ** 3;
  const left = t < 700 ? 1 : t < 1050 ? 0.72 : t < 1400 ? 0.45 : t < 1530 ? 0.2 : 0;
  return { x: GEO.cx + 80 * (1 - ease), y: 262 - (262 - 188) * ease, left };
}

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

  const lid = lerp(pose.lid, 0, wink) + bias * pose.lidBias;
  const lidTilt = pose.lidTilt;
  const lidCurve = pose.lidCurve;
  const cheek = lerp(pose.cheek, 0.78, wink) + bias * pose.cheekBias + 0.05 * clamp(-gazeY, 0, 1);
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
  const reach = Math.PI / 2 / CHEEK_SPAN;
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
  const cheekPath =
    cheekEdge +
    `L${f(cx + inward * span)} ${f(bottom + far)}L${f(cx - inward * span)} ${f(bottom + far)}Z`;

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
    sleepset: q<SVGGElement>(svg, "sleepset"),
    cookie: q<SVGGElement>(svg, "cookie"),
    ball: q<SVGGElement>(svg, "ball"),
  };

  const options: EngineOptions = {
    followPointer: true,
    naps: true,
    energy: "normal",
    headphones: false,
    mustache: false,
    media: null,
    placement: null,
    friendly: false,
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
  const presence = { hp: { x: 0, v: 0 }, mu: { x: 0, v: 0 }, ss: { x: 0, v: 0 } };
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
  const driftAt: MindValues = Object.fromEntries(ATTRS.map((a) => [a.key, a.every])) as MindValues;
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
  let mediaSeenAt = Number.NEGATIVE_INFINITY;
  let lastMedia: Media | null = null;
  let interest: "media" | "you" | null = null;

  // The pointer out on the rest of the screen: whipping it around catches
  // Mote's eye for a moment.
  const pointerTrail: Array<{ t: number; d: number }> = [];
  const pointerOut = { dx: 0, dy: 0, has: false };
  let pointerUntil = Number.NEGATIVE_INFINITY;
  // Typing in another app: Mote looks over at it and finds it intriguing.
  let typingUntil = Number.NEGATIVE_INFINITY;
  const typingSpot = { dx: 0, dy: 0 };
  // Split attention: which of the things going on Mote is looking at.
  let focus: Focus | null = null;
  let focusUntil = 0;
  // Dancing: a beat clock kept in step with the music, and how hard Mote is
  // dancing (eased in and out).
  let beatOrigin = 0;
  let beatPeriod = 500;
  let dance = 0;
  let groove = { x: 0, y: 0, rot: 0, sx: 0, sy: 0 };
  // Memory of media: what's on now, and everything remembered.
  const memories: Record<string, MediaMemory> = loadMemories();
  let nowPlaying: string | null = null;
  let memoriesSavedAt = 0;
  const engage = () => {
    youUntil = clock + 15_000;
  };

  // Speech: the bubble showing, when Mote next feels like talking, what was
  // said recently, and something that just happened Mote might mention.
  let bubble: Bubble | null = null;
  let bubbleSeq = 0;
  let nextSpeechAt = 50_000 + Math.random() * 50_000;
  const lastSaid = new Map<string, number>();
  let pendingEvent: { event: SpeechEvent; at: number } | null = null;
  const movedSince = { x: 0, y: 0 };
  let pettedSince = false;
  let napGranted = false;
  // Things from the tray.
  let sleepSet = false;
  let fedSince = false;

  const log = (text: string) => hooks.onEvent?.(text);

  /** In Friendly mode, nothing makes Mote less happy. */
  const kindly = (effects: Partial<MindValues> | undefined) =>
    effects && options.friendly && (effects.happy ?? 0) < 0 ? { ...effects, happy: 0 } : effects;

  const react = (id: string) => {
    const r = reactionById.get(id);
    if (!r) return;
    const tick = (fired[id] ??= { count: 0, at: 0 });
    tick.count++;
    tick.at = clock;
    const effects = kindly(r.effects);
    if (effects) feel = nudge(feel, effects);
    log(`reaction: ${r.name.toLowerCase()}`);
    if (effects?.happy) associate(effects.happy * 0.6);
  };

  /**
   * Training: good and bad moments while something plays rub off on it. Mote
   * remembers, and feels that way about it next time.
   */
  const associate = (amount: number) => {
    if (options.friendly && amount < 0) return;
    if (!nowPlaying || !memories[nowPlaying] || amount === 0) return;
    const m = memories[nowPlaying];
    const before = m.score;
    m.score = Math.max(-6, Math.min(6, m.score + amount));
    if (before < LIKED && m.score >= LIKED) log(`now likes “${m.name}”`);
    if (before > DISLIKED && m.score <= DISLIKED) log(`now dislikes “${m.name}”`);
  };

  const liking = () => (nowPlaying ? (memories[nowPlaying]?.score ?? 0) : 0);

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
    if (next === "startle") blinkAt(now + 900, true);
    if (prev === "dizzy") dizzyReadyAt = now + 4000;
    if (prev === "dizzy" && next !== "dizzy") mention("dizzy-over", 0.5);
    if (prev === "purr" && next !== "purr") mention("petted", 0.35);
    if (next === "settle" && prev === "doze") blinkAt(now + 60, true);
  };

  /** Maybe bring up something that just happened, next time Mote can talk. */
  const mention = (event: SpeechEvent, chance: number) => {
    if (Math.random() < chance) pendingEvent = { event, at: clock };
  };

  const speechContext = (): SpeechContext => ({
    feel,
    moods: moodsNow,
    interest,
    asleep: mood === "sleep",
    event: pendingEvent?.event ?? null,
    hour: new Date().getHours(),
    headphones: options.headphones,
    mustache: options.mustache,
    placement: options.placement,
    media:
      interest === "media" && lastMedia
        ? {
            name: nowPlaying ? (memories[nowPlaying]?.name ?? null) : null,
            kind: lastMedia.kind,
            liking: liking(),
            dancing: dance > 0.3,
          }
        : null,
  });

  const showBubble = (b: Bubble | null) => {
    bubble = b;
    hooks.onSpeech?.(b);
  };

  /** How long until Mote next feels like saying something. */
  const speechGap = () => {
    const fl = feelings(feel);
    const pace = (1 - 0.3 * fl.restless + 0.3 * fl.calm) * (1 + 0.4 * fl.sleepy);
    const watching = interest === "media" ? 1.5 : 1;
    // A hungry Mote speaks up far more often (mostly to ask for food).
    const hungry = options.friendly ? 0 : fl.hungry;
    return (
      (60_000 + Math.random() * 90_000) * pace * watching * ENERGY_GAP[options.energy] * (1 - 0.75 * hungry)
    );
  };

  const say = (line: Line, now: number) => {
    const c = speechContext();
    const text = textFor(line, c);
    lastSaid.set(line.id, now);
    pendingEvent = null;
    movedSince.x = 0;
    movedSince.y = 0;
    pettedSince = false;
    fedSince = false;
    showBubble({
      id: ++bubbleSeq,
      lineId: line.id,
      kind: line.kind,
      text,
      direction: line.direction?.(c),
      born: now,
      ttl: lifetime(line.kind, text),
    });
    react("speak");
    log(`says “${text}”`);
  };

  /** A bubble is answered, acted on, ignored, or simply over. */
  const resolve = (outcome: Outcome, now: number) => {
    const b = bubble;
    if (!b) return;
    showBubble(null);
    nextSpeechAt = Math.max(nextSpeechAt, now + speechGap());
    const line = lineById.get(b.lineId);
    if (b.reply || !line) return;
    const effects = kindly(line.effects?.[outcome]);
    if (effects) feel = nudge(feel, effects);
    if (effects?.happy) associate(effects.happy * 0.6);
    // Asked straight out whether you like what's on: that sticks.
    if (line.id === "liking-this" && (outcome === "yes" || outcome === "no")) {
      associate(outcome === "yes" ? 1.2 : -1.2);
    }
    if (outcome !== "done") react(`answer-${outcome}`);
    const then = line.then?.[outcome];
    if (then === "nap" && mood !== "sleep") {
      napGranted = true;
      start("doze", now);
    }
    if (then === "play-again") start("play", now);
    if (then === "unmask") setSleepSet(false, true);
    const replies = (options.friendly && line.kindReplies?.[outcome]) || line.replies?.[outcome];
    if (replies?.length) {
      const text = replies[Math.floor(Math.random() * replies.length)];
      showBubble({
        id: ++bubbleSeq,
        lineId: line.id,
        kind: "flavor",
        text,
        born: now,
        ttl: Math.min(5000, 1500 + text.length * 55),
        reply: true,
      });
      log(`says “${text}”`);
    }
  };

  /** How far the window has been carried toward where Mote asked to go. */
  const moveProgress = (b: Bubble) => {
    const along =
      b.direction === "left"
        ? -movedSince.x
        : b.direction === "right"
          ? movedSince.x
          : b.direction === "up"
            ? -movedSince.y
            : movedSince.y;
    const span =
      b.direction === "up" || b.direction === "down" ? screen.availHeight : screen.availWidth;
    return along / Math.max(160, span * 0.15);
  };

  /** Speech each frame: resolve the current bubble, or maybe start one. */
  const speak = (now: number) => {
    if (pendingEvent && now - pendingEvent.at > 6000) pendingEvent = null;
    if (bubble) {
      const age = now - bubble.born;
      if (bubble.kind === "move" && moveProgress(bubble) >= 1) resolve("moved", now);
      else if (bubble.kind === "pet" && pettedSince) resolve("petted", now);
      else if (bubble.kind === "feed" && fedSince) resolve("fed", now);
      else if (age > bubble.ttl) resolve(bubble.kind === "flavor" ? "done" : "ignored", now);
      return;
    }
    if (debug.manual) return;
    const busy = ["dizzy", "doze", "wake", "purr", "delight", "snack", "play", "startle"].includes(
      mood,
    );
    if (busy) return;
    if (pendingEvent) {
      const line = chooseLine(speechContext(), lastSaid, now, 2 * 60_000, options.friendly);
      pendingEvent = null;
      if (line) say(line, now);
      return;
    }
    if (now < nextSpeechAt) return;
    nextSpeechAt = now + speechGap();
    // Asleep, Mote only talks in their sleep, and rarely.
    if (mood === "sleep" && Math.random() > 0.25) return;
    const line = chooseLine(speechContext(), lastSaid, now, undefined, options.friendly);
    if (line) say(line, now);
  };

  /** Say a particular line right away (things from the tray get an answer now). */
  const sayNow = (id: string) => {
    const line = lineById.get(id);
    if (!line) return;
    if (bubble) showBubble(null);
    say(line, clock);
  };

  /** The sleep set goes on or off. `quietly` skips any remark. */
  const setSleepSet = (on: boolean, quietly = false) => {
    if (on === sleepSet) return;
    sleepSet = on;
    hooks.onSleepSet?.(on);
    if (on) {
      react("sleepset-on");
      if (mood === "sleep") {
        // Fast asleep already: it goes on without waking them.
        if (Math.random() < 0.5) sayNow("masked-asleep");
      } else if (feel.alert <= 4 || mood === "doze") {
        react("sleepset-sleepy");
        sayNow("masked-sleepy");
        napGranted = true;
        start("doze", clock);
      } else {
        // Wide awake, and suddenly in the dark.
        react("sleepset-awake");
        sayNow("masked-awake");
      }
    } else {
      react("sleepset-off");
      if (!quietly && mood !== "sleep" && mood !== "doze") mention("unmasked", 0.7);
    }
  };

  const useItem = (item: Item) => {
    if (item === "sleepset") {
      setSleepSet(!sleepSet);
      return;
    }
    // Asleep, or wearing the mask: no snacks or games.
    if (mood === "sleep" || mood === "doze" || sleepSet) return;
    engage();
    if (item === "snack") {
      // Already full up? Then no thanks.
      if (feel.full >= 9) {
        react("snack-full");
        sayNow("full");
        return;
      }
      const wasHungry = feel.full <= 3 && !options.friendly;
      react("snack");
      if (wasHungry) react("fed-hungry");
      if (bubble?.kind === "feed") fedSince = true;
      start("snack", clock);
      if (!bubble) mention("snacked", 0.6);
    } else {
      react("play");
      start("play", clock);
      mention("played", 0.5);
    }
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
    // Too hungry for cute: no wiggles or happy humming on an empty tummy.
    if (has("hungry") || has("starving")) {
      bag = bag.filter((m) => m !== "cute" && m !== "hum" && m !== "surprise");
    }
    if (has("hungry")) more("rumble", 3);
    if (has("starving")) {
      more("rumble", 5);
      more("sulk", 2);
    }
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
    return (
      (7000 + Math.random() * 9000) * ENERGY_GAP[options.energy] * pace * (has("sleepy") ? 1.3 : 1)
    );
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
      if (sleepSet) setSleepSet(false, true);
      const groggy = feel.alert < 4;
      react(groggy ? "wake-groggy" : "wake-rested");
      mention(groggy ? "woke-groggy" : "woke-rested", 0.6);
      start("wake", now);
    } else if (pokes.length >= 4 && mood !== "frustrate") {
      pokes.length = 0;
      if (options.friendly) {
        // Lots of pokes just tickle.
        react("poke-giggle");
        start("cute", now);
      } else {
        react("poke-spam");
        start("frustrate", now);
      }
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
  /**
   * Getting hungrier. Asleep it's far slower and stops at peckish, so Mote
   * never wakes up starving. In Friendly mode there's no hunger at all. Awake
   * and hungry, each pang makes Mote crosser, more so the hungrier they are.
   */
  const hungerTick = () => {
    if (options.friendly) return;
    const before = feel.full;
    if (mood === "sleep") {
      if (before > HUNGER.sleepFloor) {
        feel = { ...feel, full: Math.max(HUNGER.sleepFloor, before - HUNGER.asleepStep) };
        react("hungering-asleep");
      }
      return;
    }
    react("hungering");
    const hungry = feelings(feel).hungry;
    if (hungry > 0) {
      react("hunger-pangs");
      feel = nudge(feel, { happy: -(0.3 + 1.2 * hungry), restless: 0.3 * hungry });
    }
  };

  const think = (dt: number, now: number, attention: number, sincePet: number) => {
    const ms = dt * 1000;
    for (const a of ATTRS) {
      driftAt[a.key] -= ms;
      if (driftAt[a.key] > 0) continue;
      driftAt[a.key] += a.every;
      if (a.key === "alert") {
        if (mood === "sleep") react("resting");
        else if (!interest && clock > typingUntil) react("tiring");
      } else if (a.key === "full") {
        hungerTick();
      } else {
        // Hunger drags Mote's happy baseline down: the hungrier, the lower.
        const hungry = options.friendly ? 0 : feelings(feel).hungry;
        const toward = a.key === "happy" ? a.toward - 4 * hungry : a.toward;
        const before = feel[a.key];
        feel = { ...feel, [a.key]: driftStep(before, toward) };
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

    if (interest === "media") {
      tally.sound += ms;
      if (tally.sound >= 30_000) {
        tally.sound = 0;
        react("sound-ongoing");
        // Something Mote likes (or can't stand) keeps colouring their mood.
        if (liking() >= LIKED) react("enjoying-media");
        else if (liking() <= DISLIKED && !options.friendly) react("enduring-media");
      }
    } else tally.sound = 0;

    // Friendly mode keeps Mote out of grumpy territory altogether, and
    // never hungry: snacks are just a treat.
    if (options.friendly && feel.happy < 4) feel = { ...feel, happy: 4 };
    if (options.friendly && feel.full < HUNGER.friendlyFloor) {
      feel = { ...feel, full: HUNGER.friendlyFloor };
    }
    const next = lastingMoods(feel);
    for (const m of next) if (!moodsNow.includes(m)) react(`mood-${m}`);
    for (const m of moodsNow) if (!next.includes(m)) log(`no longer ${m}`);
    moodsNow = next;

    if (now - savedAt > 5000) {
      savedAt = now;
      saveMind(feel);
    }
    if (now - memoriesSavedAt > 10_000) {
      memoriesSavedAt = now;
      saveMemories(memories);
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
    if (options.media !== null) {
      mediaSeenAt = now;
      lastMedia = options.media;
    }
    // (A few seconds' grace, since a report can drop out for a moment.)
    // With earmuffs and a mask on, Mote can't see or hear any of it.
    const media = !sleepSet && now - mediaSeenAt < 6000;
    const you = now < youUntil;
    const pointerOutThere = !sleepSet && now < pointerUntil;
    const was = interest;
    interest = media ? "media" : you ? "you" : null;
    if (interest && interest !== was)
      react(interest === "media" ? "intrigued-media" : "intrigued-you");
    if (interest === "media" && was !== "media") {
      // Sound out of nowhere jolts a sleeping Mote awake.
      if (mood === "sleep") {
        react("startled-awake");
        start("startle", now);
        mention("startled", 0.8);
      } else mention("media-start", 0.3);
    }
    const watchingMedia = media && !you;

    // Remember what's playing, and how Mote felt about it last time.
    const key = media && lastMedia ? mediaKey(lastMedia.title, lastMedia.app) : null;
    if ((key?.key ?? null) !== nowPlaying) {
      nowPlaying = key?.key ?? null;
      if (key) {
        const m = (memories[key.key] ??= {
          key: key.key,
          name: key.name,
          app: lastMedia?.app ?? null,
          score: 0,
          times: 0,
          last: 0,
        });
        m.times++;
        m.last = Date.now();
        if (m.score >= LIKED) {
          react("media-liked");
          mention("liked-media", 0.8);
        } else if (m.score <= DISLIKED && !options.friendly) {
          react("media-disliked");
          mention("disliked-media", 0.8);
        }
      }
    }

    // Split attention: the newest thing going on gets a look straight away;
    // after that, Mote's eyes move between whatever is still going on.
    const typing = !sleepSet && now < typingUntil;
    const candidates: Focus[] = [];
    if (media) candidates.push("media");
    if (pointerOutThere) candidates.push("pointer");
    if (typing) candidates.push("typing");
    if (focus && !candidates.includes(focus)) focus = null;
    const focusWas = focus;
    if (candidates.length && (!focus || now > focusUntil)) {
      const kind = lastMedia?.kind ?? "unknown";
      const weight = (c: Focus) =>
        c === "typing"
          ? 3
          : c === "pointer"
            ? 2
            : kind === "video"
              ? 3
              : kind === "music"
                ? 1.5
                : 1;
      const total = candidates.reduce((sum, c) => sum + weight(c), 0);
      let r = Math.random() * total;
      focus = candidates.find((c) => (r -= weight(c)) <= 0) ?? candidates[0];
      focusUntil =
        now + (focus === "pointer" ? 1200 + Math.random() * 1000 : 2500 + Math.random() * 3500);
    }
    // Something new to look at: the eyes go there now, not on the next wander.
    if (focus !== focusWas) wander.next = now;

    // Left completely alone (nothing playing, you away), a Mote that's actually
    // sleepy nods off. Otherwise never.
    const dozeAfter =
      feel.alert > 2 ? Number.POSITIVE_INFINITY : 30_000 + (feel.alert / 2) * 60_000;
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
      const fallsAsleep =
        napGranted || (interest ? feel.alert <= 0.5 : feel.alert <= 2 && idleFor > 8000);
      if (mood === "doze") napGranted = false;
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
        nextAct = now + actGap(watchingMedia, you || typing);
      }
    }
    if (debug.autoMoods && mood === "settle" && now >= nextAct) {
      if (interest && options.naps && feel.alert <= 2 && Math.random() < 0.35) {
        react("nod-off");
        start("doze", now);
      } else if (watchingMedia) {
        // Watching something: all Mote does is check in on you now and then,
        // or, with a video, look away for a little break.
        if (lastMedia?.kind === "video" && Math.random() < 0.4) {
          react("look-away");
          start("glance", now);
        } else {
          react("check-in");
          start("checkin", now);
        }
        nextAct = now + actGap(true, false);
      } else start(pick(), now);
    }
    if (!debug.autoMoods && mood === "settle") nextAct = Math.max(nextAct, now + 1000);
    speak(now);

    const t = now - moodStart;
    const {
      pose: target,
      shakeX,
      shakeRot,
      swirl,
      purr,
    } = poseFor(mood, t, moodSeed, {
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
      target.mLift += (0.3 * fl.happy - 0.3 * fl.frustrated - 0.3 * fl.hungry) * tone;
      // Hungry: a little worried, the outer corners of the brows dropping.
      if (!options.friendly && fl.hungry > 0.2 && fl.frustrated < 0.3) {
        target.lidTilt -= 0.3 * fl.hungry * tone;
      }
    }
    const tempo = mood === "sleep" ? 0.12 : mood === "settle" ? 1 : MOODS[mood].tempo;

    // Playing: eyes on the ball. Snacking: eyes on the cookie.
    if (mood === "play") {
      const b = ballAt(now - moodStart, moodSeed > 0.5 ? 1 : -1);
      target.lookX = clamp((b.x - GEO.cx) / 90, -1, 1);
      target.lookY = clamp((b.y - GEO.eyeY) / 90, -1, 1);
      target.lookMix = 1;
    }

    // Listening to talk (or something Mote can't place): head tilted toward it.
    const m = watchingMedia ? lastMedia : null;
    if (
      m &&
      (m.kind === "speech" || m.kind === "unknown") &&
      ["settle", "checkin"].includes(mood)
    ) {
      target.rot += 4 * Math.sign(m.dx || 1);
      target.open -= 0.03;
    }

    // Dancing to music: how hard depends on how loud and lively it is, how
    // happy Mote is, and whether they like the song.
    // (Music keeps Mote dancing even while you're busy with their window.)
    const tune = media ? lastMedia : null;
    let want = 0;
    if (tune && tune.kind === "music" && ["settle", "checkin", "glance"].includes(mood)) {
      const fl = feelings(feel);
      const taste = liking() >= LIKED ? 1.3 : liking() <= DISLIKED ? 0 : 1;
      want =
        clamp(0.25 + 0.75 * tune.intensity, 0, 1) *
        (0.7 + 0.3 * fl.happy) *
        (1 - 0.8 * fl.frustrated) *
        (1 - 0.5 * fl.sleepy) *
        (1 - 0.6 * (options.friendly ? 0 : fl.hungry)) *
        taste;
      want = clamp(want, 0, 1.2);
    }
    dance += (want - dance) * (1 - Math.exp(-dt * 1.5));
    if (dance > 0.02 && !reduced) {
      // With a beat to follow, Mote bounces on it; without one (music Mote
      // can't quite hear), they just sway along gently.
      const synced = !!lastMedia?.bpm;
      const beats = synced ? (now - beatOrigin) / beatPeriod : now / 680;
      const phase = beats - Math.floor(beats);
      const hit = Math.exp(-phase * 7) * (synced ? 1 : 0.25); // sharp on the beat, easing off
      const sway = Math.sin(beats * Math.PI); // one side per beat, back the next
      groove = {
        x: sway * 1.8 * dance,
        y: (hit * 3 - 1) * dance,
        rot: sway * 5 * dance,
        sx: hit * 0.03 * dance,
        sy: -hit * 0.045 * dance,
      };
      target.earTiltL += hit * 10 * dance;
      target.earTiltR += hit * 10 * dance;
      target.mLift += 0.3 * hit * dance;
      // Really into it: happy, scrunched-up eyes.
      if (dance > 0.75) {
        target.cheek += 0.56;
        target.cheekCurve += 0.15;
      }
    } else groove = { x: 0, y: 0, rot: 0, sx: 0, sy: 0 };

    // While a bubble is up, Mote looks out at you (or toward where they want
    // to go) and bobs a little while the words come out.
    if (bubble && mood !== "sleep" && ["settle", "glance", "checkin"].includes(mood)) {
      const dir = bubble.direction;
      target.lookX = dir === "left" ? -0.8 : dir === "right" ? 0.8 : 0;
      target.lookY = dir === "up" ? -0.75 : dir === "down" ? 0.6 : -0.05;
      target.lookMix = 0.85;
      const talking = now - bubble.born < 300 + bubble.text.length * 32;
      if (talking && !reduced) {
        const w = Math.sin(((now - bubble.born) / 1000) * Math.PI * 2 * 5);
        target.sy += 0.014 * w;
        target.sx -= 0.008 * w;
        target.y -= 0.8 * Math.max(0, w);
      }
    }

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
    const toward = (dx: number, dy: number) => ({
      x: clamp(dx / 600, -1, 1),
      y: clamp(dy / 500, -0.8, 0.8),
    });
    if (focus === "pointer") {
      // Following the pointer out on the screen, live.
      const at = toward(pointerOut.dx, pointerOut.dy);
      wander = { ...at, next: now + 200 };
    } else if (focus === "typing") {
      // Watching you type, with small glances around the page.
      if (now > wander.next) {
        const at = toward(typingSpot.dx, typingSpot.dy);
        wander = {
          x: at.x + (Math.random() - 0.5) * 0.12,
          y: at.y + 0.08 + (Math.random() - 0.5) * 0.08,
          next: now + 900 + Math.random() * 1500,
        };
      }
    } else if (now > wander.next) {
      const m = focus === "media" ? lastMedia : null;
      const dislikes = liking() <= DISLIKED;
      // How much of the time Mote keeps their eyes on it: a video almost
      // always, music and talk less; something disliked, not much at all.
      const stickiness = !m
        ? 0
        : dislikes
          ? 0.3
          : m.kind === "video"
            ? 1
            : m.kind === "music"
              ? 0.5
              : 0.6;
      if (m && Math.random() < stickiness) {
        const at = toward(m.dx, m.dy);
        const jitter = m.kind === "video" ? 0.05 : 0.15;
        wander = {
          x: at.x + (Math.random() - 0.5) * jitter,
          y: at.y + (Math.random() - 0.5) * jitter * 0.6,
          next: now + (m.kind === "video" ? 2000 : 1800) + Math.random() * 3000,
        };
      } else if (m) {
        // Listening rather than watching: eyes drift back toward you.
        wander = {
          x: (Math.random() - 0.5) * 0.4,
          y: (Math.random() - 0.5) * 0.2,
          next: now + 1500 + Math.random() * 2500,
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
    const blinkFree = ![
      "sleep",
      "wake",
      "delight",
      "cute",
      "sniffle",
      "groove",
      "dizzy",
      "purr",
    ].includes(mood);
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
    const bx = (view.x + shake.x * m + groove.x) * m;
    const by = (view.y + groove.y) * m;
    const br = (view.rot + shake.rot * m + groove.rot) * m;
    const bsx = 1 + (view.sx - 1 + groove.sx) * m - rumble * 0.004;
    const bsy = 1 + (view.sy - 1 + groove.sy) * m + rumble * 0.007;
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

    // The sleep set pops on over the eyes (the headphones make way for it).
    if (parts.sleepset) {
      const pr = presence.ss.x;
      parts.sleepset.style.display = pr < 0.003 ? "none" : "";
      parts.sleepset.setAttribute(
        "transform",
        `translate(${GEO.cx} ${GEO.eyeY}) scale(${f(Math.max(0, pr))}) translate(${-GEO.cx} ${-GEO.eyeY})`,
      );
      if (parts.hp)
        parts.hp.style.opacity = (
          Number(parts.hp.style.opacity || 1) * clamp(1 - pr, 0, 1)
        ).toFixed(3);
      // Under the mask, the eyes are hidden completely.
      if (parts.eyes) parts.eyes.style.opacity = pr > 0.35 ? "0" : "1";
    }
    // The cookie and the ball, when they're out.
    if (parts.cookie) {
      const c = mood === "snack" ? cookieAt(clock - moodStart) : null;
      parts.cookie.style.display = c && c.left > 0 ? "" : "none";
      if (c)
        parts.cookie.setAttribute(
          "transform",
          `translate(${f(c.x)} ${f(c.y)}) scale(${f(c.left)})`,
        );
    }
    if (parts.ball) {
      const b = mood === "play" ? ballAt(clock - moodStart, moodSeed > 0.5 ? 1 : -1) : null;
      parts.ball.style.display = b ? "" : "none";
      if (b)
        parts.ball.setAttribute("transform", `translate(${f(b.x)} ${f(b.y)}) rotate(${f(b.spin)})`);
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
    if (bubble?.kind === "move") {
      movedSince.x += dx;
      movedSince.y += dy;
    }
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
        ["ss", sleepSet],
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
      if (before.media === null && options.media !== null) react("sound-start");
      // Keep the beat clock in step with the music without jumping about.
      const m = options.media;
      if (m?.bpm && m.beatAgo !== null) {
        const period = 60_000 / m.bpm;
        const origin = clock - m.beatAgo * 1000;
        if (Math.abs(period - beatPeriod) > 25) {
          beatPeriod = period;
          beatOrigin = origin;
        } else {
          beatPeriod = period;
          const off = ((((origin - beatOrigin) % period) + period * 1.5) % period) - period / 2;
          beatOrigin += off * 0.3;
        }
      }
      // (Skips the first moments, when saved settings are just being restored.)
      if (clock > 1500) {
        if (!before.headphones && options.headphones) react("wear-headphones");
        if (!before.mustache && options.mustache) react("wear-mustache");
        if ((!before.headphones && options.headphones) || (!before.mustache && options.mustache)) {
          mention("accessory-on", 0.7);
        }
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
      if (bubble?.kind === "pet") pettedSince = true;
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
    answer: (yes) => {
      if (bubble?.kind === "ask" && !bubble.reply) resolve(yes ? "yes" : "no", clock);
    },
    dismissSpeech: () => {
      if (bubble?.kind === "flavor") resolve("done", clock);
    },
    pointerElsewhere: (dx, dy, inside) => {
      const d = pointerOut.has ? Math.hypot(dx - pointerOut.dx, dy - pointerOut.dy) : 0;
      pointerOut.dx = dx;
      pointerOut.dy = dy;
      pointerOut.has = true;
      if (inside || d === 0 || mood === "sleep" || !options.followPointer) return;
      const t = clock;
      pointerTrail.push({ t, d });
      while (pointerTrail.length && t - pointerTrail[0].t > 800) pointerTrail.shift();
      const travelled = pointerTrail.reduce((sum, p) => sum + p.d, 0);
      // Moving a lot catches Mote's eye for a moment.
      if (travelled > 700) {
        if (clock > pointerUntil) {
          react("pointer-elsewhere");
          focus = "pointer";
          focusUntil = clock + 1200 + Math.random() * 1000;
        }
        pointerUntil = clock + 2500;
      }
    },
    typingAt: (dx, dy) => {
      if (mood === "sleep") return;
      if (clock > typingUntil) {
        react("typing");
        focus = "typing";
        focusUntil = clock + 2500 + Math.random() * 2000;
        wander.next = clock;
      }
      typingUntil = clock + 3000;
      typingSpot.dx = dx;
      typingSpot.dy = dy;
    },
    useItem,
    forgetMedia: (key) => {
      for (const k of Object.keys(memories)) if (!key || k === key) delete memories[k];
      saveMemories(memories);
      log(key ? "forgot one piece of media" : "forgot all media");
    },
    say: (lineId) => {
      if (bubble) showBubble(null);
      const line = lineId ? lineById.get(lineId) : chooseLine(speechContext(), new Map(), clock);
      if (line) say(line, clock);
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
      media: options.media,
      intrigued: [
        ...(interest === "media" ? (["media"] as const) : []),
        ...(clock < youUntil ? (["you"] as const) : []),
        ...(clock < pointerUntil ? (["pointer"] as const) : []),
        ...(clock < typingUntil ? (["typing"] as const) : []),
      ],
      focus,
      dancing: dance,
      memories: Object.values(memories).sort((a, b) => b.last - a.last),
      sleepSet,
      nowPlaying: nowPlaying ? (memories[nowPlaying]?.name ?? null) : null,
      speech: bubble,
      nextSpeechIn: Math.max(0, nextSpeechAt - clock),
      placement: options.placement,
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
