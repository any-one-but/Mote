// Daily calories. The goal lives in Settings. The days live here, on this
// computer. The color of a day is the same scale Diet Tracker used: cool
// while you're under the goal, hot once you pass it, and nearly black when
// you're well past.

export type DayLog = {
  total: number;
  /** How many times the total went up today. The first one is breakfast. */
  bites: number;
};

export type CalorieBook = {
  /** First month to show, "YYYY-MM". */
  startMonth: string;
  days: Record<string, DayLog>;
  /** True once you've actually used this (opened it, set a goal, or logged). */
  care: boolean;
  /** The day we already said "you did it yesterday", so it only happens once. */
  praisedMorning?: string;
  /** The day we already said goodnight about today. */
  praisedEvening?: string;
  /** Wall-clock time of the last reminder, so a restart doesn't nag at once. */
  lastAsideAt?: number;
};

export type Part = "morning" | "afternoon" | "evening" | "night";

export type CalorieMoment = {
  kind: "add" | "sub" | "set";
  dir: "up" | "down";
  before: number;
  after: number;
  delta: number;
  goal: number;
  bites: number;
  hour: number;
  part: Part;
  /** Days in a row under the goal, before today. */
  streak: number;
  /** Today's total ÷ goal, after this edit. */
  fill: number;
  /** Same, before this edit. */
  was: number;
  /** How big this change is, as a fraction of the goal. */
  jump: number;
  first: boolean;
  later: boolean;
  over: boolean;
  wasOver: boolean;
  /** Was over the goal, and this edit came back under. */
  saved: boolean;
  /** Was under (or right on) the goal, and this edit crossed it. */
  crossed: boolean;
};

export type CalorieAction = { kind: "add" | "sub" | "set"; amount: number };

const KEY = "mote.calories";

export function dateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthKey(d = new Date()): string {
  return dateKey(d).slice(0, 7);
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + n);
  return dateKey(dt);
}

export function partOf(hour: number): Part {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function emptyBook(now = new Date()): CalorieBook {
  return { startMonth: monthKey(now), days: {}, care: false };
}

export function readBook(now = new Date()): CalorieBook {
  const blank = emptyBook(now);
  if (typeof localStorage === "undefined") return blank;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<CalorieBook> | null;
    if (!raw || typeof raw !== "object") return blank;
    const days: Record<string, DayLog> = {};
    if (raw.days && typeof raw.days === "object") {
      for (const [k, v] of Object.entries(raw.days)) {
        if (!v || typeof v !== "object") continue;
        const total = Math.max(0, Math.round(Number(v.total) || 0));
        const bites = Math.max(0, Math.round(Number(v.bites) || 0));
        if (total > 0) days[k] = { total, bites };
      }
    }
    return {
      startMonth: typeof raw.startMonth === "string" && /^\d{4}-\d{2}$/.test(raw.startMonth)
        ? raw.startMonth
        : blank.startMonth,
      days,
      care: raw.care === true,
      praisedMorning: typeof raw.praisedMorning === "string" ? raw.praisedMorning : undefined,
      praisedEvening: typeof raw.praisedEvening === "string" ? raw.praisedEvening : undefined,
      lastAsideAt: typeof raw.lastAsideAt === "number" ? raw.lastAsideAt : undefined,
    };
  } catch {
    return blank;
  }
}

export function writeBook(book: CalorieBook) {
  try {
    localStorage.setItem(KEY, JSON.stringify(book));
  } catch {
    // The other windows still hear about it over the bus, when there is one.
  }
}

/** How many days in a row, before `day`, were logged and under the goal. */
export function streakUnder(book: CalorieBook, goal: number, day: string): number {
  if (!(goal > 0)) return 0;
  let n = 0;
  let cursor = addDays(day, -1);
  for (let i = 0; i < 90; i++) {
    const entry = book.days[cursor];
    if (!entry || entry.total <= 0 || entry.total > goal) break;
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/**
 * Apply an add, a subtract, or a new total for today. Nothing happens if the
 * number wouldn't change. A higher total counts as another bite.
 */
export function applyToBook(
  book: CalorieBook,
  goal: number,
  action: CalorieAction,
  now = new Date(),
): { book: CalorieBook; moment: CalorieMoment } | null {
  if (!(goal > 0)) return null;
  const amount = Math.round(Number(action.amount));
  if (!Number.isFinite(amount)) return null;
  const key = dateKey(now);
  const prev = book.days[key] ?? { total: 0, bites: 0 };
  let after = prev.total;
  if (action.kind === "set") {
    if (amount < 0) return null;
    after = amount;
  } else {
    if (amount <= 0) return null;
    after = Math.max(0, prev.total + (action.kind === "add" ? amount : -amount));
  }
  if (after === prev.total) return null;

  const bites = after > prev.total ? prev.bites + 1 : prev.bites;
  const days = { ...book.days };
  if (after === 0) delete days[key];
  else days[key] = { total: after, bites };

  const next: CalorieBook = {
    ...book,
    care: true,
    startMonth: book.startMonth || monthKey(now),
    days,
  };
  const delta = after - prev.total;
  const hour = now.getHours();
  return {
    book: next,
    moment: {
      kind: action.kind,
      dir: delta > 0 ? "up" : "down",
      before: prev.total,
      after,
      delta,
      goal,
      bites,
      hour,
      part: partOf(hour),
      streak: streakUnder(book, goal, key),
      fill: after / goal,
      was: prev.total / goal,
      jump: Math.abs(delta) / goal,
      first: bites === 1 && delta > 0,
      later: bites >= 2 && delta > 0,
      over: after > goal,
      wasOver: prev.total > goal,
      saved: prev.total > goal && after <= goal,
      crossed: prev.total <= goal && after > goal,
    },
  };
}

/** Average of logged days in the range. Days with nothing logged are skipped. */
export function averageIntake(book: CalorieBook, start: Date, end: Date): number | null {
  let sum = 0;
  let count = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last) {
    const entry = book.days[dateKey(cur)];
    if (entry && typeof entry.total === "number") {
      sum += entry.total;
      count += 1;
    }
    cur.setDate(cur.getDate() + 1);
    if (count > 400) break;
  }
  return count ? Math.round(sum / count) : null;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Color for a day's total against the goal.
 * Under the goal: purple, through blue, to green.
 * From the goal to 10% over: green through yellow to red.
 * Past that: a hard dark cap.
 */
export function colorFor(total: number, goal: number): string {
  if (!goal || goal <= 0) return "#ebe2d5";
  const overLimit = goal * 1.1;
  if (total <= goal) {
    const t = total / goal;
    const h = lerp(270, 135, t);
    const s = lerp(48, 58, t);
    const l = lerp(60, 54, t);
    return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
  }
  if (total <= overLimit) {
    const t = (total - goal) / (overLimit - goal);
    const h = lerp(135, 0, t);
    const s = lerp(60, 78, t);
    const l = lerp(54, 50, t);
    return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
  }
  return "#1c1822";
}
