import type { CalorieMoment, Part } from "../../lib/companion/calories.ts";

// What Mote says about food. Staying under the goal is the good outcome:
// light amounts get a cheerful line, the middle of the day gets plain ones,
// getting close gets a little worried, and going over gets sad. How likely
// each line is depends on how big the bite was, how full the day already is,
// whether it's the first thing logged, and whether a streak is going.

export type CalorieMood = "beam" | "reckon" | "worry" | "plead" | "tada";

export type AsideKind = "status" | "nudge" | "evening" | "morning";

type Range = [number, number];

type When = {
  dir?: "up" | "down";
  kind?: Array<"add" | "sub" | "set">;
  meal?: "first" | "later";
  part?: Part;
  saved?: boolean;
  crossed?: boolean;
  over?: boolean;
  wasOver?: boolean;
  streakMin?: number;
  fill?: Range;
  was?: Range;
  jump?: Range;
};

type CalorieLine = {
  id: string;
  mood: CalorieMood;
  weight: number;
  when: When;
  say: string;
};

type Raw = {
  id: string;
  mood: CalorieMood;
  weight?: number;
  when: When;
  say: string[];
};

const expand = (raw: Raw[]): CalorieLine[] =>
  raw.flatMap((r) =>
    r.say.map((say, i) => ({
      id: `${r.id}-${i}`,
      mood: r.mood,
      weight: r.weight ?? 2,
      when: r.when,
      say,
    })),
  );

const inRange = (n: number, range?: Range) => (range ? n >= range[0] && n <= range[1] : true);

function matches(when: When, m: CalorieMoment): boolean {
  if (when.dir && when.dir !== m.dir) return false;
  if (when.kind && !when.kind.includes(m.kind)) return false;
  if (when.meal === "first" && !m.first) return false;
  if (when.meal === "later" && !m.later) return false;
  if (when.part && when.part !== m.part) return false;
  if (when.saved === true && !m.saved) return false;
  if (when.crossed === true && !m.crossed) return false;
  if (when.over === true && !m.over) return false;
  if (when.over === false && m.over) return false;
  if (when.wasOver === true && !m.wasOver) return false;
  if (when.wasOver === false && m.wasOver) return false;
  if (when.streakMin && m.streak < when.streakMin) return false;
  if (!inRange(m.fill, when.fill)) return false;
  if (!inRange(m.was, when.was)) return false;
  if (!inRange(m.jump, when.jump)) return false;
  return true;
}

const SWEET = new Set<CalorieMood>(["beam", "tada"]);
const ANALYTIC = new Set<CalorieMood>(["reckon"]);
const WORRIED = new Set<CalorieMood>(["worry"]);
const SAD = new Set<CalorieMood>(["plead"]);

function score(line: CalorieLine, m: CalorieMoment, recent: string[]): number {
  if (!matches(line.when, m)) return 0;
  let w = line.weight;
  const sweet = SWEET.has(line.mood);
  if (m.jump < 0.12 && m.fill < 0.5 && m.dir === "up" && sweet) w *= 1.9;
  if (m.jump >= 0.28 && sweet && m.fill < 1) w *= 0.4;
  if (m.fill >= 0.72 && m.fill <= 1 && sweet) w *= 0.22;
  if (m.fill >= 0.5 && m.fill < 0.84 && ANALYTIC.has(line.mood)) w *= 1.35;
  if (m.fill >= 0.88 && m.fill <= 1 && WORRIED.has(line.mood)) w *= 1.8;
  if (m.over && SAD.has(line.mood)) w *= 1 + Math.min(1.2, (m.fill - 1) * 3);
  if (m.over && sweet) w *= 0.05;
  if (m.first && m.part === "morning" && line.when.meal === "first" && line.when.part === "morning") {
    w *= 1.7;
  }
  if (m.bites >= 3 && m.fill < 0.45 && m.jump < 0.12 && sweet && m.dir === "up") w *= 1.45;
  if (m.saved && line.mood === "beam") w *= 1.6;
  if (m.streak >= 3 && m.fill <= 0.85 && !m.over && sweet) w *= 1.35;
  if (m.streak >= 2 && line.when.streakMin) w *= 1.4;
  if ((m.part === "night" || m.part === "evening") && m.fill > 0.6 && m.dir === "up" && WORRIED.has(line.mood)) {
    w *= 1.35;
  }
  if (m.kind === "set" && line.when.kind?.length === 1 && line.when.kind[0] === "set") w *= 1.3;
  if (recent.includes(line.id)) w *= 0.12;
  return w;
}

export function fillIn(
  template: string,
  n: { goal: number; eaten: number; delta: number; streak: number },
): string {
  const num = (x: number) => Math.round(x).toLocaleString();
  return template
    .replaceAll("{left}", num(Math.max(0, n.goal - n.eaten)))
    .replaceAll("{eaten}", num(n.eaten))
    .replaceAll("{delta}", num(Math.abs(n.delta)))
    .replaceAll("{goal}", num(n.goal))
    .replaceAll("{over}", num(Math.max(0, n.eaten - n.goal)))
    .replaceAll("{streak}", String(n.streak));
}

const sayOf = (template: string, m: CalorieMoment) =>
  fillIn(template, { goal: m.goal, eaten: m.after, delta: m.delta, streak: m.streak });

function expandAside(
  raw: Array<{
    id: string;
    mood: CalorieMood;
    kind: AsideKind;
    weight?: number;
    over?: boolean;
    fill?: Range;
    parts?: Part[];
    streakMin?: number;
    say: string[];
  }>,
): Aside[] {
  return raw.flatMap((r) =>
    r.say.map((say, i) => ({
      id: `${r.id}-${i}`,
      mood: r.mood,
      weight: r.weight ?? 2,
      kind: r.kind,
      over: r.over,
      fill: r.fill,
      parts: r.parts,
      streakMin: r.streakMin,
      say,
    })),
  );
}

export const CALORIE_LINES: CalorieLine[] = expand([
  {
    id: "breakfast",
    mood: "beam",
    weight: 3,
    when: { dir: "up", meal: "first", part: "morning", fill: [0, 0.55], jump: [0, 0.22], over: false },
    say: [
      "Breakfast! {delta}. Nice and light.",
      "A light breakfast. Good start.",
      "Morning! {delta} down, {left} to go.",
      "Ooh, breakfast. That’s a gentle start.",
      "Breakfast logged. Lots of day left.",
      "{delta} for breakfast? Easy.",
      "Good morning! Small breakfast, big day ahead.",
      "Breakfast’s in. {left} left for the rest.",
    ],
  },
  {
    id: "first-day",
    mood: "beam",
    weight: 3,
    when: { dir: "up", meal: "first", part: "afternoon", fill: [0, 0.5], jump: [0, 0.22], over: false },
    say: [
      "First one today! {delta}. Nice.",
      "There’s the first one. Light!",
      "{delta} to start. Plenty of room.",
    ],
  },
  {
    id: "later-small",
    mood: "beam",
    weight: 3,
    when: { dir: "up", meal: "later", fill: [0, 0.5], jump: [0, 0.18], over: false },
    say: [
      "Another small one. Nice.",
      "{delta} more. Still light.",
      "{eaten} so far. Easy going.",
      "Little snack? Fine by me.",
      "{left} left. Plenty.",
      "Ooh, a nibble.",
      "Still nice and light today.",
      "Small one! Good.",
      "Noted! {eaten} so far.",
      "That barely counts. (It counts.)",
      "Another little one. You’re pacing it well.",
      "{delta}. Easy.",
    ],
  },
  {
    id: "small-any",
    mood: "beam",
    weight: 2,
    when: { dir: "up", fill: [0, 0.55], jump: [0, 0.2], over: false },
    say: [
      "{delta}, got it. {left} left.",
      "Small one. {eaten} today.",
      "Plenty of room still.",
      "Logged! Still light.",
      "{eaten} so far. Comfy.",
      "Got it. Lots left.",
      "Nice and small.",
      "Easy one.",
    ],
  },
  {
    id: "steady",
    mood: "reckon",
    weight: 3,
    when: { dir: "up", fill: [0.48, 0.84], over: false },
    say: [
      "{eaten} of {goal}. {left} left.",
      "{left} left. Keep the next one smallish?",
      "About halfway. Steady.",
      "{eaten} so far. Still fine.",
      "Okay, {left} left. A snack fits, a feast doesn’t.",
      "Halfway-ish. Let’s keep it steady.",
      "Noted. {left} to go.",
      "On track. {left} left.",
      "{eaten}. A normal day so far.",
      "Still under. Let’s pace the rest.",
      "Got it. {left} left for later.",
      "Fine so far. Let’s keep it that way.",
    ],
  },
  {
    id: "close",
    mood: "worry",
    weight: 3,
    when: { dir: "up", fill: [0.84, 1], over: false },
    say: [
      "{left} left. Getting close…",
      "Ooh, close. Only {left} left.",
      "{left} left. Maybe that’s it for today?",
      "We’re near the line. Small things only.",
      "Careful… {left} left.",
      "Close one! {left} to spare.",
      "That’s most of it. {left} left.",
      "Hmm. {left} left. Let’s not cross it.",
      "Almost at {goal}. Can we stop here?",
      "{left} isn’t much. Tiny things only.",
      "Getting tight. {left} left.",
      "Right up near the line now.",
      "{eaten} of {goal}. Close!",
      "Okay… {left} left. I’m a little nervous.",
    ],
  },
  {
    id: "just-over",
    mood: "plead",
    weight: 3,
    when: { dir: "up", over: true, fill: [1, 1.12] },
    say: [
      "Oh no. {over} over.",
      "That tipped it. {over} over. Can we stop there?",
      "Over by {over}. Call it a day?",
      "Aw. We went over.",
      "{over} over. No more today, okay?",
      "Hmm. Just over. Let’s stop here.",
      "Over the line by {over}. That’s enough for today.",
      "Oops. {over} over. Done for today?",
      "Past {goal}. Let’s leave it there.",
      "That’s over. I’m a little sad.",
      "{over} over. Tomorrow’s a fresh start.",
      "Over… let’s not add more, okay?",
    ],
  },
  {
    id: "far-over",
    mood: "plead",
    weight: 3,
    when: { dir: "up", over: true, fill: [1.12, 20] },
    say: [
      "{over} over. That’s a lot.",
      "{eaten}… that’s way past {goal}. Please stop for today.",
      "Way over. No more today, please.",
      "Oof. {over} over.",
      "That’s a lot over. Let’s be done.",
      "{over} past the goal. I’m drooping.",
      "Way past it. Fresh start tomorrow.",
      "Please, no more today.",
      "{eaten}. Too much. Let’s stop.",
      "I’m sad about this one. {over} over.",
      "Let’s put the food down for today.",
      "Over by {over}. Enough for one day.",
    ],
  },
  {
    id: "big-bite",
    mood: "reckon",
    weight: 3,
    when: { dir: "up", jump: [0.28, 20], fill: [0, 0.84] },
    say: [
      "{delta} in one go! That’s a meal.",
      "Big one. {left} left.",
      "That was a proper meal. {left} left for later.",
      "{delta}, got it. Lighter after this?",
      "A real meal. Let’s keep the rest small.",
      "Big plate! {left} left.",
      "Okay, that’s a meal. {eaten} so far.",
      "{delta}! Good thing that’s logged.",
    ],
  },
  {
    id: "saved",
    mood: "beam",
    weight: 3,
    when: { dir: "down", saved: true },
    say: [
      "Back under! Phew.",
      "Under again. Thank you.",
      "Phew. {left} to spare now.",
      "We’re back under. Yay!",
      "Fixed! Under the line.",
      "Oh good, under again.",
      "Back on the right side. Phew.",
      "Under {goal} again. Much better.",
    ],
  },
  {
    id: "still-over",
    mood: "plead",
    weight: 3,
    when: { dir: "down", over: true, wasOver: true },
    say: [
      "Better. Still {over} over though.",
      "{delta} less. Still over.",
      "That helps. {over} to go.",
      "Down a bit. Still {over} over.",
      "Closer! Still over by {over}.",
      "Thanks. Still over, though.",
    ],
  },
  {
    id: "safer",
    mood: "beam",
    weight: 2.5,
    when: { dir: "down", wasOver: false, over: false, fill: [0.4, 1] },
    say: [
      "{delta} off. {left} left now.",
      "Less! Good.",
      "Taken off. {eaten} now.",
      "More room now. {left} left.",
      "Down to {eaten}. Nice.",
      "Fixed it. {left} left.",
      "Ooh, going down. I like that direction.",
      "{delta} back. Got it.",
    ],
  },
  {
    id: "low-sub",
    mood: "beam",
    weight: 2.5,
    when: { dir: "down", wasOver: false, fill: [0, 0.45] },
    say: [
      "Down to {eaten}. Got it.",
      "Even lighter. Nice.",
      "{delta} off. Fixed.",
      "Corrected! {eaten} now.",
      "Got it, {eaten}.",
      "Less is fine by me.",
    ],
  },
  {
    id: "set-under",
    mood: "reckon",
    weight: 1.6,
    when: { kind: ["set"], dir: "up", over: false, fill: [0.45, 1] },
    say: [
      "Okay, {eaten} today. {left} left.",
      "Total’s {eaten} now. Got it.",
      "Set to {eaten}. {left} left.",
      "{eaten} it is.",
    ],
  },
  {
    id: "set-low",
    mood: "beam",
    weight: 1.6,
    when: { kind: ["set"], dir: "up", over: false, fill: [0, 0.45] },
    say: [
      "{eaten} today. Lots of room.",
      "Set to {eaten}. Nice and light.",
    ],
  },
  {
    id: "set-over",
    mood: "plead",
    weight: 2,
    when: { kind: ["set"], dir: "up", over: true },
    say: [
      "{eaten}. That’s {over} over.",
      "Set to {eaten}. Over, so let’s stop there.",
    ],
  },
  {
    id: "set-down",
    mood: "beam",
    weight: 1.8,
    when: { kind: ["set"], dir: "down", over: false },
    say: [
      "Down to {eaten}. Got it.",
      "Fixed. {eaten} now.",
    ],
  },
  {
    id: "streak",
    mood: "beam",
    weight: 2.6,
    when: { dir: "up", streakMin: 2, fill: [0, 0.8], over: false },
    say: [
      "{streak} days under in a row! Keep it going.",
      "A {streak}-day streak, and today’s looking good.",
      "Streak’s at {streak}. Today’s on track.",
      "{streak} days in a row! Nice.",
      "Still on the streak. {left} left today.",
      "{streak} good days so far. Let’s make it one more.",
    ],
  },
  {
    id: "late",
    mood: "worry",
    weight: 2.4,
    when: { dir: "up", part: "night", fill: [0.55, 1], over: false },
    say: [
      "Late snack? {left} left.",
      "It’s late. Maybe that’s the last one?",
    ],
  },
  {
    id: "late-eve",
    mood: "worry",
    weight: 2.2,
    when: { dir: "up", part: "evening", fill: [0.7, 1], over: false },
    say: [
      "Evening, {eaten} so far. Light from here?",
      "{left} left for the evening. Keep it small?",
    ],
  },
]);

export type CaloriePick = { id: string; mood: CalorieMood; text: string };

function fallback(m: CalorieMoment): CaloriePick {
  const pick = (id: string, mood: CalorieMood, text: string) => ({ id, mood, text: sayOf(text, m) });
  if (m.saved) return pick("fallback-saved", "beam", "Back under. Phew.");
  if (m.over && m.dir === "down") return pick("fallback-still", "plead", "Still {over} over.");
  if (m.over) return pick("fallback-over", "plead", "{over} over. Let’s stop there.");
  if (m.dir === "down") return pick("fallback-down", "beam", "Down to {eaten}. Got it.");
  if (m.fill > 0.84) return pick("fallback-close", "worry", "{left} left. Careful.");
  if (m.fill > 0.5) return pick("fallback-mid", "reckon", "{eaten} of {goal}. {left} left.");
  return pick("fallback-sweet", "beam", "{eaten} so far. {left} left.");
}

export function rankCalorieLines(m: CalorieMoment, recent: string[] = []) {
  return CALORIE_LINES.map((line) => ({ id: line.id, mood: line.mood, weight: score(line, m, recent) }))
    .filter((line) => line.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

export function pickCalorieReaction(
  m: CalorieMoment,
  recent: string[] = [],
  rand: () => number = Math.random,
): CaloriePick {
  const ranked = CALORIE_LINES.map((line) => ({ line, weight: score(line, m, recent) })).filter(
    (row) => row.weight > 0,
  );
  if (!ranked.length) return fallback(m);
  const total = ranked.reduce((sum, row) => sum + row.weight, 0);
  let r = rand() * total;
  for (const row of ranked) {
    r -= row.weight;
    if (r <= 0) return { id: row.line.id, mood: row.line.mood, text: sayOf(row.line.say, m) };
  }
  const last = ranked[ranked.length - 1]!;
  return { id: last.line.id, mood: last.line.mood, text: sayOf(last.line.say, m) };
}

export type DaySnap = {
  kind: AsideKind;
  goal: number;
  eaten: number;
  fill: number;
  hour: number;
  part: Part;
  streak: number;
  over: boolean;
};

type Aside = {
  id: string;
  mood: CalorieMood;
  weight: number;
  kind: AsideKind;
  over?: boolean;
  fill?: Range;
  parts?: Part[];
  streakMin?: number;
  say: string;
};

const ASIDES: Aside[] = expandAside([
  {
    id: "status-low",
    mood: "beam",
    kind: "status",
    over: false,
    fill: [0, 0.5],
    say: [
      "{eaten} so far today. Nice and light.",
      "Quick update: {left} left.",
      "Light day so far. Just saying.",
      "{eaten} today. Lots of room.",
      "Doing well today. {left} left.",
    ],
  },
  {
    id: "status-mid",
    mood: "reckon",
    kind: "status",
    over: false,
    fill: [0.45, 0.84],
    say: [
      "{eaten} of {goal} so far.",
      "{left} left today. Pace it.",
      "Halfway-ish. {left} left.",
      "Just so you know: {left} left.",
    ],
  },
  {
    id: "status-close",
    mood: "worry",
    kind: "status",
    over: false,
    fill: [0.84, 1],
    say: [
      "{left} left today. Not much.",
      "Close to the line today. {left} left.",
      "Just {left} left. Careful.",
      "Nearly at {goal}. Small things only.",
    ],
  },
  {
    id: "status-over",
    mood: "plead",
    kind: "status",
    over: true,
    say: [
      "Still {over} over today. No more, okay?",
      "Today’s over the line. Let’s leave it.",
      "{over} over today. Tomorrow’s fresh.",
      "We’re over for today. That’s enough.",
    ],
  },
  {
    id: "nudge-day",
    mood: "reckon",
    kind: "nudge",
    parts: ["afternoon"],
    say: [
      "Eaten anything yet? Tell me!",
      "Nothing logged today. The carrot’s right there when you have.",
      "Hungry? Or did you forget to tell me?",
      "No calories logged yet today.",
      "What’s today looking like? Click the carrot and tell me.",
    ],
  },
  {
    id: "nudge-late",
    mood: "worry",
    kind: "nudge",
    parts: ["evening", "night"],
    say: [
      "Nothing logged today. What did you eat?",
      "Day’s almost over and I’ve got nothing. Log it?",
      "Did today go under? Log it so I know.",
      "No calories today yet. Did you forget?",
    ],
  },
  {
    id: "eve-under",
    mood: "tada",
    kind: "evening",
    over: false,
    say: [
      "Day’s nearly done and you’re under! Nice.",
      "{eaten} of {goal}. Good day!",
      "Under all day. Well done.",
      "That’s a day under the goal!",
      "{left} to spare tonight. Nice work.",
      "Under {goal} today. Yay!",
      "Good day! {eaten} total.",
      "Nearly bedtime, and still under. Nice.",
    ],
  },
  {
    id: "eve-streak",
    mood: "tada",
    kind: "evening",
    over: false,
    streakMin: 2,
    say: [
      "{streak} days under in a row!",
      "That’s {streak} days running. Yay!",
    ],
  },
  {
    id: "eve-over",
    mood: "plead",
    kind: "evening",
    over: true,
    say: [
      "Today went over. Tomorrow’s a fresh start.",
      "{over} over today. That’s okay. New day tomorrow.",
      "Over today. Let’s try again tomorrow.",
      "Today’s done. Tomorrow we start fresh.",
    ],
  },
  {
    id: "morn-under",
    mood: "beam",
    kind: "morning",
    over: false,
    parts: ["morning"],
    say: [
      "Morning! You stayed under yesterday.",
      "Good morning! Yesterday was a good one.",
      "Yesterday: {eaten}, under {goal}. Nice.",
      "Morning! Yesterday went well.",
      "You were under yesterday! Good start.",
      "Hi! Yesterday ended under. Nice.",
    ],
  },
  {
    id: "later-under",
    mood: "beam",
    kind: "morning",
    over: false,
    say: [
      "Oh, yesterday went well. Under!",
      "Forgot to say: yesterday was under. Nice.",
      "Yesterday came in under {goal}. Nice.",
    ],
  },
  {
    id: "morn-over",
    mood: "worry",
    kind: "morning",
    over: true,
    say: [
      "Yesterday went over. Fresh start today.",
      "New day! Yesterday’s done.",
      "Yesterday was {over} over. Today’s a clean slate.",
      "Yesterday went over. Today we try again.",
    ],
  },
]);

function asideFits(line: Aside, snap: DaySnap): boolean {
  if (line.kind !== snap.kind) return false;
  if (line.over === true && !snap.over) return false;
  if (line.over === false && snap.over) return false;
  if (line.parts && !line.parts.includes(snap.part)) return false;
  if (line.streakMin && snap.streak < line.streakMin) return false;
  if (!inRange(snap.fill, line.fill)) return false;
  return true;
}

function asideScore(line: Aside, snap: DaySnap, recent: string[]): number {
  if (!asideFits(line, snap)) return 0;
  let w = line.weight;
  if (line.parts?.includes("morning") && snap.part === "morning") w *= 1.8;
  if (line.streakMin && snap.streak >= 3) w *= 1.5;
  if (recent.includes(line.id)) w *= 0.15;
  return w;
}

const asideText = (template: string, snap: DaySnap) =>
  fillIn(template, { goal: snap.goal, eaten: snap.eaten, delta: 0, streak: snap.streak });

export function pickCalorieAside(
  snap: DaySnap,
  recent: string[] = [],
  rand: () => number = Math.random,
): CaloriePick | null {
  const ranked = ASIDES.map((line) => ({ line, weight: asideScore(line, snap, recent) })).filter(
    (row) => row.weight > 0,
  );
  if (!ranked.length) return null;
  const total = ranked.reduce((sum, row) => sum + row.weight, 0);
  let r = rand() * total;
  for (const row of ranked) {
    r -= row.weight;
    if (r <= 0) return { id: row.line.id, mood: row.line.mood, text: asideText(row.line.say, snap) };
  }
  const last = ranked[ranked.length - 1]!;
  return { id: last.line.id, mood: last.line.mood, text: asideText(last.line.say, snap) };
}

export const CALORIE_SPEECH_COUNT = CALORIE_LINES.length + ASIDES.length;
