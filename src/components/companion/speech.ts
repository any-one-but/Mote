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
export type SpeechEvent =
  | "petted"
  | "dizzy-over"
  | "media-start"
  | "welcome-back"
  | "played"
  | "spun"
  | "woke-rested"
  | "woke-groggy"
  | "startled";

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
  /** An app just dropped on Mote: its name and ID. */
  offering: { name: string; bundle?: string | null } | null;
  /** The game being played, if any: its name, what sort, and how it went. */
  game: string | null;
  gameKind: "chess" | "minecraft" | "game" | null;
  gameWon: boolean;
  /** The spin that just ended: top speed (turns a second), how long it
   * lasted (seconds) and how many times round. */
  spin: { peak: number; seconds: number; turns: number } | null;
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
  effects?: Partial<Record<Outcome, Partial<MindValues>>>;
  /** What Mote says back after each outcome (a short flavor bubble). */
  replies?: Partial<Record<Outcome, string[]>>;
  /** In Friendly mode, gentler replies to use instead. */
  kindReplies?: Partial<Record<Outcome, string[]>>;
  /** Never said in Friendly mode. */
  unkind?: boolean;
  /** Something Mote does about it (play the game again). */
  then?: Partial<Record<Outcome, "play-again" | "open-link">>;
  /** Group name shown in the debug list. */
  group: string;
};

const never = () => false;
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
    id: "spun",
    group: "After something happens",
    kind: "flavor",
    when: (c) => c.event === "spun" && c.spin !== null,
    cooldown: 0,
    say: (c) => {
      const s = c.spin ?? { peak: 0, seconds: 0, turns: 0 };
      const turns = Math.round(s.turns);
      const lines: string[] = [];
      // By top speed.
      if (s.peak < 0.6) {
        lines.push(
          "Ooh, a little twirl!",
          "Hehe. That tickled.",
          "A gentle spin! Very relaxing.",
          "Was that a spin or a wiggle? Either way, more please.",
        );
      } else if (s.peak < 2) {
        lines.push(
          "Wheee! Again!",
          "Round and round! I love that.",
          "That was the perfect speed. Do it again!",
          "Spinny! Spinny spinny!",
          "My favorite kind of exercise.",
        );
      } else if (s.peak < 6) {
        lines.push(
          "WHEEE! The room is still going!",
          "Whoa, whoa, whoa. That was SO fun.",
          "I think my eyes are still spinning.",
          "Faster than a washing machine! Again!",
          "Hold on, let me find which way is up.",
        );
      } else if (s.peak < 20) {
        lines.push(
          "THAT WAS AMAZING. Give me a second…",
          "I can hear colors.",
          "I think I left my stomach over there.",
          "Is this what being a fan feels like? A ceiling fan?",
          "My cheeks are still stuck from squishing!",
        );
      } else {
        lines.push(
          "I think I saw the back of my own head.",
          "I am one with the centrifuge.",
          "Was that the speed of light?!",
          "I went so fast I arrived yesterday.",
          "I’m pretty sure I just became a donut.",
          "HOW. That was incredible. HOW.",
        );
      }
      // By how long it lasted.
      if (s.seconds > 30) {
        lines.push(
          "How long were we spinning?! I’ve lost track of time.",
          "I’ve been spinning so long I forgot what still feels like.",
        );
      } else if (s.seconds > 12) {
        lines.push(
          "That went on forever! In the best way.",
          "My whole world has been sideways for ages.",
        );
      } else if (s.seconds < 2 && s.peak >= 0.6) {
        lines.push("Short but sweet!", "Over so fast! Wanna go again?");
      }
      // And how many times round.
      if (turns >= 1000)
        lines.push(`That was… ${turns.toLocaleString()} spins?! I stopped counting at a hundred.`);
      else if (turns >= 50)
        lines.push(
          `I counted ${turns} spins! …I think.`,
          `${turns} times round! A new record? Probably!`,
        );
      else if (turns >= 5) lines.push(`${turns} whole spins!`);
      return lines;
    },
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
    effects: { yes: { happy: 0.3 } },
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
