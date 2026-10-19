import { useCallback, useEffect, useRef, useState } from "react";
import { listenBus, send } from "@/lib/companion/bus";

// Features kept in the app for testing but out of everyone else's reach.
//
// Debug is locked behind a key, typed anywhere in the Settings window (there's
// no box for it: you just type it). Unlocking is remembered for good
// (resetting settings doesn't undo it) until Debug's own "Turn off debugging"
// locks it again. With Debug unlocked, Settings grows the Debug tabs, and the
// Features tab switches everything else Mote
// does on and off, sorted by kind (their mind, each kind of thing they say,
// what you do together, what they notice, how they look): the usual ones are
// on until switched off, the rest (the experimental ones, and a few plain
// ones like getting dizzy) off until switched on. Some
// only work with another on (remembering games needs the games).
//
// Only a fingerprint of the key (its SHA-256) lives in the app, never the key.
// A few of Mote's settings live in the Features tab too (Friendly mode,
// Energy, Mode): they're kept with the rest of the
// settings (see settings.ts), just shown there.

/** Features that need a key. */
export type KeyedId = "debug";
/** Features switched on and off in the Features tab (with Debug on). */
export type FeatureId =
  | "mind"
  | "remarks"
  | "chat"
  | "needs"
  | "checkins"
  | "memories"
  | "gametalk"
  | "talk"
  | "games"
  | "links"
  | "apps"
  | "countdowns"
  | "noticing"
  | "dizzy"
  | "antics"
  | "moodshape"
  | "brows"
  | "mouth"
  | "eyes"
  | "glint";

/** How the Features tab is laid out: everything Mote does, one section per kind of thing. */
export type FeatureSection = "mind" | "speech" | "together" | "noticing" | "looks";

export const FEATURE_SECTIONS: Array<{ id: FeatureSection; title: string }> = [
  { id: "mind", title: "Mind" },
  { id: "speech", title: "Speech: what Mote says on their own" },
  { id: "together", title: "Doing things together" },
  { id: "noticing", title: "Noticing and moving" },
  { id: "looks", title: "Looks" },
];

export const KEYED: Array<{ id: KeyedId; name: string; about: string; fingerprint: string }> = [
  {
    id: "debug",
    name: "Debug",
    about: "Debug tabs alongside Settings: testing tools, and switches for Mote’s skills and experimental features.",
    fingerprint: "997c25068d8968f30b9eaa415b32fdf0fcf598d7b877089e1f02befa9bcbb9d1",
  },
];

export const FEATURES: Array<{
  id: FeatureId;
  section: FeatureSection;
  name: string;
  about: string;
  /** On until switched off. (The rest are off until switched on.) */
  usual?: boolean;
  /** Still being tried out (tagged in the Features tab). */
  experimental?: boolean;
  /** Only works with this one on too (its switch is greyed out without it). */
  needs?: FeatureId;
}> = [
  // Mind
  {
    id: "mind",
    section: "mind",
    name: "Mind",
    about: "How Mote feels, and everything that moves it: joy that goes up with pets, play and winning and down with pokes, shaking and losing; peace that grows with company and wears down when they’re ignored; the lasting moods those add up to (joyful, cross, down…) and how they show in Mote’s face, idle moods and words. Off, Mote stays even and nothing changes how they feel; how they felt is kept for when it’s back on.",
    usual: true,
  },

  // Speech
  {
    id: "remarks",
    section: "speech",
    name: "Remarks",
    about: "A word about something that just happened: after a pet or a dizzy spell, waking up from a nap, being startled awake, something starting to play, you coming back after a while. Off, Mote still reacts with their face, just without the words.",
    usual: true,
  },
  {
    id: "chat",
    section: "speech",
    name: "Small talk",
    about: "Every few minutes while you’re around, something just to chat: about the time of day, your typing or what’s playing, a passing thought, or how they feel (cheerful, low, grumpy).",
    usual: true,
  },
  {
    id: "needs",
    section: "speech",
    name: "Asking for things",
    about: "Mote speaking up when they’ve been left out too long: asking for a game, or a pet. Off, they still feel it, they just don’t say.",
    usual: true,
  },
  {
    id: "checkins",
    section: "speech",
    name: "Check-ins",
    about: "Every hour or two, Mote asks a simple question about how you’re doing, and answers kindly whichever way you reply (or says nothing if you don’t). Off, Mote doesn’t ask.",
    usual: true,
  },
  {
    id: "memories",
    section: "speech",
    name: "Remembering games",
    about: "Mote bringing up games you’ve played together: a nod to the last one when you sit down to a rematch, a word about a winning or losing streak, and now and then a memorable game in small talk. Off, the games are still remembered, just never mentioned.",
    usual: true,
    needs: "games",
  },
  {
    id: "gametalk",
    section: "speech",
    name: "Talking during games",
    about: "Mote’s lines while you play: cheering, groaning and gloating over captures, crowns and checks, saying hello and goodbye to a game. Off, Mote plays in silence, with just their faces (advice you ask for in Solitaire is still said).",
    usual: true,
    needs: "games",
  },

  // Doing things together
  {
    id: "talk",
    section: "together",
    name: "Conversations",
    about: "Double-click Mote (or press Enter on them) and they ask what you’d like to do, with a box to type in; they understand plenty of ways of putting things, typos and all. Off, a double-click is just two pokes, so nothing can be asked for (Mote can still offer a game).",
    usual: true,
  },
  {
    id: "games",
    section: "together",
    name: "Games",
    about: "Games with Mote (checkers, chess, tic-tac-toe, Solitaire, Uno, Mote Clicker: ask Mote for one), and Mote asking for or suggesting a game. Off, a game that’s open is put away, Mote says the games are put away if you ask, and never brings them up (games you’ve played are still remembered).",
    usual: true,
  },
  {
    id: "links",
    section: "together",
    name: "Saved links",
    about: "Links dragged onto Mote are saved, and now and then Mote suggests one. Off, Mote doesn’t take links or bring them up (the ones already saved are kept), and Settings hides the list.",
  },
  {
    id: "apps",
    section: "together",
    name: "Reacting to apps",
    about: "Apps dragged onto Mote: games get played (Chess, Minecraft, any game) and the Mac’s own apps get a reaction. Off, Mote doesn’t take apps.",
  },
  {
    id: "countdowns",
    section: "together",
    name: "Countdowns",
    about: "Counting down to days worth waiting for, weeks, months or years away. Say “countdown”, “timer” or “alarm” to Mote and the list opens: make a new one, see them all ticking, and click one to rename it, move its day or delete it. Say one’s name (“birthday”, “how long until the trip?”) and Mote tells you how long is left. When one runs out, Mote says so, once. Off, Mote doesn’t know about them (the ones you made are kept).",
    needs: "talk",
  },

  // Noticing and moving
  {
    id: "noticing",
    section: "noticing",
    name: "Noticing the screen",
    about: "Mote turning to look when something plays sound in another window, finding it intriguing, watching along, and chatting about it. Off, Mote doesn’t notice it.",
    usual: true,
  },
  {
    id: "dizzy",
    section: "noticing",
    name: "Getting dizzy",
    about: "Whipping the pointer around or shaking Mote’s window makes them dizzy: swirling eyes, a wobble, and a bit of a grump about it. Off, they just ride it out (the window still swings them along).",
  },
  {
    id: "antics",
    section: "noticing",
    name: "Little moods",
    about: "The little things Mote does on their own between everything else: glancing about, thinking, feeling cute, a surprise, and with their mood, a hum, a huff, a sulk or a look your way. Off, Mote just rests between things (still blinking, napping and following the pointer).",
    usual: true,
  },

  // Looks
  {
    id: "moodshape",
    section: "looks",
    name: "Mood effects persistent eye shape",
    about: "How Mote feels shapes their eyes while they rest: a scowl when frustrated, a little smile when joyful, a droop when low. Off, the eyes rest in their usual shape whatever the mood (expressions still play).",
    needs: "mind",
  },
  {
    id: "brows",
    section: "looks",
    experimental: true,
    name: "Eyebrows",
    about: "Two little eyebrows above Mote’s eyes. They follow every expression: down and slanted when cross, up when surprised or worried, relaxed when sleepy.",
  },
  {
    id: "mouth",
    section: "looks",
    experimental: true,
    name: "Mouth",
    about: "A little mouth under Mote’s eyes. It follows every expression: a smile when happy, a small frown when worried or cross, a small “o” when surprised.",
  },
  {
    id: "eyes",
    section: "looks",
    experimental: true,
    name: "Just the eyes",
    about: "No body, no dot, no shadow: just Mote’s eyes (bigger), on a window the colour of Mote, so the whole window is Mote. Touching anywhere in it counts as touching Mote. Eyebrows and the mouth still work if they’re on.",
  },
  {
    id: "glint",
    section: "looks",
    experimental: true,
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

/** Where a feature's own switch is set (ignoring what it needs). */
export function featureSwitch(state: FeatureState, id: KeyedId | FeatureId): boolean {
  if (isKeyed(id)) return state.unlocked.includes(id) && state.on[id] !== false;
  if (FEATURES.some((f) => f.id === id && f.usual)) return state.on[id] !== false;
  return state.on[id] === true;
}

/** Whether a feature is on (and, for a keyed one, unlocked), along with
 * anything it needs. */
export function featureOn(state: FeatureState, id: KeyedId | FeatureId): boolean {
  if (!featureSwitch(state, id)) return false;
  const needs = FEATURES.find((f) => f.id === id)?.needs;
  return needs ? featureOn(state, needs) : true;
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

  /** Whatever was just typed (the last few dozen keys): if it ends with a
   * key, that feature unlocks. Returns the feature it unlocked, or null. */
  const unlockTyped = useCallback(
    async (typed: string): Promise<KeyedId | null> => {
      for (let i = 0; i < typed.length; i++) {
        const print = await fingerprint(typed.slice(i));
        const feature = KEYED.find((f) => f.fingerprint === print);
        if (!feature) continue;
        const now = current.current;
        if (now.unlocked.includes(feature.id)) return null;
        commit({ unlocked: [...now.unlocked, feature.id], on: { ...now.on, [feature.id]: true } });
        return feature.id;
      }
      return null;
    },
    [commit],
  );

  /** Locks a keyed feature again, as if it had never been unlocked. */
  const lock = useCallback(
    (id: KeyedId) => {
      const now = current.current;
      const on = { ...now.on };
      delete on[id];
      commit({ unlocked: now.unlocked.filter((u) => u !== id), on });
    },
    [commit],
  );

  const setOn = useCallback(
    (id: KeyedId | FeatureId, on: boolean) =>
      commit({ ...current.current, on: { ...current.current.on, [id]: on } }),
    [commit],
  );

  /** Every switch in the Features tab back to how it starts: the usual
   * ones on, the experimental ones off. (Debug stays unlocked.) */
  const setDefaults = useCallback(() => {
    const now = current.current;
    const on: FeatureState["on"] = {};
    for (const id of now.unlocked) if (now.on[id] === false) on[id] = false;
    commit({ unlocked: now.unlocked, on });
  }, [commit]);

  return [state, { unlockTyped, lock, setOn, setDefaults }] as const;
}
