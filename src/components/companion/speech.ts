import type { MediaKind } from "@/components/companion/engine";
import type { LastingMood, MindValues } from "@/components/companion/mind";

// Everything Mote can say, and when. Mote speaks up on their own every so
// often (and right after certain things happen), picking a line that fits how
// they feel and what's going on. A bubble is one of:
//
// - "flavor": just a remark, nothing to answer
// - "ask":    a question with a green (yes) and a red (no) button
// - "move":   asks you to move the window somewhere; moving it is the answer
// - "pet":    asks for a pet; petting is the answer
// - "feed":   asks for a snack; giving one from the tray is the answer
//
// Every bubble disappears after a while. Questions you don't answer in time
// count as ignored.

export type BubbleKind = "flavor" | "ask" | "move" | "pet" | "feed";
export type Outcome = "yes" | "no" | "moved" | "petted" | "fed" | "ignored" | "done";
export type Direction = "left" | "right" | "up" | "down";

/** Things that just happened, which Mote might want to comment on. */
export type SpeechEvent =
  | "petted"
  | "dizzy-over"
  | "woke-rested"
  | "woke-groggy"
  | "media-start"
  | "accessory-on"
  | "startled"
  | "liked-media"
  | "disliked-media"
  | "snacked"
  | "played"
  | "unmasked";

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
  /** What Mote is watching or listening to, if anything. */
  media: { name: string | null; kind: MediaKind; liking: number; dancing: boolean } | null;
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
  /** How long before it can come up again (default 10 minutes). */
  cooldown?: number;
  /** Which way Mote wants to be moved (move bubbles). */
  direction?: (c: SpeechContext) => Direction;
  /** How each outcome moves Mote's feelings. */
  effects?: Partial<Record<Outcome, Partial<MindValues>>>;
  /** What Mote says back after each outcome (a short flavor bubble). */
  replies?: Partial<Record<Outcome, string[]>>;
  /** In Friendly mode, gentler replies to use instead. */
  kindReplies?: Partial<Record<Outcome, string[]>>;
  /** Never said in Friendly mode. */
  unkind?: boolean;
  /** Something Mote does about it (e.g. lie down for a nap). */
  then?: Partial<Record<Outcome, "nap" | "stay-up" | "play-again" | "unmask">>;
  /** Group name shown in the debug list. */
  group: string;
};

const has = (c: SpeechContext, m: LastingMood) => c.moods.includes(m);
const neutral = (c: SpeechContext) =>
  !c.asleep &&
  !c.event &&
  !has(c, "frustrated") &&
  !has(c, "annoyed") &&
  !has(c, "hungry") &&
  !has(c, "starving");

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
    unkind: true,
  },
  {
    id: "watching",
    group: "While something plays",
    kind: "flavor",
    when: (c) => c.media?.kind === "video" && !c.event && !c.asleep,
    weight: 2,
    say: ["What happens next?", "Shh, it’s getting good.", "Ooh, I like this part."],
  },
  {
    id: "listening",
    group: "While something plays",
    kind: "flavor",
    when: (c) => (c.media?.kind === "speech" || c.media?.kind === "unknown") && !c.event && !c.asleep,
    weight: 2,
    say: ["Who’s talking? They sound interesting.", "I’m listening too.", "Hm. Good point, whoever that is."],
  },
  {
    id: "dancing",
    group: "While something plays",
    kind: "flavor",
    when: (c) => !!c.media?.dancing && !c.event && !c.asleep,
    weight: 3,
    say: (c) =>
      c.media?.name && (c.media?.liking ?? 0) >= 2
        ? [`*${c.media.name}* always gets me moving.`, "I can’t help it, my whole face is dancing."]
        : ["This one’s got a good beat!", "I can’t help it, my whole face is dancing."],
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
    kindReplies: { yes: ["Ha! It was kind of like a ride."], no: ["Whee, anyway!"] },
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
    say: (c) =>
      c.media?.name
        ? [`Ooh, *${c.media.name}*!`, `Oh! *${c.media.name}*?`]
        : ["Ooh, something’s on!", "Oh! Are we watching something?"],
  },
  {
    id: "startled",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "startled",
    say: (c) =>
      c.media?.name
        ? [`WHA—! …Oh. It’s just *${c.media.name}*.`, "I’m up! I’m up!"]
        : ["Who’s there?!", "I’m up! I’m up!"],
  },
  {
    id: "liked-media",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "liked-media" && !!c.media?.name,
    say: (c) => [`Oh! I love *${c.media?.name}*!`, `*${c.media?.name}*! This is one of my favourites.`],
  },
  {
    id: "disliked-media",
    group: "After something happens",
    kind: "ask",
    when: (c) => c.event === "disliked-media" && !!c.media?.name,
    say: (c) => [`Oh no. Not *${c.media?.name}* again… Can we skip this one?`],
    unkind: true,
    effects: { yes: { happy: 0.6 }, no: { happy: -0.5, restless: 0.3 } },
    replies: { yes: ["Thank you!"], no: ["Fine…"] },
  },
  {
    id: "accessory-on",
    group: "After something happens",
    kind: "ask",
    when: (c) => c.event === "accessory-on",
    say: ["Do I look dashing?"],
    effects: { yes: { happy: 0.6 }, no: { happy: -0.3 } },
    replies: { yes: ["I knew it!"], no: ["Well, I like it."] },
    kindReplies: { no: ["Fair enough! I still like it."] },
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
    kindReplies: { no: ["No worries! I’ll be right here."] },
  },
  {
    id: "liking-this",
    group: "Questions",
    kind: "ask",
    when: (c) => c.interest === "media" && !c.event && !c.asleep,
    say: (c) => (c.media?.name ? [`Do you like *${c.media.name}*?`] : ["Do you like this one?"]),
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
    kindReplies: { no: ["Fair enough! I’m keeping it, though."] },
  },

  // Things from the tray
  {
    id: "masked-sleepy",
    group: "Things you give Mote",
    kind: "flavor",
    when: () => false, // said straight away when the sleep set goes on
    say: ["Ooh, perfect. Night night…", "Earmuffs and a mask? You know me so well."],
  },
  {
    id: "masked-asleep",
    group: "Things you give Mote",
    kind: "flavor",
    when: () => false,
    say: ["mm… cozy…", "zzz… so quiet…"],
  },
  {
    id: "masked-awake",
    group: "Things you give Mote",
    kind: "ask",
    when: () => false,
    say: ["Hey! Who turned out the lights? I’m not even sleepy. Do I have to?"],
    replies: {
      yes: ["Fiiine. Night night."],
      no: ["Phew! Taking this off."],
      ignored: ["I’ll just… take this off, then."],
    },
    then: { yes: "nap", no: "unmask", ignored: "unmask" },
  },
  {
    id: "unmasked",
    group: "Things you give Mote",
    kind: "flavor",
    when: (c) => c.event === "unmasked",
    say: ["Ahh, there you are!", "The light! It’s so bright!"],
  },
  {
    id: "snacked",
    group: "Things you give Mote",
    kind: "flavor",
    when: (c) => c.event === "snacked",
    say: ["Crunchy! Thank you.", "Mmm. My favourite kind of cookie: this one."],
  },
  {
    id: "full",
    group: "Things you give Mote",
    kind: "flavor",
    when: () => false,
    say: ["I’m full! Maybe later.", "Couldn’t eat another crumb."],
  },
  {
    id: "played",
    group: "Things you give Mote",
    kind: "ask",
    when: (c) => c.event === "played",
    say: ["Again! Again?"],
    effects: { yes: { happy: 0.3 } },
    replies: { no: ["Aw, okay. That was fun!"] },
    then: { yes: "play-again" },
  },

  // Hungry: asking for food, more and more desperately
  {
    id: "peckish",
    group: "Hungry",
    kind: "feed",
    when: (c) => !c.asleep && c.feel.full > 3 && c.feel.full <= 4.5,
    weight: 2,
    cooldown: 6 * 60_000,
    say: ["I’m a little peckish. Snack, maybe?", "Is it snack o’clock? It feels like snack o’clock."],
    effects: { fed: { happy: 0.5 }, ignored: { happy: -0.2 } },
    replies: { fed: ["Mmm, thank you!"], ignored: ["…I’ll manage."] },
  },
  {
    id: "hungry",
    group: "Hungry",
    kind: "feed",
    when: (c) => !c.asleep && c.feel.full > 1.5 && c.feel.full <= 3,
    weight: 5,
    cooldown: 3 * 60_000,
    say: [
      "My tummy’s rumbling… could I please have a snack?",
      "I’m getting really hungry.",
      "Just one cookie? Please?",
    ],
    effects: { fed: { happy: 1 }, ignored: { happy: -0.5 } },
    replies: { fed: ["Oh, thank you. I needed that."], ignored: ["Hungry AND ignored. Great."] },
  },
  {
    id: "starving",
    group: "Hungry",
    kind: "feed",
    when: (c) => !c.asleep && c.feel.full <= 1.5,
    weight: 10,
    cooldown: 90_000,
    say: [
      "PLEASE. FOOD. I’m wasting away!",
      "I can’t think about anything except cookies.",
      "Snack. Snack. Snack. SNACK.",
      "Is this how it ends? Hungry, in a window?",
    ],
    effects: { fed: { happy: 1.5, restless: -0.5 }, ignored: { happy: -1 } },
    replies: { fed: ["Oh, FINALLY. You’re the best."], ignored: ["…How could you."] },
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
    kindReplies: { ignored: ["Actually, it’s pretty nice right here."] },
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
  friendly = false,
): Line | null {
  const ok = LINES.filter(
    (l) =>
      l.when(c) &&
      !(friendly && l.unkind) &&
      now - (lastSaid.get(l.id) ?? Number.NEGATIVE_INFINITY) > Math.min(cooldown, l.cooldown ?? cooldown),
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
