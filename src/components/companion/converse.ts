// Talking to Mote. Click Mote and they ask what you'd like to do; you type
// anything ("I want to play chess", "chess", "my links", "I want to paaly a
// gatme") and Mote works out what you mean from a big list of keywords and
// loose connections to them (typos, missing or extra letters, swapped
// letters, words run together or split apart), then gets on with it:
//
// - sure of it (the words, or near enough): Mote just does it
// - a guess (only a typo-ish match): Mote checks first ("You want to play a
//   game?"), and you answer yes or no
// - no idea: Mote asks you to put it another way
//
// The point is to get out of the conversation as fast as possible: one line
// from you, then the right thing opens. Everything Mote can do lives under
// one intent each, so a keyword never points two ways.
//
// Nothing here touches the screen: Companion asks `understand` what was
// meant, and picks the words to say from the lists below.

export type IntentId =
  // Games: the chest itself, and each game by name.
  | "games"
  | "chess"
  | "checkers"
  | "tictactoe"
  | "solitaire"
  | "files"
  // Saved links: bring one up, or how to save one.
  | "links"
  | "saveLink"
  | "settings"
  // Talking about the talking.
  | "help"
  | "greet"
  | "thanks"
  | "howAreYou"
  | "pet"
  | "cancel";

/** A keyword: a word or phrase, and how strongly it points to its intent. */
type Word = string | [string, number];

const GAMES = ["chess", "checkers", "tictactoe", "solitaire"] as const;
export type GameIntent = (typeof GAMES)[number];
export const isGame = (id: IntentId): id is GameIntent => (GAMES as readonly string[]).includes(id);

/**
 * Every intent's keywords. Strong, specific words weigh 1; words that only
 * lean that way weigh less, so a specific match wins ("play chess" is chess,
 * not just "a game"). Plurals and -ing / -ed forms match on their own, and so
 * do typos, so these lists are about meaning, not spelling.
 */
const INTENTS: Record<IntentId, Word[]> = {
  games: [
    "game",
    // A little under a game itself, so "play a video" is a video.
    ["play", 0.9],
    ["playtime", 0.9],
    "board game",
    "boardgame",
    ["toy", 0.9],
    ["toy chest", 1],
    ["chest", 0.6],
    ["bored", 0.8],
    ["boring", 0.7],
    ["fun", 0.6],
    ["something fun", 0.85],
    ["entertain", 0.8],
    ["entertainment", 0.8],
    ["challenge", 0.8],
    ["compete", 0.8],
    ["competition", 0.7],
    ["match", 0.6],
    ["rematch", 0.85],
    ["versus", 0.7],
    ["vs", 0.6],
    ["kill time", 0.85],
    ["pass the time", 0.85],
    ["round", 0.5],
    ["win", 0.55],
    ["beat you", 0.85],
    ["play with you", 1],
    ["play with me", 1],
    ["play together", 1],
    ["minigame", 0.9],
    ["puzzle", 0.6],
    ["strategy", 0.6],
  ],
  chess: [
    ["chess", 1.3],
    ["chessboard", 1.3],
    ["checkmate", 1.2],
    ["check mate", 1.2],
    ["rook", 1.1],
    ["bishop", 1.1],
    ["knight", 1],
    ["pawn", 1.05],
    ["queen", 0.9],
    ["castling", 1],
    ["en passant", 1.2],
    ["stalemate", 1.1],
    ["grandmaster", 1],
  ],
  checkers: [
    ["checkers", 1.3],
    ["checker", 1.3],
    ["chequers", 1.3],
    ["draughts", 1.3],
    ["king me", 1.3],
    ["double jump", 1.1],
    ["jump", 0.7],
  ],
  tictactoe: [
    ["tic tac toe", 1.3],
    ["tictactoe", 1.3],
    ["tic tac", 1.2],
    ["tick tack toe", 1.3],
    ["noughts and crosses", 1.3],
    ["noughts", 1.2],
    ["naughts", 1.2],
    ["crosses", 1.05],
    ["xs and os", 1.3],
    ["x and o", 1.2],
    ["xo", 1],
    ["three in a row", 1.2],
    ["ttt", 1.1],
  ],
  solitaire: [
    ["solitaire", 1.3],
    ["patience", 1.25],
    ["klondike", 1.3],
    ["card", 1.1],
    ["card game", 1.3],
    ["play cards", 1.35],
    ["deck of cards", 1.3],
    ["deck", 0.9],
    ["deal", 0.8],
    ["shuffle", 0.9],
    ["by myself", 0.9],
    ["on my own", 0.9],
    ["help me play", 1],
    ["together", 0.6],
  ],
  files: [
    ["file", 1],
    ["folder", 1],
    ["directory", 0.95],
    ["clean", 0.95],
    ["cleanup", 1],
    ["clean up", 1],
    ["tidy", 1],
    ["tidy up", 1],
    ["organize", 1],
    ["organise", 1],
    ["sort", 0.8],
    ["declutter", 1],
    ["clutter", 0.95],
    ["rename", 1],
    ["compress", 1],
    ["shrink", 0.9],
    ["convert", 1],
    ["unzip", 1],
    ["zip", 0.9],
    ["archive", 0.9],
    ["extract", 0.95],
    ["duplicate", 0.9],
    ["trim", 0.9],
    ["mp4", 0.9],
    ["downloads", 0.9],
    ["desktop", 0.7],
    ["storage", 0.85],
    ["disk", 0.85],
    ["space", 0.6],
    ["free up space", 1.1],
    ["delete", 0.75],
    ["junk", 0.85],
  ],
  links: [
    ["link", 1.1],
    ["saved", 0.9],
    ["bookmark", 1],
    ["video", 1],
    ["youtube", 1.1],
    ["watch", 0.95],
    ["something to watch", 1.2],
    ["website", 0.95],
    ["site", 0.85],
    ["url", 1],
    ["article", 0.95],
    ["read", 0.75],
    ["favorite", 0.85],
    ["favourite", 0.85],
    ["show me something", 1],
    ["remind me", 0.8],
  ],
  saveLink: [
    ["save a link", 1.3],
    ["save link", 1.3],
    ["add a link", 1.3],
    ["add link", 1.3],
    ["save", 0.7],
    ["bookmark this", 1.3],
    ["how do i save", 1.3],
  ],
  settings: [
    ["settings", 1.2],
    ["setting", 1.2],
    ["preferences", 1.1],
    ["prefs", 1.05],
    ["options", 0.9],
    ["configure", 1],
    ["config", 1],
    ["dark mode", 1.2],
    ["light mode", 1.2],
    ["theme", 1],
    ["appearance", 1],
    ["login", 1.1],
    ["log in", 1.1],
    ["float", 0.9],
    ["on top", 0.9],
  ],
  help: [
    ["help", 1],
    ["what can you do", 1.3],
    ["what do you do", 1.25],
    ["what can i do", 1.25],
    ["what should we do", 1.2],
    ["what should i do", 1.2],
    ["what do you want to do", 1.2],
    ["what is there", 1.1],
    ["what now", 1],
    ["menu", 1],
    ["list", 0.85],
    ["commands", 1],
    ["ideas", 0.9],
    ["idea", 0.85],
    ["idk", 1],
    ["dunno", 1],
    ["dont know", 1.1],
    ["not sure", 1],
    ["anything", 0.85],
    ["something", 0.7],
    ["surprise me", 1.1],
    ["whatever", 0.85],
    ["choices", 0.95],
    ["everything", 0.75],
  ],
  greet: [
    ["hi", 1],
    ["hello", 1],
    ["hey", 0.95],
    ["hiya", 1],
    ["howdy", 1],
    ["yo", 0.9],
    ["sup", 0.85],
    ["good morning", 1],
    ["morning", 0.85],
    ["good evening", 1],
    ["greetings", 1],
    ["just saying hi", 1.3],
  ],
  thanks: [
    ["thanks", 1.1],
    ["thank you", 1.2],
    ["thx", 1],
    ["ty", 0.95],
    ["cheers", 0.95],
    ["appreciate it", 1.1],
  ],
  howAreYou: [
    ["how are you", 1.3],
    ["how r u", 1.3],
    ["how are u", 1.3],
    ["how you doing", 1.3],
    ["how are things", 1.2],
    ["you okay", 1.15],
    ["you ok", 1.15],
    ["you alright", 1.15],
    ["how do you feel", 1.3],
    ["are you happy", 1.2],
    ["how is your day", 1.25],
  ],
  pet: [
    ["pet", 1.05],
    ["pat", 1],
    ["stroke", 1],
    ["cuddle", 1],
    ["hug", 1],
    ["scratch", 0.9],
    ["boop", 0.9],
    ["tickle", 0.95],
  ],
  cancel: [
    ["nothing", 1.1],
    ["never mind", 1.2],
    ["nevermind", 1.2],
    ["nvm", 1.1],
    ["nah", 1],
    ["no", 0.9],
    ["nope", 1],
    ["cancel", 1.1],
    ["stop", 0.9],
    ["bye", 1],
    ["goodbye", 1],
    ["later", 0.8],
    ["not now", 1.1],
    ["forget it", 1.2],
    ["no thanks", 1.2],
    ["all good", 1],
    ["im good", 1],
    ["im fine", 0.9],
    ["oops", 0.95],
    ["mistake", 0.9],
    ["by accident", 1.1],
    ["misclick", 1.1],
  ],
};

/** Words that carry no meaning on their own here (they're skipped). */
const STOP = new Set(
  (
    "i im ive id ill me my mine myself want wanna wanted to a an the please pls plz can could " +
    "would should will we us lets let some like just really so and or of for with at on in it " +
    "its this that these those now right little bit quick quickly again then um uh umm hmm ok " +
    "okay yeah yea yep sure is are be been am was were do does did go gonna gotta maybe kind " +
    "sort of very much more any up out about over get got give make take have has need " +
    "time today tonight thing things think also too there here what which who how why when where " +
    "you your youre yours yourself u ur mote motes ya"
  ).split(" "),
);
/** Phrases that keep their words, though some are stop words. */
const KEEP_PHRASES = [
  "what can you do",
  "on top",
  "log in",
  "what do you do",
  "what can i do",
  "what should we do",
  "what should i do",
  "what do you want to do",
  "what is there",
  "what now",
  "how are you",
  "how r u",
  "how are u",
  "how you doing",
  "how are things",
  "how do you feel",
  "are you happy",
  "how is your day",
  "you okay",
  "you ok",
  "you alright",
  "how am i doing",
  "how im doing",
  "play with you",
  "play with me",
  "beat you",
  "something to watch",
  "show me something",
  "remind me",
  "so far",
  "not now",
  "x and o",
  "three in a row",
  "pass the time",
  "how do i save",
  "free up space",
  "just saying hi",
  "king me",
  "im good",
  "im fine",
  "save a link",
  "add a link",
  "dont know",
  "not sure",
  "by myself",
  "on my own",
  "help me play",
  "deck of cards",
  "kill time",
  "lights out",
  "xs and os",
  "bookmark this",
];

/** Common words that look like keywords with a typo, but aren't. */
const NOT_TYPOS = new Set(
  (
    "same came name gave late lame fame plan plane plate place player clay pray played " +
    "rook look took book cook hook nook week seek peek chest best test rest west nest " +
    "bed red fed led wed bad bid bud beg " +
    "file fine mile while tile wile pile life five fire " +
    "fun run sun gun bun fan fin " +
    "link line pink sink think wink lint " +
    "nap map cap gap tap lap rap " +
    "pet net met set get bet let jet wet vet " +
    "log dog fog hog jog bog lag leg " +
    "cal call all tall wall hall ball fall " +
    "help held hell helm " +
    "hi he ha ho " +
    "save safe same sale cave wave have gave " +
    "watch match catch batch latch " +
    "eat at it eel ear sat bat cat hat mat oat " +
    "roll role rule poll toll doll " +
    "sort sore sorry short snort fort port " +
    "track trick truck crack stack " +
    "toy boy joy " +
    "clean clear cleat glean " +
    "feed feet feel fees need seed weed reed " +
    "meal real seal deal heal veal " +
    "treat great threat " +
    "food good hood mood wood " +
    "sleep sheep steep sweep " +
    // And the negations themselves ("dont" isn't half of "dont know").
    "dont not never without isnt cant wont"
  )
    .split(" ")
    .filter(Boolean),
);

/** "Don't", "not", "no": a keyword just after one of these doesn't count. */
const NEGATIONS = new Set(["dont", "not", "never", "without", "isnt", "cant", "wont"]);

const compact = (s: string) => s.replace(/ /g, "");

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/'/g, "")
    .replace(/-/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plural and -ing / -ed endings off, so "games", "playing", "played" meet their word. */
function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es") && !w.endsWith("ses")) return w.slice(0, -1);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Repeated letters squashed ("paaly" → "paly", "gaaame" → "game"). */
const squash = (w: string) => w.replace(/(.)\1+/g, "$1");

/** Edit distance, counting a swap of two neighbouring letters as one edit. */
export function distance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

/** How well a typed word (or words run together) matches a keyword: 0 to 1,
 * and whether it's sure (the word itself, or near enough) or a guess. */
type Match = { q: number; sure: boolean };
const NONE: Match = { q: 0, sure: false };

function wordMatch(typed: string, word: string): Match {
  if (!typed || !word) return NONE;
  if (typed === word || stem(typed) === stem(word)) return { q: 1, sure: true };
  // Plurals either way ("games" for "game", "cookie" for "cookies").
  const forms = (w: string) => [w, w.replace(/s$/, ""), w.replace(/es$/, "")];
  if (forms(typed).some((t) => forms(word).includes(t))) return { q: 1, sure: true };
  if (squash(typed) === squash(word)) return { q: 0.97, sure: true };
  if (NOT_TYPOS.has(typed)) return NONE;
  // A word cut short ("solitai", "chec", "tic tac"): sure when most of it is there.
  if (typed.length >= 4 && word.startsWith(typed)) {
    const part = typed.length / word.length;
    if (part >= 0.7) return { q: 0.92, sure: true };
    if (part >= 0.5) return { q: 0.75, sure: false };
  }
  // Short words only forgive two letters swapped ("lnik" for "link").
  if (word.length <= 3) {
    const swapped =
      typed.length === word.length && [...typed].sort().join("") === [...word].sort().join("") && distance(typed, word) === 1;
    return swapped ? { q: 0.8, sure: false } : NONE;
  }
  const allowed = word.length >= 8 ? 3 : word.length >= 5 ? 2 : typed.length >= 5 ? 2 : 1;
  if (Math.abs(typed.length - word.length) > allowed) return NONE;
  const d = Math.min(distance(typed, word), distance(squash(typed), squash(word)));
  if (d > allowed) return NONE;
  // Two or more slips with a different first letter is usually another word.
  if (d >= 2 && typed[0] !== word[0]) return NONE;
  return { q: Math.max(0.55, 0.95 - (d / word.length) * 1.1), sure: false };
}

type Hit = { intent: IntentId; score: number; sure: boolean; at: number };

/** The best place a keyword shows up in the words typed. */
function find(tokens: string[], negated: boolean[], keyword: string): Match & { at: number } {
  const target = compact(keyword);
  const parts = keyword.split(" ").length;
  let best: Match & { at: number } = { ...NONE, at: -1 };
  for (let i = 0; i < tokens.length; i++) {
    if (negated[i]) continue;
    // The keyword against one typed word, or a few run together (so "tic tac
    // toe", "tictactoe" and "tic tactoe" all meet "tic tac toe").
    for (let n = 1; n <= Math.min(parts + 1, tokens.length - i); n++) {
      const joined = tokens.slice(i, i + n).join("");
      const m = wordMatch(joined, target);
      // A run of words has to cover most of a long keyword to count.
      if (n > 1 && joined.length < target.length * 0.7) continue;
      if (m.q > best.q || (m.q === best.q && m.sure && !best.sure)) best = { ...m, at: i };
    }
  }
  return best;
}

export type Heard =
  /** Sure what was meant: do it. */
  | { kind: "do"; intent: IntentId }
  /** A guess: check first. */
  | { kind: "check"; intent: IntentId }
  /** No idea. */
  | { kind: "unknown" };

export type Understanding = {
  /** The intents Mote can be talked into right now (anything locked away is
   * left out, so it's as if Mote had never heard of it). */
  known: ReadonlySet<IntentId>;
  /** Choices on offer just now (a menu of games, or of what Mote can do): their intents,
   * in order, so "2" or "the second one" picks one. */
  choices?: IntentId[];
};

const ORDINALS: Record<string, number> = {
  "1": 0,
  one: 0,
  first: 0,
  "2": 1,
  two: 1,
  second: 1,
  "3": 2,
  three: 2,
  third: 2,
  "4": 3,
  four: 3,
  fourth: 3,
  "5": 4,
  five: 4,
  fifth: 4,
  "6": 5,
  six: 5,
  sixth: 5,
  "7": 6,
  seven: 6,
  seventh: 6,
  "8": 7,
  eight: 7,
  eighth: 7,
  last: -1,
};

/**
 * What did they mean? Every intent's keywords are looked for in what was
 * typed; the strongest wins, with a nudge for more than one keyword pointing
 * the same way and for who it's about ("you" leans toward asking how Mote is,
 * or petting them).
 */
export function understand(text: string, u: Understanding): Heard {
  const clean = normalize(text);
  if (!clean) return { kind: "unknown" };
  const raw = clean.split(" ");

  // Picking from a menu by number or position.
  if (u.choices?.length) {
    const pick = raw.map((w) => ORDINALS[w]).find((n) => n !== undefined);
    if (pick !== undefined && raw.length <= 4) {
      const intent = pick < 0 ? u.choices[u.choices.length - 1] : u.choices[pick];
      if (intent) return { kind: "do", intent };
    }
  }

  // Keep whole phrases that are mostly stop words ("what can you do").
  let kept = clean;
  const held: string[] = [];
  for (const p of KEEP_PHRASES) {
    const re = new RegExp(`\\b${p}\\b`, "g");
    if (re.test(kept)) {
      held.push(compact(p));
      kept = kept.replace(re, " ");
    }
  }
  const words = kept.split(" ").filter(Boolean);
  const negated: boolean[] = [];
  const tokens: string[] = [];
  words.forEach((w, i) => {
    if (STOP.has(w) && !NEGATIONS.has(w)) return;
    const before = words.slice(Math.max(0, i - 3), i);
    negated.push(before.some((b) => NEGATIONS.has(b)) && !NEGATIONS.has(w));
    tokens.push(w);
  });
  for (const h of held) {
    tokens.push(h);
    negated.push(false);
  }

  const aboutYou = raw.some((w) => ["you", "your", "yourself", "u", "ur", "mote", "ya"].includes(w));

  const hits: Hit[] = [];
  for (const [intent, list] of Object.entries(INTENTS) as Array<[IntentId, Word[]]>) {
    if (!u.known.has(intent)) continue;
    let best: Hit | null = null;
    let extra = 0;
    for (const w of list) {
      const [keyword, weight] = typeof w === "string" ? [w, 1] : w;
      const m = find(tokens, negated, keyword);
      if (m.q <= 0) continue;
      const score = m.q * weight;
      if (!best || score > best.score) {
        if (best) extra++;
        best = { intent, score, sure: m.sure, at: m.at };
      } else extra++;
    }
    if (!best) continue;
    best.score += Math.min(2, extra) * 0.08;
    if (aboutYou && ["howAreYou", "pet"].includes(intent)) best.score += 0.2;
    hits.push(best);
  }
  hits.sort((a, b) => b.score - a.score);
  let top = hits[0];
  if (!top || top.score < 0.5) return { kind: "unknown" };

  // Two games by name is the games menu.
  const second = hits[1];
  if (second && isGame(top.intent) && isGame(second.intent) && second.score > top.score - 0.1) {
    top = { ...top, intent: "games" };
  }
  // A thanks or a hello alongside a real request: the request wins.
  if (top.intent === "greet" || top.intent === "thanks") {
    const real = hits.find(
      (h) => !["greet", "thanks", "cancel", "help", "howAreYou"].includes(h.intent) && h.sure && h.score >= 0.8,
    );
    if (real) top = real;
  }

  return top.sure ? { kind: "do", intent: top.intent } : { kind: "check", intent: top.intent };
}

// What Mote says.

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export type Mind = {
  /** Lasting moods right now (see mind.ts). */
  moods: readonly string[];
  friendly: boolean;
  hour: number;
};

/** Asking what you'd like to do: open enough for anything, but always about
 * doing something, so the answer is something to do. */
export function introLine(m: Mind): string {
  const has = (x: string) => m.moods.includes(x);
  const lists: string[][] = [
    [
      "What would you like to do?",
      "What should we do?",
      "What can I do for you?",
      "Hi! What are we doing?",
      "Ooh, hello. What would you like to do?",
      "Yes? What do you need?",
      "What’ll it be?",
      "Tell me what you’d like to do.",
      "Need something? Tell me what.",
    ],
  ];
  if (has("joyful")) {
    lists.push([
      "Hi hi! What are we doing?",
      "Ooh! What should we do? I’m up for anything.",
      "Yes! Hello! What would you like to do?",
    ]);
  }
  if ((has("annoyed") || has("frustrated")) && !m.friendly) {
    lists.push(["What. …What do you want to do?", "Hmph. What is it you need?", "Fine. What would you like?"]);
  }
  if (has("down") || has("depressed")) {
    lists.push(["Oh! You want to do something with me? What?", "Hi. …What should we do?", "Oh, hello. What do you need?"]);
  }
  if (m.hour >= 23 || m.hour < 5) lists.push(["Still up? What do you need?"]);
  if (m.hour >= 5 && m.hour < 11) lists.push(["Morning! What should we do?"]);
  // Moods get the say more often than the plain lines.
  return pick(lists.length > 1 && Math.random() < 0.7 ? lists[1 + Math.floor(Math.random() * (lists.length - 1))] : lists[0]);
}

/** The hint in the typing box: plain, with no particular thing to do in it
 * (what's on offer is for Mote to show when asked). */
export const PLACEHOLDERS = ["Type here…", "Tell me…", "Type it however you like…", "Say it your way…"];

export const RETRY = [
  "Hmm, I didn’t get that. Could you put it another way?",
  "Sorry, I don’t understand. Can you say it differently?",
  "I’m not sure what you mean. Try other words?",
  "Huh? Say that again a different way?",
  "My little brain didn’t catch that. Rephrase it for me?",
];

export const AFTER_NO = [
  "Oh! What did you mean, then?",
  "Okay, not that. What would you like?",
  "My mistake. Tell me again?",
  "Ah. What was it, then?",
];

const CHECK: Record<IntentId, string[]> = {
  games: ["You want to play a game?", "A game? Is that it?", "Play something?"],
  chess: ["Chess? Want to play?", "You mean chess?"],
  checkers: ["Checkers? Want to play?", "You mean checkers?"],
  tictactoe: ["Tic-tac-toe? Want to play?", "You mean tic-tac-toe?"],
  solitaire: ["Solitaire? I’ll help.", "You mean solitaire?"],
  files: ["Something about files?", "You want help with some files?"],
  links: ["One of your saved links?", "Something saved to watch or read?"],
  saveLink: ["You want to save a link?"],
  settings: ["You want Settings?", "Open Settings?"],
  help: ["You want to know what I can do?"],
  greet: ["Was that a hello?"],
  thanks: ["Was that a thank you?"],
  howAreYou: ["Are you asking how I am?"],
  pet: ["Do you want to pet me?"],
  cancel: ["Never mind, then?", "You don’t need anything?"],
};
export const checkLine = (intent: IntentId) => pick(CHECK[intent]);

export const LINES = {
  games: ["Ooh. Which one?", "Pick one!", "Which game?", "Yes! What are we playing?", "Game time. Which one?"],
  // Not having fun (a check-in): a game, then.
  funNo: [
    "Well, that won’t do. Let’s play something! Which one?",
    "Boo. Let’s fix that. Pick a game, I’ll even let you go first:",
    "Not even a little? Okay. A game. Which one?",
  ],
  help: [
    "Here’s what I can do. Pick one, or just tell me:",
    "Lots of things! Pick one, or say it your way:",
    "Try one of these, or tell me in your own words:",
  ],
  files: [
    "Drag a folder or some videos onto me, and I’ll show you what I can do with them.",
    "Just drop a folder or a few videos on me. I’ll take it from there.",
    "Give me something to work on: drag a folder or videos right onto me.",
  ],
  noLinks: [
    "Nothing saved yet! Drag a link from your browser onto me and I’ll keep it.",
    "I don’t have any links yet. Drop one on me from your browser.",
  ],
  saveLink: [
    "Drag a link from your browser right onto me. I’ll keep it safe.",
    "Just drop a link on me, from the address bar or a page.",
  ],
  settings: ["Opening Settings.", "Here you go: Settings.", "Settings, coming up."],
  greet: ["Hi! What would you like to do?", "Hello! What should we do?", "Hey you. What are we doing?"],
  thanks: ["Anytime!", "You’re welcome!", "Happy to help.", "Of course!"],
  pet: [
    "Stroke my face! Slowly, back and forth. I love that.",
    "Pets are done with your pointer: press and stroke across my face.",
    "Ooh, yes. Press and stroke across my face, nice and slow.",
  ],
  cancel: ["Okay! I’ll be here.", "No problem.", "Okay. Double-click me if you need me.", "Alright!"],
  off: {
    games: ["The games are put away right now.", "No games right now. They’re switched off."],
    files: ["I’m not helping with files right now. That’s switched off."],
    links: ["Saved links are switched off right now."],
  },
} as const;

/** How Mote's doing, in a line, then back to business. */
export function howAmI(m: Mind): string {
  const has = (x: string) => m.moods.includes(x);
  if (has("joyful")) return pick(["Wonderful, actually! What should we do?", "So good. What are we doing?"]);
  if ((has("frustrated") || has("annoyed")) && !m.friendly) return pick(["A bit cross. But go on, what do you need?"]);
  if (has("down") || has("depressed")) return pick(["A little lonely. Want to do something together?"]);
  return pick(["Pretty good! What would you like to do?", "I’m good! What should we do?"]);
}

export const say = pick;
