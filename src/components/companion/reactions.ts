import type { MindValues } from "@/components/companion/mind";

// Every stimulus → response rule Mote follows, in one place. The engine fires
// these by id (and applies their `effects` to Mote's feelings); the debug
// window lists them all, live and planned. Add new behaviours here first.

export type ReactionGroup =
  | "Touch"
  | "Pointer"
  | "Window"
  | "Sound"
  | "Accessories"
  | "Time and rest"
  | "Lasting moods"
  | "Ideas";

export type Reaction = {
  id: string;
  group: ReactionGroup;
  name: string;
  /** The stimulus: what Mote notices. */
  when: string;
  /** The outcome: what Mote does. */
  then: string;
  /** How it moves Mote's feelings, each time it fires. */
  effects?: Partial<MindValues>;
  /** "live" is built; "idea" is planned and doesn't happen yet. */
  status: "live" | "idea";
};

export const REACTIONS: Reaction[] = [
  // Touch
  {
    id: "poke",
    group: "Touch",
    name: "Poke",
    when: "You click right on Mote’s face",
    then: "A happy little hop",
    effects: { happy: 1, alert: 0.5 },
    status: "live",
  },
  {
    id: "poke-grumpy",
    group: "Touch",
    name: "Poke while frustrated",
    when: "You poke Mote while they’re frustrated",
    then: "A grumpy scowl and stomp instead of a hop",
    effects: { happy: -0.5, restless: 0.5 },
    status: "live",
  },
  {
    id: "poke-spam",
    group: "Touch",
    name: "Too many pokes",
    when: "Four pokes within about two seconds",
    then: "Gets grumpy: scowls and stomps",
    effects: { happy: -3.5, restless: 1.5 },
    status: "live",
  },
  {
    id: "wake-rested",
    group: "Touch",
    name: "Woken up, rested",
    when: "You poke a sleeping Mote who has rested enough",
    then: "Wakes up bright-eyed",
    effects: { happy: 1, alert: 3 },
    status: "live",
  },
  {
    id: "wake-groggy",
    group: "Touch",
    name: "Woken up too soon",
    when: "You poke a sleeping Mote who is still tired",
    then: "Wakes up, but not happy about it",
    effects: { happy: -1.5, alert: 2 },
    status: "live",
  },
  {
    id: "pet",
    group: "Touch",
    name: "Petting",
    when: "You press and keep stroking across Mote’s face (each second)",
    then: "Melts into a relaxed purr, leaning into your hand",
    effects: { happy: 0.6, restless: -0.6, alert: -0.3 },
    status: "live",
  },
  {
    id: "pet-asleep",
    group: "Touch",
    name: "Petting while asleep",
    when: "You stroke a sleeping Mote (each second)",
    then: "A sleepy purr, without waking up",
    effects: { happy: 0.3, restless: -0.3 },
    status: "live",
  },
  {
    id: "empty-click",
    group: "Touch",
    name: "Clicking around Mote",
    when: "You click the empty window around Mote",
    then: "Nothing: only Mote’s face counts",
    status: "live",
  },

  // Pointer
  {
    id: "follow",
    group: "Pointer",
    name: "Watching your pointer",
    when: "Your pointer moves (with Follows your pointer on)",
    then: "Eyes and body turn to follow it",
    status: "live",
  },
  {
    id: "close",
    group: "Pointer",
    name: "Pointer up close",
    when: "Your pointer sits right in front of Mote’s face",
    then: "Eyes open a touch wider",
    status: "live",
  },
  {
    id: "company",
    group: "Pointer",
    name: "Keeping company",
    when: "You’ve been moving around near Mote for 15 seconds",
    then: "Cheers up and perks up a little",
    effects: { happy: 0.25, alert: 0.3 },
    status: "live",
  },
  {
    id: "shake-pointer",
    group: "Pointer",
    name: "Shaken pointer",
    when: "You whip the pointer around wildly",
    then: "Gets dizzy: swirling eyes, wobbling, then shakes it off",
    effects: { happy: -1, restless: 2, alert: 1 },
    status: "live",
  },
  {
    id: "left-alone",
    group: "Pointer",
    name: "Pointer goes still",
    when: "The pointer stops moving for a few seconds",
    then: "Stops watching it; eyes wander on their own",
    status: "live",
  },

  // Window
  {
    id: "drag",
    group: "Window",
    name: "Window dragged",
    when: "You drag Mote’s window",
    then: "Trails behind it and swings back into place",
    effects: { alert: 0.5, restless: 0.5 },
    status: "live",
  },
  {
    id: "throw",
    group: "Window",
    name: "Window thrown around",
    when: "You shake the window back and forth hard",
    then: "Gets dizzy",
    effects: { happy: -1.5, restless: 2, alert: 1 },
    status: "live",
  },

  // Sound
  {
    id: "sound-start",
    group: "Sound",
    name: "Sound starts somewhere",
    when: "Another visible window starts playing sound",
    then: "Perks up",
    effects: { alert: 1 },
    status: "live",
  },
  {
    id: "sound-ongoing",
    group: "Sound",
    name: "Watching along",
    when: "Sound keeps playing in another window (every 30 seconds)",
    then: "Won’t nap; keeps glancing toward that window",
    effects: { alert: 0.4 },
    status: "live",
  },

  // Accessories
  {
    id: "wear-headphones",
    group: "Accessories",
    name: "Headphones on",
    when: "The cat-ear headphones go on",
    then: "Pleased; listens, bops and flicks an ear now and then",
    effects: { happy: 1 },
    status: "live",
  },
  {
    id: "wear-mustache",
    group: "Accessories",
    name: "Mustache on",
    when: "The bushy mustache goes on",
    then: "Pleased; twirls it, blows on it, nearly sneezes",
    effects: { happy: 1 },
    status: "live",
  },

  // Time and rest
  {
    id: "drift",
    group: "Time and rest",
    name: "Settling back",
    when: "Every 40 seconds",
    then: "Happy and Restless each take one step back toward 5",
    status: "live",
  },
  {
    id: "tiring",
    group: "Time and rest",
    name: "Getting tired",
    when: "Every 60 seconds awake",
    then: "Alertness drops a step, so Mote gets sleepy over time",
    effects: { alert: -1 },
    status: "live",
  },
  {
    id: "idle-mood",
    group: "Time and rest",
    name: "Idle moods",
    when: "Every few seconds while resting",
    then: "Does a little something; which things depends on how Mote feels",
    status: "live",
  },
  {
    id: "doze",
    group: "Time and rest",
    name: "Dozing off",
    when: "Left alone long enough: sooner when sleepy, never when very alert or sound is playing",
    then: "Dozes, then falls asleep. Only a poke wakes Mote",
    status: "live",
  },
  {
    id: "resting",
    group: "Time and rest",
    name: "Resting",
    when: "Every 60 seconds asleep (or with the app closed)",
    then: "Recharges: more alert, calmer",
    effects: { alert: 1.5, restless: -1 },
    status: "live",
  },

  // Lasting moods
  {
    id: "mood-frustrated",
    group: "Lasting moods",
    name: "Frustrated",
    when: "Happy is 2.5 or lower",
    then: "Scowls; huffs, sulks and looks away; pokes make it worse",
    status: "live",
  },
  {
    id: "mood-annoyed",
    group: "Lasting moods",
    name: "Annoyed",
    when: "Happy is below 4",
    then: "A slight scowl; fewer cute moods, the odd huff",
    status: "live",
  },
  {
    id: "mood-happy",
    group: "Lasting moods",
    name: "Happy",
    when: "Happy is 7.5 or higher",
    then: "Brighter eyes; hums and sways; more cute moods",
    status: "live",
  },
  {
    id: "mood-restless",
    group: "Lasting moods",
    name: "Restless",
    when: "Restless is 7.5 or higher",
    then: "Fidgets, looks around a lot, does things more often",
    status: "live",
  },
  {
    id: "mood-calm",
    group: "Lasting moods",
    name: "Calm",
    when: "Restless is 2.5 or lower",
    then: "Slower breathing, fewer moods, long blinks",
    status: "live",
  },
  {
    id: "mood-sleepy",
    group: "Lasting moods",
    name: "Sleepy",
    when: "Alert is 2.5 or lower",
    then: "Heavy eyelids, slow blinks, yawns; dozes off sooner",
    status: "live",
  },
  {
    id: "mood-alert",
    group: "Lasting moods",
    name: "Alert",
    when: "Alert is 7.5 or higher",
    then: "Wide eyes, perked ears; won’t doze off",
    status: "live",
  },

  // Ideas for later
  {
    id: "idea-night",
    group: "Ideas",
    name: "Night time",
    when: "It’s late at night",
    then: "Gets sleepy faster",
    effects: { alert: -1 },
    status: "idea",
  },
  {
    id: "idea-mac-wakes",
    group: "Ideas",
    name: "Mac wakes up",
    when: "Your Mac wakes from sleep",
    then: "Wakes up too, a little groggy",
    status: "idea",
  },
  {
    id: "idea-typing",
    group: "Ideas",
    name: "Busy typing",
    when: "You’re typing a lot in another app",
    then: "Watches quietly and stays calm",
    effects: { restless: -0.5 },
    status: "idea",
  },
  {
    id: "idea-welcome-back",
    group: "Ideas",
    name: "Welcome back",
    when: "You come back after hours away",
    then: "Excited to see you",
    effects: { happy: 2, alert: 2 },
    status: "idea",
  },
];

export const REACTION_GROUPS: ReactionGroup[] = [
  "Touch",
  "Pointer",
  "Window",
  "Sound",
  "Accessories",
  "Time and rest",
  "Lasting moods",
  "Ideas",
];

export const reactionById = new Map(REACTIONS.map((r) => [r.id, r]));
