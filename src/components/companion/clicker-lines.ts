// What Mote says over Mote Clicker, and the face that goes with it. Mote's
// thrilled to be the thing being clicked (well, a little Mote is), loves
// every new gadget, and gets very excited about very big numbers. They keep
// it light: most clicks and buys get nothing, so it never turns into noise.
// `{thing}`, `{amount}` and `{os}` are filled in.

export type ClickerEvent =
  | "start"
  | "resume"
  /** Back after a while away: `{amount}` made meanwhile. */
  | "away"
  /** The first of a kind of thing: `{thing}`. */
  | "first-thing"
  /** A doubling upgrade, or a trackpad. */
  | "upgrade"
  /** A new macOS: `{os}`. */
  | "os"
  /** The all-time total passed a new named number: `{amount}`. */
  | "milestone"
  /** A golden mote turned up. */
  | "golden"
  /** Caught: a lump of motes (`{amount}`), seven times as fast, or clicks
   * worth far more. */
  | "golden-lucky"
  | "golden-frenzy"
  | "golden-clicks"
  /** It drifted away uncaught. */
  | "golden-missed"
  /** Lots of clicking, fast. */
  | "spree";

export const CLICKER_FACE: Partial<Record<ClickerEvent, string>> = {
  start: "delight",
  resume: "cute",
  away: "beam",
  "first-thing": "delight",
  upgrade: "cute",
  os: "beam",
  milestone: "surprise",
  golden: "surprise",
  "golden-lucky": "beam",
  "golden-frenzy": "delight",
  "golden-clicks": "delight",
  "golden-missed": "worry",
  spree: "surprise",
};

export const CLICKER_CHANCE: Record<ClickerEvent, number> = {
  start: 1,
  resume: 0.7,
  away: 1,
  "first-thing": 0.55,
  upgrade: 0.12,
  os: 0.5,
  milestone: 1,
  golden: 0.3,
  "golden-lucky": 0.7,
  "golden-frenzy": 0.8,
  "golden-clicks": 0.8,
  "golden-missed": 0.35,
  spree: 0.6,
};

const LINES: Record<ClickerEvent, string[]> = {
  start: [
    "Mote Clicker! Click the little me. Gently.",
    "Ooh, let’s make motes! Lots of them.",
    "Click the little one. It likes it. I think.",
    "Motes, {name}! Let’s make all of them.",
  ],
  resume: ["Back to the motes!", "The little me missed you.", "More motes? More motes."],
  away: [
    "While you were gone, we made {amount} motes!",
    "Look! {amount} motes, all on their own.",
    "The Macs kept going while you were away. {amount} motes!",
    "Welcome back, {name}! {amount} motes while you were out.",
  ],
  "first-thing": ["Ooh, a {thing}!", "A {thing}! I love it already.", "Our very first {thing}.", "{thing}! Shiny."],
  upgrade: ["Ooh, shiny.", "Even better.", "Upgrade!", "Fancy."],
  os: ["{os}! I love an update.", "Updating to {os}… done!", "{os}. Everything feels faster.", "Ooh, {os}!"],
  milestone: [
    "{amount} motes! Can you believe it?",
    "We just passed {amount} motes!",
    "{amount}! That’s so many motes.",
    "{amount} motes, {name}! Look at us.",
  ],
  golden: ["Ooh, a golden one!", "Look! Catch it!", "A golden mote!"],
  "golden-lucky": ["Got it! {amount} motes!", "Lucky! {amount} more.", "Ooh, {amount} motes, just like that."],
  "golden-frenzy": ["Everything’s making seven times as many!", "Frenzy! Look at them go.", "Seven times! Quick, buy stuff!"],
  "golden-clicks": ["Click, click, click! Every one counts so much more!", "Quick! Click the little me!", "Clicks are worth a fortune right now!"],
  "golden-missed": ["Aw, it got away.", "Next time!", "Bye, golden one."],
  spree: ["Wow, look at you go!", "So fast!", "Clicky fingers, {name}!", "Whoa. Your poor mouse."],
};

/** A line for this moment, avoiding recent ones, with the blanks filled in. */
export function pickClickerLine(
  event: ClickerEvent,
  recent: string[],
  words: { thing?: string; amount?: string; os?: string } = {},
  rand: () => number = Math.random,
): { id: string; text: string } {
  const all = LINES[event].map((text, i) => ({ id: `clicker-${event}-${i}`, text }));
  const fresh = all.filter((l) => !recent.includes(l.id));
  const from = fresh.length ? fresh : all;
  const line = from[Math.floor(rand() * from.length)] ?? from[0];
  const text = line.text
    .replaceAll("{thing}", words.thing ?? "new thing")
    .replaceAll("{amount}", words.amount ?? "so many")
    .replaceAll("{os}", words.os ?? "the new macOS");
  return { id: line.id, text: text.charAt(0).toUpperCase() + text.slice(1) };
}
