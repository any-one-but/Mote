// Mote's mind: two feelings scored 0–10 that stimuli push up and down, which
// slowly drift back to a baseline, and which add up to lasting moods.

export type Attr = "happy" | "restless";

export type MindValues = Record<Attr, number>;

export const ATTRS: Array<{
  key: Attr;
  /** What 0 and 10 mean. */
  low: string;
  high: string;
  /** Show it the other way round (so the bad end is always on the left). */
  flip?: boolean;
  /** Every `every` ms the score takes one step toward `toward`. */
  every: number;
  toward: number;
}> = [
  // Left to themselves (nobody around), Mote slowly gets crosser
  // and more restless: a step every 6 minutes. Attention is what lifts them.
  { key: "happy", low: "Frustrated", high: "Happy", every: 360_000, toward: 0 },
  { key: "restless", low: "Calm", high: "Restless", every: 360_000, toward: 10, flip: true },
];

export const MIND_START: MindValues = { happy: 5, restless: 5 };

/**
 * The mind is switched off for now: Mote doesn't keep or change feelings
 * over time, nothing about them is saved, and Mote doesn't ask for things
 * they "need". Instead they're always in this cheerful, settled state. Set
 * MIND_ENABLED to true to bring the whole system back (it's all still here,
 * and anything saved before it was switched off is left untouched).
 */
export const MIND_ENABLED = false;
export const ALWAYS: MindValues = { happy: 8, restless: 5 };

/**
 * Friendly mode's limits: however long Mote is left alone, feelings stop
 * short of anything upsetting.
 */
export const FRIENDLY = { happyMin: 4, restlessMax: 7 };

/** What each minute with the app closed does: calmer. */
export const REST_PER_MINUTE = { restless: -1 };

export type LastingMood = "frustrated" | "annoyed" | "happy" | "restless" | "calm";

export const LASTING_MOODS: Array<{
  id: LastingMood;
  label: string;
  test: (v: MindValues) => boolean;
}> = [
  // The far ends are meant to be rare: Mote spends most of the time near 5.
  { id: "frustrated", label: "Frustrated", test: (v) => v.happy <= 2 },
  { id: "annoyed", label: "Annoyed", test: (v) => v.happy > 2 && v.happy <= 3.5 },
  { id: "happy", label: "Happy", test: (v) => v.happy >= 8 },
  { id: "restless", label: "Restless", test: (v) => v.restless >= 8 },
  { id: "calm", label: "Calm", test: (v) => v.restless <= 2 },
];

export function lastingMoods(v: MindValues): LastingMood[] {
  return LASTING_MOODS.filter((m) => m.test(v)).map((m) => m.id);
}

const clamp10 = (n: number) => Math.max(0, Math.min(10, n));

export function nudge(v: MindValues, effects: Partial<MindValues>): MindValues {
  return {
    happy: clamp10(v.happy + (effects.happy ?? 0)),
    restless: clamp10(v.restless + (effects.restless ?? 0)),
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
    frustrated: ramp((3 - v.happy) / 2.5),
    happy: ramp((v.happy - 7) / 3),
    restless: ramp((v.restless - 7) / 3),
    calm: ramp((3 - v.restless) / 3),
  };
}

const STORE = "mote.mind";

/**
 * Feelings carry over between launches. Time with the app closed counts as
 * Mote resting: a little calmer.
 */
export function loadMind(): MindValues {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as {
      values: MindValues;
      at: number;
    } | null;
    if (!saved?.values) return { ...MIND_START };
    const old = saved.values;
    let v: MindValues = {
      happy: old.happy ?? MIND_START.happy,
      restless: old.restless ?? MIND_START.restless,
    };
    const away = Math.max(0, Date.now() - saved.at);
    const minutes = away / 60_000;
    v = nudge(v, { restless: Math.max(-3, REST_PER_MINUTE.restless * minutes) });
    // (Time away doesn't make Mote any crosser.)
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
