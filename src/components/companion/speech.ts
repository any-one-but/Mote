import type { LastingMood, MindValues } from "@/components/companion/mind";

// Everything Mote can say, and when. Mote doesn't chatter on a timer: they
// speak up when something happens that they'd naturally react to, or when
// they need something (food, a game, their sleep mask, a pet). A bubble is
// one of:
//
// - "flavor": just a remark, nothing to answer
// - "ask":    a question with a green (yes) and a red (no) button
// - "move":   asks you to move the window somewhere; moving it is the answer
// - "pet":    asks for a pet; petting is the answer
// - "feed":   asks for food; dropping a file on Mote is the answer
// - "mask":   asks for the sleep mask; putting it on is the answer
// - "game":   asks to play; dropping a game on Mote is the answer
//
// Every bubble disappears after a while. Questions and requests you don't
// answer in time count as ignored.

export type BubbleKind = "flavor" | "ask" | "move" | "pet" | "feed" | "mask" | "game";
export type Outcome =
  | "yes"
  | "no"
  | "moved"
  | "petted"
  | "fed"
  | "masked"
  | "played"
  | "ignored"
  | "done";
export type Direction = "left" | "right" | "up" | "down";

/** Things that just happened, which Mote might want to comment on. */
export type SpeechEvent =
  | "petted"
  | "dizzy-over"
  | "woke-rested"
  | "woke-groggy"
  | "media-start"
  | "startled"
  | "ate"
  | "played"
  | "unmasked"
  | "welcome-back";

export type SpeechContext = {
  feel: MindValues;
  moods: LastingMood[];
  interest: "media" | "you" | null;
  asleep: boolean;
  event: SpeechEvent | null;
  hour: number;
  /** Where Mote's window sits on the screen, 0..1 from the left / top. */
  placement: { x: number; y: number } | null;
  /** Sound coming from a window Mote can see. */
  media: boolean;
  /** Something just offered to Mote (a file or an app), by name and size. */
  offering: { name: string; size: number } | null;
  /** The game being played, if any. */
  game: string | null;
};

export type Line = {
  id: string;
  kind: BubbleKind;
  /** When this line can come up in reaction to something (needs and replies
   * to offerings are said directly, so theirs is `never`). */
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
  then?: Partial<Record<Outcome, "nap" | "play-again" | "unmask">>;
  /** Group name shown in the debug list. */
  group: string;
};

const never = () => false;
const name = (c: SpeechContext) => c.offering?.name ?? "that";
const size = (c: SpeechContext) => c.offering?.size ?? 0;

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
  // Reacting to something that just happened
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
    id: "startled",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "startled",
    say: ["Who’s there?!", "I’m up! I’m up!"],
  },
  {
    id: "media-start",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "media-start" && !c.asleep,
    say: ["Ooh, something’s on!", "Oh! Are we watching something?"],
  },
  {
    id: "welcome-back",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "welcome-back" && !c.asleep,
    say: ["Oh! You’re back!", "There you are! I kept your screen warm."],
  },
  {
    id: "unmasked",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "unmasked",
    say: ["Ahh, there you are!", "The light! It’s so bright!"],
  },
  {
    id: "ate",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "ate",
    say: (c) =>
      size(c) < 10_000
        ? [`*${name(c)}*? Barely a crumb.`, `A tiny little *${name(c)}*. Cute.`]
        : size(c) < 50_000_000
          ? [`*${name(c)}*! Crunchy.`, `Mmm, *${name(c)}*. Good bits in that one.`]
          : [`*${name(c)}*… so many bits. I’m stuffed.`, `That *${name(c)}* was a feast!`],
  },
  {
    id: "played",
    group: "After something happens",
    kind: "ask",
    when: (c) => c.event === "played",
    say: ["Good game! Again?"],
    effects: { yes: { happy: 0.3 } },
    replies: { no: ["Aw, okay. That was fun!"] },
    then: { yes: "play-again" },
  },

  // Replies to things you drop on Mote
  {
    id: "game-start",
    group: "Things you give Mote",
    kind: "flavor",
    when: never,
    say: (c) => [`Ooh, *${c.game}*! Let’s play!`, `*${c.game}*? I’m so in.`],
  },
  {
    id: "chess-start",
    group: "Things you give Mote",
    kind: "flavor",
    when: never,
    say: ["Chess! I’ll be white.", "Ooh, chess. Prepare to lose. (Probably.)"],
  },
  {
    id: "not-a-game",
    group: "Things you give Mote",
    kind: "flavor",
    when: never,
    say: (c) => [`*${name(c)}* is an app, not a game. Or a snack.`],
  },
  {
    id: "important",
    group: "Things you give Mote",
    kind: "flavor",
    when: never,
    say: (c) => [
      `*${name(c)}* looks important. I’d better not eat that.`,
      "Hmm, that looks like something your computer needs. No thanks!",
    ],
  },
  {
    id: "folder",
    group: "Things you give Mote",
    kind: "flavor",
    when: never,
    say: ["A whole folder? I’d get a tummy ache.", "Files, not folders, please!"],
  },
  {
    id: "empty",
    group: "Things you give Mote",
    kind: "flavor",
    when: never,
    say: (c) => [`*${name(c)}* is empty! There’s nothing to eat.`],
  },
  {
    id: "already-ate",
    group: "Things you give Mote",
    kind: "flavor",
    when: never,
    say: (c) => [`I already ate *${name(c)}*!`, `*${name(c)}* again? I just had that one.`],
  },
  {
    id: "full",
    group: "Things you give Mote",
    kind: "flavor",
    when: never,
    say: ["I’m full! Maybe later.", "Couldn’t eat another bit."],
  },
  {
    id: "busy",
    group: "Things you give Mote",
    kind: "flavor",
    when: never,
    say: ["Hang on, I’m busy!"],
  },
  {
    id: "masked-sleepy",
    group: "Things you give Mote",
    kind: "flavor",
    when: never,
    say: ["Ooh, perfect. Night night…"],
  },
  {
    id: "masked-asleep",
    group: "Things you give Mote",
    kind: "flavor",
    when: never,
    say: ["mm… cozy…"],
  },
  {
    id: "masked-awake",
    group: "Things you give Mote",
    kind: "ask",
    when: never,
    say: ["Hey! Who turned out the lights? I’m not even sleepy. Do I have to?"],
    replies: {
      yes: ["Fiiine. Night night."],
      no: ["Phew! Taking this off."],
      ignored: ["I’ll just… take this off, then."],
    },
    then: { yes: "nap", no: "unmask", ignored: "unmask" },
  },

  // Needs: Mote asks for these on their own, when they need them
  {
    id: "peckish",
    group: "Needs",
    kind: "feed",
    when: never,
    cooldown: 10 * 60_000,
    say: ["I’m a little peckish. Got a file I could nibble?"],
    effects: { fed: { happy: 0.5 }, ignored: { happy: -0.2 } },
    replies: { fed: ["Mmm, thank you!"], ignored: ["…I’ll manage."] },
  },
  {
    id: "hungry",
    group: "Needs",
    kind: "feed",
    when: never,
    cooldown: 4 * 60_000,
    say: ["My tummy’s rumbling… could you drop me a file?", "I’m getting really hungry. Any files?"],
    effects: { fed: { happy: 1 }, ignored: { happy: -0.5 } },
    replies: { fed: ["Oh, thank you. I needed that."], ignored: ["Hungry AND ignored. Great."] },
  },
  {
    id: "starving",
    group: "Needs",
    kind: "feed",
    when: never,
    cooldown: 90_000,
    say: [
      "PLEASE. FILES. I’m wasting away!",
      "I can’t stop thinking about bits.",
      "Feed me a file. Any file. (Not an important one.)",
    ],
    effects: { fed: { happy: 1.5, restless: -0.5 }, ignored: { happy: -1 } },
    replies: { fed: ["Oh, FINALLY. You’re the best."], ignored: ["…How could you."] },
  },
  {
    id: "mask-please",
    group: "Needs",
    kind: "mask",
    when: never,
    cooldown: 12 * 60_000,
    say: (c) =>
      c.hour >= 23 || c.hour < 4
        ? ["It’s really late… could I have my sleep mask?"]
        : ["I’m so sleepy… could I have my sleep mask?"],
    effects: { masked: { happy: 0.3 } },
    replies: { masked: ["Thank you… night night…"], ignored: ["I’ll just… rest my eyes, then."] },
  },
  {
    id: "play-please",
    group: "Needs",
    kind: "game",
    when: never,
    cooldown: 10 * 60_000,
    say: ["I’m so bored! Want to play a game? Drag one in.", "Can we play something? Anything!"],
    effects: { played: { happy: 0.5 }, ignored: { happy: -0.2 } },
    replies: { ignored: ["Maybe later, then."] },
  },
  {
    id: "move-me",
    group: "Needs",
    kind: "move",
    when: never,
    cooldown: 10 * 60_000,
    direction: roomier,
    say: (c) => {
      const where = PLACE_WORDS[roomier(c)];
      return [
        `It’s a bit crowded here. Could you carry me ${where}?`,
        `I want a new view. Could you move me ${where}?`,
      ];
    },
    effects: { moved: { happy: 0.8, restless: -1 }, ignored: { happy: -0.3 } },
    replies: { moved: ["Ahh, much better. Thank you!"], ignored: ["Oh well. It’s fine here too."] },
    kindReplies: { ignored: ["Actually, it’s pretty nice right here."] },
  },
  {
    id: "pet-me",
    group: "Needs",
    kind: "pet",
    when: never,
    cooldown: 10 * 60_000,
    say: ["Could I have a pet? I’m feeling a bit down."],
    effects: { petted: { happy: 1, restless: -0.5 }, ignored: { happy: -0.3 } },
    replies: { petted: ["Mmm… that’s better."], ignored: ["Maybe later, then."] },
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
