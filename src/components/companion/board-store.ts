import { LEVELS, type Level } from "@/lib/checkers/ai";

// Remembering board games: the game in progress, and your record against Mote.

export type Phase = "pick" | "playing" | "over";
export type Winner = "you" | "mote" | "draw";
export type Record3 = { you: number; mote: number; draw: number };
export type Stats = Record<Level, Record3>;

export const LEVEL_NAME: Record<Level, string> = { easy: "Easy", normal: "Normal", hard: "Hard" };

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
  LEVELS.includes(raw as Level) ? (raw as Level) : "normal";

export function readStats(key: string): Stats {
  const raw = load<Partial<Stats>>(key) ?? {};
  const blank = (): Record3 => ({ you: 0, mote: 0, draw: 0 });
  return { easy: raw.easy ?? blank(), normal: raw.normal ?? blank(), hard: raw.hard ?? blank() };
}

/** Adds a finished game to the record, and returns the new record. */
export function addToStats(key: string, level: Level, winner: Winner): Stats {
  const next = readStats(key);
  next[level][winner] += 1;
  store(key, next);
  return next;
}
