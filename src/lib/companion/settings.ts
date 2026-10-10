import { useCallback, useEffect, useRef, useState } from "react";
import type { Energy } from "@/components/companion/engine";
import { listenBus, send } from "@/lib/companion/bus";

export type Settings = {
  followPointer: boolean;
  /** Mote never gets cross or hurt: punishing reactions become gentle ones. */
  friendly: boolean;
  naps: boolean;
  energy: Energy;
  floatOnTop: boolean;
  headphones: boolean;
  mustache: boolean;
  debug: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  followPointer: true,
  friendly: false,
  naps: true,
  energy: "normal",
  floatOnTop: false,
  headphones: false,
  mustache: false,
  debug: false,
};

const KEY = "mote.settings";

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
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
    floatOnTop: bool(raw.floatOnTop, d.floatOnTop),
    headphones: bool(raw.headphones, d.headphones),
    mustache: bool(raw.mustache, d.mustache),
    debug: bool(raw.debug, d.debug),
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
