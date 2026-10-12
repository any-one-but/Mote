import { LEVELS, type Level } from "@/lib/checkers/ai";

// Remembering board games: the game in progress, and your record against Mote.

export type Phase = "pick" | "playing" | "over";
export type Winner = "you" | "mote" | "draw";
export type Record3 = { you: number; mote: number; draw: number };
export type Stats = Record<Level, Record3>;

export const LEVEL_NAME: Record<Level, string> = { close: "Close", easy: "Easy", normal: "Normal", hard: "Hard" };

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

export const savedLevel = (raw: unknown): Level =>
  LEVELS.includes(raw as Level) ? (raw as Level) : "close";

export function readStats(key: string): Stats {
  const raw = load<Partial<Stats>>(key) ?? {};
  const blank = (): Record3 => ({ you: 0, mote: 0, draw: 0 });
  return {
    close: raw.close ?? blank(),
    easy: raw.easy ?? blank(),
    normal: raw.normal ?? blank(),
    hard: raw.hard ?? blank(),
  };
}

/** Adds a finished game to the record, and returns the new record. */
export function addToStats(key: string, level: Level, winner: Winner): Stats {
  const next = readStats(key);
  next[level][winner] += 1;
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
