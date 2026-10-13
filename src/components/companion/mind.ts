// Mote's mind: a mood on two axes.
//
//   joy    −10 Frustrated … +10 Joyful
//          How Mote is being *treated*. Petting, playing, attention and
//          winning lift it; meanness, being shaken or thrown around, and
//          losing again and again bring it down. It fades back toward the
//          middle on its own.
//
//   peace  −10 Depressed … +10 Satisfied
//          Whether Mote is being *looked after*. Being spent time with
//          lifts it; being ignored wears it down. It changes slowly.
//
// Everything here is plain arithmetic, so it can be tested on its own; the
// engine calls `tickMind` as time passes and `nudge` when things happen.

export type Feeling = "joy" | "peace";
export type MindKey = Feeling;
export type MindValues = Record<MindKey, number>;

/** What a stimulus does to the mood. */
export type Effects = Partial<Record<Feeling, number>>;

export const MIND_START: MindValues = { joy: 2, peace: 3 };

/** With the mind switched off: even, no lasting moods at all. */
export const MIND_STEADY: MindValues = { joy: 0, peace: 0 };

export const AXES: Array<{ key: Feeling; low: string; high: string }> = [
  { key: "joy", low: "Frustrated", high: "Joyful" },
  { key: "peace", low: "Depressed", high: "Satisfied" },
];

/** Friendly mode: however Mote is treated, the mood stops short of this. */
export const FRIENDLY_FLOOR = -3;

export type LastingMood =
  | "joyful"
  | "annoyed"
  | "frustrated"
  | "satisfied"
  | "down"
  | "depressed";

export const LASTING_MOODS: Array<{ id: LastingMood; label: string; test: (v: MindValues) => boolean }> = [
  { id: "joyful", label: "Joyful", test: (v) => v.joy >= 4 },
  { id: "annoyed", label: "Annoyed", test: (v) => v.joy <= -3 && v.joy > -6 },
  { id: "frustrated", label: "Frustrated", test: (v) => v.joy <= -6 },
  { id: "satisfied", label: "Satisfied", test: (v) => v.peace >= 4 },
  { id: "down", label: "Down", test: (v) => v.peace <= -3 && v.peace > -6 },
  { id: "depressed", label: "Depressed", test: (v) => v.peace <= -6 },
];

export function lastingMoods(v: MindValues): LastingMood[] {
  return LASTING_MOODS.filter((m) => m.test(v)).map((m) => m.id);
}

/** Where on the chart Mote is: a corner, along one edge, or the middle. */
export type Quadrant =
  | "happy"
  | "needy"
  | "grumpy"
  | "miserable"
  | "cheerful"
  | "cross"
  | "content"
  | "lonely"
  | "okay";

export const QUADRANT_NAME: Record<Quadrant, string> = {
  happy: "Happy",
  needy: "Needy",
  grumpy: "Grumpy",
  miserable: "Miserable",
  cheerful: "Cheerful",
  cross: "Cross",
  content: "Content",
  lonely: "Lonely",
  okay: "Okay",
};

/**
 * The corners: Happy (treated well and looked after), Needy (treated well
 * when you're around, but too often left out), Grumpy (looked after, but
 * someone's been mean), Miserable (both). When only one axis leans much
 * (2½ or more either way), it's named on its own: Cheerful, Cross, Content,
 * Lonely. Near the middle on both: Okay.
 */
export function quadrant(v: MindValues): Quadrant {
  const j = v.joy >= 2.5 ? 1 : v.joy <= -2.5 ? -1 : 0;
  const p = v.peace >= 2.5 ? 1 : v.peace <= -2.5 ? -1 : 0;
  if (j === 0 && p === 0) return "okay";
  if (p === 0) return j > 0 ? "cheerful" : "cross";
  if (j === 0) return p > 0 ? "content" : "lonely";
  if (j > 0) return p > 0 ? "happy" : "needy";
  return p > 0 ? "grumpy" : "miserable";
}

const clampAxis = (n: number, floor = -10) => Math.max(floor, Math.min(10, n));

export function nudge(v: MindValues, e: Effects, friendly = false): MindValues {
  const floor = friendly ? FRIENDLY_FLOOR : -10;
  return {
    ...v,
    joy: clampAxis(v.joy + (e.joy ?? 0), Math.min(floor, v.joy)),
    peace: clampAxis(v.peace + (e.peace ?? 0), Math.min(floor, v.peace)),
  };
}

/** How strongly each feeling shows on the face (0..1), fading in gradually. */
export function feelings(v: MindValues) {
  const ramp = (n: number) => Math.max(0, Math.min(1, n));
  return {
    joyful: ramp((v.joy - 3) / 5),
    frustrated: ramp((-v.joy - 2.5) / 5),
    satisfied: ramp((v.peace - 3) / 5),
    depressed: ramp((-v.peace - 2.5) / 5),
  };
}

export type TickContext = {
  asleep: boolean;
  /** Minutes since you last did anything with Mote. */
  sinceAttention: number;
  /** You're at the computer (typing, moving the pointer) even if not with Mote. */
  youAround: boolean;
  /** In the middle of a game, or a job together. */
  busyTogether: boolean;
  friendly: boolean;
};

/** Per minute. */
export const RATES = {
  /** Joy settling back toward the middle. */
  joyFade: 0.02,
  /** Peace rising while Mote is spent time with. */
  company: 0.05,
  /** Peace falling when Mote has been left out for a while. */
  ignored: 0.03,
  /** …faster when you're right there at the computer, just not with Mote. */
  ignoredWhileHere: 1.6,
  /** After this many minutes without attention, Mote counts as ignored. */
  ignoredAfter: 20,
  /** Peace rising a little in a nap. */
  sleepingWell: 0.02,
};

const toward = (value: number, target: number, step: number) =>
  Math.abs(target - value) <= step ? target : value + Math.sign(target - value) * step;

/** How the mind moves over `minutes` of time going by. */
export function tickMind(v: MindValues, minutes: number, c: TickContext): MindValues {
  const r = RATES;
  let { joy, peace } = v;

  joy = toward(joy, 0, r.joyFade * minutes);

  if (c.asleep) {
    peace += r.sleepingWell * minutes;
  } else {
    const attended = c.busyTogether || c.sinceAttention < 10;
    const ignored = !c.busyTogether && c.sinceAttention >= r.ignoredAfter;
    if (attended) peace += r.company * minutes;
    if (ignored) peace -= r.ignored * (c.youAround ? r.ignoredWhileHere : 1) * minutes;
  }

  const floor = c.friendly ? FRIENDLY_FLOOR : -10;
  return {
    joy: clampAxis(joy, Math.min(floor, v.joy)),
    peace: clampAxis(peace, Math.min(floor, v.peace)),
  };
}

/**
 * Time with the app closed: a night away is nothing, but past ten hours it
 * gets lonely: peace drifts down toward −2, no further.
 */
export function awayFor(v: MindValues, minutes: number): MindValues {
  if (!(minutes > 0)) return v;
  const lonely = Math.max(0, minutes - 600);
  const peace = v.peace > -2 ? Math.max(-2, v.peace - 0.006 * lonely) : v.peace;
  return { joy: toward(v.joy, 0, 0.02 * minutes), peace };
}

const STORE = "mote.mind.v2";

type Saved = { values: MindValues; at: number };

/** The mind as it was left, with the time since then accounted for. */
export function loadMind(now = Date.now()): { values: MindValues; awayMinutes: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as Saved | null;
    if (!saved?.values) return { values: { ...MIND_START }, awayMinutes: 0 };
    const n = (x: unknown, fb: number) => (typeof x === "number" && Number.isFinite(x) ? x : fb);
    const values: MindValues = {
      joy: clampAxis(n(saved.values.joy, MIND_START.joy)),
      peace: clampAxis(n(saved.values.peace, MIND_START.peace)),
    };
    const awayMinutes = Math.max(0, (now - n(saved.at, now)) / 60_000);
    return { values: awayFor(values, awayMinutes), awayMinutes };
  } catch {
    return { values: { ...MIND_START }, awayMinutes: 0 };
  }
}

export function saveMind(v: MindValues) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ values: v, at: Date.now() } satisfies Saved));
  } catch {
    // Fine: the mood just won't carry over to the next launch.
  }
}
