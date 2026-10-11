import type { LastingMood, MindValues } from "@/components/companion/mind";

// Everything Mote can say on their own, and when. Mote doesn't chatter on a
// timer: they speak up when something happens that they'd naturally react
// to, or when they need something (a pet, a change of scene). A bubble is one
// of:
//
// - "flavor": just a remark, nothing to answer
// - "ask":    a question with a green (yes) and a red (no) button
// - "move":   asks you to move the window somewhere; moving it is the answer
// - "pet":    asks for a pet; petting is the answer
//
// (Helping you with files is a conversation of its own; see assistant.ts.)
//
// Every bubble disappears after a while. Questions and requests you don't
// answer in time count as ignored.

export type BubbleKind = "flavor" | "ask" | "move" | "pet";
export type Outcome = "yes" | "no" | "moved" | "petted" | "ignored" | "done";
export type Direction = "left" | "right" | "up" | "down";

/** Things that just happened, which Mote might want to comment on. */
export type SpeechEvent = "petted" | "dizzy-over" | "media-start" | "welcome-back";

export type SpeechContext = {
  feel: MindValues;
  moods: LastingMood[];
  interest: "media" | "you" | null;
  event: SpeechEvent | null;
  hour: number;
  /** Where Mote's window sits on the screen, 0..1 from the left / top. */
  placement: { x: number; y: number } | null;
  /** Sound coming from a window Mote can see. */
  media: boolean;
};

export type Line = {
  id: string;
  kind: BubbleKind;
  /** When this line can come up in reaction to something (needs are said
   * directly, so theirs is `never`). */
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
  /** Group name shown in the debug list. */
  group: string;
};

const never = () => false;

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
    id: "media-start",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "media-start",
    say: ["Ooh, something’s on!", "Oh! Are we watching something?"],
  },
  {
    id: "welcome-back",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "welcome-back",
    say: ["Oh! You’re back!", "There you are! I kept your screen warm."],
  },

  // Needs: Mote asks for these on their own, when they need them
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
      now - (lastSaid.get(l.id) ?? Number.NEGATIVE_INFINITY) >
        Math.min(cooldown, l.cooldown ?? cooldown),
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
