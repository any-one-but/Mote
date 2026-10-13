import { useCallback, useEffect, useRef, useState } from "react";
import { listenBus, send } from "@/lib/companion/bus";

// Features kept in the app for testing but out of everyone else's reach.
//
// Three things are locked behind a Feature Key each: Debug, the diet
// tracker and Local Gallery. Keys are typed in at the bottom of Settings, and
// unlocking is remembered for good (resetting settings doesn't undo it); each
// unlocked one gets a switch there. With Debug unlocked and on, Settings
// grows the Debug tabs, and the Features tab switches everything else Mote
// does on and off, sorted by kind (their mind, each kind of thing they say,
// what you do together, what they notice, how they look): the usual ones are
// on until switched off, the experimental ones off until switched on. Some
// only work with another on (remembering games needs the games).
//
// Only a fingerprint of the key (its SHA-256) lives in the app, never the key.

/** Features that need a key. */
export type KeyedId = "debug" | "diet" | "gallery";
/** Features switched on and off in the Features tab (with Debug on). */
export type FeatureId =
  | "mind"
  | "hunger"
  | "sleep"
  | "remarks"
  | "chat"
  | "needs"
  | "checkins"
  | "memories"
  | "gametalk"
  | "talk"
  | "games"
  | "links"
  | "files"
  | "apps"
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
  section: FeatureSection;
  name: string;
  about: string;
  /** One of Mote's usual skills: on until switched off. (The rest are
   * experimental: off until switched on.) */
  usual?: boolean;
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
  {
    id: "hunger",
    section: "mind",
    name: "Mote eats too",
    about: "Mote gets hungry, feeding them (ask Mote for a snack), and hunger’s effect on their mood, face and what they say.",
    needs: "mind",
  },
  {
    id: "sleep",
    section: "mind",
    name: "Goodnight Mote",
    about: "Mote getting tired and needing sleep: sleepy and exhausted moods, asking for bed, tucking them in (ask Mote for “bed”), and waking when rested. Off, Mote still naps when left alone.",
    needs: "mind",
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
    about: "Every few minutes while you’re around, something just to chat: about the time of day, your typing or what’s playing, a passing thought, or how they feel (cheerful, low, grumpy, hungry, sleepy).",
    usual: true,
  },
  {
    id: "needs",
    section: "speech",
    name: "Asking for things",
    about: "Mote speaking up when they need something: a snack when hungry, bed when exhausted, a game or a pet when they’ve been left out too long. Off, they still need it, they just don’t say.",
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
    about: "Mote’s lines while you play: cheering, groaning and gloating over captures, crowns, checks, bluffs and calls, saying hello and goodbye to a game. Off, Mote plays in silence, with just their faces (advice you ask for in Solitaire is still said).",
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
    about: "Games with Mote (checkers, chess, tic-tac-toe, Liar’s Dice, Solitaire: ask Mote for one), and Mote asking for or suggesting a game. Off, a game that’s open is put away, Mote says the games are put away if you ask, and never brings them up (games you’ve played are still remembered).",
    usual: true,
  },
  {
    id: "links",
    section: "together",
    name: "Saved links",
    about: "Links dragged onto Mote are saved, and now and then Mote suggests one. Off, Mote doesn’t take links or bring them up (the ones already saved are kept), and Settings hides the list.",
    usual: true,
  },
  {
    id: "files",
    section: "together",
    name: "Helping with files",
    about: "Folders and videos dragged onto Mote get the cleanup jobs (opening archives, clearing clutter, tidying names, converting, compressing…). Off, Mote doesn’t take them, and Settings hides the Pace.",
    usual: true,
  },
  {
    id: "apps",
    section: "together",
    name: "Reacting to apps",
    about: "Apps dragged onto Mote: games get played (Chess, Minecraft, any game) and the Mac’s own apps get a reaction. Off, Mote doesn’t take apps.",
    usual: true,
  },

  // Noticing and moving
  {
    id: "noticing",
    section: "noticing",
    name: "Noticing the screen",
    about: "Mote turning to look when something plays sound in another window or you type in another app, finding it intriguing, watching along, and chatting about it. Off, Mote doesn’t notice either (their eyes still follow the pointer).",
    usual: true,
  },
  {
    id: "dizzy",
    section: "noticing",
    name: "Getting dizzy",
    about: "Whipping the pointer around or shaking Mote’s window makes them dizzy: swirling eyes, a wobble, and a bit of a grump about it. Off, they just ride it out (the window still swings them along).",
    usual: true,
  },
  {
    id: "antics",
    section: "noticing",
    name: "Little moods",
    about: "The little things Mote does on their own between everything else: glancing about, thinking, feeling cute, a surprise, and with their mood, a hum, a huff, a sulk, a fidget or a look your way. Off, Mote just rests between things (still blinking, napping and following the pointer).",
    usual: true,
  },

  // Looks
  {
    id: "moodshape",
    section: "looks",
    name: "Mood effects persistent eye shape",
    about: "How Mote feels shapes their eyes while they rest: a scowl when frustrated, a little smile when joyful, a droop when low, heavy lids when sleepy, worried brows when hungry. Off, the eyes rest in their usual shape whatever the mood (expressions still play).",
    usual: true,
    needs: "mind",
  },
  {
    id: "brows",
    section: "looks",
    name: "Eyebrows",
    about: "Two little eyebrows above Mote’s eyes. They follow every expression: down and slanted when cross, up when surprised or worried, relaxed when sleepy.",
  },
  {
    id: "mouth",
    section: "looks",
    name: "Mouth",
    about: "A little mouth under Mote’s eyes. It follows every expression: a smile when happy, a small frown when worried or cross, a small “o” when surprised.",
  },
  {
    id: "eyes",
    section: "looks",
    name: "Just the eyes",
    about: "No body, no dot, no shadow: just Mote’s eyes (bigger), on a window the colour of Mote, so the whole window is Mote. Touching anywhere in it counts as touching Mote. Eyebrows and the mouth still work if they’re on.",
  },
  {
    id: "glint",
    section: "looks",
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
