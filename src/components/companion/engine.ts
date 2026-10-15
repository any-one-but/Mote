import {
  feelings,
  lastingMoods,
  loadMind,
  MIND_START,
  MIND_STEADY,
  nudge,
  quadrant,
  saveMind,
  tickMind,
  type Effects,
  type LastingMood,
  type MindKey,
  type MindValues,
  type Quadrant,
} from "@/components/companion/mind";
import {
  chatLine,
  markMentioned,
  recordGame,
  startLine,
  streakLine,
  type GameName,
  type GameResult,
} from "@/components/companion/memories";
import { reactionById } from "@/components/companion/reactions";
import { forName } from "@/components/companion/converse";
import {
  addLink,
  isVideo,
  linkName,
  loadLinks,
  noteOpened,
  noteSuggested,
  pickLink,
  type SavedLink,
} from "@/components/companion/links";
import {
  APPLE_APPS,
  chooseCheckIn,
  chooseLine,
  lifetime,
  lineById,
  textFor,
  type Bubble,
  type Line,
  type Outcome,
  type SpeechContext,
  type SpeechEvent,
} from "@/components/companion/speech";
import { GEO } from "@/lib/companion/theme";
import {
  CHECKERS_CHANCE,
  CHECKERS_FACE,
  pickCheckersLine,
  type CheckersEvent,
} from "@/components/companion/checkers-lines";
import {
  CHESS_CHANCE,
  CHESS_FACE,
  pickChessLine,
  type ChessEvent,
} from "@/components/companion/chess-lines";
import {
  pickTicTacToeLine,
  TICTACTOE_CHANCE,
  TICTACTOE_FACE,
  type TicTacToeEvent,
} from "@/components/companion/tictactoe-lines";
import { pickUnoLine, UNO_CHANCE, UNO_FACE, type UnoEvent } from "@/components/companion/uno-lines";
import {
  CLICKER_CHANCE,
  CLICKER_FACE,
  pickClickerLine,
  type ClickerEvent,
} from "@/components/companion/clicker-lines";
import {
  SOLITAIRE_CHANCE,
  SOLITAIRE_FACE,
  pickSolitaireLine,
  type SolitaireEvent,
} from "@/components/companion/solitaire-lines";

export type BoardGameState = "you" | "mote" | "idle" | null;

/** What Mote would like, shown as a glow on the matching button. */
export type Want = "play";

export type Mood =
  | "settle"
  | "glance"
  | "think"
  | "frustrate"
  | "cute"
  | "delight"
  | "surprise"
  // Napping when left alone: nodding off, asleep, waking, and jolted awake.
  | "doze"
  | "sleep"
  | "wake"
  | "startle"
  | "yawn"
  | "dizzy"
  | "purr"
  // Idles that come from lasting moods.
  | "huff"
  | "sulk"
  | "hum"
  // Looking out at you while watching something.
  | "checkin"
  // Playing a game dropped on Mote.
  | "gaming"
  // Pleased, and worried.
  | "beam"
  | "worry"
  // Check-ins on how you're doing: concerned for you, or a soft, wordless look.
  | "care"
  | "soothe"
  // Checkers: watching your move, thinking over theirs, and how it goes.
  | "ck-watch"
  | "ck-think"
  | "ck-smug"
  | "ck-ouch"
  | "ck-crown"
  | "ck-win"
  | "ck-lose"
  // Chess: putting you in check, and being in check.
  | "ch-check"
  | "ch-checked"
  // A sorry-but-no shake of the head (something Mote won't take).
  | "decline"
  // The simple set (see SIMPLE): a few general moods, each standing in for
  // several of the classic ones above.
  | "happy"
  | "cheer"
  | "proud"
  | "content"
  | "gentle"
  | "grumpy"
  | "sad"
  | "worried"
  | "no"
  | "watch"
  | "concentrate"
  | "play";

/** The simple set's own moods. */
export type SimpleMood = "happy" | "cheer" | "proud" | "content" | "gentle" | "grumpy" | "sad" | "worried" | "no" | "watch" | "concentrate" | "play";

/**
 * Two sets of animations, switched in Debug's Moods tab. The classic set has
 * a mood for nearly every moment; the simple set has fewer, more general
 * ones, each standing in for several classic moods (all the grumpy ones are
 * just "grumpy", every pleased look after a good move is "proud"). Mote
 * behaves the same either way, and everything asks for classic moods: with
 * the simple set on, they're shown as the simple mood that stands in for
 * them (moods without one are the same in both).
 */
export type AnimationSet = "classic" | "simple";

export const SIMPLE: Partial<Record<Mood, SimpleMood | Mood>> = {
  startle: "surprise",
  delight: "happy",
  "ck-win": "cheer",
  "ck-smug": "proud",
  "ck-crown": "proud",
  "ch-check": "proud",
  beam: "content",
  hum: "content",
  soothe: "gentle",
  checkin: "gentle",
  frustrate: "grumpy",
  huff: "grumpy",
  sulk: "grumpy",
  "ck-lose": "sad",
  "ck-ouch": "sad",
  worry: "worried",
  care: "worried",
  "ch-checked": "worried",
  decline: "no",
  "ck-watch": "watch",
  "ck-think": "concentrate",
  gaming: "play",
};

/** Each simple mood's animation: the classic one that suits it best (made to
 * be general: nothing in them is about one particular moment). Gentle has
 * an animation of its own (see `poseFor`). */
const SIMPLE_POSE: Record<Exclude<SimpleMood, "gentle">, Mood> = {
  happy: "delight",
  cheer: "ck-win",
  proud: "ck-smug",
  content: "beam",
  grumpy: "frustrate",
  sad: "ck-ouch",
  worried: "worry",
  no: "decline",
  watch: "ck-watch",
  concentrate: "ck-think",
  play: "gaming",
};

/** A simple mood that borrows a classic one's animation. */
const borrows = (m: Mood): m is Exclude<SimpleMood, "gentle"> => m in SIMPLE_POSE;

/** The mood an animation set shows for a mood something asked for. */
export const shownAs = (set: AnimationSet, m: Mood): Mood => (set === "simple" ? (SIMPLE[m] ?? m) : m);

/**
 * Everything Mote can do with their face. The eyes are pills; expression comes
 * from two curved cuts per eye: the brow (from above) and the cheek (from below).
 */
export type Pose = {
  /** Body offset, lean and squash/stretch (viewBox units / degrees / scale). */
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  /** Where the mood wants Mote to look, and how much it overrides the pointer. */
  lookX: number;
  lookY: number;
  lookMix: number;
  /** Pill height / width multipliers. */
  open: number;
  wide: number;
  /** + shrinks the left eye and grows the right one (a one-eyed squint). */
  openBias: number;
  /** Brow cut: depth at the eye's centre (fraction of eye height from the top). */
  lid: number;
  /** + drops the inner end (cross), − drops the outer end (worried). */
  lidTilt: number;
  /** + rounds the cut downward in the middle (sleepy), − arches it (alert). */
  lidCurve: number;
  /** + deepens the left brow and lifts the right one. */
  lidBias: number;
  /** Cheek cut: height at the eye's centre (fraction of eye height from the bottom). */
  cheek: number;
  /** + raises the inner end. */
  cheekTilt: number;
  /** + pushes the middle up into a smile, − flattens it. */
  cheekCurve: number;
  /** + raises the left cheek and lowers the right one. */
  cheekBias: number;
  /** 0..1 happy wink per eye. */
  winkL: number;
  winkR: number;
};

type Keys = Array<[number, Partial<Pose>]>;

export type EngineHooks = {
  /** Screen-reader description of what Mote is doing, or null for nothing notable. */
  onMood: (label: string | null) => void;
  /** Plain-text happenings (mood changes, pokes, blinks) for the debug log. */
  onEvent?: (text: string) => void;
  /** A speech bubble appears (or goes away, with null). */
  onSpeech?: (bubble: Bubble | null) => void;
  /** You said yes to a saved link Mote suggested: open it. */
  onOpenLink?: (url: string) => void;
  /** Mote would like a game (you weren't having fun): offer the games. */
  onSuggestPlay?: () => void;
};

export type Energy = "calm" | "normal" | "lively";

/** Something said in a conversation (see `talk`). */
export type Talk = {
  kind: "talk" | "choose" | "ask" | "flavor";
  text: string;
  choices?: Array<{ id: string; label: string }>;
  placeholder?: string;
  /** No box to type in, just the choices. */
  noTyping?: boolean;
};

export type EngineOptions = {
  energy: Energy;
  /**
   * Sound from another window you can see (null when there's none), and
   * where that window is relative to Mote's.
   */
  media: Media | null;
  /** Where Mote's window sits on its screen, 0..1 from the left / top. */
  placement: { x: number; y: number } | null;
  /** Friendly mode: Mote never gets cross or hurt. */
  friendly: boolean;
  /** The mind (on unless switched off): how Mote feels, and everything that
   * moves it. Off, they stay even, and how they felt is kept aside. */
  mind: boolean;
  /** What Mote says on their own, by kind (each on unless switched off):
   * a word about something that just happened, small talk, asking for what
   * they need, bringing up games you've played, and lines during a game. */
  remarks: boolean;
  chat: boolean;
  needs: boolean;
  memories: boolean;
  gameTalk: boolean;
  /** Shaking the pointer or the window makes Mote dizzy (on unless switched off). */
  dizzy: boolean;
  /** Little idle moods between things (on unless switched off). Off, Mote
   * just rests. */
  antics: boolean;
  /** Eyebrows (an experimental feature). */
  brows: boolean;
  /** A little mouth (an experimental feature). */
  mouth: boolean;
  /** Saved links: Mote brings one up now and then (on unless switched off). */
  links: boolean;
  /** Check-ins: now and then Mote asks how you're doing (on unless switched off). */
  checkIns: boolean;
  /** The toy chest: games to play (on unless switched off). Off, Mote never
   * asks for or suggests one. */
  games: boolean;
  /** Just the eyes (an experimental feature): no body, so the whole window
   * is Mote, and anywhere in it counts as touching them. */
  eyesOnly: boolean;
  /** Dark mode: Mote's colours swap, the face dark and the eyes cream. */
  dark: boolean;
  /** A reflection dot in each eye, tinted by mood (an experimental feature). */
  glint: boolean;
  /** Lasting moods shape the resting eyes (on unless switched off). */
  moodShape: boolean;
  /** A special look (Settings' Mode): triangle eyes and a carved grin, or
   * coal eyes, a coal smile and a carrot nose. */
  look: Look;
  /** What Mote calls you (empty until you've told them). */
  name: string;
  /** Which set of animations plays (see AnimationSet). */
  animations: AnimationSet;
};

/** An app dropped on Mote: its name, its ID (com.apple.safari…), and
 * whether it's Apple's Chess, Minecraft, some other game, or not a game. */
export type AppOffer = {
  name: string;
  bundle: string | null;
  game: "chess" | "minecraft" | "game" | null;
};


export type Media = {
  /** Where its window is, from the centre of Mote's window, in screen points. */
  dx: number;
  dy: number;
  app: string | null;
};

/** A hand-set face for the debug window: springs and moods are bypassed. */
export type ManualFace = { pose: Pose; gazeX: number; gazeY: number; blink: number };

export type EngineSnapshot = {
  mood: Mood;
  moodMs: number;
  fps: number;
  gazeX: number;
  gazeY: number;
  attention: number;
  blink: number;
  idleMs: number;
  pose: Pose;
  petting: boolean;
  /** Sound coming from a window Mote can see, if any. */
  media: Media | null;
  /** Everything Mote is intrigued by right now. */
  intrigued: Array<"media" | "you">;
  /** Mote's mood (joy and peace, −10 to 10), needs (0–10), the corner of
   * the mood chart they're in, and the lasting moods it all adds up to. */
  mind: MindValues;
  quadrant: Quadrant;
  moods: LastingMood[];
  /** Asleep (or nodding off). */
  asleep: boolean;
  /** Something Mote would like right now, shown on their buttons. */
  wants: Want | null;
  /** Minutes since you last did anything with Mote. */
  sinceAttention: number;
  /** How often each reaction has fired, and when last (ms of Mote's clock ago). */
  reactions: Record<string, { count: number; ago: number }>;
  /** The speech bubble showing now, and the need Mote is about to ask about. */
  speech: Bubble | null;
  need: { line: string; in: number } | null;
  placement: { x: number; y: number } | null;
};

export type FaceEngine = {
  destroy: () => void;
  configure: (opts: Partial<EngineOptions>) => void;
  poke: () => void;
  force: (mood: Mood) => void;
  blink: (double?: boolean) => void;
  setTimeScale: (scale: number) => void;
  setFrozen: (frozen: boolean) => void;
  setAutoMoods: (on: boolean) => void;
  setLoop: (on: boolean) => void;
  setGuides: (on: boolean) => void;
  setManual: (face: ManualFace | null) => void;
  /** Is this screen point on Mote's body (not just the window around it)? */
  hitTest: (clientX: number, clientY: number) => boolean;
  /** A petting stroke at this screen point. */
  pet: (clientX: number, clientY: number) => void;
  /** The window moved by this much (CSS px), for inertia and dizziness. */
  windowMoved: (dx: number, dy: number) => void;
  /** Fire a reaction by id (see reactions.ts), applying its feelings. */
  react: (id: string) => void;
  /** Debug: set one part of the mind directly, or put it all back to the start. */
  setFeeling: (key: MindKey, value: number) => void;
  resetFeelings: () => void;
  /** A board game starts (Mote may remember the last one) and ends (Mote
   * remembers this one, and it moves their mood). `event` is the game's own
   * end line to use if there's nothing more personal to say. */
  gameStart: (game: GameName, opener?: string) => void;
  gameOver: (result: GameResult, event: string) => void;
  /** Answer the question in the speech bubble: green (true) or red (false). */
  answer: (yes: boolean) => void;
  /** Close a remark bubble early. */
  dismissSpeech: () => void;
  /** Talking with you (see converse.ts): a question with a box to type in,
   * a few choices, a yes-or-no check, or just a remark. It replaces whatever
   * was being said, and nothing counts as ignored. */
  talk: (t: Talk) => void;
  /** The conversation's over: the bubble goes. */
  endTalk: () => void;
  /** You're typing an answer: the bubble waits for you. */
  stillTalking: () => void;
  /** Asleep or nodding off: a click wakes Mote before anything else. */
  drowsy: () => boolean;
  /** Debug: say a particular line now (or anything fitting, with no id). */
  say: (lineId?: string) => void;
  /** Something is being dragged over Mote's window (or not, with false). */
  dragHover: (over: boolean) => void;
  /** An app dropped on Mote: a game gets played, anything else gets a reaction. */
  offerApp: (app: AppOffer) => void;
  /** A file or folder dropped on Mote: not their kind of thing, and they say
   * so, nicely. */
  notForMe: () => void;
  /** Something dropped on Mote that they don't take (its feature is off):
   * a polite little "no thanks". */
  declined: () => void;
  /** A link dropped on Mote, to save for suggesting some day. */
  saveLink: (url: string, title: string | null) => void;
  /** Debug: suggest a saved link right now (this one, or Mote's pick). */
  suggestLink: (url?: string) => void;
  /** A game of checkers or chess: whose turn it is ("idle" between games,
   * null when the board is put away). */
  setBoardGame: (state: BoardGameState) => void;
  /** Something happened in a game. Mote reacts, and maybe says something. */
  checkers: (event: CheckersEvent) => void;
  chess: (event: ChessEvent, words?: { piece?: string; yours?: string }) => void;
  tictactoe: (event: TicTacToeEvent) => void;
  /** Uno: its moments. `color` is a colour a wild of Mote's named. */
  uno: (event: UnoEvent, words?: { color?: string }) => void;
  /** Solitaire, with Mote helping: its moments. `move` is Mote's advice in
   * words, for them to say. */
  solitaire: (event: SolitaireEvent, move?: string) => void;
  /** Mote Clicker: its big moments (the component keeps them spaced out). */
  clicker: (event: ClickerEvent, words?: { thing?: string; amount?: string; os?: string }) => void;
  snapshot: () => EngineSnapshot;
};

export const MOOD_LIST: Mood[] = [
  "settle",
  "glance",
  "think",
  "frustrate",
  "cute",
  "delight",
  "surprise",
  "doze",
  "sleep",
  "wake",
  "startle",
  "yawn",
  "dizzy",
  "purr",
  "huff",
  "sulk",
  "hum",
  "checkin",
  "gaming",
  "beam",
  "worry",
  "care",
  "soothe",
  "ck-watch",
  "ck-think",
  "ck-smug",
  "ck-ouch",
  "ck-crown",
  "ck-win",
  "ck-lose",
  "ch-check",
  "ch-checked",
  "decline",
];

/** The simple set, in the same order (see SIMPLE). */
export const SIMPLE_LIST: Mood[] = [
  "settle",
  "glance",
  "think",
  "cute",
  "surprise",
  "happy",
  "cheer",
  "proud",
  "content",
  "gentle",
  "grumpy",
  "sad",
  "worried",
  "no",
  "watch",
  "concentrate",
  "play",
  "dizzy",
  "purr",
  "yawn",
  "doze",
  "sleep",
  "wake",
];

export const REST: Pose = {
  x: 0,
  y: 0,
  rot: 0,
  sx: 1,
  sy: 1,
  lookX: 0,
  lookY: 0,
  lookMix: 0,
  open: 1,
  wide: 1,
  openBias: 0,
  lid: 0,
  lidTilt: 0,
  lidCurve: 0,
  lidBias: 0,
  cheek: 0,
  cheekTilt: 0,
  cheekCurve: 0,
  cheekBias: 0,
  winkL: 0,
  winkR: 0,
};

export const POSE_KEYS = Object.keys(REST) as Array<keyof Pose>;

/** Spring stiffness (k) and damping ratio (z) per channel. Lower z = more bounce. */
const SPRING: Record<keyof Pose, [number, number]> = {
  x: [150, 0.62],
  y: [190, 0.56],
  rot: [120, 0.58],
  sx: [380, 0.5],
  sy: [380, 0.5],
  lookX: [300, 1],
  lookY: [300, 1],
  lookMix: [300, 1],
  open: [420, 0.5],
  wide: [420, 0.5],
  openBias: [300, 0.7],
  lid: [300, 0.72],
  lidTilt: [280, 0.72],
  lidCurve: [280, 0.72],
  lidBias: [260, 0.75],
  cheek: [300, 0.66],
  cheekTilt: [280, 0.72],
  cheekCurve: [300, 0.66],
  cheekBias: [260, 0.75],
  winkL: [520, 0.7],
  winkR: [520, 0.7],
};

/** Mood length (ms) and how fast springs move while it plays (1 = normal). */
type Timing = { dur: number; tempo: number };

const CLASSIC_MOODS: Record<Exclude<Mood, "settle" | "sleep" | SimpleMood>, Timing> = {
  doze: { dur: 4200, tempo: 0.18 },
  wake: { dur: 1100, tempo: 1 },
  yawn: { dur: 2600, tempo: 0.7 },
  startle: { dur: 1600, tempo: 1.2 },
  glance: { dur: 1700, tempo: 1 },
  think: { dur: 3400, tempo: 0.7 },
  frustrate: { dur: 2100, tempo: 1 },
  cute: { dur: 2500, tempo: 1 },
  delight: { dur: 1400, tempo: 1.15 },
  surprise: { dur: 1800, tempo: 1.1 },
  dizzy: { dur: 3000, tempo: 1 },
  huff: { dur: 1600, tempo: 1 },
  sulk: { dur: 3200, tempo: 0.8 },
  hum: { dur: 3000, tempo: 0.9 },
  checkin: { dur: 1500, tempo: 0.9 },
  gaming: { dur: 5600, tempo: 1.2 },
  beam: { dur: 8400, tempo: 1 },
  worry: { dur: 8400, tempo: 0.85 },
  care: { dur: 7000, tempo: 0.8 },
  soothe: { dur: 3800, tempo: 0.75 },
  "ck-smug": { dur: 2600, tempo: 1 },
  "ck-ouch": { dur: 2400, tempo: 1.05 },
  "ck-crown": { dur: 3000, tempo: 1 },
  "ck-win": { dur: 3600, tempo: 1.05 },
  "ck-lose": { dur: 3800, tempo: 0.85 },
  "ch-check": { dur: 2200, tempo: 1 },
  "ch-checked": { dur: 2400, tempo: 1.1 },
  decline: { dur: 2100, tempo: 1.05 },
  // Purring lasts as long as the petting does; see `PURR_AFTER`.
  purr: { dur: Number.POSITIVE_INFINITY, tempo: 0.8 },
  // Held for as long as it's your turn, or Mote's (see `setBoardGame`).
  "ck-watch": { dur: Number.POSITIVE_INFINITY, tempo: 1 },
  "ck-think": { dur: Number.POSITIVE_INFINITY, tempo: 0.85 },
};

/** How long each mood lasts, and how fast it moves (a simple mood, like the
 * classic one its animation is). */
const MOODS: Record<Exclude<Mood, "settle" | "sleep">, Timing> = {
  ...CLASSIC_MOODS,
  ...(Object.fromEntries(
    (Object.keys(SIMPLE_POSE) as Array<keyof typeof SIMPLE_POSE>).map((m) => [
      m,
      CLASSIC_MOODS[SIMPLE_POSE[m] as keyof typeof CLASSIC_MOODS],
    ]),
  ) as Record<Exclude<SimpleMood, "gentle">, Timing>),
  gentle: { dur: 3800, tempo: 0.8 },
};

/** How long a purr keeps going after the petting stops (ms). */
const PURR_AFTER = 1300;

/** Moods Mote is too caught up in to talk through. */
const BUSY: Mood[] = [
  "doze",
  "sleep",
  "wake",
  "startle",
  "dizzy",
  "purr",
  "delight",
  "beam",
  "worry",
  "care",
  "soothe",
  "gaming",
  "ck-think",
  "ck-smug",
  "ck-ouch",
  "ck-crown",
  "ck-win",
  "ck-lose",
  "ch-check",
  "ch-checked",
  "decline",
];

const GAME_MOODS: Mood[] = ["gaming"];

/** Whether this game goes Mote's way. */
const gameWon = (seed: number) => gamingWin(seed);

/** How long you have to be away before Mote is glad to see you back (ms). */
const AWAY = 10 * 60_000;

const BAG: Mood[] = [
  "glance",
  "glance",
  "glance",
  "think",
  "think",
  "cute",
  "cute",
  "surprise",
  // Grumpiness and dozing are never picked at random; they come from how
  // Mote actually feels (see the scheduling in `step`).
];

const LABELS: Partial<Record<Mood, string>> = {
  happy: "Mote is happy.",
  cheer: "Mote is cheering!",
  proud: "Mote looks proud.",
  content: "Mote looks content.",
  gentle: "Mote gives you a gentle look.",
  grumpy: "Mote is grumpy.",
  sad: "Mote is sad.",
  worried: "Mote is worried.",
  no: "Mote shakes their head.",
  watch: "Mote is watching.",
  concentrate: "Mote is concentrating.",
  play: "Mote is playing a game.",
  sleep: "Mote is sleeping. Click to wake.",
  yawn: "Mote yawns.",
  startle: "Mote jolts awake!",
  think: "Mote is thinking.",
  frustrate: "Mote is grumpy.",
  cute: "Mote is feeling cute.",
  surprise: "Mote is surprised.",
  dizzy: "Mote is dizzy.",
  huff: "Mote huffs.",
  sulk: "Mote is sulking.",
  hum: "Mote is humming happily.",
  checkin: "Mote checks in on you.",
  beam: "Mote is pleased.",
  worry: "Mote is worried.",
  care: "Mote looks at you with concern.",
  soothe: "Mote gives you a gentle look.",
  "ck-watch": "Mote is watching your move.",
  "ck-think": "Mote is thinking about their move.",
  "ck-smug": "Mote looks pleased with that move.",
  "ck-ouch": "Mote lost a piece.",
  "ck-crown": "Mote got a king!",
  "ck-win": "Mote won the game!",
  "ck-lose": "Mote lost the game.",
  "ch-check": "Mote puts your king in check.",
  "ch-checked": "Mote's king is in check!",
  decline: "Mote shakes their head: no thanks.",
  gaming: "Mote is gaming.",
  purr: "Mote is enjoying the pets.",
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function keyed(t: number, keys: Keys): Partial<Pose> {
  let cur: Partial<Pose> = {};
  for (const [at, p] of keys) {
    if (t < at) break;
    cur = p;
  }
  return cur;
}

/** Target pose for a mood `t` ms in, plus offsets that skip the springs (shakes). */
export type PoseExtras = {
  /** ms since the last petting stroke (negative while still petting). */
  sincePet?: number;
};

/**
 * Target pose for a mood `t` ms in, plus things that skip the springs: shakes,
 * the dizzy eye swirl (0..1) and the purr rumble (0..1).
 */
export function poseFor(
  mood: Mood,
  t: number,
  seed: number,
  extras: PoseExtras = {},
): { pose: Pose; shakeX: number; shakeRot: number; swirl: number; purr: number } {
  if (borrows(mood)) return poseFor(SIMPLE_POSE[mood], t, seed, extras);
  const dir = seed > 0.5 ? 1 : -1;
  let swirl = 0;
  let purr = 0;
  let wobble: Partial<Pose> = {};
  const variant = (seed * 7.31) % 1;
  let keys: Keys = [];
  let shakeX = 0;
  let shakeRot = 0;

  if (mood === "glance") {
    const look: Partial<Pose> =
      variant < 0.25
        ? { lookX: dir * 0.3, lookY: -0.85, lookMix: 1, open: 1.05, y: -2, sy: 1.02 }
        : variant > 0.85
          ? { lookX: dir * 0.4, lookY: 0.75, lookMix: 1, y: 1.5 }
          : { lookX: dir * 0.95, lookY: -0.05, lookMix: 1, rot: dir * 3.5, x: dir * 2 };
    keys = [
      [0, look],
      [1150, {}],
    ];
  } else if (mood === "think") {
    const base: Partial<Pose> = {
      lookY: -0.8,
      lookMix: 1,
      openBias: dir * 0.16,
      lid: 0.09,
      lidTilt: 0.26,
      lidBias: dir * 0.09,
      wide: 0.97,
      rot: dir * 7,
      y: -2,
    };
    keys = [
      [0, { ...base, lookX: dir * 0.25 }],
      [900, { ...base, lookX: dir * 0.58 }],
      [1900, { ...base, lookX: dir * 0.32, lookY: -0.62 }],
      [2750, { open: 1.07, wide: 1.02, y: -3, sy: 1.03, sx: 0.98 }],
      [3050, {}],
    ];
  } else if (mood === "frustrate") {
    const cross: Partial<Pose> = {
      lid: 0.26,
      lidTilt: 0.56,
      lidCurve: 0.08,
      open: 0.94,
      wide: 1.05,
      lookY: 0.12,
      lookMix: 0.9,
    };
    keys = [
      [0, { open: 1.06, sy: 1.04, sx: 0.97, y: -2 }],
      [140, { ...cross, sy: 0.95, sx: 1.04, y: 3 }],
      [460, { ...cross, sy: 0.98, sx: 1.02, y: 1 }],
      [1000, { ...cross, lid: 0.2, sy: 1.03, sx: 0.98, y: -1 }],
      [1250, { ...cross, y: 1 }],
      [1750, {}],
    ];
    if (t > 160 && t < 680) {
      const decay = 1 - (t - 160) / 520;
      const wobble = Math.sin(((t - 160) / 1000) * Math.PI * 2 * 9);
      shakeX = wobble * 2.2 * decay;
      shakeRot = wobble * 1.4 * decay;
    }
  } else if (mood === "cute") {
    const happy: Partial<Pose> = {
      cheek: 0.54,
      cheekCurve: 0.15,
      open: 1.1,
      wide: 1.05,
      lookY: -0.12,
      lookMix: 0.5,
    };
    // At the peak the cheeks push up into a squishy, bashful smile.
    const squish: Partial<Pose> = {
      ...happy,
      cheek: 0.66,
      cheekCurve: 0.2,
      open: 1.06,
      wide: 1.07,
    };
    keys = [
      [0, { sy: 0.94, sx: 1.05, y: 2.5, open: 0.92 }],
      [130, { ...happy, y: -9, sy: 1.05, sx: 0.96, rot: dir * 5 }],
      [400, { ...happy, y: 1.5, sy: 0.96, sx: 1.03, rot: dir * 6 }],
      [540, { ...squish, rot: dir * 7, sy: 0.98, sx: 1.02 }],
      [1450, { ...happy, rot: dir * 5 }],
      [2000, {}],
    ];
  } else if (mood === "delight") {
    const joy: Partial<Pose> = { cheek: 0.7, cheekCurve: 0.26, open: 1.04, wide: 1.06 };
    keys = [
      [0, { ...joy, sy: 0.91, sx: 1.07, y: 3 }],
      [100, { ...joy, y: -12, sy: 1.06, sx: 0.96 }],
      [360, { ...joy, y: 1.5, sy: 0.94, sx: 1.05 }],
      [500, joy],
      [1050, {}],
    ];
  } else if (mood === "surprise") {
    keys = [
      [0, { open: 0.85, sy: 0.95, sx: 1.04, y: 2 }],
      [90, { open: 1.24, wide: 0.9, y: -6, sy: 1.05, sx: 0.96, lookY: -0.15, lookMix: 0.6 }],
      [700, { open: 1.12, wide: 0.95, y: -2 }],
      [1300, {}],
    ];
  } else if (mood === "doze") {
    keys = [
      [0, { lid: 0.3, lidCurve: 0.05, lidTilt: -0.08, y: 2, lookY: 0.3, lookMix: 0.6 }],
      [
        1200,
        {
          lid: 0.5,
          lidCurve: 0.05,
          lidTilt: -0.1,
          y: 5,
          rot: 3,
          lookY: 0.45,
          lookMix: 0.8,
          sy: 0.99,
        },
      ],
      [2200, { lid: 0.26, lidCurve: 0.05, lidTilt: -0.06, y: 1, rot: 1, lookY: 0.2, lookMix: 0.6 }],
      [2900, { lid: 0.6, lidCurve: 0.06, lidTilt: -0.12, y: 7, rot: 5, lookY: 0.5, lookMix: 0.9 }],
    ];
  } else if (mood === "sleep") {
    keys = [[0, SLEEP]];
  } else if (mood === "wake") {
    keys = [
      [0, { ...SLEEP, lid: 0.5, cheek: 0.06, y: 5, rot: 3 }],
      [160, { open: 1.16, wide: 0.98, y: -7, sy: 1.05, sx: 0.96 }],
      [520, { open: 1.04 }],
      [800, {}],
    ];
  } else if (mood === "yawn") {
    // A long stretch with eyes squeezed shut (edges kept parallel), then droops.
    keys = [
      [0, { sy: 1.02, lid: 0.2, lidCurve: 0.05 }],
      [
        250,
        {
          sy: 1.08,
          sx: 0.95,
          y: -4,
          lid: 0.58,
          lidCurve: 0.2,
          cheek: 0.2,
          cheekCurve: -0.2,
        },
      ],
      [1500, { sy: 0.97, sx: 1.03, y: 2, lid: 0.4, lidCurve: 0.05 }],
      [2000, { lid: 0.36, lidCurve: 0.04 }],
      [2400, {}],
    ];
  } else if (mood === "startle") {
    // From fast asleep to wide awake in a blink: eyes huge, a jump, a shiver.
    keys = [
      [0, { ...SLEEP, open: 0.3 }],
      [
        70,
        {
          open: 1.4,
          wide: 0.85,
          y: -16,
          sy: 1.12,
          sx: 0.9,
          lookY: -0.1,
          lookMix: 1,
        },
      ],
      [450, { open: 1.25, wide: 0.9, y: -5, sy: 1.04, sx: 0.98 }],
      [900, { open: 1.12 }],
      [1300, {}],
    ];
    if (t > 70 && t < 520) {
      const decay = 1 - (t - 70) / 450;
      const shiver = Math.sin(((t - 70) / 1000) * Math.PI * 2 * 14);
      shakeX = shiver * 1.6 * decay;
      shakeRot = shiver * 1.2 * decay;
    }
  } else if (mood === "huff") {
    // A big, cross breath in… and out through the nose.
    const cross: Partial<Pose> = { lid: 0.26, lidTilt: 0.6, lidCurve: 0.06, open: 0.96 };
    keys = [
      [0, { ...cross, sy: 1.05, sx: 0.97, y: -2 }],
      [
        450,
        {
          ...cross,
          sy: 0.93,
          sx: 1.06,
          y: 2.5,
        },
      ],
      [900, { ...cross, lid: 0.24, lidTilt: 0.55, y: 1 }],
      [1300, {}],
    ];
    if (t > 450 && t < 700) {
      const decay = 1 - (t - 450) / 250;
      shakeX = Math.sin(((t - 450) / 1000) * Math.PI * 2 * 12) * 1.2 * decay;
    }
  } else if (mood === "sulk") {
    // Turns away, sneaks a glance back, then turns away again. Hmph.
    const cross: Partial<Pose> = { lid: 0.22, lidTilt: 0.45, lidCurve: 0.04 };
    keys = [
      [0, { ...cross, lookX: dir * 0.95, lookY: 0.15, lookMix: 1, rot: dir * 8, x: dir * 3 }],
      [1400, { ...cross, lookX: -dir * 0.3, lookY: 0.05, lookMix: 1, rot: dir * 6, x: dir * 2 }],
      [
        1800,
        {
          ...cross,
          lookX: dir * 0.95,
          lookY: 0.2,
          lookMix: 1,
          rot: dir * 9,
          x: dir * 3,
          sy: 0.97,
          sx: 1.02,
        },
      ],
      [2800, {}],
    ];
  } else if (mood === "hum") {
    // A contented little sway, as if humming a tune.
    const glad: Partial<Pose> = {
      cheek: 0.54,
      cheekCurve: 0.15,
      open: 1.06,
      wide: 1.04,
    };
    keys = [[0, glad]];
    for (let i = 0; i < 6; i++) {
      const s = i % 2 ? 1 : -1;
      keys.push([150 + i * 380, { ...glad, rot: s * 4, x: s * 1.5, y: -1.5, sy: 1.02 }]);
    }
    keys.push([2600, {}]);
  } else if (mood === "gaming") {
    // Gaming: locks in, mashes buttons with darting eyes, a clutch moment,
    // then a victory hop or a deflated head shake.
    const locked: Partial<Pose> = {
      lid: 0.26,
      lidCurve: -0.12,
      lidTilt: 0.1,
      cheek: 0.12,
      lookY: 0.5,
      lookMix: 1,
      y: 3,
      sy: 0.97,
      sx: 1.03,
    };
    keys = [
      [0, { open: 1.15, y: -3, lookY: 0.7, lookMix: 1 }],
      [400, locked],
    ];
    for (let i = 0; i < 11; i++) {
      keys.push([600 + i * 220, { ...locked, lookX: (i % 2 ? 1 : -1) * 0.32, x: i % 2 ? 1 : -1 }]);
    }
    keys.push([3000, { ...locked, rot: dir * 9, x: dir * 4, lid: 0.34, open: 0.92, sy: 0.95 }]);
    if (gamingWin(seed)) {
      keys.push(
        [
          3800,
          { y: -12, sy: 1.08, sx: 0.94, open: 1.15, cheek: 0.7, cheekCurve: 0.25, lookMix: 1 },
        ],
        [4150, { y: 1, sy: 0.95, sx: 1.04, cheek: 0.7, cheekCurve: 0.25 }],
        [4400, { cheek: 0.64, cheekCurve: 0.2, rot: -dir * 3 }],
        [5100, {}],
      );
    } else {
      const glum: Partial<Pose> = {
        sy: 0.9,
        sx: 1.08,
        y: 7,
        lid: 0.3,
        lidTilt: -0.45,
        lidCurve: 0.1,
        lookY: 0.6,
        lookMix: 1,
      };
      keys.push([3800, glum], [5100, {}]);
      if (t > 4150 && t < 4900) {
        const decay = 1 - (t - 4150) / 750;
        const shake = Math.sin(((t - 4150) / 1000) * Math.PI * 2 * 4);
        shakeRot = shake * 4 * decay;
        shakeX = shake * 2.5 * decay;
      }
    }
    // Button mashing.
    const mash = t > 600 && t < 3000 ? 0.9 : t >= 3000 && t < 3750 ? 1.6 : 0;
    if (mash) shakeX = Math.sin((t / 1000) * Math.PI * 2 * 13) * mash;
  } else if (mood === "checkin") {
    // Turns from what they're watching to look out at you for a moment.
    keys = [
      [0, { lookX: 0, lookY: -0.05, lookMix: 1, open: 1.05, wide: 1.02, rot: dir * 2.5, y: -1 }],
      [1150, {}],
    ];
  } else if (mood === "dizzy") {
    // Whoa — eyes swirl, Mote wobbles in little circles, then shakes it off.
    const woozy: Partial<Pose> = { open: 0.88, wide: 0.95, lookMix: 1 };
    keys = [
      [0, { open: 1.15, wide: 0.95, y: -3, sy: 1.04, sx: 0.97 }],
      [220, woozy],
      [2300, { open: 1.02 }],
      [2700, {}],
    ];
    const up = Math.min(1, Math.max(0, (t - 150) / 350));
    const down = Math.min(1, Math.max(0, (2300 - t) / 400));
    swirl = up * down;
    const w = t / 1000;
    wobble = {
      x: Math.sin(w * 9) * 4 * swirl,
      rot: Math.sin(w * 9 + 1) * 7 * swirl,
      y: Math.cos(w * 18) * 1.5 * swirl,
      openBias: Math.sin(w * 11) * 0.18 * swirl,
    };
    if (t > 2300 && t < 2750) {
      const decay = 1 - (t - 2300) / 450;
      const shake = Math.sin(((t - 2300) / 1000) * Math.PI * 2 * 10);
      shakeX = shake * 3 * decay;
      shakeRot = shake * 2 * decay;
    }
  } else if (mood === "beam") {
    // Pleased: a little hop, then a held, bashful smile.
    const glad: Partial<Pose> = {
      cheek: 0.64,
      cheekCurve: 0.2,
      open: 1.08,
      wide: 1.05,
      lookY: -0.08,
      lookMix: 0.4,
    };
    keys = [
      [0, { sy: 0.94, sx: 1.05, y: 2 }],
      [160, { ...glad, y: -8, sy: 1.04, sx: 0.97, rot: dir * 4 }],
      [420, glad],
    ];
    const w = t / 1000;
    wobble = { rot: Math.sin(w * 2.1) * 3, x: Math.sin(w * 2.1) * 1.2 };
  } else if (mood === "worry") {
    // Worried: worried brows, a small shrink, eyes that won't settle.
    const face: Partial<Pose> = {
      lid: 0.14,
      lidTilt: -0.5,
      lidCurve: 0.02,
      open: 1.08,
      wide: 0.98,
      lookY: -0.12,
      lookMix: 0.85,
      y: 2,
      sy: 0.98,
      cheek: 0.1,
    };
    keys = [
      [0, { open: 1.16, y: -3, sy: 1.03 }],
      [240, { ...face, rot: dir * 3 }],
      [800, face],
    ];
    const w = t / 1000;
    wobble = { lookX: Math.sin(w * 1.3) * 0.22, rot: Math.sin(w * 1.3) * 1.4 };
  } else if (mood === "care") {
    // Concerned for you: a small sigh, then worried brows and a tilted head,
    // eyes staying on you rather than wandering, a little softness under them.
    const face: Partial<Pose> = {
      lid: 0.17,
      lidTilt: -0.6,
      lidCurve: 0.03,
      open: 1.02,
      wide: 0.98,
      lookX: 0,
      lookY: -0.06,
      lookMix: 1,
      cheek: 0.2,
      cheekCurve: 0.05,
      rot: dir * 7,
      y: 1,
      sy: 0.99,
    };
    keys = [
      [0, { open: 1.08, y: -2, sy: 1.02 }],
      [320, { ...face, y: 3, sy: 0.96, sx: 1.03 }],
      [900, face],
    ];
    const w = t / 1000;
    wobble = { rot: Math.sin(w * 0.9) * 1.5, y: Math.sin(w * 0.9) * 0.6 };
  } else if (mood === "gentle") {
    // A warm, attentive look at you: like watching, but at you. Eyes open
    // and bright, a soft smile in the cheeks, a slow easy lean and a small
    // nod, then back to resting.
    const face: Partial<Pose> = {
      lookX: 0,
      lookY: -0.04,
      lookMix: 0.85,
      open: 1.04,
      cheek: 0.2,
      cheekCurve: 0.07,
      y: 0.5,
    };
    keys = [
      [0, { lookMix: 0.4 }],
      [500, face],
      [3100, face],
      [3800, {}],
    ];
    const w = t / 1000;
    const nod = Math.max(0, Math.sin(Math.min(1, Math.max(0, (t - 1400) / 1000)) * Math.PI));
    wobble = { rot: Math.sin(w * 0.9) * 2.2 * dir, x: Math.sin(w * 0.9) * 0.8 * dir, y: nod * 1.8 };
  } else if (mood === "soothe") {
    // No words, just a soft look: a slow blink, eyes smiling a little, a
    // gentle tilt and a slow nod.
    const face: Partial<Pose> = {
      lid: 0.2,
      lidTilt: -0.25,
      lidCurve: 0.05,
      open: 0.96,
      cheek: 0.4,
      cheekCurve: 0.16,
      lookX: 0,
      lookY: -0.04,
      lookMix: 0.9,
      rot: dir * 5,
    };
    keys = [
      [0, { lookMix: 0.9, lookY: -0.04 }],
      [700, face],
      [3000, face],
      [3800, {}],
    ];
    const nod = Math.max(0, Math.sin(Math.min(1, Math.max(0, (t - 1300) / 1200)) * Math.PI));
    wobble = { y: nod * 2.5 };
  } else if (mood === "ck-watch") {
    // Your turn: an attentive look down at the board (the eyes still follow
    // your pointer across it), with a slow, curious lean now and then.
    keys = [[0, { lookY: 0.55, lookMix: 0.35, open: 1.04, cheek: 0.14, cheekCurve: 0.05, y: 1 }]];
    const w = t / 1000;
    wobble = { rot: Math.sin(w * 0.7) * 2.2, x: Math.sin(w * 0.7) * 0.8 };
  } else if (mood === "ck-think") {
    // Mote's turn: eyes down on the board, scanning from piece to piece, brows
    // knitted, with a little "hmm" squint every few seconds.
    const focus: Partial<Pose> = {
      lookY: 0.7,
      lookMix: 1,
      lid: 0.16,
      lidTilt: 0.22,
      lidCurve: -0.04,
      wide: 0.97,
      y: 1,
    };
    keys = [[0, { ...focus, open: 1.06 }], [300, focus]];
    const w = t / 1000;
    const hmm = Math.max(0, Math.sin(w * 1.3 + seed * 6)) ** 6;
    wobble = {
      lookX: Math.sin(w * 1.9 + seed * 4) * 0.55,
      lookY: Math.sin(w * 1.1) * 0.12,
      rot: Math.sin(w * 0.9) * 3 * dir,
      openBias: hmm * 0.18 * dir,
      lidBias: hmm * 0.1 * dir,
    };
  } else if (mood === "ck-smug") {
    // A good move: a quick pleased bounce, then a sideways look at you with
    // one brow up and cheeks lifted.
    const smug: Partial<Pose> = {
      lid: 0.24,
      lidCurve: -0.06,
      lidBias: -dir * 0.08,
      cheek: 0.46,
      cheekCurve: 0.14,
      rot: -dir * 4,
      lookX: -dir * 0.35,
      lookY: 0.1,
      lookMix: 1,
    };
    keys = [
      [0, { y: 2, sy: 0.95, sx: 1.04, cheek: 0.3 }],
      [140, { y: -7, sy: 1.05, sx: 0.96, cheek: 0.5, cheekCurve: 0.16 }],
      [420, smug],
      [2200, {}],
    ];
    if (t > 600 && t < 2000) wobble = { y: -Math.abs(Math.sin(((t - 600) / 1000) * Math.PI * 2 * 1.2)) * 1.2 };
  } else if (mood === "ck-ouch") {
    // One of Mote's pieces is taken: a start, a wince down at the board, then
    // a pout.
    keys = [
      [0, { open: 1.3, wide: 0.9, y: -5, sy: 1.05, sx: 0.96 }],
      [260, { lid: 0.22, lidTilt: -0.5, open: 0.9, sy: 0.93, sx: 1.05, y: 3, lookY: 0.75, lookMix: 1 }],
      [1100, { lid: 0.2, lidTilt: -0.32, cheek: 0.16, cheekCurve: -0.08, rot: dir * 5, lookX: dir * 0.3, lookY: 0.3, lookMix: 1 }],
      [2000, {}],
    ];
    if (t > 260 && t < 700) shakeX = Math.sin(((t - 260) / 1000) * Math.PI * 2 * 9) * 1.6 * (1 - (t - 260) / 440);
  } else if (mood === "ck-crown") {
    // Crowned: stretches up tall and proud, then a regal little sway, chin up.
    const proud: Partial<Pose> = { cheek: 0.6, cheekCurve: 0.2, lid: 0.12, lidCurve: -0.08, lookY: -0.35, lookMix: 1 };
    keys = [
      [0, { sy: 0.9, sx: 1.08, y: 3 }],
      [180, { ...proud, y: -12, sy: 1.1, sx: 0.92 }],
      [520, { ...proud, y: -3, sy: 1.04, sx: 0.97 }],
      [2500, {}],
    ];
    if (t > 520 && t < 2400) {
      const sway = Math.sin(((t - 520) / 1000) * Math.PI * 2 * 0.9);
      wobble = { rot: sway * 5, x: sway * 1.5 };
    }
  } else if (mood === "ck-win") {
    // Won the game: two big hops, a happy spin of a sway, and a wink at you.
    const glad: Partial<Pose> = { cheek: 0.74, cheekCurve: 0.28, open: 1.04, wide: 1.06 };
    keys = [
      [0, { ...glad, sy: 0.9, sx: 1.08, y: 3 }],
      [120, { ...glad, y: -16, sy: 1.08, sx: 0.94 }],
      [400, { ...glad, y: 2, sy: 0.92, sx: 1.07 }],
      [540, { ...glad, y: -13, sy: 1.07, sx: 0.95 }],
      [820, { ...glad, y: 1.5, sy: 0.94, sx: 1.05 }],
      [1000, { ...glad, rot: dir * 6, x: dir * 2 }],
      [1400, { ...glad, rot: -dir * 6, x: -dir * 2 }],
      [1800, { ...glad, rot: dir * 4, x: dir }],
      [2200, { ...glad, cheek: 0.6, winkL: dir > 0 ? 1 : 0, winkR: dir > 0 ? 0 : 1, lookMix: 1 }],
      [3100, {}],
    ];
  } else if (mood === "ck-lose") {
    // Lost the game: a droop and a long look at the board, then a good-sport
    // smile back up at you.
    keys = [
      [0, { open: 1.1, y: -2 }],
      [300, { sy: 0.9, sx: 1.06, y: 6, lid: 0.3, lidTilt: -0.44, lidCurve: 0.1, open: 0.92, lookY: 0.8, lookMix: 1 }],
      [1900, { lid: 0.12, lidTilt: -0.2, cheek: 0.42, cheekCurve: 0.14, rot: dir * 6, lookY: 0, lookMix: 1, y: 0 }],
      [3300, {}],
    ];
    if (t > 300 && t < 1700) {
      const sigh = Math.sin(((t - 300) / 1000) * Math.PI * 2 * 0.6);
      wobble = { y: sigh * 1.2, sy: sigh * 0.01 };
    }
  } else if (mood === "ch-check") {
    // Check!: a sly look straight at you, eyes narrowed, a little lean and a
    // pointed nod.
    const sly: Partial<Pose> = {
      lid: 0.3,
      lidCurve: -0.1,
      lidTilt: 0.12,
      cheek: 0.34,
      cheekCurve: 0.12,
      lookX: 0,
      lookY: 0,
      lookMix: 1,
      rot: dir * 6,
      x: dir * 2,
    };
    keys = [
      [0, { open: 1.08, y: -2 }],
      [200, { ...sly, y: 3, sy: 0.96, sx: 1.03 }],
      [420, { ...sly, y: -1 }],
      [620, { ...sly, y: 2, sy: 0.98 }],
      [820, sly],
      [1800, {}],
    ];
  } else if (mood === "ch-checked") {
    // In check: eyes wide, brows up in alarm, darting around the board for a
    // way out, with a little shiver.
    keys = [
      [0, { open: 1.3, wide: 0.92, y: -5, sy: 1.05, sx: 0.96 }],
      [220, { open: 1.18, wide: 0.95, lidTilt: -0.45, lid: 0.06, lookY: 0.6, lookMix: 1, y: 0 }],
      [1900, {}],
    ];
    if (t > 220 && t < 1800) {
      const w = (t - 220) / 1000;
      wobble = { lookX: Math.sign(Math.sin(w * Math.PI * 2 * 1.6)) * 0.55 };
      shakeX = Math.sin(w * Math.PI * 2 * 11) * 0.7;
    }
  } else if (mood === "decline") {
    // No thanks: eyes open, a little wince, then a slow, sorry-but-no shake
    // of the head, looking right at you.
    const no: Partial<Pose> = {
      lid: 0.16,
      lidTilt: 0.18,
      lidCurve: 0.04,
      open: 0.96,
      cheek: 0.08,
      lookX: 0,
      lookY: 0,
      lookMix: 1,
    };
    keys = [
      [0, { open: 1.16, wide: 0.95, y: -2 }],
      [200, { ...no, sy: 0.96, sx: 1.03, y: 2 }],
      [400, no],
      [1700, {}],
    ];
    if (t > 400 && t < 1550) {
      const u = (t - 400) / 1150;
      const shake = Math.sin(u * Math.PI * 2 * 2.5) * (1 - u * 0.6);
      wobble = { rot: shake * 7, x: shake * 2.5 };
    }
  } else if (mood === "purr") {
    // Melts into the petting: blissful arcs, sinking and leaning in, a soft rumble.
    const bliss: Partial<Pose> = {
      cheek: 0.7,
      cheekCurve: 0.16,
      open: 0.98,
      wide: 1.06,
      sy: 0.97,
      sx: 1.03,
      y: 2.5,
    };
    const since = extras.sincePet ?? 0;
    if (since <= 0) {
      keys = [[0, bliss]];
      purr = 1;
    } else {
      keys = [
        [0, bliss],
        [600, { ...bliss, cheek: 0.6, cheekCurve: 0.18, sy: 0.99, sx: 1.01, y: 1 }],
        [1000, {}],
      ];
      purr = Math.max(0, 1 - since / 700);
      t = since;
    }
  }

  const pose: Pose = { ...REST, ...keyed(t, keys) };
  for (const k of Object.keys(wobble) as Array<keyof Pose>) pose[k] += wobble[k] ?? 0;
  return { pose, shakeX, shakeRot, swirl, purr };
}

/** Whether this game goes Mote's way. */
export const gamingWin = (seed: number) => (seed * 7.31) % 1 < 0.65;

const popIn = (t: number, dur: number) =>
  Math.min(1, t / 220) * Math.min(1, Math.max(0, (dur - t) / 260));

/** The game controller, `t` ms into a game: jiggling while buttons are mashed. */
export function padAt(t: number, seed: number) {
  const dir = seed > 0.5 ? 1 : -1;
  const mash = t > 600 && t < 3750 ? 1 : 0;
  const jig = Math.sin((t / 1000) * Math.PI * 2 * 13) * mash;
  const clutch = t >= 3000 && t < 3750 ? 1 : 0;
  const won = gamingWin(seed) && t > 3800 && t < 4200 ? Math.sin(((t - 3800) / 400) * Math.PI) : 0;
  return {
    x: GEO.cx + jig * 0.8,
    y: 234 + Math.abs(jig) * 1.2 - won * 14,
    rot: clutch * dir * 12 + jig * 2,
    s: popIn(t, MOODS.gaming.dur),
  };
}

/**
 * Closed, contented eyes: a soft ‿ of even thickness. The brow sags into the
 * eye and the cheek cut bows the same way underneath, so both edges run
 * parallel instead of a curved top over a flat bottom.
 */
const SLEEP: Partial<Pose> = {
  open: 0.72,
  wide: 1.1,
  lid: 0.64,
  lidCurve: 0.3,
  cheek: 0.1,
  cheekCurve: -0.3,
  y: 7,
  rot: 5,
  sy: 0.985,
  lookY: 0.2,
  lookMix: 1,
};

/** Blink curve: quick accelerating close, short hold, softer open with a tiny pop. */
const BLINK = {
  fast: { close: 72, hold: 40, open: 190 },
  slow: { close: 170, hold: 200, open: 420 },
};

/** How long a whole blink takes, closing to open again (ms). */
export const blinkLength = (slow: boolean) => {
  const b = BLINK[slow ? "slow" : "fast"];
  return b.close + b.hold + b.open;
};

function blinkCurve(t: number, slow: boolean) {
  const { close, hold, open } = BLINK[slow ? "slow" : "fast"];
  if (t < 0) return 0;
  if (t < close) {
    const u = t / close;
    return u * u;
  }
  if (t < close + hold) return 1;
  const u = (t - close - hold) / open;
  if (u >= 1) return 0;
  const c = 1.3;
  const back = 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
  return 1 - back;
}

const CHEEK_SPAN = 1.8;
const CHEEK_STEPS = 24;

export type EyeShape = {
  pill: { x: number; y: number; w: number; h: number; r: number };
  lid: string;
  cheek: string;
  /** Just the cut edges, for the debug guides. */
  lidEdge: string;
  cheekEdge: string;
  /** The eyebrow above the eye (drawn only with Eyebrows switched on). */
  brow: string;
};

/** Eyebrows: how far above the open eye they sit, how much of the eye's
 * width they span, how strongly they follow the brow cut (its depth, slant
 * and curve, in eye heights), their arch, and how far they shoot up as the
 * eyes open wide. */
const BROW = { gap: 12, span: 0.74, drop: 0.36, tilt: 0.5, curve: 0.3, arch: 2.6, raise: 24 };

const f = (n: number) => n.toFixed(2);

/** Builds one eye's pill and its two cuts. */
/**
 * The reflection dot in an eye: high on the eye and a little to the left (the
 * same side in both, as if from one light). It rides along with the eye, but
 * lags its gaze a touch, as a real reflection would, and shrinks and fades
 * away as the eye closes.
 */
export function glintAt(pill: EyeShape["pill"], gazeX: number, gazeY: number, look: Look = "neutral") {
  const jack = look === "jack";
  const open = clamp((pill.h - 12) / 22, 0, 1);
  return {
    // A triangle eye is narrow at the top: the reflection sits lower.
    cx: pill.x + pill.w * (jack ? 0.4 : 0.31) - gazeX * 3,
    cy: pill.y + (jack ? pill.h * 0.6 : Math.min(pill.h * 0.27, pill.w * 0.42)) - gazeY * 2,
    r: pill.w * 0.13 * (0.5 + 0.5 * open),
    o: open,
  };
}

/**
 * The reflection's colour: Mote's own (cream, or in dark mode the dark face
 * colour), with the faintest red as they get frustrated and blue as they get
 * low; both together read as a little purple.
 */
export function glintColor(feel: Pick<MindValues, "joy" | "peace">, dark: boolean, look: Look = "neutral") {
  const ramp = (n: number) => clamp(n, 0, 1);
  const red = ramp((-feel.joy - 1) / 6) * 0.15;
  const blue = ramp((-feel.peace - 1) / 6) * 0.15;
  const base =
    look === "snow" ? [251, 253, 255] : dark ? [35, 28, 24] : look === "jack" ? [245, 173, 110] : [255, 241, 228];
  const tint = (c: number[], to: number[], k: number) => c.map((v, i) => v + (to[i] - v) * k);
  const c = tint(tint(base, [232, 96, 90], red), [92, 124, 230], blue);
  return `rgb(${c.map(Math.round).join(" ")})`;
}

export function eyeShape(
  side: "l" | "r",
  pose: Pose,
  gazeX: number,
  gazeY: number,
  blink: number,
  /** Extra per-eye gaze nudge, used by the dizzy swirl. */
  offset: { x: number; y: number } = { x: 0, y: 0 },
): EyeShape {
  const inward = side === "l" ? 1 : -1;
  const sideSign = side === "l" ? -1 : 1;
  const wink = side === "l" ? pose.winkL : pose.winkR;

  // Turning toward one side foreshortens the eye on that side a touch.
  const edge = clamp(gazeX * sideSign, 0, 1);
  const away = clamp(-gazeX * sideSign, 0, 1);

  const bias = side === "l" ? 1 : -1;
  const open = pose.open * (1 - bias * pose.openBias);
  const baseH = GEO.eyeH * Math.max(0.05, open) * (1 - 0.14 * wink);
  const h = Math.max(6.5, baseH * (1 - 0.86 * blink));
  const w = GEO.eyeW * pose.wide * (1 + 0.08 * blink) * (1 - 0.1 * edge + 0.03 * away);
  const cx = (side === "l" ? GEO.eyeLX : GEO.eyeRX) + gazeX * (15 - 3 * edge) + offset.x * 15;
  // Eyes travel less when looking down, so they never crowd the bottom edge.
  const cy = GEO.eyeY + gazeY * (gazeY > 0 ? 8 : 12) + offset.y * 10 + (baseH - h) * 0.14;
  const top = cy - h / 2;
  const bottom = cy + h / 2;

  const lid = lerp(pose.lid, 0, wink) + bias * pose.lidBias;
  const lidTilt = pose.lidTilt;
  const lidCurve = pose.lidCurve;
  const cheek = lerp(pose.cheek, 0.78, wink) + bias * pose.cheekBias + 0.05 * clamp(-gazeY, 0, 1);
  const cheekTilt = lerp(pose.cheekTilt, 0, wink);
  const cheekCurve = lerp(pose.cheekCurve, 0.3, wink);

  // Cut edges are cubic curves sampled outer → inner at s = 0, ⅓, ⅔, 1.
  const half = w / 2 + 1;
  const xs = [0, 1, 2, 3].map((i) => cx + inward * (-half + (i / 3) * half * 2));
  const curveAt = (k: number, i: number) => (i === 0 || i === 3 ? -k : k / 3);
  const tiltAt = (k: number, i: number) => k * (i / 3 - 0.5);

  const lidY = xs.map((_, i) => top + h * (lid + curveAt(lidCurve, i) + tiltAt(lidTilt, i)));

  const far = 80;
  const lidPath = `M${f(xs[0])} ${f(top - far)}L${f(xs[0])} ${f(lidY[0])}C${f(xs[1])} ${f(lidY[1])} ${f(xs[2])} ${f(lidY[2])} ${f(xs[3])} ${f(lidY[3])}L${f(xs[3])} ${f(top - far)}Z`;

  // The cheek is a wide, shallow swell that reaches well past the eye, so it
  // meets the pill's sides at a soft angle instead of leaving sharp tips.
  // `cheekCurve` is how far the swell has dropped by the time it reaches the
  // eye's edge.
  const span = (w / 2) * CHEEK_SPAN;
  const reach = Math.PI / 2 / CHEEK_SPAN;
  const norm = 1 - Math.cos(reach);
  let cheekEdge = "";
  for (let i = 0; i <= CHEEK_STEPS; i++) {
    const u = -1 + (2 * i) / CHEEK_STEPS;
    const d = Math.abs(u) * CHEEK_SPAN;
    const drop = (1 - Math.cos(d * reach)) / norm;
    const s = (u * CHEEK_SPAN + 1) / 2;
    const y = bottom - h * (cheek - cheekCurve * drop + cheekTilt * (s - 0.5));
    const x = cx + inward * u * span;
    cheekEdge += `${i === 0 ? "M" : "L"}${f(x)} ${f(y)}`;
  }
  const cheekPath =
    cheekEdge +
    `L${f(cx + inward * span)} ${f(bottom + far)}L${f(cx - inward * span)} ${f(bottom + far)}Z`;

  // The eyebrow rides above the eye and follows the brow cut: it comes down
  // as the cut does (cross, sleepy), slants with it (inner ends down when
  // cross, up when worried), flattens as it curves, rises when the eye opens
  // wide, and slides with the gaze. It ignores blinks, so it stays put while
  // the eye closes under it. With nothing of its own to animate, it fits
  // every expression there is.
  const browH = GEO.eyeH;
  const restCy = cy - (baseH - h) * 0.14;
  const browBase =
    restCy -
    baseH / 2 -
    BROW.gap +
    browH * BROW.drop * clamp(lid, 0, 1) -
    BROW.raise * clamp(pose.open - 1, 0, 0.5);
  const browW = GEO.eyeW * pose.wide * BROW.span;
  const browY = (s: number) => browBase + browH * BROW.tilt * lidTilt * (s - 0.5);
  const bx0 = cx - inward * (browW / 2);
  const bx1 = cx + inward * (browW / 2);
  const by0 = browY(0);
  const by1 = browY(1);
  // Through a middle point arched up a little (less, the more the lid curves).
  const midY = (by0 + by1) / 2 - BROW.arch + browH * BROW.curve * lidCurve * 0.5;
  const brow = `M${f(bx0)} ${f(by0)}Q${f(cx)} ${f(2 * midY - (by0 + by1) / 2)} ${f(bx1)} ${f(by1)}`;

  return {
    pill: { x: cx - w / 2, y: top, w, h, r: Math.min(w, h) / 2 },
    lid: lidPath,
    cheek: cheekPath,
    lidEdge: `M${f(xs[0])} ${f(lidY[0])}C${f(xs[1])} ${f(lidY[1])} ${f(xs[2])} ${f(lidY[2])} ${f(xs[3])} ${f(lidY[3])}`,
    cheekEdge,
    brow,
  };
}

/** The mouth: how far below the eyes it sits, its width, how deep it smiles
 * or frowns, and how far it opens into an "o". */
const MOUTH = { y: 40, w: 20, curve: 12, open: 13, rest: 0.15 };

/**
 * The little mouth (an experimental feature). Like the eyebrows it has no
 * moves of its own: it reads the face every expression already makes. Cheeks
 * pushed up make it smile, a slanted brow (cross or worried) turns it into a
 * small frown, and eyes opened wide (surprise, a start) round it into an "o".
 * It slides a little with the gaze, and rests as a tiny contented curve.
 */
export function mouthShape(pose: Pose, gazeX: number, gazeY: number): string {
  const smile = clamp(
    MOUTH.rest + 1.5 * pose.cheek + 0.7 * pose.cheekCurve - 1.3 * Math.abs(pose.lidTilt),
    -1,
    1,
  );
  const o = clamp((pose.open - 1.08) / 0.2, 0, 1);
  const w = MOUTH.w * (1 + 0.15 * smile) * (1 - 0.35 * o);
  const x = GEO.cx + gazeX * 8;
  const y = GEO.eyeY + MOUTH.y + gazeY * 5 - smile * 1.5;
  // The top and bottom edges meet at the corners: together (a line) when
  // closed, apart (an "o") when open.
  const top = y + smile * MOUTH.curve - o * MOUTH.open * 0.5;
  const bottom = y + smile * MOUTH.curve + o * MOUTH.open;
  return `M${f(x - w / 2)} ${f(y)}Q${f(x)} ${f(top)} ${f(x + w / 2)} ${f(y)}Q${f(x)} ${f(bottom)} ${f(x - w / 2)} ${f(y)}Z`;
}

/** Mote's special looks (Settings' Mode): plain Mote, a jack-o'-lantern, a
 * ghost, or a snowman. */
export type Look = "neutral" | "jack" | "ghost" | "snow";

/** Jack-o'-lantern mode: how much wider the eyes are (triangles are wider
 * than tall), how much less the cheeks and a wink squeeze them, and the
 * carved mouth's place, size, opening and teeth. */
export const JACK = { wide: 1.45, cheek: 0.45, curve: 0.45, wink: 0.5 };
const JACK_MOUTH = { y: 42, w: 86, open: 26, tooth: 10, toothW: 15 };

/** The pose the triangle eyes are cut from: wider, and less squeezed by the
 * cheeks, with flatter cuts (a triangle is narrow at the top, so a full,
 * curved smile would leave only a hooked tip). */
export function jackLook(pose: Pose): Pose {
  return {
    ...pose,
    wide: pose.wide * JACK.wide,
    cheek: pose.cheek * JACK.cheek,
    cheekCurve: pose.cheekCurve * JACK.curve,
    winkL: pose.winkL * JACK.wink,
    winkR: pose.winkR * JACK.wink,
  };
}

/**
 * A jack-o'-lantern eye: a triangle, point up, filling the eye's box. The
 * sides bow out a touch and the soft filter rounds the corners, so it reads
 * carved but cartoony. The same brow and cheek cuts as ever shape it, so it
 * still scowls, smiles and blinks. As it gets short (a blink, a squint) the
 * point flattens out, so a closed eye is a carved slit as wide as the eye,
 * not a sliver that the soft edges wear away to a dot.
 */
export function jackEye(p: EyeShape["pill"]): string {
  const left = p.x;
  const right = p.x + p.w;
  const top = p.y;
  const bottom = p.y + p.h;
  const cx = p.x + p.w / 2;
  const mid = (top + bottom) / 2;
  const flat = clamp((26 - p.h) / 18, 0, 1);
  const half = (p.w / 2) * 0.82 * flat;
  const bow = p.w * 0.06 * (1 - flat);
  const lip = p.h * 0.06 * (1 - flat);
  return `M${f(left)} ${f(bottom)}Q${f((left + cx - half) / 2 - bow)} ${f(mid)} ${f(cx - half)} ${f(top)}L${f(cx + half)} ${f(top)}Q${f((cx + half + right) / 2 + bow)} ${f(mid)} ${f(right)} ${f(bottom)}Q${f(cx)} ${f(bottom + lip)} ${f(left)} ${f(bottom)}Z`;
}

/**
 * The jack-o'-lantern mouth: a wide carved grin with blocky teeth, two
 * hanging from the top and one standing up from the bottom. Like the little
 * mouth it reads the face: a grin when happy (corners up), a glum droop when
 * cross or worried, taller when the eyes open wide. `talk` (0..1) works the
 * jaw while Mote is talking.
 */
export function jackMouthShape(pose: Pose, gazeX: number, gazeY: number, talk = 0): string {
  const smile = clamp(
    MOUTH.rest + 1.5 * pose.cheek + 0.7 * pose.cheekCurve - 1.3 * Math.abs(pose.lidTilt),
    -1,
    1,
  );
  const o = clamp((pose.open - 1.08) / 0.2, 0, 1);
  const w = JACK_MOUTH.w * (1 + 0.1 * smile) * (1 - 0.2 * o);
  const x = GEO.cx + gazeX * 8;
  const y = GEO.eyeY + JACK_MOUTH.y + gazeY * 5;
  // The corners rise with a grin and drop when glum; the top edge dips in
  // the middle when grinning and arches when glum; the bottom hangs below it.
  const corner = y - smile * 8;
  const sag = smile * 6;
  const open = JACK_MOUTH.open + 10 * o + 6 * talk;
  // Full across the middle, closing to the corners.
  const bump = (t: number) => 1 - Math.abs(2 * t - 1) ** 2.6;
  const X = (t: number) => x - w / 2 + w * t;
  const top = (t: number) => corner + sag * bump(t);
  const bottom = (t: number) => corner + (sag + open) * bump(t);
  const tw = JACK_MOUTH.toothW / w;
  const th = JACK_MOUTH.tooth;
  const a = 0.24;
  const b = 0.76 - tw;
  const c = 0.5 - tw / 2;
  const pts: Array<[number, number]> = [
    // Along the top, left to right, with two teeth hanging down.
    ...[0, 0.09, 0.18].map((t): [number, number] => [X(t), top(t)]),
    [X(a), top(a)],
    [X(a), top(a) + th],
    [X(a + tw), top(a + tw) + th],
    [X(a + tw), top(a + tw)],
    [X(0.5), top(0.5)],
    [X(b), top(b)],
    [X(b), top(b) + th],
    [X(b + tw), top(b + tw) + th],
    [X(b + tw), top(b + tw)],
    ...[0.82, 0.91, 1].map((t): [number, number] => [X(t), top(t)]),
    // Back along the bottom, with one tooth standing up in the middle.
    ...[0.91, 0.8, 0.68].map((t): [number, number] => [X(t), bottom(t)]),
    [X(c + tw), bottom(c + tw)],
    [X(c + tw), bottom(c + tw) - th],
    [X(c), bottom(c) - th],
    [X(c), bottom(c)],
    ...[0.32, 0.2, 0.09].map((t): [number, number] => [X(t), bottom(t)]),
  ];
  return `M${pts.map(([px, py]) => `${f(px)} ${f(py)}`).join("L")}Z`;
}

/** Snowman mode: smaller eyes (lumps of coal), the coal smile's place and
 * size, and the carrot nose. */
export const SNOW = { wide: 0.82, open: 0.55 };
const SNOW_MOUTH = { y: 42, w: 66, dot: 5.6, curve: 15 };
/** Where each bit of coal goes in the "o" (degrees, five evenly round it). */
const RING = [180, 252, 108, 324, 36];

/** The pose the coal eyes are cut from: a small, roundish box. */
export function snowLook(pose: Pose): Pose {
  return { ...pose, wide: pose.wide * SNOW.wide, open: pose.open * SNOW.open };
}

/** How lumpy each lump of coal is, all the way round (the two eyes differ). */
const LUMPS: Record<"l" | "r", number[]> = {
  l: [1, 0.93, 1.04, 0.95, 1.02, 0.9, 1.05, 0.96],
  r: [0.95, 1.04, 0.92, 1.03, 0.97, 1.05, 0.91, 1.01],
};

/**
 * A lump of coal: a blob round (cx, cy), `rx` by `ry`, its edge pushed in and
 * out by `lumps` (one per point, evenly round), turned by `turn` (radians),
 * with smooth curves through it.
 */
function coalLump(cx: number, cy: number, rx: number, ry: number, lumps: number[], turn = 0): string {
  const n = lumps.length;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const pts = lumps.map((k, i) => {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    return [cx + x * cos - y * sin, cy + x * sin + y * cos];
  });
  // Smooth curves through the midpoints, with the points as handles.
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  let d = `M${f(start[0])} ${f(start[1])}`;
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f(m[0])} ${f(m[1])}`;
  }
  return `${d}Z`;
}

/**
 * A lump of coal for an eye: a slightly lumpy blob filling the eye's box, so
 * it squashes for a blink and the brow and cheek cuts still shape it.
 */
export function coalEye(p: EyeShape["pill"], side: "l" | "r"): string {
  return coalLump(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, p.h / 2, LUMPS[side]);
}

/** The mouth's five bits of coal: each its own size, squash, turn and lumps,
 * so no two are alike. */
const MOUTH_COAL: Array<{ size: number; squash: number; turn: number; lumps: number[] }> = [
  { size: 1.06, squash: 0.8, turn: 0.4, lumps: [1, 0.88, 1.08, 0.92, 1.04, 0.86, 1.08] },
  { size: 0.94, squash: 0.9, turn: -0.7, lumps: [0.9, 1.07, 0.9, 1.08, 0.95, 1.03] },
  { size: 1.1, squash: 0.78, turn: 1.3, lumps: [1.06, 0.9, 1.03, 0.87, 1.08, 0.92, 0.99, 0.9] },
  { size: 0.96, squash: 0.86, turn: 2.2, lumps: [0.9, 1.08, 0.95, 1.05, 0.88, 1.07, 1] },
  { size: 1.02, squash: 0.82, turn: -0.2, lumps: [1.06, 0.9, 1.09, 0.88, 0.97, 1.07] },
];

/**
 * The snowman's mouth: five little bits of coal in a smile. Like the little
 * mouth it reads the face: a wider, deeper smile when happy, a dip when glum,
 * and the bits gather into a small "o" when surprised.
 */
export function coalMouthShape(pose: Pose, gazeX: number, gazeY: number): string {
  const smile = clamp(
    MOUTH.rest + 0.3 + 1.5 * pose.cheek + 0.7 * pose.cheekCurve - 1.3 * Math.abs(pose.lidTilt),
    -1,
    1,
  );
  const o = clamp((pose.open - 1.08) / 0.2, 0, 1);
  const x = GEO.cx + gazeX * 8;
  const y = GEO.eyeY + SNOW_MOUTH.y + gazeY * 5;
  const w = SNOW_MOUTH.w * (1 + 0.12 * smile);
  const r = SNOW_MOUTH.dot;
  return [0, 1, 2, 3, 4]
    .map((i) => {
      const t = i / 4;
      // Along the smile...
      const ax = x - w / 2 + w * t;
      const ay = y - smile * SNOW_MOUTH.curve * (Math.abs(2 * t - 1) ** 2 - 0.5);
      // ...or round a little "o".
      // (Each bit goes to the place on the ring nearest its place in the
      // smile, left to right, so they never bunch up on the way.)
      const a = (RING[i] * Math.PI) / 180;
      const ox = x + Math.cos(a) * 15;
      const oy = y + 9 + Math.sin(a) * 15;
      const cx = lerp(ax, ox, o);
      const cy = lerp(ay, oy, o);
      const bit = MOUTH_COAL[i];
      return coalLump(cx, cy, r * bit.size, r * bit.size * bit.squash, bit.lumps, bit.turn);
    })
    .join("");
}

/**
 * The snowman's body: Mote's round face as a packed snowball, its edge
 * gently lumpy all the way round (smooth curves, nothing sharp). The lumps
 * are fixed, so the snowball keeps its own shape.
 */
export function snowBody(): string {
  const { cx, cy, faceRx: rx, faceRy: ry } = GEO;
  const n = 64;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k =
      1 +
      0.008 * Math.sin(4 * a + 0.7) +
      0.007 * Math.sin(7 * a + 2.1) +
      0.005 * Math.sin(11 * a + 4) +
      0.004 * Math.sin(17 * a + 1);
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  let d = `M${f(start[0])} ${f(start[1])}`;
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f(m[0])} ${f(m[1])}`;
  }
  return `${d}Z`;
}

/**
 * The carrot nose, in one flat colour, but worked out in 3D: a cone stuck
 * into the front of the head, pointing the way Mote looks. As the head turns
 * (with the gaze) the cone turns with it and is drawn as it would look from
 * the front: long and side-on when Mote looks away to the side, shorter as
 * they look round toward you, and seen end-on (just its round end, the tip
 * in the middle) when they look straight at you. It droops a touch, as
 * carrots do. Its root moves a little more than the eyes as the head turns,
 * since it's further forward on the head.
 */
export const NOSE = { len: 32, r: 7, tip: 2, yaw: 1.15, pitch: 0.85, droop: 0.2 };

export function noseShape(gazeX: number, gazeY: number): string {
  const yaw = clamp(gazeX, -1.1, 1.1) * NOSE.yaw;
  const pitch = clamp(gazeY, -1.1, 1.1) * NOSE.pitch + NOSE.droop;
  // Which way the carrot points (x right, y down, z out toward you).
  const dx = Math.sin(yaw) * Math.cos(pitch);
  const dy = Math.sin(pitch);
  const dz = Math.cos(yaw) * Math.cos(pitch);
  const bx = GEO.cx + gazeX * 17;
  const by = GEO.eyeY + 24 + gazeY * 9;
  const tx = bx + dx * NOSE.len;
  const ty = by + dy * NOSE.len;
  // The round end is a circle facing along the carrot, so from the front
  // it's an ellipse, squashed the more the carrot points sideways.
  const flat = Math.hypot(dx, dy);
  const ux = flat > 1e-4 ? dx / flat : 1;
  const uy = flat > 1e-4 ? dy / flat : 0;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const c = Math.cos(a) * NOSE.r;
    const sn = Math.sin(a) * NOSE.r * dz;
    pts.push([bx - uy * c + ux * sn, by + ux * c + uy * sn]);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    pts.push([tx + Math.cos(a) * NOSE.tip, ty + Math.sin(a) * NOSE.tip]);
  }
  // The cone is everything between the two: their outline wrapped round.
  const hull = wrap(pts);
  return `M${hull.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}Z`;
}

/** The outline wrapped round a set of points (their convex hull). */
function wrap(points: Array<[number, number]>): Array<[number, number]> {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Array<[number, number]> = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Array<[number, number]> = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * Ghost mode: Mote under a sheet. The eyes are holes cut in it, perfectly
 * round at rest (they still squint, widen and blink: the same cuts shape
 * them), and the body is the sheet: Mote's own round top, falling to a wavy
 * hem that billows a little on its own and trails behind when Mote moves.
 */
export const GHOST = {
  /** An eye hole's width at rest. */
  eye: 52,
  /** The hem: how many bumps, and how low they hang and where they turn up. */
  bumps: 4,
  bottom: 226,
  top: 203,
};

/** A round eye hole, filling the eye's place. */
export function ghostEye(p: EyeShape["pill"]): string {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const rx = (GHOST.eye / 2) * (p.w / GEO.eyeW);
  const ry = Math.max(3.5, (GHOST.eye / 2) * Math.min(1.3, p.h / GEO.eyeH));
  return `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`;
}

/** Where the hem's bumps and dips sit at rest, right to left (bump, dip,
 * bump… ending on a bump). */
export function ghostHem(): Array<{ x: number; y: number }> {
  const { cx, faceRx } = GEO;
  const right = cx + faceRx - 12;
  const left = cx - faceRx + 12;
  const n = GHOST.bumps * 2 - 1;
  return Array.from({ length: n }, (_, i) => ({
    x: right - ((right - left) * i) / (n - 1),
    y: i % 2 === 0 ? GHOST.bottom : GHOST.top,
  }));
}

/**
 * The sheet: the top of Mote's round face, sides that fall and flare a touch,
 * and the wavy hem, each of its points moved by `cloth` (how far the cloth
 * has swung there).
 */
export function ghostSheet(cloth: ReadonlyArray<{ x: number; y: number }> = []): string {
  const { cx, cy, faceRx: rx, faceRy: ry } = GEO;
  const hem = ghostHem().map((p, i) => ({ x: p.x + (cloth[i]?.x ?? 0), y: p.y + (cloth[i]?.y ?? 0) }));
  const first = hem[0];
  const last = hem[hem.length - 1];
  const right = cx + rx;
  const left = cx - rx;
  let d = `M${f(left)} ${f(cy)}A${rx} ${ry} 0 0 1 ${f(right)} ${f(cy)}`;
  // Down the right side, rounding into the first bump.
  d += `C${f(right + 2)} ${f(cy + 46)} ${f(right + 4 + (first.x - (right - 12)) * 0.6)} ${f(first.y - 4)} ${f(first.x)} ${f(first.y)}`;
  // The wave: smooth from each bump to the next dip and back.
  for (let i = 1; i < hem.length; i++) {
    const a = hem[i - 1];
    const b = hem[i];
    const mid = (a.x + b.x) / 2;
    d += `C${f(mid)} ${f(a.y)} ${f(mid)} ${f(b.y)} ${f(b.x)} ${f(b.y)}`;
  }
  // Up the left side.
  d += `C${f(left - 4 + (last.x - (left + 12)) * 0.6)} ${f(last.y - 4)} ${f(left - 2)} ${f(cy + 46)} ${f(left)} ${f(cy)}Z`;
  return d;
}

/** The pose each look's eyes are cut from. */
export function lookPose(look: Look, pose: Pose): Pose {
  return look === "jack" ? jackLook(pose) : look === "snow" ? snowLook(pose) : pose;
}

/** Each look's eye, in place of the pill (null: the pill itself). */
export function lookEye(look: Look, p: EyeShape["pill"], side: "l" | "r"): string | null {
  return look === "jack" ? jackEye(p) : look === "ghost" ? ghostEye(p) : look === "snow" ? coalEye(p, side) : null;
}

/**
 * Whether a look's mouth is part of the look itself: the jack-o'-lantern's
 * carved grin is, so its little game pieces always have it. (Mote's own mouth
 * otherwise follows its switch.) A new look adds itself here, to `Look`, and
 * to `lookEye`, `lookMouth` and `lookBody`, and Mote and every game piece
 * take it on.
 */
export const LOOK_HAS_MOUTH: Record<Look, boolean> = { neutral: false, jack: true, ghost: false, snow: true };

/** A look's own body shape, in place of the round face (null: the round face). */
export function lookBody(look: Look): string | null {
  return look === "ghost" ? ghostSheet() : look === "snow" ? snowBody() : null;
}

/** Each look's mouth. `talk` (0..1) works a jack-o'-lantern's jaw. (A ghost
 * has no mouth of its own: with the mouth switched on, it's the plain one.) */
export function lookMouth(look: Look, pose: Pose, gazeX: number, gazeY: number, talk = 0): string {
  return look === "jack"
    ? jackMouthShape(pose, gazeX, gazeY, talk)
    : look === "snow"
      ? coalMouthShape(pose, gazeX, gazeY)
      : mouthShape(pose, gazeX, gazeY);
}

/** The line id of everything said in a conversation. */
export const TALK = "talk";

function q<T extends Element>(svg: SVGSVGElement, name: string) {
  return svg.querySelector(`[data-part="${name}"]`) as T | null;
}

const ENERGY_GAP: Record<Energy, number> = { calm: 1.8, normal: 1, lively: 0.5 };

export function startFaceEngine(svg: SVGSVGElement, hooks: EngineHooks): FaceEngine {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = mq.matches;
  const onMq = () => {
    reduced = mq.matches;
  };
  mq.addEventListener("change", onMq);

  const parts = {
    body: q<SVGGElement>(svg, "body"),
    skin: q<SVGEllipseElement>(svg, "skin"),
    sheet: q<SVGPathElement>(svg, "sheet"),
    eyes: q<SVGGElement>(svg, "eyes"),
    shadow: q<SVGEllipseElement>(svg, "shadow"),
    pillL: q<SVGRectElement>(svg, "pill-l"),
    pillR: q<SVGRectElement>(svg, "pill-r"),
    ownL: q<SVGPathElement>(svg, "own-l"),
    ownR: q<SVGPathElement>(svg, "own-r"),
    snow: q<SVGGElement>(svg, "snow"),
    nose: q<SVGPathElement>(svg, "nose"),
    coal: q<SVGPathElement>(svg, "coal"),
    lidL: q<SVGPathElement>(svg, "lid-l"),
    lidR: q<SVGPathElement>(svg, "lid-r"),
    cheekL: q<SVGPathElement>(svg, "cheek-l"),
    cheekR: q<SVGPathElement>(svg, "cheek-r"),
    brows: q<SVGGElement>(svg, "brows"),
    browL: q<SVGPathElement>(svg, "brow-l"),
    browR: q<SVGPathElement>(svg, "brow-r"),
    mouth: q<SVGPathElement>(svg, "mouth"),
    glints: q<SVGGElement>(svg, "glints"),
    glintL: q<SVGCircleElement>(svg, "glint-l"),
    glintR: q<SVGCircleElement>(svg, "glint-r"),
    guides: q<SVGGElement>(svg, "guides"),
    gPillL: q<SVGRectElement>(svg, "guide-pill-l"),
    gPillR: q<SVGRectElement>(svg, "guide-pill-r"),
    gLidL: q<SVGPathElement>(svg, "guide-lid-l"),
    gLidR: q<SVGPathElement>(svg, "guide-lid-r"),
    gCheekL: q<SVGPathElement>(svg, "guide-cheek-l"),
    gCheekR: q<SVGPathElement>(svg, "guide-cheek-r"),
    pad: q<SVGGElement>(svg, "pad"),
  };

  const options: EngineOptions = {
    energy: "normal",
    media: null,
    placement: null,
    // Set from Settings (see Companion).
    friendly: false,
    mind: true,
    remarks: true,
    chat: true,
    needs: true,
    memories: true,
    gameTalk: true,
    dizzy: true,
    antics: true,
    brows: false,
    mouth: false,
    links: true,
    checkIns: true,
    games: true,
    eyesOnly: false,
    dark: false,
    glint: false,
    moodShape: true,
    look: "neutral",
    name: "",
    animations: "simple",
  };
  const debug = {
    timeScale: 1,
    frozen: false,
    autoMoods: true,
    loop: false,
    guides: false,
    manual: null as ManualFace | null,
  };

  // `clock` is Mote's own time, so the debug window can slow it down or stop it.
  let clock = 0;
  let realLast = performance.now();
  let fps = 60;
  const pointer = { x: 0, y: 0, at: 0, has: false };
  let mood: Mood = "settle";
  let moodStart = 0;
  let moodSeed = Math.random();
  let lastAct: Mood = "glance";
  let nextAct = 2200;
  let pokeQueued = false;
  const pokes: number[] = [];
  let blinks: number[] = [];
  let lastBlink = 0;
  let nextBlink = 1400;
  let wander = { x: 0, y: 0, next: 1600 };
  let gazeTarget = { x: 0, y: 0 };
  let announced: string | null = null;
  let lastAttention = 0;
  let lastBlinkAmt = 0;

  const view: Pose = { ...REST };
  const vel = Object.fromEntries(POSE_KEYS.map((k) => [k, 0])) as Record<keyof Pose, number>;
  const gaze = { x: 0, y: 0, vx: 0, vy: 0 };
  const lag = { x: 0, y: 0, vx: 0, vy: 0 };
  // Petting, and too much shaking (of the pointer or the window) making Mote dizzy.
  const petAt = { t: Number.NEGATIVE_INFINITY, x: 0, y: 0 };
  const shakes: Record<"pointer" | "window", Array<{ t: number; d: number }>> = {
    pointer: [],
    window: [],
  };
  let dizzyReadyAt = 0;
  const lastScreen = { x: window.screenX, y: window.screenY };
  let swirlNow = 0;
  let purrNow = 0;

  // Older versions kept a list of watched titles, and the diet tracker kept
  // its days; both are gone, so clear them.
  try {
    localStorage.removeItem("mote.memory");
    localStorage.removeItem("mote.calories");
  } catch {
    // Nothing to clear.
  }

  // The mind: mood and needs (carried over from last time, with the time
  // away accounted for), and a tally of reactions.
  const loaded = loadMind();
  let feel: MindValues = loaded.values;
  // Away for hours: glad to see you, and likely to say so.
  const backAfterAWhile = loaded.awayMinutes > 180;
  if (backAfterAWhile) feel = nudge(feel, { joy: 0.8 });
  let mindTick = 0;
  // The mind switched off: Mote is held even, and how they really felt is
  // kept here (and saved) until it's back on.
  let keptMind: MindValues | null = null;
  const fired: Record<string, { count: number; at: number }> = {};
  let moodsNow: LastingMood[] = lastingMoods(feel);
  let savedAt = 0;
  const tally = { pet: 0, company: 0, sound: 0 };
  let lastDragReact = Number.NEGATIVE_INFINITY;
  let watching = false;
  let wasClose = false;
  // Interest: Mote stays intrigued for a while after you last did something
  // with the window, and while sound keeps playing elsewhere (with a little
  // grace, since that report comes and goes).
  let youUntil = Number.NEGATIVE_INFINITY;
  let mediaSeenAt = Number.NEGATIVE_INFINITY;
  let lastMedia: Media | null = null;
  let interest: "media" | "you" | null = null;

  // Whether Mote's eyes are on what's playing.
  let eyesOnMedia = false;
  // The last time you did anything with Mote: the measure of being ignored.
  let attendedAt = 0;
  const engage = () => {
    youUntil = clock + 15_000;
    attendedAt = clock;
  };
  // Something being dragged over the window: Mote perks up, curious.
  let hovering = false;
  // Napping: the last time you did anything with Mote themself, how long
  // they wait before nodding off, and whether the yawn underway leads into
  // a doze.
  let touchedAt = 0;
  // Left alone, Mote naps after 4–7 quiet minutes, until poked.
  const newNapAfter = () => 4 * 60_000 + Math.random() * 3 * 60_000;
  let napAfter = newNapAfter();
  let dozeNext = false;
  let twitchStart = -1;
  let nextTwitch = 5000;
  /** You did something with Mote: no nodding off for a while. */
  const touch = () => {
    touchedAt = clock;
    if (mood === "settle" || mood === "yawn") napAfter = newNapAfter();
  };
  /** You did something; back after a long while away, Mote is glad. */
  const noticeYou = () => {
    if (clock - lastYou > AWAY && lastYou > 0 && mood !== "sleep") {
      react("welcome-back");
      mention("welcome-back", 0.85);
    }
    lastYou = clock;
  };

  // Speech: the bubble showing, what was said recently, something that just
  // happened Mote might mention, and the need Mote is working up to asking
  // about (they notice a need a little while before saying so).
  let bubble: Bubble | null = null;
  let bubbleSeq = 0;
  const lastSaid = new Map<string, number>();
  let pendingEvent: { event: SpeechEvent; at: number } | null = null;
  // Chatting: 3 to 6 minutes apart at Normal energy, more often when lively.
  // A joyful Mote chats a bit more; a low one, less.
  const chatGap = () => {
    const fl = feelings(feel);
    return (3 + Math.random() * 3) * 60_000 * ENERGY_GAP[options.energy] * (1 - 0.25 * fl.joyful + 0.6 * fl.depressed);
  };
  let nextChatAt = 90_000;
  // Check-ins on how you're doing: the first 25–40 minutes in, then an hour
  // or two apart.
  let nextCheckInAt = (25 + Math.random() * 15) * 60_000;
  const movedSince = { x: 0, y: 0 };
  let pettedSince = false;
  let wanting: { need: string; line: string; at: number } | null = null;
  // You, coming and going: the last time you did anything Mote could notice.
  let lastYou = Number.NEGATIVE_INFINITY;
  let playing: BoardGameState = null;
  let recentGameLines: string[] = [];
  // The app just dropped on Mote, and the game being played (and how it went).
  let offered: SpeechContext["offering"] = null;
  // Saved links: the one being talked about, and when Mote next considers
  // bringing one up (and last did).
  let talkingLink: SavedLink | null = null;
  let nextLinkCheck = 3 * 60_000;
  let lastLinkAt = Number.NEGATIVE_INFINITY;
  // A game dropped on Mote: its name, what sort (Apple's Chess and Minecraft
  // get lines of their own), and how it went.
  let game: { name: string; kind: "chess" | "minecraft" | "game"; won: boolean } | null = null;

  const log = (text: string) => hooks.onEvent?.(text);

  /** In Friendly mode, nothing makes Mote less happy. */
  /** Friendly mode softens anything that would hurt. */
  const kindly = (effects: Effects | undefined) =>
    effects && options.friendly && (effects.joy ?? 0) < 0 ? { ...effects, joy: (effects.joy ?? 0) / 2 } : effects;
  const moveMind = (effects: Effects | undefined) => {
    if (keptMind) return;
    const e = kindly(effects);
    if (e) feel = nudge(feel, e, options.friendly);
  };

  const react = (id: string) => {
    const r = reactionById.get(id);
    if (!r) return;
    const tick = (fired[id] ??= { count: 0, at: 0 });
    tick.count++;
    tick.at = clock;
    moveMind(r.effects);
    log(`reaction: ${r.name.toLowerCase()}`);
  };

  const announce = (label: string | null) => {
    if (label === announced) return;
    announced = label;
    hooks.onMood(label);
  };

  /** Blinks are slow and heavy dozing off or deeply content. */
  const slowBlinks = () => mood === "doze" || feelings(feel).satisfied > 0.6;
  /** A blink at `at`; a double blink is two whole blinks, the eyes fully open
   * for a beat between them. */
  const blinkAt = (at: number, double = false) => {
    blinks.push(at);
    lastBlink = at;
    if (double) {
      const second = at + blinkLength(slowBlinks()) + 70;
      blinks.push(second);
      lastBlink = second;
    }
  };

  /** The mood whose animation is playing: the one asked for, as the
   * animation set shows it (see SIMPLE). */
  const shown = () => shownAs(options.animations, mood);

  const start = (next: Mood, now: number) => {
    const prev = mood;
    mood = next;
    moodStart = now;
    moodSeed = Math.random();
    if (next !== "settle") lastAct = next;
    svg.dataset.mood = shownAs(options.animations, next);
    announce(LABELS[shownAs(options.animations, next)] ?? null);
    log(`mood → ${next}`);
    nextBlink = Math.max(nextBlink, now + 900);
    if (next === "glance" && Math.random() < 0.4) blinkAt(now + 20);
    if (next === "dizzy") blinkAt(now + 2680, true);
    if (next === "checkin") blinkAt(now + 40);
    if (next === "soothe") blinkAt(now + 900);
    if (prev === "dizzy") dizzyReadyAt = now + 4000;
    if (prev === "dizzy" && next !== "dizzy") mention("dizzy-over", 0.7);
    if (prev === "purr" && next !== "purr") mention("petted", 0.6);
    if (game && next === "gaming") game.won = gameWon(moodSeed);
    if (GAME_MOODS.includes(prev) && !GAME_MOODS.includes(next)) mention("played", 0.7);
  };

  /** Maybe bring up something that just happened, next time Mote can talk. */
  const mention = (event: SpeechEvent, chance: number) => {
    if (Math.random() < chance) pendingEvent = { event, at: clock };
  };
  // Back after hours away: a hello first thing.
  if (backAfterAWhile) mention("welcome-back", 0.9);

  const speechContext = (): SpeechContext => ({
    feel,
    moods: moodsNow,
    interest,
    event: pendingEvent?.event ?? null,
    hour: new Date().getHours(),
    look: options.look,
    placement: options.placement,
    media: interest === "media",
    games: options.games,
    name: options.name,
    offering: offered,
    game: game?.name ?? null,
    gameKind: game?.kind ?? null,
    gameWon: game?.won ?? false,
    link: talkingLink
      ? {
          name: linkName(talkingLink),
          video: isVideo(talkingLink.url),
          suggested: talkingLink.suggested,
          opened: talkingLink.opened,
          daysSince: talkingLink.lastSuggested
            ? (Date.now() - talkingLink.lastSuggested) / 86_400_000
            : null,
        }
      : null,
  });

  const showBubble = (b: Bubble | null) => {
    bubble = b;
    hooks.onSpeech?.(b);
  };

  const say = (line: Line, now: number) => {
    const c = speechContext();
    const text = textFor(line, c);
    lastSaid.set(line.id, now);
    pendingEvent = null;
    movedSince.x = 0;
    movedSince.y = 0;
    pettedSince = false;
    showBubble({
      id: ++bubbleSeq,
      lineId: line.id,
      kind: line.kind,
      text,
      direction: line.direction?.(c),
      born: now,
      ttl: lifetime(line.kind, text),
    });
    react("speak");
    log(`says “${text}”`);
  };

  /** A bubble is answered, acted on, ignored, or simply over. */
  const resolve = (outcome: Outcome, now: number) => {
    const b = bubble;
    if (!b) return;
    showBubble(null);
    const line = lineById.get(b.lineId);
    if (b.reply || !line) return;
    moveMind(line.effects?.[outcome]);
    if (line.checkIn) react(outcome === "yes" ? "check-in-fine" : outcome === "no" ? "check-in-not" : "check-in-quiet");
    else if (outcome !== "done") react(`answer-${outcome}`);
    const face = line.faces?.[outcome];
    if (face) start(face, now);
    if (line.then?.[outcome] === "suggest-play") hooks.onSuggestPlay?.();
    if (line.then?.[outcome] === "play-again" && game) {
      react("play");
      start("gaming", now);
    }
    if (line.then?.[outcome] === "open-link" && talkingLink) {
      react("link-opened");
      noteOpened(talkingLink.url);
      hooks.onOpenLink?.(talkingLink.url);
      start("delight", now);
    }
    const replies = (options.friendly && line.kindReplies?.[outcome]) || line.replies?.[outcome];
    if (replies?.length) {
      const named = forName(replies, options.name);
      const text = named[Math.floor(Math.random() * named.length)];
      showBubble({
        id: ++bubbleSeq,
        lineId: line.id,
        kind: "flavor",
        text,
        born: now,
        // A check-in's reply is worth taking in, so it stays up longer.
        ttl: line.checkIn ? lifetime("flavor", text) + 1500 : Math.min(5000, 1500 + text.length * 55),
        reply: true,
      });
      log(`says “${text}”`);
    }
  };

  /** How far the window has been carried toward where Mote asked to go. */
  const moveProgress = (b: Bubble) => {
    const along =
      b.direction === "left"
        ? -movedSince.x
        : b.direction === "right"
          ? movedSince.x
          : b.direction === "up"
            ? -movedSince.y
            : movedSince.y;
    const span =
      b.direction === "up" || b.direction === "down" ? screen.availHeight : screen.availWidth;
    return along / Math.max(160, span * 0.15);
  };

  /**
   * What Mote needs most right now, if anything: some time with you (a
   * game, or a pet). Needs make Mote speak up on their own.
   */
  const currentNeed = (): string | null => {
    if (playing || mood === "sleep" || mood === "doze") return null;
    if (feel.peace <= -4) return feel.joy >= -2 && options.games ? "play-with-me" : "pet-me";
    return null;
  };

  /** Has this line been quiet long enough to say again? */
  const rested = (id: string, now: number) => {
    const line = lineById.get(id);
    const last = lastSaid.get(id) ?? Number.NEGATIVE_INFINITY;
    return !!line && now - last > (line.cooldown ?? 10 * 60_000);
  };

  /**
   * Speech each frame: resolve the current bubble, mention something that
   * just happened, or ask for something Mote needs. Now and then, just to chat.
   */
  const speak = (now: number) => {
    if (pendingEvent && now - pendingEvent.at > 6000) pendingEvent = null;
    if (bubble) {
      const age = now - bubble.born;
      if (bubble.kind === "move" && moveProgress(bubble) >= 1) resolve("moved", now);
      else if (bubble.kind === "pet" && pettedSince) resolve("petted", now);
      else if (age > bubble.ttl) resolve(bubble.kind === "flavor" ? "done" : "ignored", now);
      return;
    }
    // Mid-game, Mote keeps their own chatter to themself.
    if (debug.manual || playing || BUSY.includes(mood)) return;
    // Remarks switched off: nothing gets mentioned (bar asking to play an
    // app's game again, which is the apps' own).
    if (pendingEvent && !options.remarks && pendingEvent.event !== "played") pendingEvent = null;
    if (pendingEvent) {
      const line = chooseLine(speechContext(), lastSaid, now, 2 * 60_000, options.friendly);
      pendingEvent = null;
      if (line) say(line, now);
      return;
    }

    // Every few minutes, if you're around, Mote says something just to chat:
    // now and then, a game that's still on their mind.
    if (now >= nextChatAt) {
      nextChatAt = now + chatGap();
      if (options.memories && clock - lastYou < 2 * 60_000 && Math.random() < 0.3) {
        const memo = chatLine({ friendly: options.friendly });
        if (memo) {
          markMentioned(memo.id);
          react("remember-game");
          showBubble({
            id: ++bubbleSeq,
            lineId: "memory-chat",
            kind: "flavor",
            text: memo.text,
            born: now,
            ttl: lifetime("flavor", memo.text),
          });
          log(`says “${memo.text}”`);
          return;
        }
      }
      // Now and then, instead, a check-in on how you're doing. Not while
      // Mote is cross (unless they're in Friendly mode).
      const cross = moodsNow.some((m) => m === "annoyed" || m === "frustrated");
      if (options.checkIns && now >= nextCheckInAt && clock - lastYou < 2 * 60_000 && (options.friendly || !cross)) {
        pendingEvent = { event: "chat", at: now };
        const line = chooseCheckIn(speechContext(), lastSaid, now);
        pendingEvent = null;
        if (line) {
          nextCheckInAt = now + (60 + Math.random() * 60) * 60_000;
          react("check-in");
          say(line, now);
          return;
        }
      }
      if (options.chat && clock - lastYou < 2 * 60_000) {
        pendingEvent = { event: "chat", at: now };
        const line = chooseLine(speechContext(), lastSaid, now, 10 * 60_000, options.friendly);
        pendingEvent = null;
        if (line) {
          say(line, now);
          return;
        }
      }
    }

    // A need is noticed a little while before Mote says anything about it.
    const need = currentNeed();
    if (need !== wanting?.need) {
      wanting = need
        ? {
            need,
            line: need,
            at: now + 8000 + Math.random() * 17_000,
          }
        : null;
    }
    if (options.needs && wanting && now >= wanting.at && rested(wanting.line, now)) {
      const line = lineById.get(wanting.line);
      if (line && !(options.friendly && line.unkind)) {
        react("needs");
        say(line, now);
        return;
      }
    }

    // Now and then, a saved link: only when nothing's playing and you're
    // around to say yes (you've done something in the last couple of
    // minutes), never more than once every 12 minutes, and on average about
    // every 20 minutes of that.
    if (options.links && now >= nextLinkCheck) {
      nextLinkCheck = now + 60_000;
      const around = clock - lastYou < 2 * 60_000;
      const quietScreen = interest !== "media" && options.media === null;
      if (around && quietScreen && !playing && now - lastLinkAt > 12 * 60_000 && Math.random() < 0.08) {
        suggestLink(now);
      }
    }
  };

  /**
   * Checkers and chess. While a game is on, Mote's face follows it: watching
   * your move, thinking over theirs. Their usual chatter waits until the
   * board is put away.
   */
  const setBoardGame = (state: BoardGameState) => {
    if (state) rouse();
    if (state === playing) return;
    const was = playing;
    playing = state;
    engage();
    pendingEvent = null;
    wanting = null;
    const held = (m: Mood) => m === "ck-watch" || m === "ck-think" || m === "settle";
    if (state && held(mood)) start(state === "mote" ? "ck-think" : "ck-watch", clock);
    else if (!state && was && (mood === "ck-watch" || mood === "ck-think")) start("settle", clock);
    log(state ? `board game: ${state}` : "put the board away");
  };

  /** Something happened in a game: a face, and maybe a line to go with it. */
  const gameMoment = (
    reaction: string,
    face: string | undefined,
    chance: number,
    line: () => { id: string; text: string },
    /** Said even with talking during games switched off (advice you asked
     * for, or a memory of an earlier game, which has its own switch). */
    always = false,
  ) => {
    rouse();
    engage();
    if (face && !debug.manual) start(face as Mood, clock);
    react(reaction);
    if (!options.gameTalk && !always) return;
    if (chance <= 0 || Math.random() > chance) return;
    // A line that calls you by name only when Mote knows it: without a name,
    // pick again (every moment has lines without one).
    let said = line();
    for (let tries = 0; !options.name && said.text.includes("{name}") && tries < 8; tries++) said = line();
    said = { ...said, text: forName([said.text], options.name)[0] };
    recentGameLines = [...recentGameLines, said.id].slice(-12);
    showBubble({
      id: ++bubbleSeq,
      lineId: `game:${said.id}`,
      kind: "flavor",
      text: said.text,
      born: clock,
      ttl: Math.min(4500, lifetime("flavor", said.text)),
    });
    log(`says “${said.text}”`);
  };

  const checkersEvent = (event: CheckersEvent) =>
    gameMoment(`checkers-${event}`, CHECKERS_FACE[event], CHECKERS_CHANCE[event], () =>
      pickCheckersLine(event, recentGameLines),
    );

  const chessEvent = (event: ChessEvent, words?: { piece?: string; yours?: string }) =>
    gameMoment(`chess-${event}`, CHESS_FACE[event], CHESS_CHANCE[event], () =>
      pickChessLine(event, recentGameLines, words),
    );

  const solitaireEvent = (event: SolitaireEvent, move?: string) => {
    if (event === "start" || event === "resume") react("game-start");
    gameMoment(
      `solitaire-${event}`,
      SOLITAIRE_FACE[event],
      SOLITAIRE_CHANCE[event],
      () => pickSolitaireLine(event, recentGameLines, { move }),
      event === "hint" || event === "hint-draw" || event === "hint-recycle" || event === "mote-nothing",
    );
  };

  // Mote's "Uno!" and catching you out are part of the game, so they're
  // said even with talking during games switched off.
  const unoEvent = (event: UnoEvent, words?: { color?: string }) =>
    gameMoment(
      `uno-${event}`,
      UNO_FACE[event],
      UNO_CHANCE[event],
      () => pickUnoLine(event, recentGameLines, words),
      event === "mote-uno" || event === "caught" || event === "mote-wild" || event === "mote-wild4",
    );

  // What was made while you were away is news, so it's said even with
  // talking during games switched off.
  const clickerEvent = (event: ClickerEvent, words?: { thing?: string; amount?: string; os?: string }) => {
    if (event === "start" || event === "resume" || event === "away") react("game-start");
    gameMoment(
      `clicker-${event}`,
      CLICKER_FACE[event],
      CLICKER_CHANCE[event],
      () => pickClickerLine(event, recentGameLines, words),
      event === "away",
    );
  };

  const ticTacToeEvent = (event: TicTacToeEvent) =>
    gameMoment(`tictactoe-${event}`, TICTACTOE_FACE[event], TICTACTOE_CHANCE[event], () =>
      pickTicTacToeLine(event, recentGameLines),
    );

  /** Brings up one of your saved links, asking if you'd like to go there. */
  const suggestLink = (now: number, url?: string) => {
    const link = url ? (loadLinks().find((l) => l.url === url) ?? null) : pickLink();
    if (!link) return;
    talkingLink = link;
    lastLinkAt = now;
    const line = lineById.get("suggest-link");
    if (!line) return;
    react("suggest-link");
    say(line, now);
    // Counted after the words are picked, so "never suggested" lines fit.
    noteSuggested(link.url);
  };

  /** What Mote would like right now, for a glow on the matching button. */
  const wants = (): Want | null => {
    if (mood === "sleep" || mood === "doze" || playing) return null;
    if (options.games && feel.peace <= -2) return "play";
    return null;
  };

  /** A board game starting: maybe a word about the last one. `opener` is the
   * game's own line to use instead of its usual one (Mote going first). */
  const gameStart = (game: GameName, opener?: string) => {
    rouse();
    engage();
    react("game-start");
    const memo = options.memories ? startLine(game, { friendly: options.friendly }) : null;
    if (!memo) {
      if (game === "checkers") checkersEvent("start");
      else if (game === "chess") chessEvent("start");
      else if (game === "uno") unoEvent((opener as UnoEvent | undefined) ?? "start");
      else ticTacToeEvent((opener as TicTacToeEvent | undefined) ?? "start");
      return;
    }
    markMentioned(memo.id);
    gameMoment(`${game}-start`, "delight", 1, () => ({ id: `memory-start-${Date.now()}`, text: memo.text }), true);
  };

  /** A board game over: remembered, felt, and maybe a word about a streak. */
  const gameOver = (result: GameResult, event: string) => {
    const { memory, effects } = recordGame(result);
    moveMind(effects);
    log(`remembered ${memory.game}: ${memory.winner} won (${memory.margin}${memory.comeback ? ", a comeback" : ""})`);
    const streakSaid = options.memories ? streakLine(result.game, { friendly: options.friendly }) : null;
    if (streakSaid) {
      const face = memory.winner === "mote" ? "ck-win" : memory.winner === "you" ? "ck-lose" : "cute";
      gameMoment(`${result.game}-${event}`, face, 1, () => ({ id: `streak-${Date.now()}`, text: streakSaid }), true);
    } else if (result.game === "checkers") checkersEvent(event as CheckersEvent);
    else if (result.game === "chess") chessEvent(event as ChessEvent);
    else if (result.game === "uno") unoEvent(event as UnoEvent);
    else ticTacToeEvent(event as TicTacToeEvent);
  };

  /** Say a particular line right away (a reply to something you just did). */
  const sayNow = (id: string) => {
    const line = lineById.get(id);
    if (!line) return;
    if (bubble) showBubble(null);
    say(line, clock);
  };

  /** An app dropped on Mote: play the game, or have a say about the app. */
  /** Woken by something being dropped on them. */
  const rouse = () => {
    touch();
    if (mood === "sleep" || mood === "doze" || mood === "yawn") {
      react("wake-rested");
      start("wake", clock);
    }
  };

  /** A link dropped on Mote: saved (or already saved), with a happy look. */
  const saveLink = (url: string, title: string | null) => {
    rouse();
    engage();
    const fresh = addLink(url, title);
    talkingLink = loadLinks().find((l) => l.url === url) ?? null;
    if (!talkingLink) {
      // (Already saved under a slightly different address.)
      talkingLink = {
        url,
        title,
        savedAt: Date.now(),
        suggested: 0,
        opened: 0,
        lastSuggested: null,
      };
    }
    react(fresh ? "link-saved" : "link-already");
    log(`${fresh ? "saved" : "already had"} the link ${url}`);
    if (mood !== "wake") start(fresh ? "delight" : "cute", clock);
    sayNow(fresh ? "link-saved" : "link-already");
  };

  const offerApp = (app: AppOffer) => {
    rouse();
    hovering = false;
    engage();
    offered = { name: app.name, bundle: app.bundle };
    log(`given the app “${app.name}”`);
    if (GAME_MOODS.includes(mood) || mood === "dizzy") {
      sayNow("busy");
      return;
    }
    if (app.game) {
      game = { name: app.name, kind: app.game, won: false };
      react("play");
      sayNow(app.game === "game" ? "game-start" : `${app.game}-start`);
      start("gaming", clock);
      return;
    }
    // One of the apps that came with the Mac: Mote has something to say.
    const known = APPLE_APPS[app.bundle ?? ""];
    if (known) {
      react("offer-apple-app");
      sayNow("apple-app");
      if (known.mood) start(known.mood, clock);
      return;
    }
    react("offer-app");
    sayNow("not-a-game");
  };


  /** Which little idle moods are on the cards depends on how Mote feels. */
  const pick = (): Mood => {
    const has = (m: LastingMood) => moodsNow.includes(m);
    let bag: Mood[] = [...BAG];
    const more = (m: Mood, n: number) => {
      for (let i = 0; i < n; i++) bag.push(m);
    };
    if (has("frustrated")) {
      bag = bag.filter((m) => m !== "cute" && m !== "surprise");
      more("huff", 3);
      more("sulk", 3);
      more("frustrate", 1);
    } else if (has("annoyed")) {
      bag.splice(bag.indexOf("cute"), 1);
      more("huff", 1);
    }
    if (has("joyful")) {
      more("hum", 2);
      more("cute", 2);
    }
    if (has("down") || has("depressed")) {
      // Quieter: fewer bright moments, more wistful looks your way.
      bag = bag.filter((m) => m !== "surprise" && m !== "cute");
      more("checkin", has("depressed") ? 3 : 2);
      if (has("depressed")) more("sulk", 1);
    }
    const opts = bag.filter((m) => m !== lastAct);
    react("idle-mood");
    return opts[Math.floor(Math.random() * opts.length)] ?? "glance";
  };

  /** How long until Mote does something on their own next. */
  const actGap = (watchingMedia: boolean, engaged: boolean) => {
    if (watchingMedia) {
      const fl = feelings(feel);
      return (15_000 + Math.random() * 20_000) * (1 - 0.3 * fl.joyful + 0.4 * fl.depressed);
    }
    // Busy with you, Mote does fewer random things.
    return restGap() * (engaged ? 2 : 1);
  };

  const restGap = () => {
    const fl = feelings(feel);
    // Livelier when joyful; slower when low.
    const pace = (1 - 0.3 * fl.joyful) * (1 + 0.6 * fl.depressed);
    // Most of the time Mote just rests; little moods are the exception.
    return (7000 + Math.random() * 9000) * ENERGY_GAP[options.energy] * pace;
  };

  /**
   * Adds up how far something has travelled in the last ~0.7s; going much too
   * far, too fast makes Mote dizzy.
   */
  const shaken = (kind: "pointer" | "window", d: number, limit: number) => {
    if (!options.dizzy) return;
    const list = shakes[kind];
    const t = performance.now();
    list.push({ t, d });
    while (list.length && t - list[0].t > 700) list.shift();
    const travelled = list.reduce((sum, s) => sum + s.d, 0);
    const calm = mood !== "dizzy" && mood !== "purr";
    if (travelled > limit && calm && clock > dizzyReadyAt && !debug.manual) {
      list.length = 0;
      engage();
      react(kind === "pointer" ? "shake-pointer" : "throw");
      start("dizzy", clock);
    }
  };

  // Only a poke wakes Mote up; moving the pointer around doesn't.
  const onMove = (e: PointerEvent) => {
    const dist = pointer.has ? Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) : 0;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.at = clock;
    pointer.has = true;
    touch();
    noticeYou();
    // Fast strokes while the button is held are petting, not shaking.
    if (dist > 0 && e.buttons === 0) {
      const size = svg.getBoundingClientRect().width || 300;
      shaken("pointer", dist, size * 4.5);
    }
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  // Wiggling just before a press doesn't add up with the stroke after it.
  const onPress = () => {
    shakes.pointer.length = 0;
  };
  window.addEventListener("pointerdown", onPress, { passive: true });
  const keepFeelings = () => saveMind(keptMind ?? feel);
  window.addEventListener("pagehide", keepFeelings);

  let raf = 0;
  let running = true;
  let hidden = document.hidden;

  const onVis = () => {
    hidden = document.hidden;
    if (!hidden) {
      realLast = performance.now();
      pointer.at = clock;
      if (!raf) raf = requestAnimationFrame(loop);
    }
  };
  document.addEventListener("visibilitychange", onVis);

  const spring = (x: number, v: number, target: number, k: number, z: number, dt: number) => {
    const a = -k * (x - target) - 2 * z * Math.sqrt(k) * v;
    const nv = v + a * dt;
    return [x + nv * dt, nv] as const;
  };

  const setGlint = (el: SVGCircleElement | null, g: ReturnType<typeof glintAt>, fill: string) => {
    if (!el) return;
    el.setAttribute("cx", f(g.cx));
    el.setAttribute("cy", f(g.cy));
    el.setAttribute("r", f(g.r));
    el.setAttribute("fill", fill);
    el.style.opacity = g.o.toFixed(3);
  };

  const setPill = (el: SVGRectElement | null, p: EyeShape["pill"]) => {
    if (!el) return;
    el.setAttribute("x", f(p.x));
    el.setAttribute("y", f(p.y));
    el.setAttribute("width", f(p.w));
    el.setAttribute("height", f(p.h));
    el.setAttribute("rx", f(p.r));
  };

  // Pokes: a happy hop, unless Mote is cross or you keep pestering.
  const handlePoke = (now: number) => {
    engage();
    noticeYou();
    touch();
    pokes.push(now);
    while (pokes.length && now - pokes[0] > 2200) pokes.shift();
    if (mood === "sleep" || mood === "doze" || (mood === "yawn" && dozeNext)) {
      // Woken up from a nap: bright and breezy.
      dozeNext = false;
      react("wake-rested");
      if (mood === "sleep") mention("woke-rested", 0.8);
      start("wake", now);
    } else if (pokes.length >= 4 && mood !== "frustrate") {
      pokes.length = 0;
      // Too many pokes: a moment of annoyance (it passes straight away).
      react("poke-spam");
      start("frustrate", now);
    } else if (moodsNow.includes("frustrated")) {
      react("poke-grumpy");
      if (mood !== "frustrate") start("frustrate", now);
    } else if (mood !== "frustrate") {
      react("poke");
      start("delight", now);
    }
  };

  /**
   * The slow side of the mind: as time passes, mood and needs move (see
   * tickMind), a tired Mote gets closer to napping, and lasting moods are
   * re-read.
   */
  const think = (dt: number, now: number, attention: number, sincePet: number) => {
    const ms = dt * 1000;
    // Looking at Mote (the pointer on their window) counts as spending time with them.
    if (attention > 0.5) attendedAt = clock;
    mindTick += ms;
    // The mind switched off: nothing moves.
    if (keptMind) mindTick = 0;
    if (mindTick >= 5000) {
      const asleep = mood === "sleep" || mood === "doze";
      feel = tickMind(feel, mindTick / 60_000, {
        asleep,
        sinceAttention: (clock - attendedAt) / 60_000,
        youAround: clock - lastYou < 2 * 60_000,
        busyTogether: playing !== null && playing !== "idle",
        friendly: options.friendly,
      });
      mindTick = 0;
    }

    if (sincePet < 350) {
      tally.pet += ms;
      if (tally.pet >= 1000) {
        tally.pet -= 1000;
        react("pet");
      }
    } else tally.pet = 0;

    if (attention > 0.5) {
      tally.company += ms;
      if (tally.company >= 60_000) {
        tally.company = 0;
        react("company");
      }
    }
    if (attention > 0.5) engage();
    if (attention > 0.5 && !watching) {
      watching = true;
      react("follow");
    } else if (attention < 0.05 && watching) {
      watching = false;
      react("left-alone");
    }

    if (interest === "media") {
      tally.sound += ms;
      if (tally.sound >= 30_000) {
        tally.sound = 0;
        react("sound-ongoing");
      }
    } else tally.sound = 0;

    const next = lastingMoods(feel);
    for (const m of next) if (!moodsNow.includes(m)) react(`mood-${m}`);
    for (const m of moodsNow) if (!next.includes(m)) log(`no longer ${m}`);
    moodsNow = next;

    if (now - savedAt > 5000) {
      savedAt = now;
      saveMind(keptMind ?? feel);
    }
  };

  const step = (dt: number, now: number) => {
    if (pokeQueued) {
      pokeQueued = false;
      handlePoke(now);
    }

    // What has Mote's interest: what's playing elsewhere, or you.
    const idleFor = pointer.has ? now - pointer.at : 0;
    const sincePet = now - petAt.t;
    if (options.media !== null) {
      mediaSeenAt = now;
      lastMedia = options.media;
    }
    // (A few seconds' grace, since a report can drop out for a moment.)
    const media = now - mediaSeenAt < 6000;
    const you = now < youUntil;
    const was = interest;
    interest = media ? "media" : you ? "you" : null;
    if (interest && interest !== was)
      react(interest === "media" ? "intrigued-media" : "intrigued-you");
    if (interest === "media" && was !== "media") {
      // Sound out of nowhere jolts a napping Mote awake.
      if (mood === "sleep" || mood === "doze") {
        react("startled-awake");
        start("startle", now);
        mention("startled", 0.8);
      } else mention("media-start", 0.5);
    }
    const watchingMedia = media && !you;

    // Something starting to play: the eyes go there now, not on the next wander.
    if (media !== eyesOnMedia) wander.next = now;
    eyesOnMedia = media;

    // Left be for a while, with nothing going on that's intriguing, Mote
    // yawns and nods off. Only a poke (or something starting to play, or
    // something dropped on them) wakes them.
    const quiet = !interest && !playing && !bubble;
    if (debug.autoMoods && mood === "settle" && quiet && now - touchedAt > napAfter) {
      react("doze");
      dozeNext = true;
      start("yawn", now);
    }
    const over =
      mood === "settle" || mood === "sleep"
        ? false
        : mood === "purr"
          ? sincePet > PURR_AFTER
          : now >= moodStart + MOODS[shown() as keyof typeof MOODS].dur;
    if (over) {
      // Nodding off: a doze becomes real sleep, unless something happened in
      // the meantime and they catch themself.
      const stillQuiet = quiet && now - touchedAt > napAfter;
      // A tiny chance a check-in turns into something sweet, more when joyful.
      const sweet = 0.03 + 0.12 * feelings(feel).joyful;
      if (debug.loop && mood !== "purr") start(mood, now);
      else if (mood === "yawn" && dozeNext && stillQuiet) start("doze", now);
      else if (mood === "doze" && stillQuiet) {
        react("fall-asleep");
        start("sleep", now);
      } else if (mood === "checkin" && Math.random() < sweet) {
        react("check-in-happy");
        start(Math.random() < 0.5 ? "cute" : "delight", now);
      } else if (mood === "doze" || mood === "yawn") {
        // Caught themself nodding off.
        start("settle", now);
        nextAct = now + actGap(watchingMedia, you);
      } else if (playing) {
        // Back to the game.
        start(playing === "mote" ? "ck-think" : "ck-watch", now);
      } else {
        start("settle", now);
        nextAct = now + actGap(watchingMedia, you);
      }
      if (mood !== "yawn" && mood !== "doze") dozeNext = false;
    }
    if (debug.autoMoods && mood === "settle" && now >= nextAct) {
      // Little moods switched off: Mote just rests.
      if (!options.antics) nextAct = now + actGap(watchingMedia, you);
      else if (watchingMedia) {
        // Watching something: all Mote does is check in on you now and then,
        // or look away for a little break.
        if (Math.random() < 0.3) {
          react("look-away");
          start("glance", now);
        } else {
          react("check-in");
          start("checkin", now);
        }
        nextAct = now + actGap(true, false);
      } else start(pick(), now);
    }
    if (!debug.autoMoods && mood === "settle") nextAct = Math.max(nextAct, now + 1000);
    speak(now);

    const t = now - moodStart;
    const {
      pose: target,
      shakeX,
      shakeRot,
      swirl,
      purr,
    } = poseFor(shown(), t, moodSeed, {
      sincePet: sincePet < 350 ? -1 : sincePet - 350,
    });
    swirlNow = swirl;
    // Petting a sleeping Mote gets a sleepy little purr without waking them.
    purrNow = mood === "sleep" && sincePet < 350 ? 0.6 : purr;

    // Lasting moods colour the idle face: a scowl when frustrated, a little
    // smile when joyful, a droop when low. Moods with their own expression mostly override it.
    const fl = feelings(feel);
    const tone =
      mood === "settle" || mood === "ck-watch" ? 1 : mood === "glance" ? 0.7 : mood === "think" || mood === "checkin" ? 0.5 : 0;
    // (Unless that's switched off: then the eyes rest in their usual shape.)
    if (tone > 0 && options.moodShape) {
      const scowl = fl.frustrated > 0.2 ? 0.2 + 0.06 * fl.frustrated : 0;
      target.lid += (scowl + 0.08 * fl.depressed) * tone;
      target.lidTilt += ((scowl ? 0.5 * fl.frustrated : 0) - 0.22 * fl.depressed) * tone;
      target.open += (0.05 * fl.joyful - 0.06 * fl.depressed) * tone;
      target.cheek = Math.max(target.cheek, (0.24 * fl.joyful + 0.1 * fl.satisfied) * tone);
      target.cheekCurve += 0.08 * fl.joyful * tone;
      target.y += 2.5 * fl.depressed * tone;
      target.sy -= 0.03 * fl.depressed * tone;
      if (fl.depressed > 0) {
        target.lookY = lerp(target.lookY, 0.55, fl.depressed * tone);
        target.lookMix = Math.max(target.lookMix, 0.35 * fl.depressed * tone);
      }
    }
    const tempo = mood === "sleep" ? 0.12 : mood === "settle" ? 1 : MOODS[shown() as keyof typeof MOODS].tempo;

    // Something dragged over the window: eyes wide, leaning in, curious.
    if (hovering && ["settle", "glance", "think"].includes(mood)) {
      target.open += 0.14;
      target.wide += 0.03;
      target.lookY = 0.45;
      target.lookX = 0;
      target.lookMix = 1;
      target.y -= 3;
      target.sy += 0.02;
      target.cheek = Math.max(target.cheek, 0.3);
      target.cheekCurve = Math.max(target.cheekCurve, 0.1);
    }

    // While a bubble is up, Mote looks out at you (or toward where they want
    // to go) and bobs a little while the words come out.
    if (bubble && ["settle", "glance", "checkin"].includes(mood)) {
      const dir = bubble.direction;
      target.lookX = dir === "left" ? -0.8 : dir === "right" ? 0.8 : 0;
      target.lookY = dir === "up" ? -0.75 : dir === "down" ? 0.6 : -0.05;
      target.lookMix = 0.85;
      const talking = now - bubble.born < 300 + bubble.text.length * 32;
      if (talking && !reduced) {
        const w = Math.sin(((now - bubble.born) / 1000) * Math.PI * 2 * 5);
        target.sy += 0.014 * w;
        target.sx -= 0.008 * w;
        target.y -= 0.8 * Math.max(0, w);
      }
    }

    // Pointer & idle gaze.
    const rect = svg.getBoundingClientRect();
    let px = 0;
    let py = 0;
    if (pointer.has && rect.width > 0) {
      px = clamp((pointer.x - (rect.left + rect.width * 0.5)) / (rect.width * 0.6), -1, 1);
      py = clamp((pointer.y - (rect.top + rect.height * 0.5)) / (rect.height * 0.6), -1, 1);
    }
    const fade = (idle: number) => (idle < 2000 ? 1 : clamp(1 - (idle - 2000) / 1000, 0, 1));
    // Attention to you (playing with Mote's window) only comes from the
    // pointer over it; the eyes follow it everywhere.
    const attention = !pointer.has ? 0 : fade(idleFor);
    const looking = !pointer.has || mood === "sleep" ? 0 : fade(idleFor);
    lastAttention = looking;
    think(dt, now, attention, sincePet);
    const toward = (dx: number, dy: number) => ({
      x: clamp(dx / 600, -1, 1),
      y: clamp(dy / 500, -0.8, 0.8),
    });
    if (now > wander.next) {
      const m = eyesOnMedia ? lastMedia : null;
      // Mote keeps their eyes on it most of the time.
      const stickiness = m ? 0.85 : 0;
      if (m && Math.random() < stickiness) {
        const at = toward(m.dx, m.dy);
        wander = {
          x: at.x + (Math.random() - 0.5) * 0.1,
          y: at.y + (Math.random() - 0.5) * 0.06,
          next: now + 2000 + Math.random() * 3000,
        };
      } else if (m) {
        // A glance back toward you.
        wander = {
          x: (Math.random() - 0.5) * 0.4,
          y: (Math.random() - 0.5) * 0.2,
          next: now + 1500 + Math.random() * 2500,
        };
      } else {
        const fl = feelings(feel);
        const home = Math.random() < 0.45 - 0.2 * fl.joyful;
        const reach = 1 + 0.4 * fl.joyful;
        // At peace or sleepy, the eyes wander slowly.
        const pace = 1 + 0.6 * fl.satisfied;
        wander = {
          x: home ? 0 : (Math.random() - 0.5) * 0.9 * reach,
          y: home ? 0 : (Math.random() - 0.5) * 0.5 * reach,
          next: now + (1200 + Math.random() * 2400) * pace,
        };
      }
    }
    // A frustrated Mote doesn't want to look at you quite as much; a low one
    // looks away more too.
    const fe = feelings(feel);
    const engaged = looking * (1 - 0.45 * fe.frustrated - 0.3 * fe.depressed);
    const freeX = lerp(wander.x, px, engaged);
    const freeY = lerp(wander.y, py, engaged);
    const nextGX = lerp(freeX, target.lookX, target.lookMix);
    const nextGY = lerp(freeY, target.lookY, target.lookMix);
    if (
      Math.hypot(nextGX - gazeTarget.x, nextGY - gazeTarget.y) > 0.6 &&
      now - lastBlink > 700 &&
      Math.random() < 0.35
    ) {
      blinkAt(now);
    }
    gazeTarget = { x: nextGX, y: nextGY };

    // Looking straight at you up close makes the eyes a touch bigger.
    const close = mood === "settle" && attention > 0.6 && Math.hypot(px, py) < 0.45;
    if (close) {
      target.open += 0.05;
      target.wide += 0.03;
    }
    if (close && !wasClose) react("close");
    wasClose = close;

    // Leaning into the hand that's petting (just a little, asleep).
    if (mood === "purr" || (mood === "sleep" && sincePet < 600)) {
      const lean = clamp((petAt.x - (rect.left + rect.width / 2)) / (rect.width / 2), -1, 1);
      const fade = mood === "purr" ? 1 : 0.5;
      target.x += lean * 4 * fade;
      target.rot += lean * 6 * fade;
    }

    // Little twitches in their sleep.
    if (mood === "sleep") {
      if (twitchStart < 0 && now >= nextTwitch) twitchStart = now;
      if (twitchStart >= 0) {
        const u = (now - twitchStart) / 600;
        if (u >= 1) {
          twitchStart = -1;
          nextTwitch = now + 5000 + Math.random() * 8000;
        } else target.lid -= Math.sin(u * Math.PI) * 0.12;
      }
    }

    // Natural blinks.
    const blinkFree = !["sleep", "wake", "delight", "cute", "dizzy", "purr"].includes(mood);
    const fb = feelings(feel);
    if (blinkFree && now >= nextBlink) {
      blinkAt(now, Math.random() < 0.16);
      nextBlink = now + (2400 + Math.random() * 3600) * (1 + 0.5 * fb.satisfied);
    }
    const slow = slowBlinks();
    let blink = 0;
    blinks = blinks.filter((b) => now - b < 900);
    for (const b of blinks) blink = Math.max(blink, blinkCurve(now - b, slow));
    if (mood === "sleep") blink = 0;
    lastBlinkAmt = blink;

    // When the window is dragged, Mote trails behind it a little and swings
    // back into place when it stops.
    const unit = GEO.vbW / (rect.width || 300);
    target.x += clamp(-winSpeed.x * unit * 0.012, -10, 10);
    target.y += clamp(-winSpeed.y * unit * 0.008, -7, 7);
    target.rot += clamp(-winSpeed.x * unit * 0.014, -8, 8);

    // Body follows the gaze a little.
    target.x += gaze.x * 2.5;
    target.rot += gaze.x * 2.5;
    target.y += gaze.y * 1.2;

    // Breathing.
    if (!reduced) {
      const base = mood === "sleep" ? 3400 : mood === "think" ? 1600 : 2600;
      const period = base * (1 + 0.35 * fb.satisfied - 0.15 * fb.joyful);
      const b = Math.sin((now / period) * Math.PI * 2);
      const deep = mood === "sleep" ? 1.4 : 1;
      target.sy += b * 0.012 * deep;
      target.sx -= b * 0.008 * deep;
      target.y -= b * 0.8 * deep;
    }

    // Integrate springs in small steps so fast motion stays stable.
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (const key of POSE_KEYS) {
        const [k, z] = SPRING[key];
        const [x, v] = spring(view[key], vel[key], target[key], k * tempo, z, h);
        view[key] = x;
        vel[key] = v;
      }
      [gaze.x, gaze.vx] = spring(gaze.x, gaze.vx, gazeTarget.x, 900, 0.82, h);
      [gaze.y, gaze.vy] = spring(gaze.y, gaze.vy, gazeTarget.y, 900, 0.82, h);
      [lag.x, lag.vx] = spring(lag.x, lag.vx, view.x, 110, 0.45, h);
      [lag.y, lag.vy] = spring(lag.y, lag.vy, view.y, 110, 0.45, h);
    }

    return { blink, shakeX, shakeRot };
  };

  let shake = { x: 0, rot: 0 };

  // The ghost's sheet: where the body was last frame, and each hem point's
  // swing (see `render`).
  const cloth = {
    at: 0,
    bx: 0,
    by: 0,
    br: 0,
    points: ghostHem().map(() => ({ x: 0, y: 0, vx: 0, vy: 0 })),
  };

  const render = (blink: number) => {
    const m = reduced ? 0.2 : 1;
    const ghost = options.look === "ghost";
    // A purr is a soft, fast rumble that skips the springs.
    const rumble = purrNow * Math.sin((clock / 1000) * Math.PI * 2 * 11) * m;
    const bx = (view.x + shake.x * m) * m;
    // A ghost hovers, bobbing gently (less in a nap).
    const hover = ghost ? Math.sin((clock / 1000) * ((Math.PI * 2) / 3.4)) * (mood === "sleep" ? 1 : 2.2) * m : 0;
    const by = view.y * m + hover;
    const br = (view.rot + shake.rot * m) * m;
    const bsx = 1 + (view.sx - 1) * m - rumble * 0.004;
    const bsy = 1 + (view.sy - 1) * m + rumble * 0.007;
    parts.body?.setAttribute(
      "transform",
      `translate(${f(bx)} ${f(by)}) rotate(${f(br)} ${GEO.cx} ${GEO.pivotY}) translate(${GEO.cx} ${GEO.groundY}) scale(${bsx.toFixed(4)} ${bsy.toFixed(4)}) translate(${-GEO.cx} ${-GEO.groundY})`,
    );
    const ex = clamp((lag.x - view.x) * 0.35, -3, 3) * m;
    const ey = clamp((lag.y - view.y) * 0.35, -4, 4) * m;
    const eyeShift = `translate(${f(ex)} ${f(ey)})`;
    parts.eyes?.setAttribute("transform", eyeShift);

    const lift = clamp(-by, 0, 40);
    if (parts.shadow) {
      // A ghost floats, so its shadow is smaller and fainter.
      const float = ghost ? 0.78 : 1;
      parts.shadow.setAttribute("rx", f(GEO.shadowRx * float * bsx * (1 - lift / 50)));
      parts.shadow.setAttribute("cx", f(GEO.cx + bx * 0.6));
      parts.shadow.style.opacity = (0.1 * float * (1 - lift / 60)).toFixed(3);
    }

    // The ghost's sheet: each point of the hem on a soft spring of its own,
    // trailing behind the body as it moves (and the window as it's dragged),
    // and billowing a little all the time.
    const snow = options.look === "snow";
    if (parts.skin) parts.skin.style.display = ghost || snow ? "none" : "";
    if (parts.sheet) parts.sheet.style.display = ghost ? "" : "none";
    if (parts.snow) parts.snow.style.display = snow ? "" : "none";
    if (ghost) {
      const dt = clamp((clock - cloth.at) / 1000, 0, 0.05);
      cloth.at = clock;
      const vx = dt > 0 ? (bx - cloth.bx) / dt : 0;
      const vy = dt > 0 ? (by - cloth.by) / dt : 0;
      const vr = dt > 0 ? (br - cloth.br) / dt : 0;
      cloth.bx = bx;
      cloth.by = by;
      cloth.br = br;
      const t = clock / 1000;
      const drag = clamp(lag.x - view.x, -12, 12);
      const dragY = clamp(lag.y - view.y, -12, 12);
      cloth.points.forEach((p, i) => {
        // Further from the middle, the hem swings more with a turn.
        const across = (i / (cloth.points.length - 1)) * 2 - 1;
        const tx = clamp(-vx * 0.07 - vr * 0.05 + drag * 0.8, -10, 10) * m;
        const ty = clamp(-vy * 0.06 + dragY * 0.6 + vr * across * 0.03, -8, 8) * m;
        const k = 70 + i * 9;
        p.vx += (tx - p.x) * k * dt;
        p.vy += (ty - p.y) * k * dt;
        p.vx *= Math.exp(-7 * dt);
        p.vy *= Math.exp(-7 * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      });
      parts.sheet?.setAttribute(
        "d",
        ghostSheet(
          cloth.points.map((p, i) => ({
            x: p.x + Math.sin(t * 1.7 + i * 0.9) * 0.8 * m,
            y: p.y + Math.sin(t * 2.3 + i * 1.3) * 1.3 * m,
          })),
        ),
      );
    }

    // Dizzy eyes orbit in opposite directions.
    const spin = (clock / 1000) * 14;
    const orbit = 0.5 * swirlNow;
    // A special look's eyes (triangles, lumps of coal) are their own shape.
    const look = lookPose(options.look, view);
    const l = eyeShape("l", look, gaze.x, gaze.y, blink, {
      x: Math.cos(spin) * orbit,
      y: Math.sin(spin) * orbit,
    });
    const r = eyeShape("r", look, gaze.x, gaze.y, blink, {
      x: Math.cos(-spin + Math.PI / 2) * orbit,
      y: Math.sin(-spin + Math.PI / 2) * orbit,
    });
    setPill(parts.pillL, l.pill);
    setPill(parts.pillR, r.pill);
    for (const [pill, own, shape, side] of [
      [parts.pillL, parts.ownL, l, "l"],
      [parts.pillR, parts.ownR, r, "r"],
    ] as const) {
      const d = lookEye(options.look, shape.pill, side);
      if (pill) pill.style.display = d ? "none" : "";
      if (own) own.style.display = d ? "" : "none";
      if (d) own?.setAttribute("d", d);
    }
    parts.lidL?.setAttribute("d", l.lid);
    parts.lidR?.setAttribute("d", r.lid);
    parts.cheekL?.setAttribute("d", l.cheek);
    parts.cheekR?.setAttribute("d", r.cheek);
    if (parts.brows) parts.brows.style.display = options.brows ? "" : "none";
    if (options.brows) {
      parts.browL?.setAttribute("d", l.brow);
      parts.browR?.setAttribute("d", r.brow);
    }
    // The snowman's bits of coal are drawn outside the soft filter (which
    // would round their lumps away), so they have a path of their own.
    if (parts.mouth) parts.mouth.style.display = options.mouth && !snow ? "" : "none";
    if (parts.coal) parts.coal.style.display = options.mouth && snow ? "" : "none";
    parts.mouth?.classList.toggle("is-jack", options.look === "jack");
    if (options.mouth && snow) {
      parts.coal?.setAttribute("d", coalMouthShape(view, gaze.x, gaze.y));
      parts.coal?.setAttribute("transform", eyeShift);
    } else if (options.mouth) {
      // A jack-o'-lantern works its jaw while the words come out.
      const said = bubble ? clock - bubble.born : Infinity;
      const talking = !!bubble && said < 300 + bubble.text.length * 32 && !reduced;
      const talk = talking ? 0.5 + 0.5 * Math.sin((said / 1000) * Math.PI * 2 * 4) : 0;
      parts.mouth?.setAttribute("d", lookMouth(options.look, view, gaze.x, gaze.y, talk));
    }
    if (parts.nose) parts.nose.style.display = snow ? "" : "none";
    if (snow) {
      parts.nose?.setAttribute("d", noseShape(gaze.x, gaze.y));
      parts.nose?.setAttribute("transform", eyeShift);
    }
    if (parts.glints) parts.glints.style.display = options.glint ? "" : "none";
    if (options.glint) {
      parts.glints?.setAttribute("transform", eyeShift);
      const fill = glintColor(feel, options.dark, options.look);
      setGlint(parts.glintL, glintAt(l.pill, gaze.x, gaze.y, options.look), fill);
      setGlint(parts.glintR, glintAt(r.pill, gaze.x, gaze.y, options.look), fill);
    }

    // The pawn, the controller, the Minecraft block and creeper.
    const at = clock - moodStart;
    const place = (
      el: SVGGElement | null,
      p: { x: number; y: number; rot?: number; s: number } | null,
    ) => {
      if (!el) return;
      el.style.display = p && p.s > 0.01 ? "" : "none";
      if (p && p.s > 0.01)
        el.setAttribute(
          "transform",
          `translate(${f(p.x)} ${f(p.y)}) rotate(${f(p.rot ?? 0)}) scale(${f(p.s)})`,
        );
    };
    place(parts.pad, mood === "gaming" ? padAt(at, moodSeed) : null);

    if (debug.guides) {
      parts.guides?.setAttribute("transform", eyeShift);
      setPill(parts.gPillL, l.pill);
      setPill(parts.gPillR, r.pill);
      parts.gLidL?.setAttribute("d", l.lidEdge);
      parts.gLidR?.setAttribute("d", r.lidEdge);
      parts.gCheekL?.setAttribute("d", l.cheekEdge);
      parts.gCheekR?.setAttribute("d", r.cheekEdge);
    }
  };

  const force = (next: Mood) => {
    // A forced purr pretends someone pets Mote for a moment.
    if (next === "purr") petAt.t = clock + 1200;
    start(next, clock);
  };

  /** Inertia (Mote lags behind the window), and dizziness if it's thrown about. */
  // Moves arrive in uneven bursts while the window is dragged, so they're
  // collected here and turned into a smoothed speed once per frame.
  const winMoved = { x: 0, y: 0 };
  const winSpeed = { x: 0, y: 0 };
  const windowMoved = (dx: number, dy: number) => {
    touch();
    const d = Math.hypot(dx, dy);
    if (d === 0 || d > 2000) return;
    winMoved.x += dx;
    winMoved.y += dy;
    engage();
    noticeYou();
    if (bubble?.kind === "move") {
      movedSince.x += dx;
      movedSince.y += dy;
    }
    if (clock - lastDragReact > 5000) {
      lastDragReact = clock;
      react("drag");
    }
    if (!debug.manual) shaken("window", d, window.innerWidth * 3.5);
  };

  const loop = (real: number) => {
    if (!running) return;
    if (hidden) {
      raf = 0;
      return;
    }
    const realDt = Math.min(0.05, (real - realLast) / 1000);
    realLast = real;
    if (realDt > 0) fps = lerp(fps, 1 / realDt, 0.05);

    // Notice the window itself being moved around the screen. (The Mac app
    // reports moves itself, through `windowMoved`.)
    const sx = "__TAURI_INTERNALS__" in window ? lastScreen.x : window.screenX;
    const sy = "__TAURI_INTERNALS__" in window ? lastScreen.y : window.screenY;
    if (sx !== lastScreen.x || sy !== lastScreen.y) {
      const dx = sx - lastScreen.x;
      const dy = sy - lastScreen.y;
      lastScreen.x = sx;
      lastScreen.y = sy;
      windowMoved(dx, dy);
    }
    if (realDt > 0) {
      const ease = 1 - Math.exp(-realDt * 8);
      winSpeed.x = lerp(winSpeed.x, winMoved.x / realDt, ease);
      winSpeed.y = lerp(winSpeed.y, winMoved.y / realDt, ease);
      winMoved.x = 0;
      winMoved.y = 0;
    }

    let blink = 0;
    if (debug.manual) {
      const m = debug.manual;
      Object.assign(view, m.pose);
      for (const key of POSE_KEYS) vel[key] = 0;
      gaze.x = m.gazeX;
      gaze.y = m.gazeY;
      lag.x = view.x;
      lag.y = view.y;
      shake = { x: 0, rot: 0 };
      blink = m.blink;
      lastBlinkAmt = blink;
    } else if (debug.frozen) {
      blink = lastBlinkAmt;
    } else {
      const dt = realDt * debug.timeScale;
      clock += dt * 1000;
      const out = step(dt, clock);
      blink = out.blink;
      shake = { x: out.shakeX, rot: out.shakeRot };
    }

    render(blink);
    raf = requestAnimationFrame(loop);
  };

  svg.dataset.mood = "settle";
  // Lets a mood be played from the browser console while tuning: $0.mote("twirl").
  (svg as SVGSVGElement & { mote?: (m: Mood) => void }).mote = force;
  raf = requestAnimationFrame(loop);

  const api: FaceEngine = {
    destroy: () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onPress);
      window.removeEventListener("pagehide", keepFeelings);
      keepFeelings();
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onMq);
    },
    configure: (opts) => {
      const before = { ...options };
      Object.assign(options, opts);
      if (before.media === null && options.media !== null) react("sound-start");
      // The mind switched off, Mote is held even (how they felt is kept
      // aside); back on, they feel as they did.
      if (!options.mind && !keptMind) {
        keptMind = feel;
        feel = { ...MIND_STEADY };
        moodsNow = lastingMoods(feel);
        wanting = null;
      } else if (options.mind && keptMind) {
        feel = keptMind;
        keptMind = null;
        moodsNow = lastingMoods(feel);
      }
    },
    poke: () => {
      pokeQueued = true;
    },
    force,
    blink: (double = false) => {
      blinkAt(clock, double);
      log(double ? "double blink" : "blink");
    },
    setTimeScale: (scale) => {
      debug.timeScale = clamp(scale, 0, 4);
    },
    setFrozen: (frozen) => {
      debug.frozen = frozen;
    },
    setAutoMoods: (on) => {
      debug.autoMoods = on;
      if (on) nextAct = clock + restGap();
    },
    setLoop: (on) => {
      debug.loop = on;
    },
    setGuides: (on) => {
      debug.guides = on;
      if (on) svg.dataset.guides = "";
      else delete svg.dataset.guides;
    },
    hitTest: (clientX, clientY) => {
      if (options.eyesOnly) return true;
      const ctm = parts.body?.getScreenCTM();
      if (!ctm) return false;
      const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      const nx = (pt.x - GEO.cx) / GEO.faceRx;
      const ny = (pt.y - GEO.cy) / GEO.faceRy;
      return nx * nx + ny * ny <= 1.04;
    },
    pet: (clientX, clientY) => {
      touch();
      engage();
      noticeYou();
      if (bubble?.kind === "pet") pettedSince = true;
      const fresh = clock - petAt.t > 350;
      petAt.t = clock;
      petAt.x = clientX;
      petAt.y = clientY;
      if (fresh) log("petting");
      if (mood !== "purr" && mood !== "dizzy") start("purr", clock);
    },
    windowMoved: (dx, dy) => windowMoved(dx, dy),
    react,
    setFeeling: (key, value) => {
      feel = { ...feel, [key]: clamp(value, -10, 10) };
      log(`set ${key} to ${feel[key].toFixed(1)}`);
    },
    gameStart,
    gameOver,
    answer: (yes) => {
      touch();
      if (bubble?.kind === "ask" && !bubble.reply) resolve(yes ? "yes" : "no", clock);
    },
    dismissSpeech: () => {
      if (bubble?.kind === "flavor") resolve("done", clock);
      else if (bubble?.lineId === TALK) showBubble(null);
    },
    talk: (t) => {
      rouse();
      engage();
      touch();
      pendingEvent = null;
      // A long time to answer in: there's a box to type in.
      const ttl = t.kind === "talk" || t.kind === "choose" ? 60_000 : t.kind === "ask" ? lifetime("ask", t.text) : lifetime("flavor", t.text) + 1200;
      showBubble({
        id: ++bubbleSeq,
        lineId: TALK,
        kind: t.kind,
        text: t.text,
        choices: t.choices,
        placeholder: t.placeholder,
        noTyping: t.noTyping,
        born: clock,
        ttl,
      });
      react("speak");
      log(`says “${t.text}”`);
    },
    endTalk: () => {
      if (bubble?.lineId === TALK) showBubble(null);
    },
    stillTalking: () => {
      if (bubble?.lineId === TALK) bubble.ttl = clock - bubble.born + 60_000;
    },
    drowsy: () => mood === "sleep" || mood === "doze" || (mood === "yawn" && dozeNext),
    declined: () => {
      rouse();
      engage();
      react("drop-declined");
      start("decline", clock);
      sayNow("drop-declined");
    },
    notForMe: () => {
      rouse();
      engage();
      react("drop-file");
      start("decline", clock);
      sayNow("drop-file");
    },
    dragHover: (over) => {
      hovering = over;
    },
    offerApp,
    saveLink,
    suggestLink: (url) => {
      if (bubble) showBubble(null);
      suggestLink(clock, url);
    },
    setBoardGame,
    checkers: checkersEvent,
    chess: chessEvent,
    tictactoe: ticTacToeEvent,
    uno: unoEvent,
    solitaire: solitaireEvent,
    clicker: clickerEvent,
    say: (lineId) => {
      if (bubble) showBubble(null);
      const line = lineId ? lineById.get(lineId) : chooseLine(speechContext(), new Map(), clock);
      if (line) say(line, clock);
    },
    resetFeelings: () => {
      if (keptMind) keptMind = { ...MIND_START };
      else feel = { ...MIND_START };
      log("mind reset to the start");
    },
    setManual: (face) => {
      debug.manual = face;
    },
    snapshot: () => ({
      mood: shown(),
      moodMs: clock - moodStart,
      fps,
      gazeX: gaze.x,
      gazeY: gaze.y,
      attention: lastAttention,
      blink: lastBlinkAmt,
      idleMs: pointer.has ? clock - pointer.at : 0,
      pose: { ...view },
      petting: clock - petAt.t < 350,
      media: options.media,
      intrigued: [
        ...(interest === "media" ? (["media"] as const) : []),
        ...(clock < youUntil ? (["you"] as const) : []),
      ],
      speech: bubble,
      need: wanting ? { line: wanting.line, in: Math.max(0, wanting.at - clock) } : null,
      placement: options.placement,
      mind: { ...feel },
      quadrant: quadrant(feel),
      moods: [...moodsNow],
      asleep: mood === "sleep" || mood === "doze",
      wants: wants(),
      sinceAttention: (clock - attendedAt) / 60_000,
      reactions: Object.fromEntries(
        Object.entries(fired).map(([id, r]) => [id, { count: r.count, ago: clock - r.at }]),
      ),
    }),
  };
  // Also reachable from the console while tuning: $0.moteEngine.
  (svg as SVGSVGElement & { moteEngine?: FaceEngine }).moteEngine = api;
  return api;
}
