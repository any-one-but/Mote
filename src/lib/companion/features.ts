import { useCallback, useEffect, useRef, useState } from "react";
import { listenBus, send } from "@/lib/companion/bus";

// Features kept in the app for testing but out of everyone else's reach.
//
// Three things are locked behind a Feature Key each: Debug, the diet
// tracker and Local Gallery. Keys are typed in at the bottom of Settings, and
// unlocking is remembered for good (resetting settings doesn't undo it); each
// unlocked one gets a switch there. With Debug unlocked and on, Settings
// grows the Debug tabs, and the Features tab switches the rest on and off:
// Mote's usual skills (on until switched off) and the experimental features
// (off until switched on).
//
// Only a fingerprint of the key (its SHA-256) lives in the app, never the key.

/** Features that need a key. */
export type KeyedId = "debug" | "diet" | "gallery";
/** Features switched on and off in the Features tab (with Debug on). */
export type FeatureId =
  | "links"
  | "files"
  | "apps"
  | "checkins"
  | "games"
  | "moodshape"
  | "hunger"
  | "levels"
  | "sleep"
  | "brows"
  | "mouth"
  | "eyes"
  | "glint";

export const KEYED: Array<{ id: KeyedId; name: string; about: string; fingerprint: string }> = [
  {
    id: "debug",
    name: "Debug",
    about: "Debug tabs alongside Settings: testing tools, and switches for Mote’s skills and experimental features.",
    fingerprint: "5338425b70e71202639415bbc64b4ca2b70d2d436f292fb7cc5415ba27eaafa9",
  },
  {
    id: "diet",
    name: "Diet tracker",
    about: "Calorie logging (ask Mote for “calories”), the Days window, and everything Mote says about food you eat.",
    fingerprint: "529ae584fe8563a4e8ec4701330d2de99ea399aa3f58ddcb22cdf72c0aca4e98",
  },
  {
    id: "gallery",
    name: "Local Gallery",
    about: "Opening Local Gallery by asking Mote for it. Mote carries it with them (the same app, with the same library and settings).",
    fingerprint: "58410d02ab9bdb3c0ed5d08fdcc5557f27ef308e10489e982b964ad60205305c",
  },
];

export const FEATURES: Array<{
  id: FeatureId;
  name: string;
  about: string;
  /** One of Mote's usual skills: on until switched off. (The rest are
   * experimental: off until switched on.) */
  usual?: boolean;
}> = [
  {
    id: "links",
    name: "Saved links",
    about: "Links dragged onto Mote are saved, and now and then Mote suggests one. Off, Mote doesn’t take links or bring them up (the ones already saved are kept), and Settings hides the list.",
    usual: true,
  },
  {
    id: "files",
    name: "Helping with files",
    about: "Folders and videos dragged onto Mote get the cleanup jobs (opening archives, clearing clutter, tidying names, converting, compressing…). Off, Mote doesn’t take them, and Settings hides the Pace.",
    usual: true,
  },
  {
    id: "apps",
    name: "Reacting to apps",
    about: "Apps dragged onto Mote: games get played (Chess, Minecraft, any game) and the Mac’s own apps get a reaction. Off, Mote doesn’t take apps.",
    usual: true,
  },
  {
    id: "checkins",
    name: "Check-ins",
    about: "Every hour or two, Mote asks a simple question about how you’re doing, and answers kindly whichever way you reply (or says nothing if you don’t). Off, Mote doesn’t ask.",
    usual: true,
  },
  {
    id: "games",
    name: "Games",
    about: "Games with Mote (checkers, chess, tic-tac-toe, Liar’s Dice: ask Mote for one), and Mote asking for or suggesting a game. Off, a game that’s open is put away, Mote says the games are put away if you ask, and never brings them up (games you’ve played are still remembered).",
    usual: true,
  },
  {
    id: "moodshape",
    name: "Mood effects persistent eye shape",
    about: "How Mote feels shapes their eyes while they rest: a scowl when frustrated, a little smile when joyful, a droop when low, heavy lids when sleepy, worried brows when hungry. Off, the eyes rest in their usual shape whatever the mood (expressions still play).",
    usual: true,
  },
  {
    id: "hunger",
    name: "Mote eats too",
    about: "Mote gets hungry, feeding them (ask Mote for a snack), and hunger’s effect on their mood, face and what they say.",
  },
  {
    id: "levels",
    name: "Levels and learning",
    about: "Picking how Mote plays board games: Easy, Normal or Hard (or Close, the usual), plus the Learn with Mote option for checkers and tic-tac-toe. Off, Mote always plays to keep it close and let you edge ahead.",
  },
  {
    id: "sleep",
    name: "Goodnight Mote",
    about: "Mote getting tired and needing sleep: sleepy and exhausted moods, asking for bed, tucking them in (ask Mote for “bed”), and waking when rested. Off, Mote still naps when left alone.",
  },
  {
    id: "brows",
    name: "Eyebrows",
    about: "Two little eyebrows above Mote’s eyes. They follow every expression: down and slanted when cross, up when surprised or worried, relaxed when sleepy.",
  },
  {
    id: "mouth",
    name: "Mouth",
    about: "A little mouth under Mote’s eyes. It follows every expression: a smile when happy, a small frown when worried or cross, a small “o” when surprised.",
  },
  {
    id: "eyes",
    name: "Just the eyes",
    about: "No body, no dot, no shadow: just Mote’s eyes (bigger), on a window the colour of Mote, so the whole window is Mote. Touching anywhere in it counts as touching Mote. Eyebrows and the mouth still work if they’re on.",
  },
  {
    id: "glint",
    name: "Eye reflection dot",
    about: "A little reflection in each eye that moves with them. Its colour quietly follows Mote’s mood: Mote’s own colour when all’s well, a touch of red when frustrated, a touch of blue when low, a little purple when both.",
  },
];

export type FeatureState = {
  /** Keyed features you've unlocked. */
  unlocked: KeyedId[];
  /** On or off: experimental features (off unless set true), usual ones
   * and unlocked keyed ones (on unless set false). */
  on: Partial<Record<KeyedId | FeatureId, boolean>>;
};

const KEY = "mote.features";
const NONE: FeatureState = { unlocked: [], on: {} };

export function readFeatures(): FeatureState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
      unlocked?: string[];
      on?: Record<string, boolean>;
    } | null;
    const was = Array.isArray(raw?.unlocked) ? raw.unlocked : [];
    const keyed = new Set<string>(KEYED.map((f) => f.id));
    const unlocked = was.filter((id): id is KeyedId => keyed.has(id));
    const on: FeatureState["on"] = {};
    for (const id of unlocked) if (raw?.on?.[id] === false) on[id] = false;
    for (const f of FEATURES) {
      if (f.usual) {
        if (raw?.on?.[f.id] === false) on[f.id] = false;
        continue;
      }
      // Features that used to have their own keys: unlocked meant on.
      const before = was.includes(f.id) ? raw?.on?.[f.id] !== false : raw?.on?.[f.id] === true;
      if (before) on[f.id] = true;
    }
    return { unlocked, on };
  } catch {
    return NONE;
  }
}

/** Every useFeatures in this window, so a change made in one reaches the rest
 * (the bus only reaches other windows). */
const here = new Set<(next: FeatureState) => void>();

function writeFeatures(next: FeatureState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // The other windows still hear about it below.
  }
  here.forEach((set) => set(next));
  send({ type: "features", features: next });
}

const isKeyed = (id: KeyedId | FeatureId): id is KeyedId => KEYED.some((f) => f.id === id);

/** Whether a feature is on (and, for a keyed one, unlocked). */
export function featureOn(state: FeatureState, id: KeyedId | FeatureId): boolean {
  if (isKeyed(id)) return state.unlocked.includes(id) && state.on[id] !== false;
  if (FEATURES.some((f) => f.id === id && f.usual)) return state.on[id] !== false;
  return state.on[id] === true;
}

async function fingerprint(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Feature state, kept in step across every Mote window. */
export function useFeatures() {
  const [state, setState] = useState<FeatureState>(NONE);
  const current = useRef(state);
  current.current = state;

  useEffect(() => {
    setState(readFeatures());
    here.add(setState);
    const stopBus = listenBus((msg) => {
      if (msg.type === "features") setState(msg.features);
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setState(readFeatures());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      here.delete(setState);
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
    async (key: string): Promise<{ id: KeyedId; already: boolean } | null> => {
      const print = await fingerprint(key.trim());
      const feature = KEYED.find((f) => f.fingerprint === print);
      if (!feature) return null;
      const now = current.current;
      if (now.unlocked.includes(feature.id)) return { id: feature.id, already: true };
      commit({ unlocked: [...now.unlocked, feature.id], on: { ...now.on, [feature.id]: true } });
      return { id: feature.id, already: false };
    },
    [commit],
  );

  const setOn = useCallback(
    (id: KeyedId | FeatureId, on: boolean) =>
      commit({ ...current.current, on: { ...current.current.on, [id]: on } }),
    [commit],
  );

  return [state, { unlock, setOn }] as const;
}
