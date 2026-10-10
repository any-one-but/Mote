// Mote's mind: three feelings scored 0–10 that stimuli push up and down, which
// slowly drift back to a baseline, and which add up to lasting moods.

export type Attr = "happy" | "restless" | "alert";

export type MindValues = Record<Attr, number>;

export const ATTRS: Array<{
  key: Attr;
  /** What 0 and 10 mean. */
  low: string;
  high: string;
  /** Every `every` ms the score takes one step toward `toward`. */
  every: number;
  toward: number;
}> = [
  { key: "happy", low: "Frustrated", high: "Happy", every: 40_000, toward: 5 },
  { key: "restless", low: "Calm", high: "Restless", every: 40_000, toward: 5 },
  // Unlike the others, alertness wears off on its own: left be, Mote gets tired.
  { key: "alert", low: "Sleepy", high: "Alert", every: 60_000, toward: 0 },
];

export const MIND_START: MindValues = { happy: 5, restless: 5, alert: 5 };

/** What each minute asleep (or with the app closed) does: more rested, calmer. */
export const REST_PER_MINUTE = { alert: 1.5, restless: -1 };

export type LastingMood =
  | "frustrated"
  | "annoyed"
  | "happy"
  | "restless"
  | "calm"
  | "sleepy"
  | "alert";

export const LASTING_MOODS: Array<{ id: LastingMood; label: string; test: (v: MindValues) => boolean }> =
  [
    { id: "frustrated", label: "Frustrated", test: (v) => v.happy <= 2.5 },
    { id: "annoyed", label: "Annoyed", test: (v) => v.happy > 2.5 && v.happy < 4 },
    { id: "happy", label: "Happy", test: (v) => v.happy >= 7.5 },
    { id: "restless", label: "Restless", test: (v) => v.restless >= 7.5 },
    { id: "calm", label: "Calm", test: (v) => v.restless <= 2.5 },
    { id: "sleepy", label: "Sleepy", test: (v) => v.alert <= 2.5 },
    { id: "alert", label: "Alert", test: (v) => v.alert >= 7.5 },
  ];

export function lastingMoods(v: MindValues): LastingMood[] {
  return LASTING_MOODS.filter((m) => m.test(v)).map((m) => m.id);
}

const clamp10 = (n: number) => Math.max(0, Math.min(10, n));

export function nudge(v: MindValues, effects: Partial<MindValues>): MindValues {
  return {
    happy: clamp10(v.happy + (effects.happy ?? 0)),
    restless: clamp10(v.restless + (effects.restless ?? 0)),
    alert: clamp10(v.alert + (effects.alert ?? 0)),
  };
}

/** One drift step: move by up to 1 toward the baseline, never past it. */
export function driftStep(value: number, toward: number) {
  if (Math.abs(value - toward) <= 1) return toward;
  return value + Math.sign(toward - value);
}

/**
 * How strongly each feeling shows right now (0..1), smoothed so expressions
 * fade in as a score heads toward an extreme rather than snapping on.
 */
export function feelings(v: MindValues) {
  const ramp = (n: number) => Math.max(0, Math.min(1, n));
  return {
    frustrated: ramp((4 - v.happy) / 3),
    happy: ramp((v.happy - 6) / 3),
    restless: ramp((v.restless - 6) / 3),
    calm: ramp((4 - v.restless) / 3),
    sleepy: ramp((3.5 - v.alert) / 3),
    alert: ramp((v.alert - 6.5) / 3),
  };
}

const STORE = "mote.mind";

/**
 * Feelings carry over between launches. Time with the app closed counts as
 * Mote resting: a little calmer and more rested, and the rest settles back.
 */
export function loadMind(): MindValues {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as {
      values: MindValues;
      at: number;
    } | null;
    if (!saved?.values) return { ...MIND_START };
    let v: MindValues = { ...MIND_START, ...saved.values };
    const away = Math.max(0, Date.now() - saved.at);
    const minutes = away / 60_000;
    v = nudge(v, {
      alert: REST_PER_MINUTE.alert * minutes,
      restless: Math.max(-3, REST_PER_MINUTE.restless * minutes),
    });
    const happySteps = Math.floor(away / 40_000);
    for (let i = 0; i < happySteps && v.happy !== 5; i++) v.happy = driftStep(v.happy, 5);
    return v;
  } catch {
    return { ...MIND_START };
  }
}

export function saveMind(v: MindValues) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ values: v, at: Date.now() }));
  } catch {
    // Fine: feelings just won't carry over to the next launch.
  }
}
