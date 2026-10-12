import { useCallback, useEffect, useRef, useState } from "react";
import type { Energy } from "@/components/companion/engine";
import { listenBus, send } from "@/lib/companion/bus";

export type Settings = {
  /** Light, dark, or whatever the Mac is set to. */
  theme: Theme;
  /** A special look for Mote, for a vibe or a season (or plain Mote). */
  mode: Mode;
  /** Mote never gets too upset: hurt counts for less, no sulking or sharp words. */
  friendly: boolean;
  energy: Energy;
  /**
   * How hard the computer works when Mote helps with files: as each job
   * always has, as much at once as it can take, or quietly in the background.
   */
  pace: Pace;
  floatOnTop: boolean;
  /** Calories to stay under for the day. */
  calorieGoal: number;
};

export type Pace = "normal" | "turbo" | "gentle";
export type Theme = "light" | "dark" | "system";
export type Mode = "neutral" | "jack";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  mode: "neutral",
  friendly: false,
  energy: "normal",
  pace: "normal",
  floatOnTop: false,
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
    theme: pick(raw.theme, ["light", "dark", "system"] as const, d.theme),
    mode: pick(raw.mode, ["neutral", "jack"] as const, d.mode),
    friendly: bool(raw.friendly, d.friendly),
    energy: pick(raw.energy, ["calm", "normal", "lively"] as const, d.energy),
    pace: pick(raw.pace, ["normal", "turbo", "gentle"] as const, d.pace),
    floatOnTop: bool(raw.floatOnTop, d.floatOnTop),
    calorieGoal: goalOf(raw.calorieGoal, d.calorieGoal),
  };
}

/** Every useSettings in this window, so a change made in one reaches the rest
 * (the bus only reaches other windows). */
const here = new Set<(next: Settings) => void>();

export function writeSettings(next: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable; the other windows still hear about it below.
  }
  here.forEach((set) => set(next));
  send({ type: "settings", settings: next });
}

/** Settings shared by every Mote window, kept in step as any of them changes. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const current = useRef(settings);
  current.current = settings;

  useEffect(() => {
    setSettings(readSettings());
    here.add(setSettings);
    const stopBus = listenBus((msg) => {
      if (msg.type === "settings") setSettings(msg.settings);
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setSettings(readSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      here.delete(setSettings);
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

/**
 * Whether things look dark right now: the Theme setting, or with "system",
 * whatever the Mac is set to (followed as it changes). Marks the page too
 * (`data-theme` on <html>), which is all the styles need.
 */
export function useDark(theme: Theme): boolean {
  const [systemDark, setSystemDark] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const dark = theme === "dark" || (theme === "system" && systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  return dark;
}

/** Marks the page with Mote's mode (`data-mode` on <html>) for the styles. */
export function useMode(mode: Mode) {
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);
}
