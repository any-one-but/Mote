import type { Effects, LastingMood, MindValues } from "@/components/companion/mind";

// Everything Mote can say on their own, and when. Mote speaks up when
// something happens that they'd naturally react to, when they need something
// (a pet, a change of scene), and every few minutes while you're around, just
// to chat. A bubble is one of:
//
// - "flavor": just a remark, nothing to answer
// - "ask":    a question with a green (yes) and a red (no) button
// - "move":   asks you to move the window somewhere; moving it is the answer
// - "pet":    asks for a pet; petting is the answer
// - "talk":   in a conversation, a question with a box to type the answer in
// - "choose": in a conversation, a few choices (and the box, too)
//
// (Conversations themselves are in converse.ts.)
//
// Now and then, rarely, a question is a check-in on how you're doing (see
// CHECK_INS): green always means you're doing fine. Left unanswered, Mote
// just gives you a soft look and lets it go.
//
// (Helping you with files is a conversation of its own; see assistant.ts.)
//
// Every bubble disappears after a while. Questions and requests you don't
// answer in time count as ignored.

export type BubbleKind = "flavor" | "ask" | "move" | "pet" | "talk" | "choose";
export type Outcome = "yes" | "no" | "moved" | "petted" | "ignored" | "done";
export type Direction = "left" | "right" | "up" | "down";

/** Things that just happened, which Mote might want to comment on. */
export type SpeechEvent =
  | "petted"
  | "dizzy-over"
  | "media-start"
  | "welcome-back"
  | "played"
  | "woke-rested"
  | "woke-groggy"
  | "startled"
  /** Nothing in particular: Mote just feels like saying something. */
  | "chat";

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
  /** You're typing in another app. */
  typing: boolean;
  /** The toy chest is switched on, so games can be suggested. */
  games: boolean;
  /** An app just dropped on Mote: its name and ID. */
  offering: { name: string; bundle?: string | null } | null;
  /** The game being played, if any: its name, what sort, and how it went. */
  game: string | null;
  gameKind: "chess" | "minecraft" | "game" | null;
  gameWon: boolean;
  /** Local Gallery's passcode, just tried: tries left before Mote stops
   * taking them, and how long (seconds) they won't take any. */
  passcode: { triesLeft: number; wait: number } | null;
  /** A saved link being talked about: what it's called, whether it's a
   * video, and its history with you. */
  link: {
    name: string;
    video: boolean;
    suggested: number;
    opened: number;
    /** Days since Mote last suggested it (null if never). */
    daysSince: number | null;
  } | null;
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
  effects?: Partial<Record<Outcome, Effects>>;
  /** What Mote says back after each outcome (a short flavor bubble). */
  replies?: Partial<Record<Outcome, string[]>>;
  /** In Friendly mode, gentler replies to use instead. */
  kindReplies?: Partial<Record<Outcome, string[]>>;
  /** Never said in Friendly mode. */
  unkind?: boolean;
  /** Something Mote does about it (play the game again, open the link, or
   * offer the games). */
  then?: Partial<Record<Outcome, "play-again" | "open-link" | "suggest-play">>;
  /** The face Mote makes after each outcome. */
  faces?: Partial<Record<Outcome, ReplyFace>>;
  /** A check-in on how you're doing: never picked as ordinary chat, only by
   * `chooseCheckIn`, and never more than one an hour or so. */
  checkIn?: boolean;
  /** Group name shown in the debug list. */
  group: string;
};

/** Faces Mote can make after an answer. */
export type ReplyFace = "beam" | "care" | "soothe" | "cute" | "think";

const never = () => false;

/** "30 seconds", "a minute", "4 minutes": how long Mote won't take tries. */
export function waitWords(seconds: number) {
  if (seconds < 55) return `${Math.max(5, Math.ceil(seconds / 5) * 5)} seconds`;
  const minutes = Math.round(seconds / 60);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}
const wait = (c: SpeechContext) => waitWords(c.passcode?.wait ?? 30);
const name = (c: SpeechContext) => c.offering?.name ?? "that";

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
    effects: { yes: { joy: -0.3 }, no: { joy: 0.2 } },
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
    id: "woke-rested",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "woke-rested",
    say: [
      "Good morning! …Is it morning?",
      "I’m back! Did I miss anything?",
      "That was a great nap. I dreamed about snacks.",
    ],
  },
  {
    id: "woke-groggy",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "woke-groggy",
    say: [
      "Five more minutes…",
      "Wha—? I was right in the middle of a dream.",
      "Mmf… was I snoring?",
    ],
  },
  {
    id: "startled",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "startled",
    say: ["Who’s there?!", "I’m up! I’m up!"],
  },
  {
    id: "welcome-back",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "welcome-back",
    say: ["Oh! You’re back!", "There you are! I kept your screen warm."],
  },

  {
    id: "played",
    group: "Apps you give Mote",
    kind: "ask",
    when: (c) => c.event === "played",
    say: (c) =>
      c.gameKind === "chess"
        ? c.gameWon
          ? ["Checkmate! Again?", "Ha! Good game. Again?"]
          : ["Okay, that one didn’t count. Again?"]
        : c.gameKind === "minecraft"
          ? c.gameWon
            ? ["I got a block! Again?", "Look at my block! Can we mine more?"]
            : ["Aw man. A creeper. Again?", "Who let that creeper in?! Again?"]
          : c.gameWon
            ? ["GG! Again?", "Did you see that? Again!"]
            : ["I was lagging. Again?", "Rematch?"],
    effects: { yes: { joy: 0.3 } },
    replies: { no: ["Aw, okay. That was fun!"] },
    then: { yes: "play-again" },
  },
  {
    id: "game-start",
    group: "Apps you give Mote",
    kind: "flavor",
    when: never,
    say: (c) => [`Ooh, *${c.game}*! Let’s play!`, `*${c.game}*? I’m so in.`],
  },
  {
    id: "chess-start",
    group: "Apps you give Mote",
    kind: "flavor",
    when: never,
    say: ["Chess! I’ll be white.", "Ooh, chess. Prepare to lose. (Probably.)"],
  },
  {
    id: "minecraft-start",
    group: "Apps you give Mote",
    kind: "flavor",
    when: never,
    say: [
      "Minecraft! I’ll punch a tree.",
      "Ooh, Minecraft! Let’s dig straight down. (Kidding.)",
      "Minecraft! Watch out for creepers.",
    ],
  },
  {
    id: "apple-app",
    group: "Apps you give Mote",
    kind: "flavor",
    when: never,
    say: (c) => APPLE_APPS[c.offering?.bundle ?? ""]?.say ?? ["Ooh, an app!"],
  },
  {
    id: "not-a-game",
    group: "Apps you give Mote",
    kind: "flavor",
    when: never,
    say: (c) => [`*${name(c)}* is an app, not a game. Or a snack.`],
  },
  {
    id: "busy",
    group: "Apps you give Mote",
    kind: "flavor",
    when: never,
    say: ["Hang on, I’m busy!"],
  },

  // Links you save, and Mote bringing them up again some day
  {
    id: "link-saved",
    group: "Saved links",
    kind: "flavor",
    when: never,
    say: (c) => {
      const x = `*${c.link?.name ?? "that"}*`;
      return c.link?.video
        ? [
            `Ooh, ${x}! I’ll save it for later.`,
            `${x}, saved! We’ll watch it together sometime.`,
            `Into my little box of favorites it goes: ${x}.`,
            `Saving ${x} for a cozy day.`,
            `${x}! I’ll remember that one. Probably while snacking.`,
          ]
        : [
            `${x}, saved! I’ll remind you about it someday.`,
            `Ooh, a link! Tucking ${x} away for later.`,
            `Got it! ${x} is safe with me.`,
          ];
    },
  },
  {
    id: "link-already",
    group: "Saved links",
    kind: "flavor",
    when: never,
    say: (c) => [
      `I already have *${c.link?.name}*! It’s one of my favorites.`,
      `*${c.link?.name}*? Already saved. Great taste, though.`,
    ],
  },
  {
    id: "suggest-link",
    group: "Saved links",
    kind: "ask",
    when: never,
    // Never held back by the usual ten-minute rest: how often links come up
    // is decided where they're suggested.
    cooldown: 0,
    say: (c) => {
      const l = c.link;
      if (!l) return ["Want to look at something?"];
      const x = `*${l.name}*`;
      const see = l.video ? "watch" : "look at";
      const it = l.video ? "watch it" : "have a look";
      const lines = [
        `I was just thinking about ${x}. Want to ${it}?`,
        `Snack break? We could ${see} ${x}.`,
        `Before I nap… ${x}? Just one?`,
        `Ooh, I know! ${x}! Yes?`,
        `Feel like ${x}?`,
        `How about a little break? ${x} is waiting.`,
      ];
      if (l.suggested === 0) {
        lines.push(
          `Remember ${x}? You saved it a while back. Want to ${it}?`,
          `I’ve been saving ${x} for a moment like this. ${l.video ? "Watch it" : "Open it"} now?`,
          `Psst. ${x}. Shall we?`,
        );
      }
      if (l.opened >= 2 && l.opened * 2 >= l.suggested) {
        lines.push(
          `${x} again? You always say yes to this one!`,
          `Our favorite! ${x}? Pretty please?`,
          `I bet you want to ${see} ${x}. Am I right?`,
        );
      }
      if (l.daysSince !== null && l.daysSince > 14) {
        lines.push(
          `It’s been ages since we ${l.video ? "watched" : "looked at"} ${x}. Shall we?`,
          `Haven’t seen ${x} in forever! Want to?`,
        );
      }
      return lines;
    },
    replies: {
      yes: ["Yay! Opening it.", "Here you go!", "Enjoy! I’ll be right here."],
      no: [
        "Okay! Another time.",
        "That’s fine. I’ll keep it safe.",
        "Fair enough. Back in the box it goes.",
      ],
    },
    then: { yes: "open-link" },
  },

  // Chatting: every few minutes while you're around, Mote says something
  // just because. Time of day and what you're up to shape what comes out.
  {
    id: "chat-morning",
    group: "Just chatting",
    kind: "flavor",
    cooldown: 8 * 60_000,
    when: (c) => c.event === "chat" && c.hour >= 5 && c.hour < 12,
    say: [
      "Morning! What are we doing today?",
      "Is it coffee time? It feels like coffee time.",
      "Good morning, screen. Good morning, you.",
      "I’m awake. Mostly.",
    ],
  },
  {
    id: "chat-afternoon",
    group: "Just chatting",
    kind: "flavor",
    cooldown: 8 * 60_000,
    when: (c) => c.event === "chat" && c.hour >= 12 && c.hour < 17,
    say: [
      "Afternoon already? Where did the morning go?",
      "Is it snack o’clock yet?",
      "Afternoons are for little naps. Just saying.",
    ],
  },
  {
    id: "chat-evening",
    group: "Just chatting",
    kind: "flavor",
    cooldown: 8 * 60_000,
    when: (c) => c.event === "chat" && c.hour >= 17 && c.hour < 22,
    say: [
      "Evening! Long day?",
      "It’s getting cozy out there. Probably.",
      "Dinner time? Tell me what you’re having. I can’t eat, but I like hearing.",
    ],
  },
  {
    id: "chat-late",
    group: "Just chatting",
    kind: "flavor",
    cooldown: 8 * 60_000,
    when: (c) => c.event === "chat" && (c.hour >= 22 || c.hour < 5),
    say: [
      "It’s late, you know.",
      "Shouldn’t we both be asleep?",
      "Night owl, huh? Me too, I guess.",
      "The screen’s the brightest thing in the room, isn’t it?",
    ],
  },
  {
    id: "chat-typing",
    group: "Just chatting",
    kind: "flavor",
    cooldown: 8 * 60_000,
    weight: 2,
    when: (c) => c.event === "chat" && c.typing,
    say: [
      "Lots of typing! Important stuff?",
      "Clack clack clack.",
      "You type fast. I can’t type at all.",
      "Busy, busy.",
    ],
  },
  {
    id: "chat-media",
    group: "Just chatting",
    kind: "flavor",
    cooldown: 8 * 60_000,
    weight: 2,
    when: (c) => c.event === "chat" && c.media,
    say: [
      "Is this good? It sounds good.",
      "I can’t see it from here, but I’m watching anyway.",
      "Are we having a movie night?",
    ],
  },
  {
    id: "chat-thought",
    group: "Just chatting",
    kind: "flavor",
    cooldown: 3 * 60_000,
    weight: 3,
    // Cheerful thoughts, so not when Mote is low or cross.
    when: (c) => c.event === "chat" && !c.moods.some((m) => m === "down" || m === "depressed" || m === "frustrated"),
    say: (c) => [
      ...(c.games
        ? [
            "Chess? Checkers? Tic-tac-toe? Click me and tell me which.",
            "I’ve been practicing my checkers. Just saying.",
          ]
        : []),
      "Hi. Just saying hi.",
      "What are you up to?",
      "I wonder what clouds feel like.",
      "Do you think I’d like pizza?",
      "I’m round. Did you notice? Very round.",
      "I counted your windows. There are a lot.",
      "I like sitting here with you.",
      "Hmm. What was I thinking about?",
      "If I had hands, I’d wave.",
      "Don’t mind me. Just floating.",
      "Got any folders that need tidying? I love that stuff.",
      "I had a thought, but it wandered off.",
      "Favorite color? Mine’s cream.",
      "Is your chair comfy? I hope it’s comfy.",
      "Remember to drink some water!",
      "Stretch break? Your shoulders say yes.",
      "Boop. That’s all.",
      "Got any games? I’m pretty good. (Sometimes.)",
    ],
  },

  {
    id: "chat-joyful",
    group: "Just chatting",
    kind: "flavor",
    cooldown: 8 * 60_000,
    weight: 2,
    when: (c) => c.event === "chat" && c.moods.includes("joyful"),
    say: ["Today’s a good day.", "I’m in such a good mood.", "Hehe. Nothing. I’m just happy."],
  },
  {
    id: "chat-low",
    group: "Just chatting",
    kind: "flavor",
    cooldown: 8 * 60_000,
    weight: 4,
    when: (c) => c.event === "chat" && (c.moods.includes("down") || c.moods.includes("depressed")),
    say: ["It’s been quiet.", "Do you still like me?", "…Hi.", "I don’t mind being here. I just wish we did stuff."],
  },
  {
    id: "chat-grumpy",
    group: "Just chatting",
    kind: "flavor",
    cooldown: 8 * 60_000,
    weight: 4,
    unkind: true,
    when: (c) => c.event === "chat" && (c.moods.includes("annoyed") || c.moods.includes("frustrated")),
    say: ["Hmph.", "Still a bit cross, if you were wondering.", "I’m fine. (I’m not.)"],
  },
  {
    id: "chat-hungry",
    group: "Just chatting",
    kind: "flavor",
    cooldown: 8 * 60_000,
    weight: 4,
    when: (c) => c.event === "chat" && (c.moods.includes("hungry") || c.moods.includes("starving")),
    say: ["My tummy’s rumbling.", "Is it snack time? It feels like snack time."],
  },
  {
    id: "chat-sleepy",
    group: "Just chatting",
    kind: "flavor",
    cooldown: 8 * 60_000,
    weight: 4,
    when: (c) => c.event === "chat" && (c.moods.includes("sleepy") || c.moods.includes("exhausted")),
    say: ["*yawn* …sorry.", "I could use a nap.", "My eyes keep closing on their own."],
  },

  // Looking after Mote: snacks and bedtime
  {
    id: "fed-cookie",
    group: "Looking after Mote",
    kind: "flavor",
    when: never,
    say: ["Mmm, cookie!", "Crunchy. Thank you!"],
  },
  {
    id: "fed-berries",
    group: "Looking after Mote",
    kind: "flavor",
    when: never,
    say: ["Berries! My favorite.", "Sweet and a little sour. Perfect."],
  },
  {
    id: "fed-meal",
    group: "Looking after Mote",
    kind: "flavor",
    when: never,
    say: ["A whole meal! Thank you.", "Oh, that hits the spot."],
  },
  {
    id: "fed-hungry",
    group: "Looking after Mote",
    kind: "flavor",
    when: never,
    say: ["Oh, thank you. I really needed that.", "Finally! I was so hungry."],
  },
  {
    id: "full",
    group: "Looking after Mote",
    kind: "flavor",
    when: never,
    say: ["I’m full! Maybe later.", "Couldn’t eat another bite."],
  },
  {
    id: "tucked-in",
    group: "Looking after Mote",
    kind: "flavor",
    when: never,
    say: ["Night night…", "Just a little nap…"],
  },
  {
    id: "not-sleepy",
    group: "Looking after Mote",
    kind: "flavor",
    when: never,
    say: ["I’m not sleepy yet!", "Bedtime? It’s way too early."],
  },

  // Local Gallery, opened by asking Mote
  {
    id: "gallery-opened",
    group: "Local Gallery",
    kind: "flavor",
    when: never,
    say: ["Opening the gallery!", "Gallery time.", "Here you go: Local Gallery.", "Ooh, pictures."],
  },
  {
    id: "gallery-missing",
    group: "Local Gallery",
    kind: "flavor",
    when: never,
    say: ["Hmm, I can’t find the gallery in this copy of me."],
  },
  {
    id: "drop-declined",
    group: "After something happens",
    kind: "flavor",
    when: never,
    say: ["Hmm, I don’t do anything with those right now.", "Not that, sorry. That’s switched off."],
  },
  {
    id: "passcode-already-open",
    group: "Local Gallery",
    kind: "flavor",
    when: never,
    say: ["It’s already open. Here!", "Still open. Bringing it up."],
  },

  // Local Gallery's passcode, which Mote keeps
  {
    id: "passcode-ask",
    group: "Local Gallery passcode",
    kind: "flavor",
    when: never,
    say: [
      "What’s the passcode? I won’t look.",
      "Passcode, please. Eyes shut, promise.",
      "Go ahead, I’m not peeking.",
    ],
  },
  {
    id: "passcode-right",
    group: "Local Gallery passcode",
    kind: "flavor",
    when: never,
    say: ["That’s the one! Opening it now.", "Yep, that’s it. Here you go.", "Correct! Gallery time."],
  },
  {
    id: "passcode-wrong",
    group: "Local Gallery passcode",
    kind: "flavor",
    when: never,
    say: (c) => {
      const left = c.passcode?.triesLeft ?? 0;
      if (left === 1) return ["That’s not it. One more try, then I stop.", "Not it. Last try before I stop asking."];
      if (left === 2) return ["That’s not it either. Two tries left.", "Still not it. Two more tries."];
      return ["Hmm, that’s not it.", "Nope, not that one.", "Not quite. Try again?"];
    },
  },
  {
    id: "passcode-refuse",
    group: "Local Gallery passcode",
    kind: "flavor",
    when: never,
    say: (c) => [
      `That’s too many wrong tries. I’m not opening it. Ask me again in ${wait(c)}.`,
      `No. It stays shut. Try again in ${wait(c)}.`,
    ],
  },
  {
    id: "passcode-waiting",
    group: "Local Gallery passcode",
    kind: "flavor",
    when: never,
    say: (c) => [`Not yet. No more tries for ${wait(c)}.`, `Still no. Give it ${wait(c)}.`],
  },
  {
    id: "passcode-cancel",
    group: "Local Gallery passcode",
    kind: "flavor",
    when: never,
    say: ["Okay. It stays shut.", "Never mind, then. It stays closed."],
  },
  {
    id: "passcode-set",
    group: "Local Gallery passcode",
    kind: "flavor",
    when: never,
    say: [
      "Got it. Nobody opens the gallery without it now.",
      "Passcode set. I didn’t look, but I’ll know it when I see it.",
    ],
  },
  {
    id: "passcode-changed",
    group: "Local Gallery passcode",
    kind: "flavor",
    when: never,
    say: ["New passcode, noted.", "Changed. The old one won’t work now."],
  },
  {
    id: "passcode-off",
    group: "Local Gallery passcode",
    kind: "flavor",
    when: never,
    say: ["Passcode off. I’ll just open the gallery now.", "No more passcode. Anyone can open it."],
  },
  {
    id: "passcode-locked",
    group: "Local Gallery passcode",
    kind: "flavor",
    when: never,
    say: ["Locked. It needs the passcode again now.", "Shut tight."],
  },
  {
    id: "passcode-was-locked",
    group: "Local Gallery passcode",
    kind: "flavor",
    when: never,
    say: ["It wasn’t open, so it’s locked already."],
  },
  {
    id: "passcode-hidden",
    group: "Local Gallery passcode",
    kind: "flavor",
    when: never,
    say: ["Tucked away. Finder won’t show the gallery folder now.", "Hidden out of sight."],
  },
  {
    id: "passcode-shown",
    group: "Local Gallery passcode",
    kind: "flavor",
    when: never,
    say: ["The gallery folder’s back where Finder can see it."],
  },

  // Needs: Mote asks for these on their own, when they need them
  {
    id: "feed-me",
    group: "Needs",
    kind: "flavor",
    when: never,
    cooldown: 10 * 60_000,
    say: [
      "I’m getting hungry… is there a snack?",
      "My tummy’s rumbling. A snack, maybe?",
      "Could I have something to eat?",
      "Snack? Click me and say “snack”. Please?",
    ],
  },
  {
    id: "tuck-me-in",
    group: "Needs",
    kind: "flavor",
    when: never,
    cooldown: 10 * 60_000,
    say: ["I’m so sleepy… could you tuck me in?", "*yawn* I need a nap. Click me and say “bed”?"],
  },
  {
    id: "play-with-me",
    group: "Needs",
    kind: "flavor",
    when: never,
    cooldown: 10 * 60_000,
    say: ["Want to play something? Click me and say “game”.", "It’s been quiet. A game, maybe?", "Could we play something? Anything."],
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
    effects: { moved: { joy: 0.5, peace: 0.5 }, ignored: { peace: -0.3 } },
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
    effects: { petted: { joy: 0.6, peace: 1 }, ignored: { peace: -0.4 } },
    replies: { petted: ["Mmm… that’s better."], ignored: ["Maybe later, then."] },
  },
];

// Check-ins: simple, easy questions about how you're doing. Green is always
// the "doing fine" answer, and gets something glad. Red gets a worried, soft
// face and a reply that fits the question: understanding, not a lecture, and
// where it helps, one small idea. (Not having fun isn't a worry: it's a
// reason to play something.) Unanswered, Mote says nothing at all, just a
// soft look: there's never any pressure to reply.
const fine: Line["faces"] = { yes: "beam", no: "care", ignored: "soothe" };
const evening = (c: SpeechContext) => c.hour >= 18 && c.hour < 23;
const lateNight = (c: SpeechContext) => c.hour >= 23 || c.hour < 4;
const daytime = (c: SpeechContext) => c.hour >= 9 && c.hour < 19;

type CheckIn = Omit<Line, "kind" | "group" | "when" | "checkIn"> & { when?: Line["when"] };

const ASKED: CheckIn[] = [
  {
    id: "check-okay",
    say: ["Hey. You doing okay?", "Just checking in: you alright?", "You good?"],
    replies: {
      yes: ["Good. That’s all I wanted to know.", "Okay! Carry on, then.", "Good. Me too, now."],
      no: [
        "Ah. Thanks for telling me. You don’t have to explain. I’ll just sit here with you.",
        "Sorry. I’ll keep quiet for a bit. Poke me if you want silly instead.",
        "Okay. Not great is allowed. I still like hanging out with you.",
      ],
    },
  },
  {
    id: "check-calm",
    say: ["Feeling pretty calm right now?", "How’s your head? Quiet-ish?", "Things feeling easy at the moment?"],
    replies: {
      yes: ["Good. I like it when it’s calm in here.", "Nice. Let’s keep it like this as long as we can.", "Mm. Same. Quiet’s nice."],
      no: [
        "Ah, one of those. Lots of tabs open in there, huh? Mine get like that too.",
        "Hmm. It doesn’t all have to get sorted at once. Just the next little bit.",
        "Oof. Okay. I’ll be extra quiet and not add to the pile.",
      ],
    },
  },
  {
    id: "check-things",
    say: ["Feeling alright about things?", "Is life being kind to you lately?", "Things going okay, in general?"],
    replies: {
      yes: ["Good. I’m glad.", "Yay. That makes me happy.", "Good. Hang on to that."],
      no: [
        "Sorry. That sounds heavy to carry around. You can put it down for a minute. It’ll keep.",
        "Hmm. Sometimes saying it out loud helps. Even to a little dot. I won’t tell.",
        "Ah. That’s hard. You don’t have to have it all figured out today.",
      ],
    },
  },
  {
    id: "check-fun",
    when: (c) => c.games,
    say: ["Having a good time over there?", "Is today being fun at all?", "Enjoying yourself?"],
    // No: the games are offered (see converse.ts's funNo).
    replies: {
      yes: ["Yay! Good. Fun suits you.", "Excellent. Carry on having it.", "Good! I hope it’s catching. I want some."],
    },
    faces: { yes: "beam", no: "cute", ignored: "soothe" },
    then: { no: "suggest-play" },
  },
  {
    // The same question with the toy chest switched off: no games to offer.
    id: "check-fun-plain",
    when: (c) => !c.games,
    say: ["Having a good time over there?", "Is today being fun at all?", "Enjoying yourself?"],
    replies: {
      yes: ["Yay! Good. Fun suits you.", "Excellent. Carry on having it.", "Good! I hope it’s catching. I want some."],
      no: [
        "Boo. Take five and do the most fun thing within reach. It doesn’t have to be useful.",
        "Well, that won’t do. Put on a song you love, loud. I’ll bob along.",
        "Not even a little? Do something silly for a minute. Dance badly. I won’t tell.",
      ],
    },
    faces: { yes: "beam", no: "cute", ignored: "soothe" },
  },
  {
    id: "check-day",
    say: ["Is today treating you alright?", "Good day so far?", "Has today been a nice one?"],
    replies: {
      yes: ["Yay. Let’s keep it that way.", "Good! I hope the rest of it is just as nice.", "Love that. Good days are easy to forget, so remember this one."],
      no: [
        "Ah, sorry. Some days just won’t cooperate. It’s still allowed to get better later.",
        "Ugh, one of those. Well, it’s not over yet. Plenty of time for it to turn around.",
        "Sorry. Those are rough. I’m not going anywhere, if you want company.",
      ],
    },
  },
  {
    id: "check-rested",
    say: ["Getting enough sleep lately?", "Feeling rested today?", "Sleeping okay these days?"],
    replies: {
      yes: ["Good! Sleep’s the best. I’d know, I do a lot of it.", "Nice. Well-rested you is my favorite you."],
      no: [
        "Ugh. Everything’s twice as hard on not enough sleep. Today can be a low-effort day.",
        "Oh no. Tired makes everything feel heavier than it really is. Small stuff only today?",
        "If you can sneak a nap in later, I won’t tell anyone. I nap all the time.",
      ],
    },
  },
  {
    id: "check-comfy",
    say: ["Are you comfy right now?", "How’s your back? Comfy?", "Sitting comfy over there?"],
    replies: {
      yes: ["Good. Comfy is the best way to be.", "Nice. I’m comfy too. I’m always comfy."],
      no: [
        "Fix it! Wiggle around, grab a cushion. I’ll wait.",
        "Stand up and stretch for a sec? Your back will thank you. I’ll watch your stuff.",
        "Shuffle around till it’s right. You’ve been sitting there a while.",
      ],
    },
    faces: { yes: "beam", no: "think", ignored: "soothe" },
  },
  {
    id: "check-ate",
    when: (c) => c.hour >= 11 || c.hour < 4,
    say: ["Have you eaten something today?", "Had anything to eat lately?", "Eaten today? Real food, I mean."],
    replies: {
      yes: ["Good! Fed people are happy people.", "Great. That’s one thing ticked off."],
      no: [
        "Hey, go grab something. Even a little. I’ll guard the screen.",
        "Not even a snack? Toast is easy. Go on, I’ll be right here.",
        "Food first, everything else after. It all goes better with something in you.",
      ],
    },
  },
  {
    id: "check-break",
    say: ["Taken a break lately?", "Had a little break recently?"],
    replies: {
      yes: ["Good! Breaks aren’t lazy. They’re smart.", "Nice. Gold star for you."],
      no: [
        "Then it’s break time. Mote’s orders. Five minutes. Go!",
        "Get up, walk around, look at something far away. Your eyes will love you.",
        "Even a tiny one? Stretch, sip some water, come back. I’ll keep your spot.",
      ],
    },
    faces: { yes: "beam", no: "cute", ignored: "soothe" },
  },
  {
    id: "check-outside",
    when: daytime,
    say: ["Been outside at all today?", "Had some fresh air today?"],
    replies: {
      yes: ["Nice! What’s it like out there? I never get to go.", "Good. Outside is good for you. Apparently."],
      no: [
        "Maybe pop out for five minutes? Even just the doorstep. I’ll hold the fort.",
        "Open a window, at least? A bit of sky does wonders.",
        "A quick walk might be nice. I’d come, but… no legs.",
      ],
    },
    faces: { yes: "beam", no: "think", ignored: "soothe" },
  },
  {
    id: "check-people",
    say: ["Talked to anyone nice lately?", "Had a good chat with someone recently?", "Seen any friends lately?"],
    replies: {
      yes: ["Oh good! Tell them Mote says hi.", "Nice. Good chats fill you up a little, don’t they?"],
      no: [
        "You’ve got me! …I count a little. Maybe text someone who can talk back, too?",
        "It’s easy to go quiet without noticing. A quick hi to someone you like might feel nice.",
        "Hmm. Send someone something silly? Even a meme counts as hello.",
      ],
    },
  },
  {
    id: "check-treat",
    say: ["Done anything nice for yourself today?", "Had a little treat today?"],
    replies: {
      yes: ["Good! You deserve nice things.", "Yay. More of that, please."],
      no: [
        "Then do one tiny thing. A song you love? A cup of something warm? It counts.",
        "Hmm. Pick something small and nice, and do it soon. Mote’s orders.",
        "That’s too bad. A favorite snack, a little walk, five minutes of nothing. Your pick.",
      ],
    },
    faces: { yes: "beam", no: "think", ignored: "soothe" },
  },
  {
    id: "check-work",
    weight: 3,
    when: (c) => c.typing,
    say: ["Lots of typing! Is it going alright?", "Is the work going okay?", "Keeping up alright with everything?"],
    replies: {
      yes: ["Good! Look at you go.", "Nice. You’re on a roll.", "Great. I’ll keep cheering quietly."],
      no: [
        "Ugh. Pick one small piece and just do that. The rest can wait its turn.",
        "Stuck, or just too much of it? Either way, a two-minute break might help.",
        "Mm. It doesn’t all have to get done today. Probably. Mostly.",
      ],
    },
  },
  {
    id: "check-watching",
    weight: 3,
    when: (c) => c.media,
    say: ["Enjoying this?", "Is it any good?"],
    replies: {
      yes: ["Me too! Well, the sound of it.", "Good. I’ll keep listening."],
      no: [
        "Then switch it! Life’s too short for boring stuff.",
        "Put on something you actually like. You deserve better than background noise.",
      ],
    },
    faces: { yes: "beam", no: "cute", ignored: "soothe" },
  },
  {
    id: "check-morning",
    weight: 2,
    when: (c) => c.hour >= 5 && c.hour < 11,
    say: ["Feeling ready for today?", "Good morning! Feeling okay?"],
    replies: {
      yes: ["Ooh, look at you. Go get it!", "Yay. It’s going to be a good one."],
      no: [
        "Same, honestly. Start with something tiny. It gets easier once you’re moving.",
        "Ease into it. Nothing has to happen in the first hour.",
        "Breakfast first. Big things after.",
      ],
    },
  },
  {
    id: "check-evening",
    weight: 2,
    when: evening,
    say: ["Getting to relax a bit tonight?", "Winding down okay?"],
    replies: {
      yes: ["Good. Evenings are for doing nothing on purpose.", "Nice. Cozy mode, activated."],
      no: [
        "Still lots to do? Try to save a little bit of tonight just for you.",
        "Oof. Busy evenings are tiring. Even ten minutes off counts.",
        "Hmm. Whatever’s left, maybe some of it can be tomorrow’s problem.",
      ],
    },
  },
  {
    id: "check-late",
    weight: 3,
    when: lateNight,
    say: ["Still up! Doing okay?", "Late one, huh. You alright?", "It’s pretty late. Everything okay?"],
    replies: {
      yes: ["Good. Night owls unite.", "Okay! Just checking. Carry on, night owl.", "Good. It’s nice and quiet this late, isn’t it?"],
      no: [
        "Ah. Night’s when everything feels loudest. It usually shrinks a bit by morning.",
        "Can’t sleep, or don’t want to? Either way, I’ll stay up with you a while.",
        "Late-night brain is the worst brain. Don’t believe everything it tells you right now.",
      ],
    },
  },
];

export const CHECK_INS: Line[] = ASKED.map(({ when, faces, ...l }) => ({
  ...l,
  kind: "ask" as const,
  group: "Check-ins",
  checkIn: true,
  when: when ?? (() => true),
  faces: faces ?? fine,
  // Glad when you're fine; nothing else to Mote's feelings, so a hard day
  // is never something that upsets them.
  effects: { yes: { joy: 0.3, peace: 0.2 } },
}));

LINES.push(...CHECK_INS);

export const lineById = new Map(LINES.map((l) => [l.id, l]));

/** Something Mote does when you give them one of the apps that came with the Mac. */
export type AppMood =
  "think" | "cute" | "delight" | "surprise" | "hum" | "glance" | "yawn" | "dizzy";

/**
 * Apps that come with every Mac, by app ID: what Mote says when you drop one
 * on them, and what they do. (Apps can't be eaten or played with, but Mote
 * has opinions.)
 */
export const APPLE_APPS: Record<string, { say: string[]; mood?: AppMood }> = {
  "com.apple.safari": {
    say: [
      "Safari! Can we look up pictures of other dots?",
      "The whole internet? That’s a lot of bits.",
    ],
    mood: "delight",
  },
  "com.apple.mail": {
    say: ["Mail? Nobody ever writes to me.", "Ooh, is any of it for me?"],
    mood: "glance",
  },
  "com.apple.mobilesms": {
    say: ["Messages! Tell them I said hi.", "Who are we texting? Can I add an emoji?"],
    mood: "cute",
  },
  "com.apple.facetime": {
    say: ["FaceTime? I’m not camera ready!", "Is it someone I know? I’ll wave."],
    mood: "surprise",
  },
  "com.apple.mobilephone": { say: ["A phone call? Is it for me?"], mood: "surprise" },
  "com.apple.photos": {
    say: ["Photos! Are there any of me?", "So many memories. And so many bits…"],
    mood: "cute",
  },
  "com.apple.music": {
    say: ["Ooh, put something on! I’ll hum along.", "Music! Play my favorite. (It’s all of them.)"],
    mood: "hum",
  },
  "com.apple.tv": {
    say: ["TV! Movie night?", "Can we watch something with a dot in it?"],
    mood: "delight",
  },
  "com.apple.podcasts": {
    say: ["A podcast? I love when people just talk.", "Put on the one about dots."],
    mood: "hum",
  },
  "com.apple.ibooksx": {
    say: ["Books! Read me a story?", "I can’t read, but I love the pictures."],
    mood: "cute",
  },
  "com.apple.maps": {
    say: ["Maps! Where are we going?", "Can you find where I live? It’s right here."],
    mood: "glance",
  },
  "com.apple.notes": {
    say: ["Notes! Write down that I’m great.", "Taking notes? About me?"],
    mood: "think",
  },
  "com.apple.reminders": {
    say: ["Reminder: feed Mote.", "Can you add ‘pet Mote’ to the list?"],
    mood: "think",
  },
  "com.apple.ical": {
    say: ["Calendar! Anything fun coming up?", "Pencil me in for a nap."],
    mood: "think",
  },
  "com.apple.addressbook": {
    say: ["Am I in your contacts?", "So many friends! Is one of them a dot?"],
    mood: "cute",
  },
  "com.apple.calculator": {
    say: ["Two plus two is… bits?", "Numbers! My favorites are 1 and 0."],
    mood: "think",
  },
  "com.apple.clock": { say: ["Is it nap time yet?", "Tick tock! What time is it?"], mood: "yawn" },
  "com.apple.weather": {
    say: ["Is it sunny out there? It’s always cozy in here.", "Do I need a tiny umbrella?"],
    mood: "glance",
  },
  "com.apple.preview": {
    say: ["Preview! Show me something!", "Ooh, peeking at pictures?"],
    mood: "glance",
  },
  "com.apple.textedit": {
    say: ["TextEdit! Write me a poem?", "A blank page. So much potential!"],
    mood: "think",
  },
  "com.apple.finder": {
    say: ["Finder! Can you find me a snack?", "All your files! Any tasty ones?"],
    mood: "delight",
  },
  "com.apple.systempreferences": {
    say: ["Settings? Don’t change anything about me!", "Careful in there. Very serious stuff."],
    mood: "surprise",
  },
  "com.apple.appstore": {
    say: ["Ooh, are we getting a new game?", "The App Store! Get something fun!"],
    mood: "delight",
  },
  "com.apple.apps.launcher": { say: ["All your apps! Any games?"], mood: "glance" },
  "com.apple.terminal": {
    say: ["The Terminal! Very hacker. Very cool.", "Whoa, all text. You must be a genius."],
    mood: "surprise",
  },
  "com.apple.activitymonitor": {
    say: ["Am I using too much? I’m tiny, I promise!", "Look at all those busy little bits."],
    mood: "think",
  },
  "com.apple.console": { say: ["So many messages. Is everything okay in there?"], mood: "think" },
  "com.apple.diskutility": { say: ["Disk Utility? Please don’t erase me!"], mood: "surprise" },
  "com.apple.systemprofiler": { say: ["How big is my house? Show me!"], mood: "think" },
  "com.apple.photobooth": {
    say: ["Photo Booth! Quick, get my good side.", "Say cheese!"],
    mood: "cute",
  },
  "com.apple.image_capture": { say: ["Say cheese!"], mood: "cute" },
  "com.apple.screenshot.launcher": { say: ["A screenshot! Get me in it."], mood: "cute" },
  "com.apple.quicktimeplayerx": {
    say: ["Are we watching a video?", "QuickTime! Play it!"],
    mood: "delight",
  },
  "com.apple.iwork.keynote": {
    say: ["Keynote! Are you presenting? I’ll clap.", "Make a slide about me!"],
    mood: "delight",
  },
  "com.apple.iwork.pages": {
    say: ["Pages! Write a story about a little dot.", "Ooh, fancy writing."],
    mood: "think",
  },
  "com.apple.iwork.numbers": {
    say: ["Spreadsheets! My eyes are spinning.", "So many cells. So many numbers."],
    mood: "dizzy",
  },
  "com.apple.garageband10": { say: ["GarageBand! Let’s make a song!"], mood: "hum" },
  "com.apple.imovieapp": { say: ["iMovie! Am I the star?"], mood: "cute" },
  "com.apple.stocks": {
    say: ["Stocks? Is that like soup?", "Line go up? Line go down?"],
    mood: "think",
  },
  "com.apple.home": { say: ["Can you turn the lights down? I’m sleepy."], mood: "yawn" },
  "com.apple.freeform": { say: ["Freeform! Draw me?"], mood: "cute" },
  "com.apple.fontbook": {
    say: ["Fonts! I like the round ones.", "So many letters."],
    mood: "glance",
  },
  "com.apple.dictionary": {
    say: ["Look up ‘Mote’! Does it say ‘cute’?", "Words, words, words."],
    mood: "think",
  },
  "com.apple.stickies": { say: ["Stickies! Stick one on me."], mood: "cute" },
  "com.apple.passwords": {
    say: ["Passwords? Secrets! I won’t look.", "I’m covering my eyes. Promise."],
    mood: "glance",
  },
  "com.apple.journal": { say: ["Dear diary: today Mote was very cute."], mood: "cute" },
  "com.apple.shortcuts": { say: ["Is there a shortcut for snacks?"], mood: "think" },
  "com.apple.voicememos": { say: ["Record me! Ahem. Hi!"], mood: "delight" },
  "com.apple.news": { say: ["Any news about dots?"], mood: "glance" },
  "com.apple.findmy": { say: ["Did you lose something? I’m right here."], mood: "glance" },
  "com.apple.backup.launcher": {
    say: ["Time Machine! Can we go back to when I was full?"],
    mood: "think",
  },
  "com.apple.automator": { say: ["A robot! Hello, robot friend."], mood: "delight" },
  "com.apple.scripteditor2": { say: ["Are you writing spells?"], mood: "think" },
  "com.apple.siri.launcher": { say: ["Siri! Tell Siri I said hi."], mood: "cute" },
  "com.apple.campo": { say: ["Siri! Tell Siri I said hi."], mood: "cute" },
  "com.apple.helpviewer": { say: ["Tip: pet Mote often."], mood: "cute" },
  "com.apple.screencontinuity": {
    say: ["Your phone! Is there a little Mote in there too?"],
    mood: "surprise",
  },
  "com.apple.generativeplaygroundapp": { say: ["Make a picture of me!"], mood: "delight" },
  "com.apple.exposelauncher": { say: ["Whoa, all your windows at once!"], mood: "dizzy" },
  "com.apple.magnifier": { say: ["Do I look bigger now?"], mood: "cute" },
  "com.apple.grapher": { say: ["Draw a happy curve!"], mood: "think" },
  "com.apple.dt.xcode": { say: ["Xcode! Are you making me?"], mood: "surprise" },
  "com.anyonebut.mote": { say: ["Wait… that’s me?!", "Is that… another me?"], mood: "surprise" },
};

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
      !l.checkIn &&
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

/**
 * A check-in that fits right now, leaving out any asked in the last eight
 * hours. Null if none fits.
 */
export function chooseCheckIn(c: SpeechContext, lastSaid: Map<string, number>, now: number): Line | null {
  const ok = CHECK_INS.filter(
    (l) => l.when(c) && now - (lastSaid.get(l.id) ?? Number.NEGATIVE_INFINITY) > 8 * 60 * 60_000,
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
  /** In a conversation: choices to pick from (one per line), and a hint in
   * the box to type in. */
  choices?: Array<{ id: string; label: string }>;
  placeholder?: string;
};
