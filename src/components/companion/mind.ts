// Mote's mind: a mood on two axes, and two bodily needs.
//
//   joy    −10 Frustrated … +10 Joyful
//          How Mote is being *treated*. Petting, playing, attention and
//          winning lift it; meanness, being shaken or thrown around, and
//          losing again and again bring it down. It fades back toward the
//          middle on its own.
//
//   peace  −10 Depressed … +10 Satisfied
//          Whether Mote is being *looked after*. Being rested, fed, and
//          spent time with lift it; being ignored, left hungry or kept up
//          exhausted wear it down. It changes slowly.
//
//   fullness  0 starving … 10 full     (goes down while awake)
//   rest      0 exhausted … 10 rested  (goes down awake, comes back asleep)
//
// Everything here is plain arithmetic, so it can be tested on its own; the
// engine calls `tickMind` as time passes and `nudge` when things happen.

export type Feeling = "joy" | "peace";
export type Need = "fullness" | "rest";
export type MindKey = Feeling | Need;
export type MindValues = Record<MindKey, number>;

/** What a stimulus does to the mood. */
export type Effects = Partial<Record<Feeling, number>>;

export const MIND_START: MindValues = { joy: 2, peace: 3, fullness: 7, rest: 8 };

/** With the mind switched off: even, fed and rested, no lasting moods at all. */
export const MIND_STEADY: MindValues = { joy: 0, peace: 0, fullness: 10, rest: 10 };

export const AXES: Array<{ key: Feeling; low: string; high: string }> = [
  { key: "joy", low: "Frustrated", high: "Joyful" },
  { key: "peace", low: "Depressed", high: "Satisfied" },
];

export const NEEDS: Array<{ key: Need; low: string; high: string }> = [
  { key: "fullness", low: "Starving", high: "Full" },
  { key: "rest", low: "Exhausted", high: "Rested" },
];

/** Friendly mode: however Mote is treated, the mood stops short of this. */
export const FRIENDLY_FLOOR = -3;

export type LastingMood =
  | "joyful"
  | "annoyed"
  | "frustrated"
  | "satisfied"
  | "down"
  | "depressed"
  | "hungry"
  | "starving"
  | "sleepy"
  | "exhausted";

export const LASTING_MOODS: Array<{ id: LastingMood; label: string; test: (v: MindValues) => boolean }> = [
  { id: "joyful", label: "Joyful", test: (v) => v.joy >= 4 },
  { id: "annoyed", label: "Annoyed", test: (v) => v.joy <= -3 && v.joy > -6 },
  { id: "frustrated", label: "Frustrated", test: (v) => v.joy <= -6 },
  { id: "satisfied", label: "Satisfied", test: (v) => v.peace >= 4 },
  { id: "down", label: "Down", test: (v) => v.peace <= -3 && v.peace > -6 },
  { id: "depressed", label: "Depressed", test: (v) => v.peace <= -6 },
  { id: "hungry", label: "Hungry", test: (v) => v.fullness <= 3 && v.fullness > 1 },
  { id: "starving", label: "Starving", test: (v) => v.fullness <= 1 },
  { id: "sleepy", label: "Sleepy", test: (v) => v.rest <= 3 && v.rest > 1 },
  { id: "exhausted", label: "Exhausted", test: (v) => v.rest <= 1 },
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
const clampNeed = (n: number) => Math.max(0, Math.min(10, n));

export function nudge(v: MindValues, e: Effects, friendly = false): MindValues {
  const floor = friendly ? FRIENDLY_FLOOR : -10;
  return {
    ...v,
    joy: clampAxis(v.joy + (e.joy ?? 0), Math.min(floor, v.joy)),
    peace: clampAxis(v.peace + (e.peace ?? 0), Math.min(floor, v.peace)),
  };
}

export function feed(v: MindValues, amount: number): MindValues {
  return { ...v, fullness: clampNeed(v.fullness + amount) };
}

/** How strongly each feeling shows on the face (0..1), fading in gradually. */
export function feelings(v: MindValues) {
  const ramp = (n: number) => Math.max(0, Math.min(1, n));
  return {
    joyful: ramp((v.joy - 3) / 5),
    frustrated: ramp((-v.joy - 2.5) / 5),
    satisfied: ramp((v.peace - 3) / 5),
    depressed: ramp((-v.peace - 2.5) / 5),
    hungry: ramp((3.5 - v.fullness) / 3),
    sleepy: ramp((3.5 - v.rest) / 3),
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
  hour: number;
  friendly: boolean;
};

/** Per minute. */
export const RATES = {
  /** Joy settling back toward the middle. */
  joyFade: 0.02,
  /** Peace rising while Mote is spent time with, fed and rested. */
  company: 0.05,
  /** Peace falling when Mote has been left out for a while. */
  ignored: 0.03,
  /** …faster when you're right there at the computer, just not with Mote. */
  ignoredWhileHere: 1.6,
  /** After this many minutes without attention, Mote counts as ignored. */
  ignoredAfter: 20,
  /** Peace falling from hunger or exhaustion. */
  needing: 0.03,
  /** Peace rising a little in a good sleep. */
  sleepingWell: 0.02,
  /** Fullness used up awake (full to empty in a bit over 4 hours) and asleep. */
  hungerAwake: 0.04,
  hungerAsleep: 0.01,
  /** Rest used up awake (fully rested to exhausted in about 6½ hours)… */
  tireAwake: 0.025,
  /** …faster late at night, and when busy together. */
  tireNight: 1.5,
  tireBusy: 1.3,
  /** Rest coming back asleep (empty to full in 40 minutes). */
  restAsleep: 0.25,
};

const toward = (value: number, target: number, step: number) =>
  Math.abs(target - value) <= step ? target : value + Math.sign(target - value) * step;

/** How the mind moves over `minutes` of time going by. */
export function tickMind(v: MindValues, minutes: number, c: TickContext): MindValues {
  const r = RATES;
  const night = c.hour >= 22 || c.hour < 6;
  let { joy, peace, fullness, rest } = v;

  joy = toward(joy, 0, r.joyFade * minutes);

  if (c.asleep) {
    fullness -= r.hungerAsleep * minutes;
    rest += r.restAsleep * minutes;
    if (fullness >= 3) peace += r.sleepingWell * minutes;
  } else {
    const busy = c.busyTogether ? r.tireBusy : 1;
    fullness -= r.hungerAwake * busy * minutes;
    rest -= r.tireAwake * (night ? r.tireNight : 1) * busy * minutes;
    const attended = c.busyTogether || c.sinceAttention < 10;
    const ignored = !c.busyTogether && c.sinceAttention >= r.ignoredAfter;
    if (attended && fullness >= 4 && rest >= 3) peace += r.company * minutes;
    if (ignored) peace -= r.ignored * (c.youAround ? r.ignoredWhileHere : 1) * minutes;
  }
  if (fullness < 3) peace -= r.needing * minutes;
  if (rest < 2 && !c.asleep) peace -= r.needing * minutes;

  const floor = c.friendly ? FRIENDLY_FLOOR : -10;
  return {
    joy: clampAxis(joy, Math.min(floor, v.joy)),
    peace: clampAxis(peace, Math.min(floor, v.peace)),
    fullness: clampNeed(fullness),
    rest: clampNeed(rest),
  };
}

/**
 * Time with the app closed: Mote sleeps it off and gets a little hungry
 * (never below 3, so they don't wake up starving). A night away is nothing,
 * but past ten hours it gets lonely: peace drifts down toward −2, no further.
 */
export function awayFor(v: MindValues, minutes: number): MindValues {
  if (!(minutes > 0)) return v;
  const lonely = Math.max(0, minutes - 600);
  const peace = v.peace > -2 ? Math.max(-2, v.peace - 0.006 * lonely) : v.peace;
  return {
    joy: toward(v.joy, 0, 0.02 * minutes),
    peace,
    fullness: v.fullness > 3 ? Math.max(3, v.fullness - 0.01 * minutes) : v.fullness,
    rest: clampNeed(v.rest + 0.25 * minutes),
  };
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
      fullness: clampNeed(n(saved.values.fullness, MIND_START.fullness)),
      rest: clampNeed(n(saved.values.rest, MIND_START.rest)),
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

/** Things Mote can eat, from the snack menu. */
export const SNACKS: Array<{ id: string; name: string; fill: number }> = [
  { id: "cookie", name: "A cookie", fill: 1.5 },
  { id: "berries", name: "Some berries", fill: 2.5 },
  { id: "meal", name: "A proper meal", fill: 5 },
];
