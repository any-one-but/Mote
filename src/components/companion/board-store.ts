// Remembering board games: the game in progress, and your record against Mote.

export type Phase = "pick" | "playing" | "over";
export type Winner = "you" | "mote" | "draw";
export type Record3 = { you: number; mote: number; draw: number };
export type Stats = Record3;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function load<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

export function store(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not saved; the game still plays.
  }
}

/** Your record against Mote. (Records kept from when there were levels to
 * pick are added together.) */
export function readStats(key: string): Stats {
  const raw = load<Record<string, unknown>>(key) ?? {};
  const count = (r: unknown, k: keyof Record3) => Number((r as Partial<Record3> | undefined)?.[k]) || 0;
  const old = ["close", "easy", "normal", "hard"].map((l) => raw[l]).filter(Boolean);
  const parts = old.length ? old : [raw];
  return {
    you: parts.reduce<number>((n, r) => n + count(r, "you"), 0),
    mote: parts.reduce<number>((n, r) => n + count(r, "mote"), 0),
    draw: parts.reduce<number>((n, r) => n + count(r, "draw"), 0),
  };
}

/** Adds a finished game to the record, and returns the new record. */
export function addToStats(key: string, winner: Winner): Stats {
  const next = readStats(key);
  next[winner] += 1;
  store(key, next);
  return next;
}

/** How far ahead (max) and behind (min) Mote got during a game. */
export type Swing = { min: number; max: number };

export const noteSwing = (swing: Swing, moteLead: number): Swing => ({
  min: Math.min(swing.min, moteLead),
  max: Math.max(swing.max, moteLead),
});

/** The winner's lead at the end and their worst moment, for Mote's memory. */
export function margins(winner: Winner, moteLead: number, swing: Swing) {
  if (winner === "mote") return { lead: moteLead, worst: swing.min };
  if (winner === "you") return { lead: -moteLead, worst: -swing.max };
  return { lead: moteLead, worst: 0 };
}
