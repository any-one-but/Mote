import {
  feed,
  feelings,
  lastingMoods,
  loadMind,
  MIND_START,
  nudge,
  quadrant,
  saveMind,
  SNACKS,
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
  pickCalorieAside,
  pickCalorieReaction,
  type CalorieMood,
  type CaloriePick,
  type DaySnap,
} from "@/components/companion/calorie-lines";
import { commitBook } from "@/lib/companion/calorie-store";
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
import {
  LIARSDICE_CHANCE,
  LIARSDICE_FACE,
  pickLiarsDiceLine,
  type LiarsDiceEvent,
} from "@/components/companion/liarsdice-lines";
import type { Level } from "@/lib/checkers/ai";

export type BoardGameState = "you" | "mote" | "idle" | null;

/** Local Gallery's passcode: Mote asking for it (and each digit you type),
 * how it went, and what Settings did with it. */
export type PasscodeEvent =
  | "ask"
  | "digit"
  | "right"
  | "wrong"
  | "refuse"
  | "waiting"
  | "cancel"
  | "already-open"
  | "set"
  | "changed"
  | "off"
  | "locked"
  | "was-locked"
  | "hidden"
  | "shown";

export type PasscodeInfo = { triesLeft?: number; wait?: number; quiet?: boolean };

/** The face for each passcode moment (none: Mote just settles). */
const PASSCODE_FACE: Partial<Record<PasscodeEvent, Mood>> = {
  ask: "pc-away",
  right: "pc-right",
  wrong: "pc-wrong",
  refuse: "pc-refuse",
  waiting: "pc-refuse",
  "already-open": "delight",
  set: "cute",
  changed: "delight",
  off: "surprise",
  locked: "ck-smug",
  "was-locked": "glance",
  hidden: "cute",
  shown: "glance",
};

/** What Mote would like, shown as a glow on the matching button. */
export type Want = "food" | "sleep" | "play";
import {
  addDays,
  dateKey,
  partOf,
  readBook,
  streakUnder,
  type CalorieMoment,
} from "@/lib/companion/calories";

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
  | "fidget"
  | "hum"
  // Looking out at you while watching something.
  | "checkin"
  // Playing a game dropped on Mote.
  | "chess"
  | "minecraft"
  | "gaming"
  // Helping you: looking up at the options, busy with a job, and how it went.
  | "present"
  | "work"
  | "tada"
  | "uhoh"
  // Eating: pleased, thinking it over, worried near the line, sad once over.
  | "beam"
  | "reckon"
  | "worry"
  | "plead"
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
  // Eating something you gave them.
  | "munch"
  // Local Gallery's passcode: not peeking while you type it, then right,
  // wrong, or refusing outright.
  | "pc-away"
  | "pc-right"
  | "pc-wrong"
  | "pc-refuse";

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
};

export type Energy = "calm" | "normal" | "lively";

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
  /** Daily calorie goal. 0 means Mote isn't keeping track. */
  calorieGoal: number;
  /** Mote gets hungry and can be fed (a keyed feature). Off, they stay full. */
  hunger: boolean;
  /** Mote gets tired and needs sleep (a keyed feature). Off, they stay rested
   * and just nap now and then when left alone. */
  sleepNeed: boolean;
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
};

/** An app dropped on Mote: its name, its ID (com.apple.safari…), and
 * whether it's Apple's Chess, Minecraft, some other game, or not a game. */
export type AppOffer = {
  name: string;
  bundle: string | null;
  game: "chess" | "minecraft" | "game" | null;
};

/** Something going on that Mote can turn to look at. */
export type Focus = "media" | "pointer" | "typing";

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
  /** Everything Mote is intrigued by right now, and which one they're looking at. */
  intrigued: Array<"media" | "you" | "pointer" | "typing">;
  focus: Focus | null;
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
  /** Helping you with something: busy with a job, or talking it over. */
  helping: "busy" | "talking" | null;
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
  /** Give Mote something to eat (one of SNACKS, by id). */
  feed: (snack: string) => void;
  /** Put Mote to bed: they go to sleep if they're tired enough. */
  tuckIn: () => void;
  /** You opened Local Gallery from Mote (or tried to). */
  openedGallery: (ok: boolean) => void;
  /** Local Gallery's passcode (see PasscodeEvent): `triesLeft` after a wrong
   * one, `wait` (seconds) when Mote stops taking tries; `quiet`, no line. */
  passcode: (event: PasscodeEvent, info?: PasscodeInfo) => void;
  /** A board game starts (Mote may remember the last one) and ends (Mote
   * remembers this one, and it moves their mood). `event` is the game's own
   * end line to use if there's nothing more personal to say. */
  gameStart: (game: GameName, level: Level, opener?: string) => void;
  gameOver: (result: GameResult, event: string) => void;
  /** Answer the question in the speech bubble: green (true) or red (false). */
  answer: (yes: boolean) => void;
  /** Close a remark bubble early. */
  dismissSpeech: () => void;
  /** Debug: say a particular line now (or anything fitting, with no id). */
  say: (lineId?: string) => void;
  /** The pointer, out on the rest of the screen: where, from Mote's centre. */
  pointerElsewhere: (dx: number, dy: number, inside: boolean) => void;
  /** You're typing in another app, whose window is this far from Mote's centre. */
  typingAt: (dx: number, dy: number) => void;
  /** Something is being dragged over Mote's window (or not, with false). */
  dragHover: (over: boolean) => void;
  /**
   * Helping you with files: "talking" while the options are up (Mote looks
   * at them and keeps their own chatter to themself), "busy" while a job
   * runs, null when done. Finishing a job well or badly shows on the face.
   */
  setHelping: (state: "busy" | "talking" | null) => void;
  /** A job just finished: well (a happy hop) or with problems (a worried look). */
  jobDone: (ok: boolean) => void;
  /** An app dropped on Mote: a game gets played, anything else gets a reaction. */
  offerApp: (app: AppOffer) => void;
  /** Something dropped on Mote that they don't take (its feature is off):
   * a polite little "no thanks". */
  declined: () => void;
  /** A link dropped on Mote, to save for suggesting some day. */
  saveLink: (url: string, title: string | null) => void;
  /** Debug: suggest a saved link right now (this one, or Mote's pick). */
  suggestLink: (url?: string) => void;
  /** You just changed today's calories. Mote says something that fits. */
  noteCalories: (moment: CalorieMoment) => void;
  /** A game of checkers or chess: whose turn it is ("idle" between games,
   * null when the board is put away). */
  setBoardGame: (state: BoardGameState) => void;
  /** Something happened in a game. Mote reacts, and maybe says something. */
  checkers: (event: CheckersEvent, level: Level) => void;
  chess: (event: ChessEvent, level: Level, words?: { piece?: string; yours?: string }) => void;
  tictactoe: (event: TicTacToeEvent, level: Level) => void;
  /** Liar's Dice, which never ends: a round's moments. `bid` is the bid in
   * words, for Mote to say. */
  liarsDice: (event: LiarsDiceEvent, bid?: string) => void;
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
  "fidget",
  "hum",
  "checkin",
  "chess",
  "minecraft",
  "gaming",
  "present",
  "work",
  "tada",
  "uhoh",
  "beam",
  "reckon",
  "worry",
  "plead",
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
  "munch",
  "pc-away",
  "pc-right",
  "pc-wrong",
  "pc-refuse",
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
const MOODS: Record<Exclude<Mood, "settle" | "sleep">, { dur: number; tempo: number }> = {
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
  fidget: { dur: 2000, tempo: 1.2 },
  hum: { dur: 3000, tempo: 0.9 },
  checkin: { dur: 1500, tempo: 0.9 },
  tada: { dur: 1800, tempo: 1.1 },
  chess: { dur: 5600, tempo: 0.95 },
  minecraft: { dur: 5400, tempo: 1 },
  gaming: { dur: 5600, tempo: 1.2 },
  uhoh: { dur: 2400, tempo: 1 },
  beam: { dur: 8400, tempo: 1 },
  reckon: { dur: 8400, tempo: 0.85 },
  worry: { dur: 8400, tempo: 0.85 },
  plead: { dur: 9000, tempo: 0.75 },
  care: { dur: 7000, tempo: 0.8 },
  soothe: { dur: 3800, tempo: 0.75 },
  "ck-smug": { dur: 2600, tempo: 1 },
  "ck-ouch": { dur: 2400, tempo: 1.05 },
  "ck-crown": { dur: 3000, tempo: 1 },
  "ck-win": { dur: 3600, tempo: 1.05 },
  "ck-lose": { dur: 3800, tempo: 0.85 },
  "ch-check": { dur: 2200, tempo: 1 },
  "ch-checked": { dur: 2400, tempo: 1.1 },
  munch: { dur: 2600, tempo: 1.1 },
  "pc-right": { dur: 1900, tempo: 1.1 },
  "pc-wrong": { dur: 2100, tempo: 1.05 },
  "pc-refuse": { dur: 3400, tempo: 0.95 },
  // Held while the passcode pad is up (see `passcode`).
  "pc-away": { dur: Number.POSITIVE_INFINITY, tempo: 0.8 },
  // Purring lasts as long as the petting does; see `PURR_AFTER`. Looking at
  // the options and working last as long as they do (see `setHelping`).
  purr: { dur: Number.POSITIVE_INFINITY, tempo: 0.8 },
  present: { dur: Number.POSITIVE_INFINITY, tempo: 1 },
  work: { dur: Number.POSITIVE_INFINITY, tempo: 1 },
  // Held for as long as it's your turn, or Mote's (see `setBoardGame`).
  "ck-watch": { dur: Number.POSITIVE_INFINITY, tempo: 1 },
  "ck-think": { dur: Number.POSITIVE_INFINITY, tempo: 0.85 },
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
  "present",
  "work",
  "tada",
  "uhoh",
  "beam",
  "reckon",
  "worry",
  "plead",
  "care",
  "soothe",
  "chess",
  "minecraft",
  "gaming",
  "ck-think",
  "ck-smug",
  "ck-ouch",
  "ck-crown",
  "ck-win",
  "ck-lose",
  "ch-check",
  "ch-checked",
  "munch",
  "pc-away",
  "pc-right",
  "pc-wrong",
  "pc-refuse",
];

type GameMood = "chess" | "minecraft" | "gaming";
const GAME_MOODS: Mood[] = ["chess", "minecraft", "gaming"];

/** Whether this game goes Mote's way. */
const gameWon = (m: GameMood, seed: number) =>
  m === "chess" ? chessWin(seed) : m === "minecraft" ? minecraftWin(seed) : gamingWin(seed);

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
  sleep: "Mote is sleeping. Poke to wake.",
  yawn: "Mote yawns.",
  startle: "Mote jolts awake!",
  think: "Mote is thinking.",
  frustrate: "Mote is grumpy.",
  cute: "Mote is feeling cute.",
  surprise: "Mote is surprised.",
  dizzy: "Mote is dizzy.",
  huff: "Mote huffs.",
  sulk: "Mote is sulking.",
  fidget: "Mote is fidgeting.",
  hum: "Mote is humming happily.",
  checkin: "Mote checks in on you.",
  beam: "Mote is pleased.",
  reckon: "Mote is thinking it over.",
  worry: "Mote is worried.",
  plead: "Mote is upset.",
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
  munch: "Mote is eating.",
  "pc-away": "Mote isn’t looking while you type the passcode.",
  "pc-right": "Mote: that’s the passcode!",
  "pc-wrong": "Mote: that’s not the passcode.",
  "pc-refuse": "Mote refuses to open the gallery.",
  chess: "Mote is playing chess.",
  minecraft: "Mote is playing Minecraft.",
  gaming: "Mote is gaming.",
  present: "Mote is asking what to do.",
  work: "Mote is working on it.",
  tada: "Mote is done!",
  uhoh: "Mote ran into a problem.",
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
  /** ms since the last digit of a passcode was typed. */
  sinceTap?: number;
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
  } else if (mood === "fidget") {
    // Can’t sit still: little shuffles side to side and darting glances.
    keys = [];
    for (let i = 0; i < 6; i++) {
      const s = i % 2 ? 1 : -1;
      keys.push([
        i * 260,
        {
          x: s * 4,
          rot: s * 4,
          y: i % 3 === 0 ? -3 : 0,
          lookX: -s * 0.7,
          lookY: (i % 3) * 0.2 - 0.2,
          lookMix: 0.8,
        },
      ]);
    }
    keys.push([1600, {}]);
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
  } else if (mood === "chess") {
    // Chess with the little pawn: a long think, then either a clever move and
    // a smug look before checkmate, or a blunder, a worried look and a laugh.
    const atPawn: Partial<Pose> = { lookX: dir * 0.45, lookY: 0.75, lookMix: 1 };
    const pondering: Partial<Pose> = {
      ...atPawn,
      lid: 0.12,
      lidTilt: 0.22,
      lidBias: dir * 0.08,
      openBias: dir * 0.12,
      rot: dir * 4,
      y: -1,
    };
    if (chessWin(seed)) {
      keys = [
        [0, { ...atPawn, open: 1.05 }],
        [500, pondering],
        [1200, { ...pondering, rot: dir * 6, lookX: dir * 0.3 }],
        [1900, { ...atPawn, open: 1.25, wide: 1.04, y: -8, sy: 1.06, sx: 0.96 }],
        [2250, { ...atPawn, open: 1.1, y: 0 }],
        // Smug: a sideways look at you, one brow up, cheeks up.
        [
          2700,
          {
            lid: 0.24,
            lidCurve: -0.06,
            lidBias: -dir * 0.06,
            cheek: 0.42,
            cheekCurve: 0.12,
            rot: -dir * 3,
            lookX: -dir * 0.3,
            lookY: 0.05,
            lookMix: 1,
          },
        ],
        // Checkmate!
        [3900, { y: -11, sy: 1.06, sx: 0.95, cheek: 0.7, cheekCurve: 0.26, open: 1.02 }],
        [4200, { y: 1, sy: 0.95, sx: 1.04, cheek: 0.7, cheekCurve: 0.26 }],
        [4450, { cheek: 0.62, cheekCurve: 0.2, rot: dir * 3 }],
        [5100, {}],
      ];
    } else {
      keys = [
        [0, { ...atPawn, open: 1.05 }],
        [500, pondering],
        // A confident move…
        [1450, { ...atPawn, open: 1.08, cheek: 0.32, cheekCurve: 0.1, y: -2 }],
        // …and the pawn gets knocked flat.
        [2500, { ...atPawn, open: 1.36, wide: 0.9, y: -7, sy: 1.06, sx: 0.95 }],
        [3000, { ...atPawn, lookY: 0.85, lidTilt: -0.45, lid: 0.1, open: 1.1, y: 1 }],
        // Oh well: a laugh about it.
        [3900, { cheek: 0.7, cheekCurve: 0.2, open: 0.92, lookY: -0.05, lookMix: 1 }],
        [5100, {}],
      ];
      if (t > 3900 && t < 4900) {
        const fade = 1 - (t - 3900) / 1000;
        const giggle = Math.sin(((t - 3900) / 1000) * Math.PI * 2 * 6);
        wobble = { y: -Math.abs(giggle) * 2.5 * fade, rot: giggle * 1.5 * fade };
      }
    }
  } else if (mood === "minecraft") {
    // Minecraft: either bonks a block until it pops, and is delighted with
    // the little block they get; or a creeper turns up, hisses… and BOOM.
    const atBlock: Partial<Pose> = { lookX: dir * 0.45, lookY: 0.7, lookMix: 1 };
    if (minecraftWin(seed)) {
      keys = [[0, { ...atBlock, open: 1.1 }]];
      for (const at of BONKS) {
        keys.push(
          [at, { ...atBlock, x: dir * 5, rot: dir * 7, y: 2, sy: 0.94, sx: 1.05, lid: 0.15 }],
          [at + 160, { ...atBlock, x: dir, lid: 0.1 }],
        );
      }
      keys.push(
        [2350, { ...atBlock, open: 1.2, y: -4 }],
        [2700, { y: -12, sy: 1.07, sx: 0.95, cheek: 0.7, cheekCurve: 0.26, open: 1.05 }],
        [3000, { y: 1, sy: 0.95, sx: 1.04, cheek: 0.7, cheekCurve: 0.26 }],
        [3300, { cheek: 0.62, cheekCurve: 0.2, lookX: dir * 0.3, lookY: 0.4, lookMix: 1 }],
        [4900, {}],
      );
    } else {
      keys = [
        [0, { ...atBlock, open: 1.05, rot: dir * 3 }],
        // Is that… a creeper?
        [900, { ...atBlock, open: 1.25, lidTilt: -0.45, lid: 0.05, x: -dir * 3, y: -1 }],
        // BOOM.
        [2300, { open: 1.4, wide: 0.88, y: -14, sy: 1.1, sx: 0.9, lookY: -0.1, lookMix: 1 }],
        [2650, { open: 0.9, wide: 0.95, lookMix: 1 }],
        [4200, { open: 1.02 }],
        [4600, {}],
      ];
      if (t > 900 && t < 2300) shakeX = Math.sin((t / 1000) * Math.PI * 2 * 16) * 0.6;
      // Dazed, eyes swirling, then shakes it off.
      const up = Math.min(1, Math.max(0, (t - 2650) / 300));
      const down = Math.min(1, Math.max(0, (4200 - t) / 400));
      swirl = up * down;
      const w = t / 1000;
      wobble = {
        x: Math.sin(w * 9) * 3 * swirl,
        rot: Math.sin(w * 9 + 1) * 6 * swirl,
        openBias: Math.sin(w * 11) * 0.15 * swirl,
      };
      if (t > 4200 && t < 4650) {
        const decay = 1 - (t - 4200) / 450;
        const shake = Math.sin(((t - 4200) / 1000) * Math.PI * 2 * 10);
        shakeX = shake * 3 * decay;
        shakeRot = shake * 2 * decay;
      }
    }
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
  } else if (mood === "present") {
    // Looking up at the options, friendly and attentive, with a slow tilt
    // one way and then the other while you decide.
    const up: Partial<Pose> = {
      lookY: -0.8,
      lookMix: 1,
      open: 1.06,
      cheek: 0.24,
      cheekCurve: 0.1,
      y: -1,
    };
    const tilt = (Math.floor(t / 2600) % 2 ? 1 : -1) * dir;
    keys = [
      [0, { ...up, open: 1.12, y: -3 }],
      [350, { ...up, rot: tilt * 3, x: tilt }],
    ];
  } else if (mood === "work") {
    // Busy: focused eyes reading down a list, a little nod as each thing
    // gets done.
    keys = [[0, { lid: 0.2, lidCurve: -0.1, lidTilt: 0.06, cheek: 0.1, lookY: 0.35, lookMix: 1 }]];
    const w = t / 1000;
    wobble = {
      lookX: Math.sin(w * 1.9) * 0.4,
      y: Math.abs(Math.sin(w * 3.4)) * 1.4,
      rot: Math.sin(w * 1.9) * 1.5,
    };
  } else if (mood === "tada") {
    // All done: a big happy hop, then a pleased little sway.
    const glad: Partial<Pose> = { cheek: 0.72, cheekCurve: 0.26, open: 1.04, wide: 1.06 };
    keys = [
      [0, { ...glad, sy: 0.9, sx: 1.08, y: 3 }],
      [120, { ...glad, y: -15, sy: 1.08, sx: 0.94 }],
      [400, { ...glad, y: 1.5, sy: 0.93, sx: 1.06 }],
      [560, { ...glad, rot: dir * 4, x: dir * 1.5 }],
      [900, { ...glad, rot: -dir * 4, x: -dir * 1.5 }],
      [1250, { ...glad, cheek: 0.6 }],
      [1600, {}],
    ];
  } else if (mood === "uhoh") {
    // Something went wrong: a start, a worried look down, then a sheepish
    // little shrug.
    keys = [
      [0, { open: 1.26, wide: 0.92, y: -4, sy: 1.04 }],
      [380, { lidTilt: -0.5, lid: 0.08, open: 1.08, lookY: 0.5, lookMix: 1, sy: 0.97, y: 2 }],
      [1400, { lidTilt: -0.3, cheek: 0.3, cheekCurve: 0.08, rot: dir * 4, y: -3, lookMix: 0 }],
      [2100, {}],
    ];
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
    // Pleased about a careful day: a little hop, then a held, bashful smile.
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
  } else if (mood === "reckon") {
    // Thinking the day through. Calm, not a celebration.
    const face: Partial<Pose> = {
      lookY: -0.55,
      lookX: dir * 0.32,
      lookMix: 1,
      lid: 0.1,
      lidTilt: 0.2,
      lidBias: dir * 0.08,
      openBias: dir * 0.1,
      open: 1.02,
      rot: dir * 5,
      y: -1,
      cheek: 0.14,
      cheekCurve: 0.04,
    };
    keys = [
      [0, { ...face, open: 1.08 }],
      [360, face],
    ];
    wobble = { lookX: Math.sin((t / 1000) * 0.8) * 0.1 };
  } else if (mood === "worry") {
    // Near the line: worried brows, a small shrink, eyes that won't settle.
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
  } else if (mood === "plead") {
    // Over the line. Either a look up and a little whine, or a sad turn away.
    const droop: Partial<Pose> = {
      sy: 0.9,
      sx: 1.06,
      y: 6,
      lid: 0.34,
      lidTilt: -0.42,
      lidCurve: 0.12,
      cheek: 0.06,
      cheekCurve: -0.04,
      open: 0.92,
      lookY: -0.55,
      lookMix: 1,
    };
    const away: Partial<Pose> = {
      ...droop,
      lookX: dir * 0.85,
      lookY: 0.4,
      rot: dir * 8,
      x: dir * 3,
    };
    const face = variant < 0.55 ? droop : away;
    keys = [
      [0, { open: 1.04, y: -1 }],
      [280, face],
    ];
    if (variant < 0.55 && t > 400) {
      const whimper = Math.sin((t / 1000) * Math.PI * 2 * 2.2);
      shakeRot = whimper * 1.1;
      wobble = { y: Math.abs(whimper) * 0.5 };
    }
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
  } else if (mood === "munch") {
    // Eating: a happy hop at the snack, then eyes closed in bliss, cheeks up,
    // chewing away with a little bob.
    const yum: Partial<Pose> = { cheek: 0.74, cheekCurve: 0.26, open: 0.98, lookMix: 1, lookY: 0.1 };
    keys = [
      [0, { open: 1.2, y: -6, sy: 1.05, sx: 0.96 }],
      [220, { ...yum, y: 1 }],
      [2200, {}],
    ];
    if (t > 300 && t < 2100) {
      const chew = Math.sin(((t - 300) / 1000) * Math.PI * 2 * 3.2);
      wobble = { sy: chew * 0.035, sx: -chew * 0.025, y: Math.abs(chew) * 1.2 };
    }
  } else if (mood === "pc-away") {
    // Not peeking: eyes shut tight in two little arcs, head turned away,
    // swaying gently. Each digit typed gets a tiny flinch, eyes still
    // firmly shut.
    const shut: Partial<Pose> = {
      open: 0.96,
      wide: 1.08,
      lid: 0.06,
      cheek: 0.7,
      cheekCurve: 0.2,
      rot: dir * 9,
      x: dir * 3,
      sy: 1.01,
    };
    keys = [
      [0, { open: 1.08, y: -2 }],
      [160, { ...shut, y: 1 }],
      [420, shut],
    ];
    const w = t / 1000;
    const tap = extras.sinceTap ?? Infinity;
    const flinch = tap < 260 ? Math.sin((tap / 260) * Math.PI) : 0;
    wobble = {
      rot: Math.sin(w * 0.9) * 1.6 + dir * flinch * 2,
      y: Math.sin(w * 1.8) * 0.5 - flinch * 1.5,
      sy: flinch * 0.025,
      lid: flinch * 0.05,
    };
  } else if (mood === "pc-right") {
    // That's it: eyes pop open, a happy hop, a firm nod, and a wink.
    const glad: Partial<Pose> = { cheek: 0.7, cheekCurve: 0.26, open: 1.04, wide: 1.06 };
    keys = [
      [0, { open: 1.2, wide: 0.95, y: -3, sy: 1.04 }],
      [140, { ...glad, sy: 0.92, sx: 1.06, y: 3 }],
      [260, { ...glad, y: -13, sy: 1.07, sx: 0.95 }],
      [540, { ...glad, y: 1.5, sy: 0.95, sx: 1.04 }],
      [720, { ...glad, y: 4, lookY: 0.2, lookMix: 1 }],
      [900, { ...glad, y: -1 }],
      [1080, { ...glad, cheek: 0.62, winkL: dir > 0 ? 1 : 0, winkR: dir > 0 ? 0 : 1, lookX: 0, lookY: 0, lookMix: 1 }],
      [1600, {}],
    ];
  } else if (mood === "pc-wrong") {
    // Not it: eyes open, a little wince, then a slow, sorry-but-no shake of
    // the head, looking right at you.
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
  } else if (mood === "pc-refuse") {
    // No more tries: a cross breath out, then chin up and turned right away,
    // eyes narrowed, not budging.
    const firm: Partial<Pose> = {
      lid: 0.32,
      lidTilt: 0.5,
      lidCurve: -0.04,
      open: 0.92,
      wide: 1.04,
    };
    keys = [
      [0, { open: 1.12, y: -2, sy: 1.04 }],
      [220, { ...firm, sy: 0.93, sx: 1.06, y: 3 }],
      [600, { ...firm, rot: dir * 11, x: dir * 3.5, y: -3, sy: 1.03, sx: 0.98, lookX: -dir * 0.7, lookY: -0.25, lookMix: 1 }],
      [2900, { ...firm, lid: 0.24, lidTilt: 0.4 }],
      [3200, {}],
    ];
    if (t > 220 && t < 520) {
      const decay = 1 - (t - 220) / 300;
      shakeX = Math.sin(((t - 220) / 1000) * Math.PI * 2 * 12) * 1.4 * decay;
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

/** Whether this game of chess (or other game) goes Mote's way. */
export const chessWin = (seed: number) => (seed * 7.31) % 1 < 0.6;
export const gamingWin = (seed: number) => (seed * 7.31) % 1 < 0.65;
export const minecraftWin = (seed: number) => (seed * 7.31) % 1 < 0.6;

/** When Mote bonks the block while mining it (ms). */
const BONKS = [600, 1100, 1600, 2100];

/** The puff of pixel smoke when the creeper goes off: one square per puff. */
export function boomAt(t: number, seed: number) {
  const dir = seed > 0.5 ? 1 : -1;
  const u = (t - 2300) / 700;
  return Array.from({ length: 10 }, (_, i) => {
    if (minecraftWin(seed) || u < 0 || u > 1) return null;
    const angle = (i / 10) * Math.PI * 2 + (i % 2) * 0.3;
    const reach = (28 + (i % 3) * 10) * (1 - (1 - u) ** 3);
    return {
      x: GEO.cx + dir * 46 + Math.cos(angle) * reach,
      y: 226 + Math.sin(angle) * reach * 0.8 - 10 * u,
      s: 1 + (i % 3) * 0.4 - 0.5 * u,
      o: 1 - u * u,
    };
  });
}

/**
 * The block (or the creeper), `t` ms into a game of Minecraft: where, how
 * big, how see-through, and how cracked (0–3).
 */
export function blockAt(t: number, seed: number) {
  const dir = seed > 0.5 ? 1 : -1;
  const s = popIn(t, MOODS.minecraft.dur);
  if (minecraftWin(seed)) {
    const cracks = BONKS.filter((b) => t >= b + 60).length;
    if (cracks < 4) {
      return { creeper: false, x: GEO.cx + dir * 44, y: 226, rot: 0, s, o: 1, cracks };
    }
    // Popped: a little block that bobs in the air, ready to pick up.
    const u = Math.min(1, (t - BONKS[3] - 60) / 300);
    const bob = Math.sin((t / 1000) * Math.PI * 2 * 0.9) * 3;
    return {
      creeper: false,
      x: GEO.cx + dir * (44 - 10 * u),
      y: 226 - 14 * u + bob,
      rot: Math.sin((t / 1000) * 3) * 12,
      s: s * (1 - 0.4 * u),
      o: 1,
      cracks: 0,
    };
  }
  // A creeper: swells and shudders while it hisses, then explodes.
  const hiss = clamp((t - 900) / 1400, 0, 1);
  const pulse = hiss * (0.06 + 0.06 * Math.sin((t / 1000) * Math.PI * 2 * (3 + 6 * hiss)));
  const boom = clamp((t - 2300) / 260, 0, 1);
  return {
    creeper: true,
    x: GEO.cx + dir * 46 + Math.sin(t / 25) * 1.2 * hiss * (1 - boom),
    y: 226,
    rot: 0,
    s: s * (1 + pulse + boom * 1.2),
    o: 1 - boom,
    cracks: 0,
  };
}

/** Pops a prop in at the start of a mood and out at the end (0..1). */
const popIn = (t: number, dur: number) =>
  Math.min(1, t / 220) * Math.min(1, Math.max(0, (dur - t) / 260));

/** The pawn on the chess board, `t` ms into a game. */
export function pawnAt(t: number, seed: number) {
  const dir = seed > 0.5 ? 1 : -1;
  const s = popIn(t, MOODS.chess.dur);
  const hop = (a: number, b: number) => {
    const u = clamp((t - a) / (b - a), 0, 1);
    return { u: u * u * (3 - 2 * u), lift: Math.sin(Math.PI * u) * 14 };
  };
  if (chessWin(seed)) {
    const m = hop(2000, 2400);
    return { x: GEO.cx + dir * (46 - 18 * m.u), y: 238 - 8 * m.u - m.lift, rot: 0, s };
  }
  const m = hop(1450, 1850);
  // Knocked over: it tips onto its side.
  const fall = clamp((t - 2450) / 220, 0, 1);
  return {
    x: GEO.cx + dir * (46 - 18 * m.u + 6 * fall),
    y: 238 - 8 * m.u - m.lift,
    rot: dir * 90 * fall * fall,
    s,
  };
}

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
function blinkCurve(t: number, slow: boolean) {
  const close = slow ? 170 : 72;
  const hold = slow ? 200 : 40;
  const open = slow ? 420 : 190;
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
export function glintAt(pill: EyeShape["pill"], gazeX: number, gazeY: number) {
  const open = clamp((pill.h - 12) / 22, 0, 1);
  return {
    cx: pill.x + pill.w * 0.31 - gazeX * 3,
    cy: pill.y + Math.min(pill.h * 0.27, pill.w * 0.42) - gazeY * 2,
    r: pill.w * 0.13 * (0.5 + 0.5 * open),
    o: open,
  };
}

/**
 * The reflection's colour: Mote's own (cream, or in dark mode the dark face
 * colour), with the faintest red as they get frustrated and blue as they get
 * low; both together read as a little purple.
 */
export function glintColor(feel: Pick<MindValues, "joy" | "peace">, dark: boolean) {
  const ramp = (n: number) => clamp(n, 0, 1);
  const red = ramp((-feel.joy - 1) / 6) * 0.15;
  const blue = ramp((-feel.peace - 1) / 6) * 0.15;
  const base = dark ? [35, 28, 24] : [255, 241, 228];
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
    eyes: q<SVGGElement>(svg, "eyes"),
    shadow: q<SVGEllipseElement>(svg, "shadow"),
    pillL: q<SVGRectElement>(svg, "pill-l"),
    pillR: q<SVGRectElement>(svg, "pill-r"),
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
    pawn: q<SVGGElement>(svg, "pawn"),
    pad: q<SVGGElement>(svg, "pad"),
    block: q<SVGGElement>(svg, "block"),
    creeper: q<SVGGElement>(svg, "creeper"),
    puffs: Array.from(svg.querySelectorAll<SVGRectElement>('[data-part="boom"] rect')),
    cracks: Array.from(svg.querySelectorAll<SVGPathElement>('[data-part="block"] .crack')),
  };

  const options: EngineOptions = {
    energy: "normal",
    media: null,
    placement: null,
    // Set from Settings (see Companion).
    friendly: false,
    calorieGoal: 0,
    hunger: false,
    sleepNeed: false,
    brows: false,
    mouth: false,
    links: true,
    checkIns: true,
    games: true,
    eyesOnly: false,
    dark: false,
    glint: false,
    moodShape: true,
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

  // Older versions kept a list of watched titles; that's gone, so clear it.
  try {
    localStorage.removeItem("mote.memory");
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

  // The pointer out on the rest of the screen: whipping it around catches
  // Mote's eye for a moment.
  const pointerTrail: Array<{ t: number; d: number }> = [];
  const pointerOut = { dx: 0, dy: 0, has: false, at: Number.NEGATIVE_INFINITY };
  let pointerUntil = Number.NEGATIVE_INFINITY;
  // Typing in another app: Mote looks over at it and finds it intriguing.
  let typingUntil = Number.NEGATIVE_INFINITY;
  const typingSpot = { dx: 0, dy: 0 };
  // Split attention: which of the things going on Mote is looking at.
  let focus: Focus | null = null;
  let focusUntil = 0;
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
  // Without tiredness, Mote naps after 4–7 quiet minutes. With it, only a
  // tired Mote naps: rested, never; a bit tired, after 4–7 quiet minutes;
  // sleepy, after a minute and a half or so.
  const newNapAfter = () => {
    if (!options.sleepNeed) return 4 * 60_000 + Math.random() * 3 * 60_000;
    if (feel.rest > 6) return Number.POSITIVE_INFINITY;
    const base = feel.rest < 3 ? 90_000 : 4 * 60_000;
    return base + Math.random() * base * 0.75;
  };
  let napAfter = newNapAfter();
  let dozeNext = false;
  // Tucked in (or too exhausted to stay up): the yawn becomes sleep even if
  // things aren't quiet.
  let tucked = false;
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
  // You weren't having fun: the toy chest glows for a while.
  let playNudgeUntil = 0;
  const movedSince = { x: 0, y: 0 };
  let pettedSince = false;
  let wanting: { need: string; line: string; at: number } | null = null;
  // You, coming and going: the last time you did anything Mote could notice.
  let lastYou = Number.NEGATIVE_INFINITY;
  // Helping you with files: talking it over, or busy with a job.
  let helping: "busy" | "talking" | null = null;
  let playing: BoardGameState = null;
  // The passcode pad is up: Mote keeps their eyes shut (see `passcode`).
  let asking = false;
  let passcodeInfo: SpeechContext["passcode"] = null;
  let tapAt = -Infinity;
  let recentGameLines: string[] = [];
  // The app just dropped on Mote, and the game being played (and how it went).
  let offered: SpeechContext["offering"] = null;
  // Saved links: the one being talked about, and when Mote next considers
  // bringing one up (and last did).
  let talkingLink: SavedLink | null = null;
  let nextLinkCheck = 3 * 60_000;
  let lastLinkAt = Number.NEGATIVE_INFINITY;
  let nextCalorieCheck = 8_000;
  let lastCalorieAt = Number.NEGATIVE_INFINITY;
  let recentCalorie: string[] = [];
  let game: { name: string; mood: GameMood; won: boolean } | null = null;

  const log = (text: string) => hooks.onEvent?.(text);

  /** In Friendly mode, nothing makes Mote less happy. */
  /** Friendly mode softens anything that would hurt. */
  const kindly = (effects: Effects | undefined) =>
    effects && options.friendly && (effects.joy ?? 0) < 0 ? { ...effects, joy: (effects.joy ?? 0) / 2 } : effects;
  const moveMind = (effects: Effects | undefined) => {
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

  const blinkAt = (at: number, double = false) => {
    blinks.push(at);
    if (double) blinks.push(at + 230);
    lastBlink = at;
  };

  const start = (next: Mood, now: number) => {
    const prev = mood;
    mood = next;
    moodStart = now;
    moodSeed = Math.random();
    if (next !== "settle") lastAct = next;
    svg.dataset.mood = next;
    announce(LABELS[next] ?? null);
    log(`mood → ${next}`);
    nextBlink = Math.max(nextBlink, now + 900);
    if (next === "glance" && Math.random() < 0.4) blinkAt(now + 20);
    if (next === "dizzy") blinkAt(now + 2680, true);
    if (next === "checkin") blinkAt(now + 40);
    if (next === "soothe") blinkAt(now + 900);
    if (next === "tada") blinkAt(now + 1300);
    if (prev === "dizzy") dizzyReadyAt = now + 4000;
    if (prev === "dizzy" && next !== "dizzy") mention("dizzy-over", 0.7);
    if (prev === "purr" && next !== "purr") mention("petted", 0.6);
    if (game && next === game.mood) game.won = gameWon(game.mood, moodSeed);
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
    placement: options.placement,
    media: interest === "media",
    typing: clock < typingUntil,
    games: options.games,
    offering: offered,
    game: game?.name ?? null,
    gameKind: game ? (game.mood === "gaming" ? "game" : game.mood) : null,
    gameWon: game?.won ?? false,
    passcode: passcodeInfo,
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
    if (line.then?.[outcome] === "suggest-play") playNudgeUntil = clock + 3 * 60_000;
    if (line.then?.[outcome] === "play-again" && game) {
      react("play");
      start(game.mood, now);
    }
    if (line.then?.[outcome] === "open-link" && talkingLink) {
      react("link-opened");
      noteOpened(talkingLink.url);
      hooks.onOpenLink?.(talkingLink.url);
      start("delight", now);
    }
    const replies = (options.friendly && line.kindReplies?.[outcome]) || line.replies?.[outcome];
    if (replies?.length) {
      const text = replies[Math.floor(Math.random() * replies.length)];
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
   * What Mote needs most right now, if anything: food, sleep, or some time
   * with you (a game, or a pet). Needs make Mote speak up on their own.
   */
  const currentNeed = (): string | null => {
    if (helping || playing || mood === "sleep" || mood === "doze") return null;
    if (feel.fullness <= 2.5) return "feed-me";
    if (options.sleepNeed && feel.rest <= 1.5) return "tuck-me-in";
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
    // Helping you, Mote keeps their own chatter to themself.
    if (debug.manual || helping || playing || asking || BUSY.includes(mood)) return;
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
      if (clock - lastYou < 2 * 60_000 && Math.random() < 0.3) {
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
      if (clock - lastYou < 2 * 60_000) {
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
    if (wanting && now >= wanting.at && rested(wanting.line, now)) {
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

    if (now >= nextCalorieCheck) {
      nextCalorieCheck = now + 60_000;
      considerCalories(now);
    }
  };

  const aroundNow = () => clock - lastYou < 2 * 60_000;

  const calorieFace = (moodName: CalorieMood) => {
    if (helping === "busy" || GAME_MOODS.includes(mood) || debug.manual) return;
    start(moodName, clock);
  };

  /** A line about food: the words, then a face that holds while they're up. */
  const sayCalorie = (pick: CaloriePick, reaction: string) => {
    recentCalorie = [...recentCalorie, pick.id].slice(-8);
    const book = readBook();
    commitBook({ ...book, lastAsideAt: Date.now() });
    showBubble({
      id: ++bubbleSeq,
      lineId: `cal:${pick.id}`,
      kind: "flavor",
      text: pick.text,
      born: clock,
      ttl: lifetime("flavor", pick.text),
    });
    react(reaction);
    calorieFace(pick.mood);
    log(`says “${pick.text}”`);
  };

  const reactionFor = (moodName: CalorieMood, saved = false) => {
    if (saved) return "calorie-relief";
    if (moodName === "plead") return "calorie-over";
    if (moodName === "worry") return "calorie-worry";
    if (moodName === "reckon") return "calorie-steady";
    return "calorie-sweet";
  };

  /**
   * Now and then, if you've started keeping track: where today stands, a
   * nudge to log, and one real congratulations when a day stays under.
   */
  const considerCalories = (now: number) => {
    const goal = options.calorieGoal;
    if (!(goal > 0)) return;
    const book = readBook();
    if (!book.care) return;
    if (helping || playing || debug.manual) return;
    const around = aroundNow();
    const today = dateKey();
    const hour = new Date().getHours();
    let next = book;
    let dirty = false;

    if (next.praisedMorning !== today) {
      const yKey = addDays(today, -1);
      const y = next.days[yKey];
      // Yesterday already got its goodnight, so the morning doesn't repeat it.
      if (y && y.total > 0 && next.praisedEvening !== yKey) {
        if (!around) return;
        const snap: DaySnap = {
          kind: "morning",
          goal,
          eaten: y.total,
          fill: y.total / goal,
          hour,
          part: partOf(hour),
          streak: streakUnder(next, goal, today),
          over: y.total > goal,
        };
        const line = pickCalorieAside(snap, recentCalorie);
        next = { ...next, praisedMorning: today };
        dirty = true;
        if (line) {
          commitBook(next);
          sayCalorie(line, y.total > goal ? "calorie-worry" : "calorie-sweet");
          return;
        }
      } else if (around) {
        next = { ...next, praisedMorning: today };
        dirty = true;
      } else return;
    }

    if (hour >= 21 && next.praisedEvening !== today) {
      const entry = next.days[today];
      if (entry && entry.total > 0) {
        if (!around) {
          if (dirty) commitBook(next);
          return;
        }
        const snap: DaySnap = {
          kind: "evening",
          goal,
          eaten: entry.total,
          fill: entry.total / goal,
          hour,
          part: partOf(hour),
          streak: streakUnder(next, goal, today) + (entry.total <= goal ? 1 : 0),
          over: entry.total > goal,
        };
        const line = pickCalorieAside(snap, recentCalorie);
        next = { ...next, praisedEvening: today };
        if (line) {
          commitBook(next);
          sayCalorie(line, entry.total > goal ? "calorie-over" : "calorie-sweet");
          return;
        }
        dirty = true;
      }
    }

    if (dirty) commitBook(next);
    if (!around) return;
    if (now - lastCalorieAt < 2 * 60_000) return;
    if (Date.now() - (next.lastAsideAt ?? 0) < 40 * 60_000) return;
    if (Math.random() > 0.12) return;

    const entry = next.days[today];
    const logged = !!entry && entry.total > 0;
    // Asking you to log it happens once a day at most.
    const kind = logged ? "status" : hour >= 11 && next.nudgedOn !== today ? "nudge" : null;
    if (!kind) return;
    if (kind === "nudge") commitBook({ ...next, nudgedOn: today });
    const eaten = entry?.total ?? 0;
    const snap: DaySnap = {
      kind,
      goal,
      eaten,
      fill: eaten / goal,
      hour,
      part: partOf(hour),
      streak: streakUnder(next, goal, today),
      over: eaten > goal,
    };
    const line = pickCalorieAside(snap, recentCalorie);
    if (!line) return;
    sayCalorie(line, kind === "nudge" ? "calorie-aside" : reactionFor(line.mood, false));
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
    if (state) playNudgeUntil = 0;
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
  ) => {
    rouse();
    engage();
    if (face && !debug.manual) start(face as Mood, clock);
    react(reaction);
    if (chance <= 0 || Math.random() > chance) return;
    const said = line();
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

  const checkersEvent = (event: CheckersEvent, level: Level) =>
    gameMoment(`checkers-${event}`, CHECKERS_FACE[event], CHECKERS_CHANCE[event], () =>
      pickCheckersLine(event, level, recentGameLines),
    );

  const chessEvent = (event: ChessEvent, level: Level, words?: { piece?: string; yours?: string }) =>
    gameMoment(`chess-${event}`, CHESS_FACE[event], CHESS_CHANCE[event], () =>
      pickChessLine(event, level, recentGameLines, words),
    );

  const liarsDiceEvent = (event: LiarsDiceEvent, bid?: string) => {
    // Sitting down to play counts as playing together, like starting a board game.
    if (event === "start" || event === "resume") react("game-start");
    gameMoment(`liarsdice-${event}`, LIARSDICE_FACE[event], LIARSDICE_CHANCE[event], () =>
      pickLiarsDiceLine(event, recentGameLines, { bid }),
    );
  };

  const ticTacToeEvent = (event: TicTacToeEvent, level: Level) =>
    gameMoment(`tictactoe-${event}`, TICTACTOE_FACE[event], TICTACTOE_CHANCE[event], () =>
      pickTicTacToeLine(event, level, recentGameLines),
    );

  /** You changed today's calories. */
  const noteCalories = (moment: CalorieMoment) => {
    rouse();
    pendingEvent = null;
    wanting = null;
    lastCalorieAt = clock;
    const pick = pickCalorieReaction(moment, recentCalorie);
    sayCalorie(pick, reactionFor(pick.mood, moment.saved));
  };

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

  /**
   * Helping you with files. Talking it over, Mote looks up at the options;
   * busy, they get on with the job. Either way their own chatter waits, and
   * any bubble of theirs goes away so it doesn't cover the conversation.
   */
  const setHelping = (state: "busy" | "talking" | null) => {
    if (state) rouse();
    if (state === helping) return;
    helping = state;
    engage();
    if (state && bubble) showBubble(null);
    pendingEvent = null;
    wanting = null;
    if (state === "talking" && mood !== "tada" && mood !== "uhoh") start("present", clock);
    else if (state === "busy") start("work", clock);
    else if (mood === "present" || mood === "work") start("settle", clock);
    log(state ? `helping: ${state}` : "done helping");
  };

  /** What Mote would like right now, for a glow on the matching button. */
  const wants = (): Want | null => {
    if (mood === "sleep" || mood === "doze" || helping || playing) return null;
    if (feel.fullness <= 3.5) return "food";
    if (options.sleepNeed && feel.rest <= 2.5) return "sleep";
    if (options.games && (feel.peace <= -2 || clock < playNudgeUntil)) return "play";
    return null;
  };

  /** Something to eat. Full, Mote politely says no. */
  const feedMote = (id: string) => {
    const snack = SNACKS.find((x) => x.id === id);
    if (!snack || !options.hunger || mood === "sleep" || mood === "doze") return;
    engage();
    touch();
    if (feel.fullness >= 9) {
      react("fed-full");
      start("cute", clock);
      sayNow("full");
      return;
    }
    const hungry = feel.fullness <= 3;
    feel = feed(feel, snack.fill);
    react(hungry ? "fed-hungry" : "fed");
    start("munch", clock);
    log(`ate ${snack.name.toLowerCase()}`);
    if (hungry) sayNow("fed-hungry");
    else if (Math.random() < 0.7) sayNow(`fed-${snack.id}`);
  };

  /** Bedtime: tired enough, Mote yawns and drifts off. */
  const tuckIn = () => {
    if (!options.sleepNeed || mood === "sleep" || mood === "doze" || helping || playing) return;
    engage();
    touch();
    if (feel.rest > 7) {
      react("tuck-not-sleepy");
      start("cute", clock);
      sayNow("not-sleepy");
      return;
    }
    react("tucked-in");
    dozeNext = true;
    tucked = true;
    if (Math.random() < 0.6) sayNow("tucked-in");
    start("yawn", clock);
  };

  /** A board game starting: maybe a word about the last one. `opener` is the
   * game's own line to use instead of its usual one (Mote going first). */
  const gameStart = (game: GameName, level: Level, opener?: string) => {
    rouse();
    engage();
    react("game-start");
    const memo = startLine(game, level, { friendly: options.friendly });
    if (!memo) {
      if (game === "checkers") checkersEvent("start", level);
      else if (game === "chess") chessEvent("start", level);
      else ticTacToeEvent((opener as TicTacToeEvent | undefined) ?? "start", level);
      return;
    }
    markMentioned(memo.id);
    gameMoment(`${game}-start`, "delight", 1, () => ({ id: `memory-start-${Date.now()}`, text: memo.text }));
  };

  /** A board game over: remembered, felt, and maybe a word about a streak. */
  const gameOver = (result: GameResult, event: string) => {
    const { memory, effects } = recordGame(result);
    moveMind(effects);
    log(`remembered ${memory.game}: ${memory.winner} won (${memory.margin}${memory.comeback ? ", a comeback" : ""})`);
    const streakSaid = streakLine(result.game, { friendly: options.friendly });
    if (streakSaid) {
      const face = memory.winner === "mote" ? "ck-win" : memory.winner === "you" ? "ck-lose" : "cute";
      gameMoment(`${result.game}-${event}`, face, 1, () => ({ id: `streak-${Date.now()}`, text: streakSaid }));
    } else if (result.game === "checkers") checkersEvent(event as CheckersEvent, result.level);
    else if (result.game === "chess") chessEvent(event as ChessEvent, result.level);
    else ticTacToeEvent(event as TicTacToeEvent, result.level);
  };

  /** Say a particular line right away (a reply to something you just did). */
  const sayNow = (id: string) => {
    const line = lineById.get(id);
    if (!line) return;
    if (bubble) showBubble(null);
    say(line, clock);
  };

  /**
   * Local Gallery's passcode. While the pad is up (from "ask" until it's
   * right, refused or put away) Mote keeps their eyes shut and their chatter
   * to themself; everything else is a moment with a face and a line.
   */
  const passcode = (event: PasscodeEvent, info: PasscodeInfo = {}) => {
    if (event === "digit") {
      tapAt = clock;
      touch();
      return;
    }
    rouse();
    engage();
    passcodeInfo = { triesLeft: info.triesLeft ?? 0, wait: info.wait ?? 0 };
    // A wrong try keeps the pad up; anything else puts it away.
    if (event === "ask") asking = true;
    else if (event !== "wrong") asking = false;
    react(`passcode-${event}`);
    const face = PASSCODE_FACE[event];
    if (face && !debug.manual) start(face, clock);
    else if (mood === "pc-away") start("settle", clock);
    if (!info.quiet) sayNow(`passcode-${event}`);
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
    if (helping === "busy" || GAME_MOODS.includes(mood) || mood === "dizzy") {
      sayNow("busy");
      return;
    }
    if (app.game) {
      const next: GameMood = app.game === "game" ? "gaming" : app.game;
      game = { name: app.name, mood: next, won: false };
      react("play");
      sayNow(next === "gaming" ? "game-start" : `${next}-start`);
      start(next, clock);
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

  /** A job just finished: a happy hop, or a worried look if things went wrong. */
  const jobDone = (ok: boolean) => {
    react(ok ? "job-done" : "job-trouble");
    start(ok ? "tada" : "uhoh", clock);
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
    if (has("sleepy") || has("exhausted")) more("yawn", 3);
    if (has("hungry") || has("starving")) more("fidget", 2);
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
    // Livelier when joyful; slower when low or sleepy.
    const pace = (1 - 0.3 * fl.joyful) * (1 + 0.6 * fl.depressed) * (1 + 0.4 * fl.sleepy);
    // Most of the time Mote just rests; little moods are the exception.
    return (7000 + Math.random() * 9000) * ENERGY_GAP[options.energy] * pace;
  };

  /**
   * Adds up how far something has travelled in the last ~0.7s; going much too
   * far, too fast makes Mote dizzy.
   */
  const shaken = (kind: "pointer" | "window", d: number, limit: number) => {
    const list = shakes[kind];
    const t = performance.now();
    list.push({ t, d });
    while (list.length && t - list[0].t > 700) list.shift();
    const travelled = list.reduce((sum, s) => sum + s.d, 0);
    const calm = mood !== "dizzy" && mood !== "purr" && mood !== "work";
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
  const keepFeelings = () => saveMind(feel);
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
      // Woken up: well rested, bright and breezy; still tired, groggy (and a
      // little put out about it).
      const rested = mood === "sleep" && (!options.sleepNeed || feel.rest >= 6);
      tucked = false;
      dozeNext = false;
      react(rested ? "wake-rested" : "wake-groggy");
      if (mood === "sleep") mention(rested ? "woke-rested" : "woke-groggy", 0.8);
      start("wake", now);
    } else if (helping === "busy") {
      // Busy with a job: a quick happy look up, then back to work.
      react("poke-busy");
      return;
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
    if (mindTick >= 5000) {
      const asleep = mood === "sleep" || mood === "doze";
      const before = feel;
      feel = tickMind(feel, mindTick / 60_000, {
        asleep,
        sinceAttention: (clock - attendedAt) / 60_000,
        youAround: clock - lastYou < 2 * 60_000,
        busyTogether: helping !== null || (playing !== null && playing !== "idle"),
        hour: new Date().getHours(),
        friendly: options.friendly,
      });
      mindTick = 0;
      // Hunger switched off: always full, so it never touches mood or face.
      if (!options.hunger) feel = { ...feel, fullness: 10 };
      // Tiredness switched off: always rested.
      if (!options.sleepNeed) feel = { ...feel, rest: 10 };
      // Getting tired: naps come sooner.
      if (feel.rest < before.rest || napAfter === Number.POSITIVE_INFINITY) {
        napAfter = Math.min(napAfter, newNapAfter());
      }
      // Slept enough: up and about.
      if (options.sleepNeed && mood === "sleep" && feel.rest >= 9.8) {
        react("wake-rested");
        mention("woke-rested", 0.8);
        start("wake", now);
      }
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
      saveMind(feel);
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
    const pointerOutThere = now < pointerUntil;
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

    // Split attention: the newest thing going on gets a look straight away;
    // after that, Mote's eyes move between whatever is still going on.
    const typing = now < typingUntil;
    const candidates: Focus[] = [];
    if (media) candidates.push("media");
    if (pointerOutThere) candidates.push("pointer");
    if (typing) candidates.push("typing");
    if (focus && !candidates.includes(focus)) focus = null;
    const focusWas = focus;
    if (candidates.length && (!focus || now > focusUntil)) {
      const weight = (c: Focus) => (c === "typing" ? 3 : c === "pointer" ? 2 : 2.5);
      const total = candidates.reduce((sum, c) => sum + weight(c), 0);
      let r = Math.random() * total;
      focus = candidates.find((c) => (r -= weight(c)) <= 0) ?? candidates[0];
      focusUntil =
        now + (focus === "pointer" ? 1200 + Math.random() * 1000 : 2500 + Math.random() * 3500);
    }
    // Something new to look at: the eyes go there now, not on the next wander.
    if (focus !== focusWas) wander.next = now;

    // Left be for a while, with nothing going on that's intriguing, Mote
    // yawns and nods off. Only a poke (or something starting to play, or
    // something dropped on them) wakes them.
    const quiet = !interest && !helping && !playing && !typing && !pointerOutThere && !bubble;
    // Exhausted, Mote nods off even with things going on (just not mid-game
    // or mid-job).
    const spent = options.sleepNeed && feel.rest <= 1 && !helping && !playing && now - touchedAt > 60_000;
    if (
      debug.autoMoods &&
      mood === "settle" &&
      ((quiet && now - touchedAt > napAfter) || spent)
    ) {
      react("doze");
      dozeNext = true;
      tucked = spent;
      start("yawn", now);
    }
    const over =
      mood === "settle" || mood === "sleep"
        ? false
        : mood === "purr"
          ? sincePet > PURR_AFTER
          : now >= moodStart + MOODS[mood].dur;
    if (over) {
      // Nodding off: a doze becomes real sleep, unless something happened in
      // the meantime and they catch themself.
      const stillQuiet = (quiet && now - touchedAt > napAfter) || tucked;
      // A tiny chance a check-in turns into something sweet, more when joyful.
      const sweet = 0.03 + 0.12 * feelings(feel).joyful;
      if (debug.loop && mood !== "purr") start(mood, now);
      else if (mood === "yawn" && dozeNext && stillQuiet) start("doze", now);
      else if (mood === "doze" && stillQuiet) {
        tucked = false;
        react("fall-asleep");
        start("sleep", now);
      } else if (mood === "checkin" && Math.random() < sweet) {
        react("check-in-happy");
        start(Math.random() < 0.5 ? "cute" : "delight", now);
      } else if (mood === "doze" || mood === "yawn") {
        // Caught themself nodding off.
        tucked = false;
        start("settle", now);
        nextAct = now + actGap(watchingMedia, you || typing);
      } else if (asking) {
        // Back to not peeking while you type.
        start("pc-away", now);
      } else if (helping) {
        // Back to looking at the options, or to the job.
        start(helping === "busy" ? "work" : "present", now);
      } else if (playing) {
        // Back to the game.
        start(playing === "mote" ? "ck-think" : "ck-watch", now);
      } else {
        start("settle", now);
        nextAct = now + actGap(watchingMedia, you || typing);
      }
      if (mood !== "yawn" && mood !== "doze") dozeNext = false;
    }
    if (debug.autoMoods && mood === "settle" && now >= nextAct) {
      if (watchingMedia) {
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
    } = poseFor(mood, t, moodSeed, {
      sincePet: sincePet < 350 ? -1 : sincePet - 350,
      sinceTap: now - tapAt,
    });
    swirlNow = swirl;
    // Petting a sleeping Mote gets a sleepy little purr without waking them.
    purrNow = mood === "sleep" && sincePet < 350 ? 0.6 : purr;

    // Lasting moods colour the idle face: a scowl when frustrated, a little
    // smile when joyful, a droop when low, heavy lids when sleepy, worried
    // brows when hungry. Moods with their own expression mostly override it.
    const fl = feelings(feel);
    const tone =
      mood === "settle" || mood === "ck-watch" ? 1 : mood === "glance" ? 0.7 : mood === "think" || mood === "checkin" ? 0.5 : 0;
    // (Unless that's switched off: then the eyes rest in their usual shape.)
    if (tone > 0 && options.moodShape) {
      const scowl = fl.frustrated > 0.2 ? 0.2 + 0.06 * fl.frustrated : 0;
      target.lid += (scowl + 0.24 * fl.sleepy + 0.08 * fl.depressed) * tone;
      target.lidTilt += ((scowl ? 0.5 * fl.frustrated : 0) - 0.3 * fl.hungry - 0.22 * fl.depressed) * tone;
      target.lidCurve += 0.08 * fl.sleepy * tone;
      target.open += (0.05 * fl.joyful - 0.06 * fl.depressed - 0.06 * fl.sleepy) * tone;
      target.cheek = Math.max(target.cheek, (0.24 * fl.joyful + 0.1 * fl.satisfied) * tone);
      target.cheekCurve += 0.08 * fl.joyful * tone;
      target.y += 2.5 * fl.depressed * tone;
      target.sy -= 0.03 * fl.depressed * tone;
      if (fl.depressed > 0) {
        target.lookY = lerp(target.lookY, 0.55, fl.depressed * tone);
        target.lookMix = Math.max(target.lookMix, 0.35 * fl.depressed * tone);
      }
    }
    const tempo = mood === "sleep" ? 0.12 : mood === "settle" ? 1 : MOODS[mood].tempo;

    // Something dragged over the window: eyes wide, leaning in, curious.
    if (hovering && ["settle", "glance", "think", "present"].includes(mood)) {
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
    // The pointer is followed wherever it was last seen moving: over Mote's
    // window, or anywhere else on the screen (moving other windows around,
    // say), even when Mote's window isn't the active one.
    const outside = pointerOut.at > (pointer.has ? pointer.at : Number.NEGATIVE_INFINITY);
    if (outside && rect.width > 0) {
      px = clamp(pointerOut.dx / (rect.width * 0.6), -1, 1);
      py = clamp(pointerOut.dy / (rect.height * 0.6), -1, 1);
    } else if (pointer.has && rect.width > 0) {
      px = clamp((pointer.x - (rect.left + rect.width * 0.5)) / (rect.width * 0.6), -1, 1);
      py = clamp((pointer.y - (rect.top + rect.height * 0.5)) / (rect.height * 0.6), -1, 1);
    }
    const fade = (idle: number) => (idle < 2000 ? 1 : clamp(1 - (idle - 2000) / 1000, 0, 1));
    // Attention to you (playing with Mote's window) only comes from the
    // pointer over it; the eyes follow it everywhere.
    const attention = !pointer.has ? 0 : fade(idleFor);
    const seen = outside ? now - pointerOut.at : idleFor;
    const looking =
      (!pointer.has && !pointerOut.has) || mood === "sleep"
        ? 0
        : fade(seen);
    lastAttention = looking;
    think(dt, now, attention, sincePet);
    const toward = (dx: number, dy: number) => ({
      x: clamp(dx / 600, -1, 1),
      y: clamp(dy / 500, -0.8, 0.8),
    });
    if (focus === "pointer") {
      // Following the pointer out on the screen, live.
      const at = toward(pointerOut.dx, pointerOut.dy);
      wander = { ...at, next: now + 200 };
    } else if (focus === "typing") {
      // Watching you type, with small glances around the page.
      if (now > wander.next) {
        const at = toward(typingSpot.dx, typingSpot.dy);
        wander = {
          x: at.x + (Math.random() - 0.5) * 0.12,
          y: at.y + 0.08 + (Math.random() - 0.5) * 0.08,
          next: now + 900 + Math.random() * 1500,
        };
      }
    } else if (now > wander.next) {
      const m = focus === "media" ? lastMedia : null;
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
        const pace = 1 + 0.6 * fl.satisfied + 0.8 * fl.sleepy;
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
    const blinkFree = !["sleep", "wake", "delight", "cute", "dizzy", "purr", "tada"].includes(mood);
    const fb = feelings(feel);
    if (blinkFree && now >= nextBlink) {
      blinkAt(now, Math.random() < 0.16);
      nextBlink = now + (2400 + Math.random() * 3600) * (1 + 0.5 * fb.satisfied);
    }
    const slow = mood === "doze" || fb.satisfied > 0.6 || fb.sleepy > 0.4;
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
      const period = base * (1 + 0.35 * fb.satisfied + 0.3 * fb.sleepy - 0.15 * fb.joyful);
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

  const render = (blink: number) => {
    const m = reduced ? 0.2 : 1;
    // A purr is a soft, fast rumble that skips the springs.
    const rumble = purrNow * Math.sin((clock / 1000) * Math.PI * 2 * 11) * m;
    const bx = (view.x + shake.x * m) * m;
    const by = view.y * m;
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
      parts.shadow.setAttribute("rx", f(GEO.shadowRx * bsx * (1 - lift / 50)));
      parts.shadow.setAttribute("cx", f(GEO.cx + bx * 0.6));
      parts.shadow.style.opacity = (0.1 * (1 - lift / 60)).toFixed(3);
    }

    // Dizzy eyes orbit in opposite directions.
    const spin = (clock / 1000) * 14;
    const orbit = 0.5 * swirlNow;
    const l = eyeShape("l", view, gaze.x, gaze.y, blink, {
      x: Math.cos(spin) * orbit,
      y: Math.sin(spin) * orbit,
    });
    const r = eyeShape("r", view, gaze.x, gaze.y, blink, {
      x: Math.cos(-spin + Math.PI / 2) * orbit,
      y: Math.sin(-spin + Math.PI / 2) * orbit,
    });
    setPill(parts.pillL, l.pill);
    setPill(parts.pillR, r.pill);
    parts.lidL?.setAttribute("d", l.lid);
    parts.lidR?.setAttribute("d", r.lid);
    parts.cheekL?.setAttribute("d", l.cheek);
    parts.cheekR?.setAttribute("d", r.cheek);
    if (parts.brows) parts.brows.style.display = options.brows ? "" : "none";
    if (options.brows) {
      parts.browL?.setAttribute("d", l.brow);
      parts.browR?.setAttribute("d", r.brow);
    }
    if (parts.mouth) parts.mouth.style.display = options.mouth ? "" : "none";
    if (options.mouth) parts.mouth?.setAttribute("d", mouthShape(view, gaze.x, gaze.y));
    if (parts.glints) parts.glints.style.display = options.glint ? "" : "none";
    if (options.glint) {
      parts.glints?.setAttribute("transform", eyeShift);
      const fill = glintColor(feel, options.dark);
      setGlint(parts.glintL, glintAt(l.pill, gaze.x, gaze.y), fill);
      setGlint(parts.glintR, glintAt(r.pill, gaze.x, gaze.y), fill);
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
    place(parts.pawn, mood === "chess" ? pawnAt(at, moodSeed) : null);
    place(parts.pad, mood === "gaming" ? padAt(at, moodSeed) : null);
    const block = mood === "minecraft" ? blockAt(at, moodSeed) : null;
    place(parts.block, block && !block.creeper ? block : null);
    place(parts.creeper, block?.creeper ? block : null);
    if (block && parts.creeper) parts.creeper.style.opacity = f(block.o);
    const puffs = mood === "minecraft" ? boomAt(at, moodSeed) : [];
    parts.puffs.forEach((el, i) => {
      const b = puffs[i];
      el.style.display = b ? "" : "none";
      if (b) {
        el.setAttribute("transform", `translate(${f(b.x)} ${f(b.y)}) scale(${f(b.s)})`);
        el.style.opacity = f(b.o);
      }
    });
    parts.cracks.forEach((el, i) => {
      el.style.display = block && block.cracks > i ? "" : "none";
    });

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
      // Tiredness switched on or off: naps come on a different clock.
      if (before.sleepNeed !== options.sleepNeed) napAfter = newNapAfter();
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
      const low = key === "joy" || key === "peace" ? -10 : 0;
      feel = { ...feel, [key]: clamp(value, low, 10) };
      log(`set ${key} to ${feel[key].toFixed(1)}`);
    },
    feed: feedMote,
    tuckIn,
    openedGallery: (ok) => {
      rouse();
      engage();
      react(ok ? "gallery-opened" : "gallery-missing");
      start(ok ? "delight" : "uhoh", clock);
      if (!ok || Math.random() < 0.6) sayNow(ok ? "gallery-opened" : "gallery-missing");
    },
    passcode,
    gameStart,
    gameOver,
    answer: (yes) => {
      touch();
      if (bubble?.kind === "ask" && !bubble.reply) resolve(yes ? "yes" : "no", clock);
    },
    dismissSpeech: () => {
      if (bubble?.kind === "flavor") resolve("done", clock);
    },
    pointerElsewhere: (dx, dy, inside) => {
      const d = pointerOut.has ? Math.hypot(dx - pointerOut.dx, dy - pointerOut.dy) : 0;
      if (d > 0) noticeYou();
      pointerOut.dx = dx;
      pointerOut.dy = dy;
      pointerOut.has = true;
      // Mote's eyes follow the pointer anywhere on the screen, not just over
      // their own window (see the gaze, in `step`).
      if (d > 0) pointerOut.at = clock;
      if (inside || d === 0 || mood === "sleep") return;
      const t = clock;
      pointerTrail.push({ t, d });
      while (pointerTrail.length && t - pointerTrail[0].t > 800) pointerTrail.shift();
      const travelled = pointerTrail.reduce((sum, p) => sum + p.d, 0);
      // Moving a lot catches Mote's eye for a moment.
      if (travelled > 700) {
        if (clock > pointerUntil) {
          react("pointer-elsewhere");
          focus = "pointer";
          focusUntil = clock + 1200 + Math.random() * 1000;
        }
        pointerUntil = clock + 2500;
      }
    },
    typingAt: (dx, dy) => {
      noticeYou();
      if (mood === "sleep") return;
      if (clock > typingUntil) {
        react("typing");
        focus = "typing";
        focusUntil = clock + 2500 + Math.random() * 2000;
        wander.next = clock;
      }
      typingUntil = clock + 3000;
      typingSpot.dx = dx;
      typingSpot.dy = dy;
    },
    declined: () => {
      rouse();
      engage();
      react("drop-declined");
      start("pc-wrong", clock);
      sayNow("drop-declined");
    },
    dragHover: (over) => {
      hovering = over && helping !== "busy";
    },
    setHelping,
    jobDone,
    offerApp,
    saveLink,
    suggestLink: (url) => {
      if (bubble) showBubble(null);
      suggestLink(clock, url);
    },
    noteCalories,
    setBoardGame,
    checkers: checkersEvent,
    chess: chessEvent,
    tictactoe: ticTacToeEvent,
    liarsDice: liarsDiceEvent,
    say: (lineId) => {
      if (bubble) showBubble(null);
      const line = lineId ? lineById.get(lineId) : chooseLine(speechContext(), new Map(), clock);
      if (line) say(line, clock);
    },
    resetFeelings: () => {
      feel = { ...MIND_START };
      log("mind reset to the start");
    },
    setManual: (face) => {
      debug.manual = face;
    },
    snapshot: () => ({
      mood,
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
        ...(clock < pointerUntil ? (["pointer"] as const) : []),
        ...(clock < typingUntil ? (["typing"] as const) : []),
      ],
      focus,
      speech: bubble,
      need: wanting ? { line: wanting.line, in: Math.max(0, wanting.at - clock) } : null,
      helping,
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
