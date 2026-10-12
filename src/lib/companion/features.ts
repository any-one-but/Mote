import { useCallback, useEffect, useRef, useState } from "react";
import { listenBus, send } from "@/lib/companion/bus";

// Features kept in the app for testing but out of everyone else's reach.
// Each one is locked behind a Feature Key, typed into the Data tab of the
// Debug window. Unlocking is remembered for good (resetting settings doesn't
// undo it); an unlocked feature can then be switched on and off.
//
// Only a fingerprint of each key (its SHA-256) lives in the app, never the
// key itself.

export type FeatureId = "diet" | "hunger" | "assist" | "sleep" | "gallery";

export const FEATURES: Array<{ id: FeatureId; name: string; about: string; fingerprint: string }> = [
  {
    id: "diet",
    name: "Diet tracker",
    about: "Calorie logging, the Days window, the carrot button, and everything Mote says about food you eat.",
    fingerprint: "529ae584fe8563a4e8ec4701330d2de99ea399aa3f58ddcb22cdf72c0aca4e98",
  },
  {
    id: "hunger",
    name: "Mote eats too",
    about: "Mote gets hungry, the snack bowl to feed them, and hunger’s effect on their mood, face and what they say.",
    fingerprint: "e5e8ceb72ba60ed777f80f2533aec3d07634d1f8bbb7c4d334f07346bac36db7",
  },
  {
    id: "assist",
    name: "Learn with Mote",
    about: "The learning option for checkers and tic-tac-toe: tips, mistakes with a take-back, and Mote explaining their moves.",
    fingerprint: "f49a470f2508e08b6877ad2fe6e9e5f42eb1916dfe4cff501edb0e1250333c84",
  },
  {
    id: "sleep",
    name: "Goodnight Mote",
    about: "Mote getting tired and needing sleep: sleepy and exhausted moods, asking for bed, the bed button, and waking when rested. Off, Mote still naps when left alone.",
    fingerprint: "664add0a6b65db0b80c0ba78fbf710a5c8b8dfc14761f4af85a98225aeb86862",
  },
  {
    id: "gallery",
    name: "Local Gallery",
    about: "A button that opens Local Gallery, which Mote carries with them (the same app, with the same library and settings).",
    fingerprint: "58410d02ab9bdb3c0ed5d08fdcc5557f27ef308e10489e982b964ad60205305c",
  },
];

export type FeatureState = {
  unlocked: FeatureId[];
  /** Switched off after unlocking (on unless set to false). */
  on: Partial<Record<FeatureId, boolean>>;
};

const KEY = "mote.features";
const NONE: FeatureState = { unlocked: [], on: {} };

export function readFeatures(): FeatureState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<FeatureState> | null;
    const known = new Set(FEATURES.map((f) => f.id));
    const unlocked = Array.isArray(raw?.unlocked) ? raw.unlocked.filter((id) => known.has(id)) : [];
    const on: FeatureState["on"] = {};
    for (const id of unlocked) if (raw?.on?.[id] === false) on[id] = false;
    return { unlocked, on };
  } catch {
    return NONE;
  }
}

function writeFeatures(next: FeatureState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // The other windows still hear about it below.
  }
  send({ type: "features", features: next });
}

/** Whether a feature is unlocked and switched on. */
export const featureOn = (state: FeatureState, id: FeatureId) =>
  state.unlocked.includes(id) && state.on[id] !== false;

async function fingerprint(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Unlocked features, kept in step across every Mote window. */
export function useFeatures() {
  const [state, setState] = useState<FeatureState>(NONE);
  const current = useRef(state);
  current.current = state;

  useEffect(() => {
    setState(readFeatures());
    const stopBus = listenBus((msg) => {
      if (msg.type === "features") setState(msg.features);
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setState(readFeatures());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      stopBus();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const commit = useCallback((next: FeatureState) => {
    current.current = next;
    setState(next);
    writeFeatures(next);
  }, []);

  /** Tries a key. Returns the feature it unlocked (or had already), or null. */
  const unlock = useCallback(
    async (key: string): Promise<{ id: FeatureId; already: boolean } | null> => {
      const print = await fingerprint(key.trim());
      const feature = FEATURES.find((f) => f.fingerprint === print);
      if (!feature) return null;
      const now = current.current;
      if (now.unlocked.includes(feature.id)) return { id: feature.id, already: true };
      commit({ unlocked: [...now.unlocked, feature.id], on: { ...now.on, [feature.id]: true } });
      return { id: feature.id, already: false };
    },
    [commit],
  );

  const setOn = useCallback(
    (id: FeatureId, on: boolean) => commit({ ...current.current, on: { ...current.current.on, [id]: on } }),
    [commit],
  );

  return [state, { unlock, setOn }] as const;
}
