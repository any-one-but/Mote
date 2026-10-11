import { useCallback, useEffect, useRef, useState } from "react";
import type { Energy } from "@/components/companion/engine";
import { listenBus, send } from "@/lib/companion/bus";

export type Settings = {
  followPointer: boolean;
  /** Mote never gets too upset: hurt counts for less, no sulking or sharp words. */
  friendly: boolean;
  /** Mote naps when left alone (a poke wakes them). */
  naps: boolean;
  energy: Energy;
  /**
   * How hard the computer works when Mote helps with files: as each job
   * always has, as much at once as it can take, or quietly in the background.
   */
  pace: Pace;
  floatOnTop: boolean;
  debug: boolean;
  /** Calories to stay under for the day. */
  calorieGoal: number;
};

export type Pace = "normal" | "turbo" | "gentle";

export const DEFAULT_SETTINGS: Settings = {
  followPointer: true,
  friendly: false,
  naps: true,
  energy: "normal",
  pace: "normal",
  floatOnTop: false,
  debug: false,
  calorieGoal: 2000,
};

const KEY = "mote.settings";

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function goalOf(value: unknown, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(20000, n));
}

export function readSettings(): Settings {
  let raw: Partial<Record<keyof Settings, unknown>> = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    raw = {};
  }
  const d = DEFAULT_SETTINGS;
  const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);
  return {
    followPointer: bool(raw.followPointer, d.followPointer),
    friendly: bool(raw.friendly, d.friendly),
    naps: bool(raw.naps, d.naps),
    energy: pick(raw.energy, ["calm", "normal", "lively"] as const, d.energy),
    pace: pick(raw.pace, ["normal", "turbo", "gentle"] as const, d.pace),
    floatOnTop: bool(raw.floatOnTop, d.floatOnTop),
    debug: bool(raw.debug, d.debug),
    calorieGoal: goalOf(raw.calorieGoal, d.calorieGoal),
  };
}

export function writeSettings(next: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable; the other windows still hear about it below.
  }
  send({ type: "settings", settings: next });
}

/** Settings shared by every Mote window, kept in step as any of them changes. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const current = useRef(settings);
  current.current = settings;

  useEffect(() => {
    setSettings(readSettings());
    const stopBus = listenBus((msg) => {
      if (msg.type === "settings") setSettings(msg.settings);
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setSettings(readSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      stopBus();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    setSettings(next);
    writeSettings(next);
  }, []);

  return [settings, update] as const;
}
