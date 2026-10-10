import type { LastingMood, MindValues } from "@/components/companion/mind";

// Everything Mote can say, and when. Mote speaks up on their own every so
// often (and right after certain things happen), picking a line that fits how
// they feel and what's going on. A bubble is one of:
//
// - "flavor": just a remark, nothing to answer
// - "ask":    a question with a green (yes) and a red (no) button
// - "move":   asks you to move the window somewhere; moving it is the answer
// - "pet":    asks for a pet; petting is the answer
//
// Every bubble disappears after a while. Questions you don't answer in time
// count as ignored.

export type BubbleKind = "flavor" | "ask" | "move" | "pet";
export type Outcome = "yes" | "no" | "moved" | "petted" | "ignored" | "done";
export type Direction = "left" | "right" | "up" | "down";

/** Things that just happened, which Mote might want to comment on. */
export type SpeechEvent =
  | "petted"
  | "dizzy-over"
  | "woke-rested"
  | "woke-groggy"
  | "media-start"
  | "accessory-on";

export type SpeechContext = {
  feel: MindValues;
  moods: LastingMood[];
  interest: "media" | "you" | null;
  asleep: boolean;
  event: SpeechEvent | null;
  hour: number;
  headphones: boolean;
  mustache: boolean;
  /** Where Mote's window sits on the screen, 0..1 from the left / top. */
  placement: { x: number; y: number } | null;
};

export type Line = {
  id: string;
  kind: BubbleKind;
  /** When this line can come up. */
  when: (c: SpeechContext) => boolean;
  /** One of these gets said. `*word*` is shown emphasised. */
  say: string[] | ((c: SpeechContext) => string[]);
  /** How likely it is to be picked over other fitting lines. */
  weight?: number;
  /** Which way Mote wants to be moved (move bubbles). */
  direction?: (c: SpeechContext) => Direction;
  /** How each outcome moves Mote's feelings. */
  effects?: Partial<Record<Outcome, Partial<MindValues>>>;
  /** What Mote says back after each outcome (a short flavor bubble). */
  replies?: Partial<Record<Outcome, string[]>>;
  /** Something Mote does about it (e.g. lie down for a nap). */
  then?: Partial<Record<Outcome, "nap" | "stay-up">>;
  /** Group name shown in the debug list. */
  group: string;
};

const has = (c: SpeechContext, m: LastingMood) => c.moods.includes(m);
const neutral = (c: SpeechContext) =>
  !c.asleep && !c.event && !has(c, "frustrated") && !has(c, "annoyed");

/** Which way to ask to go: toward the roomier side of the screen. */
const roomier = (c: SpeechContext): Direction => {
  const p = c.placement ?? { x: 0.5, y: 0.5 };
  const dx = Math.abs(p.x - 0.5);
  const dy = Math.abs(p.y - 0.5);
  if (dy > dx + 0.15) return p.y > 0.5 ? "up" : "down";
  return p.x > 0.5 ? "left" : "right";
};

export const PLACE_WORDS: Record<Direction, string> = {
  left: "over to the left",
  right: "over to the right",
  up: "up toward the top",
  down: "down toward the bottom",
};

export const LINES: Line[] = [
  // Just remarks
  {
    id: "musing",
    group: "Remarks",
    kind: "flavor",
    when: neutral,
    say: [
      "I wonder what the cursor does when you’re not looking.",
      "Just thinking about clouds.",
      "Is it me, or is this pixel slightly warmer than the others?",
      "I counted your windows. I lost count.",
      "Sometimes I practice blinking. I’m getting pretty good.",
    ],
  },
  {
    id: "cozy",
    group: "Remarks",
    kind: "flavor",
    when: (c) => neutral(c) && has(c, "happy"),
    weight: 3,
    say: [
      "This corner of your screen is the coziest place I know.",
      "I’m really glad I get to sit here with you.",
      "Everything feels sort of golden right now.",
    ],
  },
  {
    id: "calm",
    group: "Remarks",
    kind: "flavor",
    when: (c) => neutral(c) && has(c, "calm"),
    weight: 3,
    say: ["It’s so nice and quiet.", "I could stay just like this for a long time."],
  },
  {
    id: "restless",
    group: "Remarks",
    kind: "flavor",
    when: (c) => neutral(c) && has(c, "restless"),
    weight: 3,
    say: [
      "Is something about to happen? It feels like something’s about to happen.",
      "I can’t sit still today!",
      "Let’s do something. Anything!",
    ],
  },
  {
    id: "alert",
    group: "Remarks",
    kind: "flavor",
    when: (c) => neutral(c) && has(c, "alert"),
    weight: 3,
    say: ["Everything looks extra sharp right now.", "I’m wide awake. What are we doing?"],
  },
  {
    id: "sleepy",
    group: "Remarks",
    kind: "flavor",
    when: (c) => !c.asleep && !c.event && has(c, "sleepy"),
    weight: 3,
    say: ["My eyelids weigh about a hundred pounds.", "Just… resting my eyes…", "Is it bedtime yet?"],
  },
  {
    id: "grumpy",
    group: "Remarks",
    kind: "flavor",
    when: (c) => !c.asleep && !c.event && (has(c, "frustrated") || has(c, "annoyed")),
    weight: 3,
    say: ["Hmph.", "I’m not talking to you. …Okay, a little.", "That was not very nice, you know."],
  },
  {
    id: "watching",
    group: "Remarks",
    kind: "flavor",
    when: (c) => c.interest === "media" && !c.event && !c.asleep,
    weight: 2,
    say: ["Ooh, what are we watching?", "I like this part.", "Shh, it’s getting good."],
  },
  {
    id: "headphones",
    group: "Remarks",
    kind: "flavor",
    when: (c) => neutral(c) && c.headphones,
    say: ["These ears can hear everything. Even your thoughts. (Not really.)"],
  },
  {
    id: "morning",
    group: "Remarks",
    kind: "flavor",
    when: (c) => neutral(c) && c.hour >= 6 && c.hour < 10,
    say: ["Good morning! The screen looks fresh today."],
  },
  {
    id: "sleep-talk",
    group: "Remarks",
    kind: "flavor",
    when: (c) => c.asleep,
    say: ["mm… sprinkles…", "zzz…", "…five more minutes…"],
  },

  // Right after something happens
  {
    id: "after-pets",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "petted",
    say: ["That was really nice. Thank you.", "Mmm… I needed that."],
  },
  {
    id: "after-dizzy",
    group: "After something happens",
    kind: "ask",
    when: (c) => c.event === "dizzy-over",
    say: ["Whoaaa… was that on purpose?"],
    effects: { yes: { happy: -0.3, restless: 0.3 }, no: { happy: 0.2 } },
    replies: { yes: ["Rude! …My head is still spinning."], no: ["Okay. I forgive you."] },
  },
  {
    id: "woke-rested",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "woke-rested",
    say: ["Good morning! …Is it morning?", "I’m back! Did I miss anything?"],
  },
  {
    id: "woke-groggy",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "woke-groggy",
    say: ["Five more minutes…", "Wha—? I was right in the middle of a dream."],
  },
  {
    id: "media-start",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "media-start" && !c.asleep,
    say: ["Ooh, something’s on!", "Oh! Are we watching something?"],
  },
  {
    id: "accessory-on",
    group: "After something happens",
    kind: "ask",
    when: (c) => c.event === "accessory-on",
    say: ["Do I look dashing?"],
    effects: { yes: { happy: 0.6 }, no: { happy: -0.3 } },
    replies: { yes: ["I knew it!"], no: ["Well, I like it."] },
  },

  // Questions
  {
    id: "good-day",
    group: "Questions",
    kind: "ask",
    when: (c) => neutral(c) && c.interest !== "media",
    say: ["Are you having a good day?"],
    effects: { yes: { happy: 0.5 }, no: { happy: -0.2, restless: -0.2 } },
    replies: {
      yes: ["That makes my day good too."],
      no: ["I’m sorry. I’ll sit here with you, if that helps."],
    },
  },
  {
    id: "hang-out",
    group: "Questions",
    kind: "ask",
    when: (c) => neutral(c) && !has(c, "sleepy"),
    say: ["Want to hang out for a bit?", "Are we friends? I think we’re friends."],
    effects: { yes: { happy: 0.6 }, no: { happy: -0.4 }, ignored: { happy: -0.1 } },
    replies: { yes: ["Yay!"], no: ["Oh. Okay. I’ll be right here."] },
  },
  {
    id: "liking-this",
    group: "Questions",
    kind: "ask",
    when: (c) => c.interest === "media" && !c.event && !c.asleep,
    say: ["Do you like this one?"],
    effects: { yes: { happy: 0.4 }, no: { happy: -0.1 } },
    replies: { yes: ["Me too!"], no: ["Yeah… it’s not my favourite either."] },
  },
  {
    id: "nap-ok",
    group: "Questions",
    kind: "ask",
    when: (c) => !c.asleep && !c.event && has(c, "sleepy") && c.interest === null,
    weight: 2,
    say: ["Would it be okay if I took a little nap?"],
    effects: { no: { alert: 1 } },
    replies: { yes: ["Thank you… night night…"], no: ["Okay! Staying up! …Mostly."] },
    then: { yes: "nap", no: "stay-up" },
  },
  {
    id: "late",
    group: "Questions",
    kind: "ask",
    when: (c) => neutral(c) && (c.hour >= 23 || c.hour < 4),
    weight: 2,
    say: ["It’s really late. Shouldn’t we both be asleep?"],
    effects: { yes: { alert: -1 }, no: { alert: 0.5 } },
    replies: { yes: ["I’ll go first. Night night."], no: ["Okay. I’ll keep you company."] },
    then: { yes: "nap" },
  },
  {
    id: "mustache",
    group: "Questions",
    kind: "ask",
    when: (c) => neutral(c) && c.mustache,
    say: ["Be honest. Does this mustache make me look distinguished?"],
    effects: { yes: { happy: 0.6 }, no: { happy: -0.3 } },
    replies: { yes: ["I knew it."], no: ["You’re just jealous."] },
  },

  // Asking you to do something
  {
    id: "move-me",
    group: "Requests",
    kind: "move",
    when: (c) => neutral(c) && c.interest !== "media",
    direction: roomier,
    say: (c) => {
      const where = PLACE_WORDS[roomier(c)];
      return [
        `It’s a bit crowded here. Could you carry me ${where}?`,
        `I want a new view. Could you move me ${where}?`,
      ];
    },
    effects: { moved: { happy: 0.8, alert: 0.3 }, ignored: { happy: -0.3 } },
    replies: { moved: ["Ahh, much better. Thank you!"], ignored: ["Oh well. It’s fine here too."] },
  },
  {
    id: "pet-me",
    group: "Requests",
    kind: "pet",
    when: (c) => neutral(c) && (has(c, "happy") || has(c, "calm") || c.feel.happy >= 5),
    say: ["Could I have a pet? Just stroke my face."],
    effects: { petted: { happy: 0.8, restless: -0.5 }, ignored: { happy: -0.3 } },
    replies: { petted: ["Mmm… perfect."], ignored: ["Maybe later, then."] },
  },
];

export const lineById = new Map(LINES.map((l) => [l.id, l]));

/** How long a bubble stays up (ms). */
export function lifetime(kind: BubbleKind, text: string) {
  const reading = 1800 + text.length * 55;
  if (kind === "flavor") return Math.min(9000, reading);
  if (kind === "ask") return Math.max(9000, reading + 6000);
  return Math.max(16_000, reading + 10_000);
}

/**
 * Picks something fitting to say, avoiding anything said recently. Returns
 * null when nothing fits right now.
 */
export function chooseLine(
  c: SpeechContext,
  lastSaid: Map<string, number>,
  now: number,
  cooldown = 10 * 60_000,
): Line | null {
  const ok = LINES.filter(
    (l) => l.when(c) && now - (lastSaid.get(l.id) ?? Number.NEGATIVE_INFINITY) > cooldown,
  );
  if (!ok.length) return null;
  const total = ok.reduce((sum, l) => sum + (l.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const l of ok) {
    r -= l.weight ?? 1;
    if (r <= 0) return l;
  }
  return ok[ok.length - 1];
}

export function textFor(l: Line, c: SpeechContext) {
  const options = typeof l.say === "function" ? l.say(c) : l.say;
  return options[Math.floor(Math.random() * options.length)] ?? "…";
}

/** A bubble on screen. */
export type Bubble = {
  id: number;
  lineId: string;
  kind: BubbleKind;
  text: string;
  direction?: Direction;
  /** ms on Mote's clock when it appeared, and how long it lasts. */
  born: number;
  ttl: number;
  /** A reply to an earlier bubble, rather than something new. */
  reply?: boolean;
};
