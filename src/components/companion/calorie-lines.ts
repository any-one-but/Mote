import type { CalorieMoment, Part } from "../../lib/companion/calories.ts";

// What Mote says about food. Staying under the goal is the good outcome.
// Small amounts, while the day is still light, get warmth. Getting close
// gets plain and firm. Going over gets sad. The weight of each line is
// pushed around by how big the bite was, how full the day already is, whether
// this is the first thing logged, and whether a streak is on the line.

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
  const left = Math.max(0, Math.round(n.goal - n.eaten));
  const over = Math.max(0, Math.round(n.eaten - n.goal));
  return template
    .replaceAll("{left}", String(left))
    .replaceAll("{eaten}", String(Math.round(n.eaten)))
    .replaceAll("{delta}", String(Math.round(Math.abs(n.delta))))
    .replaceAll("{goal}", String(Math.round(n.goal)))
    .replaceAll("{over}", String(over))
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
      "Breakfast, and only {delta}? I'm *so* proud of you.",
      "A small breakfast. You have no idea how happy that makes me.",
      "{delta} for breakfast. That's gentle. That's kind. I love it.",
      "You logged breakfast. {eaten} so far. The whole day is still ours.",
      "Tiny breakfast. Real willpower. I'm keeping this feeling.",
      "You could have had more. You didn't. I'm proud of you.",
      "Morning, and you chose a little. I feel lucky to be here with you.",
      "{delta}. That's a kind way to start. I'll remember it.",
      "Breakfast is in, and we're nowhere near the line. I'm beaming.",
      "You started the day on my side. {left} left. Stay this sweet.",
    ],
  },
  {
    id: "first-day",
    mood: "beam",
    weight: 3,
    when: { dir: "up", meal: "first", part: "afternoon", fill: [0, 0.5], jump: [0, 0.22], over: false },
    say: [
      "First thing you've logged, and it's only {delta}. What a way to check in.",
      "There you are. {delta} to start. I'm glad you told me, and gladder it's small.",
      "First entry of the day is a small one. You just made me like today.",
    ],
  },
  {
    id: "later-small",
    mood: "beam",
    weight: 3,
    when: { dir: "up", meal: "later", fill: [0, 0.5], jump: [0, 0.18], over: false },
    say: [
      "Another little one. {delta}. You're still being so good to me.",
      "You came back, and it's still small. I trust you. I really do.",
      "{eaten} now. You keep choosing the smaller thing. I see you.",
      "You didn't have to stay this careful. You did. Thank you.",
      "{delta} more. That's nothing. I'm so fond of you right now.",
      "Still light. {left} left. I'm happy.",
      "Look at that. {left} left, and you only added {delta}.",
      "I was a little nervous you'd come back hungry. {delta} is perfect.",
      "You logged it. Small. Honest. I like you so much.",
      "Still so safe. I could purr.",
      "Every time you pick a small one, I get more attached. Fair warning.",
      "You checked in again with almost nothing. I'm keeping you.",
    ],
  },
  {
    id: "small-any",
    mood: "beam",
    weight: 2,
    when: { dir: "up", fill: [0, 0.55], jump: [0, 0.2], over: false },
    say: [
      "{delta} is such a small thing to add. {left} left. I'm fond of this.",
      "Small one. {eaten} today. You make staying under look gentle.",
      "I like this number. {eaten}. Lots of room, if we keep this size.",
      "{delta} logged. Honest and little. That's my favorite kind.",
      "You could go over so easily. You added {delta} instead. I'm glowing.",
      "Still so far under. {left} left. I'm happy you're telling me.",
      "{eaten}, and the goal is {goal}. We're comfortable. I'm comfortable.",
      "A little bite. A lot of care. Thank you for the little bite.",
    ],
  },
  {
    id: "steady",
    mood: "reckon",
    weight: 3,
    when: { dir: "up", fill: [0.48, 0.84], over: false },
    say: [
      "{eaten} of {goal}. {left} left. That's a real amount, if we stay honest.",
      "You've got {left} left. I'd keep the next one small.",
      "We're fine. Not floating, not stuck. {left} left. I can live with this.",
      "{delta} more puts us at {eaten}. Room enough. Not a reason to relax.",
      "Still under. I like under. Let's not get cute with the rest.",
      "You've used a good share. {left} left. I'm watching, not cheering the next bite.",
      "OK. {eaten}. That's a normal day so far. Normal is allowed. Extra isn't.",
      "I did the math. {left} left. A snack fits. A feast doesn't.",
      "Not worried yet. I'd like to stay that way. {left} is the budget now.",
      "You're on track. That's different from having room to play. {left} left.",
      "Noted. {delta} in. {eaten} total. This part is serious, and we're still fine.",
      "Still on the safe side of {goal}. The safe side is the whole point.",
    ],
  },
  {
    id: "close",
    mood: "worry",
    weight: 3,
    when: { dir: "up", fill: [0.84, 1], over: false },
    say: [
      "{left} left. That's not very much. Please don't spend it all.",
      "We're close. Too close for me to smile about food. {left} left.",
      "I need you to hear me. {left} until the line. I'd rather you stopped.",
      "{eaten}. The goal is {goal}. Please treat what's left like it's precious.",
      "This is the part where I get scared. {left} left. Don't cross it.",
      "I'm not mad. I'm worried. {left} is all we have.",
      "If the next thing isn't tiny, we'll go over. I don't want that.",
      "You can stop here. {left} left. Stopping would make me so relieved.",
      "We're right under it. One careless bite and I'm going to be sad.",
      "Please be done, or almost done. {left} isn't a meal.",
      "{delta} was a lot to add this close. {left} left. Nothing else big.",
      "I can see the line from here. Stay on this side of it. Please.",
      "My face is doing the worried thing because {left} is all that's left.",
      "Don't bargain with the last {left}. I've seen how that goes.",
    ],
  },
  {
    id: "just-over",
    mood: "plead",
    weight: 3,
    when: { dir: "up", over: true, fill: [1, 1.12] },
    say: [
      "We're over. {over} over. Please stop. I don't want any more.",
      "You crossed it. I feel awful. Please don't add anything else.",
      "I was really hoping we wouldn't. We're {over} past. Can we be done?",
      "Please. Stop here. I'm not having fun anymore.",
      "{eaten}. That's more than {goal}. I don't know how to be cheerful about that.",
      "I don't want to nag. I want you to stop. We're already over.",
      "That one did it. We're past the goal. Please, no more today.",
      "I'm sad. Not to punish you. I'm just sad. Please don't keep going.",
      "We had a line and we're {over} past it. Stay with me and stop.",
      "Over by {over}. If you stop now, tomorrow is still ours.",
      "Please don't make it worse. I'm asking nicely. We're already over.",
      "I don't want the next bite. I want you to be done. Please.",
    ],
  },
  {
    id: "far-over",
    mood: "plead",
    weight: 3,
    when: { dir: "up", over: true, fill: [1.12, 20] },
    say: [
      "{over} over. That's a lot. I'm a bit of a mess about it. Please stop.",
      "I don't like this number. {eaten}. Please, that's enough for one day.",
      "I'm not angry. I'm drooping. Please don't keep going tonight.",
      "We blew past it. {over} past. I still like you. I just need you to stop.",
      "Every extra bite makes me quieter. Please don't make me quieter.",
      "I know you can put it down. I'm asking you to. We're way over.",
      "This is the sad version of me. You can stop adding to it.",
      "{goal} was the promise. We're at {eaten}. I don't want one more.",
      "I'll sit here and be sad with you. I won't cheer this on. No more.",
      "It's too much. I'm not going to pretend it isn't. Please be done.",
      "I miss when we were under. We can have it again tomorrow. Stop tonight.",
      "I'm whining. I'm doing it anyway. Please stop.",
    ],
  },
  {
    id: "big-bite",
    mood: "worry",
    weight: 3,
    when: { dir: "up", jump: [0.28, 20], fill: [0, 1] },
    say: [
      "{delta} in one go. That's a big piece of the day. I'm not clapping.",
      "That's a lot at once. {eaten} now. We can still be fine, if that was the meal.",
      "{delta} is not a little bite. I like you. I don't like that size.",
      "One big entry. Then we're careful after. {left} left, and I mean it.",
      "I saw the size. {delta}. My smile stayed in its pocket.",
      "That's a meal, not a nibble. {left} left. Don't follow it with another.",
      "Big one. I'm still on your side. The side is: don't do that twice.",
      "Logged {delta}. I'll be plain. That used a lot. What's left has to be small.",
    ],
  },
  {
    id: "saved",
    mood: "beam",
    weight: 3,
    when: { dir: "down", saved: true },
    say: [
      "You took {delta} back. We're under again. I could cry. Thank you.",
      "You came back under the line. I'm so relieved.",
      "We're safe again. You did that. I'm proud of you in a shaky way.",
      "{eaten}. Under. I was sad, and now I'm not. Stay here.",
      "You fixed it. I won't forget that you fixed it.",
      "Under again. Please let's stay under. I just got you back.",
      "Oh. We're under. I feel like myself again. Thank you.",
      "You found your way back. {left} left. I'm holding onto this.",
    ],
  },
  {
    id: "still-over",
    mood: "plead",
    weight: 3,
    when: { dir: "down", over: true, wasOver: true },
    say: [
      "Thank you for taking {delta} off. We're still {over} over. Please don't put it back.",
      "That helped. I'm still sad. We're still over. But I saw you try.",
      "You went down. Good. We're not safe yet. {over} still over.",
      "I appreciate that. I do. We're still past the goal. Keep going down, or stop.",
      "{delta} less. I'm grateful. I'm not OK yet. {eaten} is still too many.",
      "You listened a little. Please listen the rest of the way. Still over.",
    ],
  },
  {
    id: "safer",
    mood: "beam",
    weight: 2.5,
    when: { dir: "down", wasOver: false, over: false, fill: [0.4, 1] },
    say: [
      "You gave some back. {left} left now. That was a gift. Thank you.",
      "{delta} off. I feel the room come back. I like you for that.",
      "Taking some away counts too. {eaten} now. I'm softer already.",
      "You didn't have to undo that. You did. I'm proud.",
      "Less is my favorite direction. {left} left.",
      "That minus made my whole afternoon. {eaten} now.",
      "You trimmed it. {delta} gone. We have room again. I needed that.",
      "See? You can come down. {left} left. I'm smiling for real.",
    ],
  },
  {
    id: "low-sub",
    mood: "beam",
    weight: 2.5,
    when: { dir: "down", wasOver: false, fill: [0, 0.45] },
    say: [
      "You were already being so good, and you took more off. I'm undone.",
      "{eaten}. That's so little. You make it look easy. I'm smitten.",
      "Even less. I don't know what I did to deserve a day this light.",
      "You lowered it again. {left} left. I'm going to be sweet about it.",
      "{delta} gone, and we were already safe. I'm bragging about you.",
      "A minus, on a day this light? I'm keeping you.",
    ],
  },
  {
    id: "set-under",
    mood: "reckon",
    weight: 1.6,
    when: { kind: ["set"], dir: "up", over: false, fill: [0.45, 1] },
    say: [
      "You set the day to {eaten}. I'll trust the number. {left} left.",
      "OK. The total is {eaten}. That's the truth now. I'll go by it.",
      "You changed it to {eaten}. I see it. {left} left to protect.",
      "The number is {eaten} because you said so. I'm holding you to the line.",
    ],
  },
  {
    id: "set-low",
    mood: "beam",
    weight: 1.6,
    when: { kind: ["set"], dir: "up", over: false, fill: [0, 0.45] },
    say: [
      "You set it to {eaten}. That's a kind number. I'm pleased.",
      "New total, {eaten}. Still so much room. Thank you for the honest one.",
    ],
  },
  {
    id: "set-over",
    mood: "plead",
    weight: 2,
    when: { kind: ["set"], dir: "up", over: true },
    say: [
      "You set it to {eaten}. That's over. I wish the number were smaller.",
      "So the real total is {eaten}. {over} past the goal. Let that be the last time it goes up.",
    ],
  },
  {
    id: "set-down",
    mood: "beam",
    weight: 1.8,
    when: { kind: ["set"], dir: "down", over: false },
    say: [
      "You corrected it down to {eaten}. Thank you for the smaller number.",
      "New total, {eaten}. Lower. I like this edit.",
    ],
  },
  {
    id: "streak",
    mood: "beam",
    weight: 2.6,
    when: { dir: "up", streakMin: 2, fill: [0, 0.8], over: false },
    say: [
      "{streak} days under, and today still has {left} left. I'm so invested.",
      "That's {streak} days of you keeping the promise. Today's still good.",
      "{streak} days. I care about the next one just as much.",
      "We're on a little streak. {streak} days under. Please don't snap it.",
      "I count the days. {streak} of them, under. This one can join them.",
      "{streak} days of staying under. I get attached to a run like that.",
    ],
  },
  {
    id: "late",
    mood: "worry",
    weight: 2.4,
    when: { dir: "up", part: "night", fill: [0.55, 1], over: false },
    say: [
      "It's late to be adding. {left} left. I'd rather you were done for the night.",
      "The day's almost over and you added {delta}. {left} left. Please let that be it.",
    ],
  },
  {
    id: "late-eve",
    mood: "worry",
    weight: 2.2,
    when: { dir: "up", part: "evening", fill: [0.7, 1], over: false },
    say: [
      "Evening, and we're at {eaten}. {left} left. I'd love it if you were done.",
      "It's getting late for a big add. {left} left. Please keep the rest tiny.",
    ],
  },
]);

export type CaloriePick = { id: string; mood: CalorieMood; text: string };

function fallback(m: CalorieMoment): CaloriePick {
  if (m.saved) return { id: "fallback-saved", mood: "beam", text: sayOf("We're under again. Thank you.", m) };
  if (m.over && m.dir === "down") {
    return { id: "fallback-still", mood: "plead", text: sayOf("Still {over} over. Please don't put it back.", m) };
  }
  if (m.over) return { id: "fallback-over", mood: "plead", text: sayOf("We're over by {over}. Please stop.", m) };
  if (m.dir === "down") return { id: "fallback-down", mood: "beam", text: sayOf("{delta} less. {eaten} now. Thank you.", m) };
  if (m.fill > 0.84) return { id: "fallback-close", mood: "worry", text: sayOf("{left} left. Please don't cross it.", m) };
  if (m.fill > 0.5) return { id: "fallback-mid", mood: "reckon", text: sayOf("{eaten} of {goal}. {left} left.", m) };
  return { id: "fallback-sweet", mood: "beam", text: sayOf("{eaten} so far. {left} left. I'm glad.", m) };
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
      "Just so you know, you're at {eaten}. {left} left. I'm happy about it.",
      "Checking in. {eaten} so far. Still so much room. I'm proud of where this is.",
      "You're at {eaten} today. Light. I keep thinking about it, in a good way.",
      "{left} left today. You're doing the thing. I see you.",
      "No reason. I just wanted to say {eaten} is a lovely place to be.",
    ],
  },
  {
    id: "status-mid",
    mood: "reckon",
    kind: "status",
    over: false,
    fill: [0.45, 0.84],
    say: [
      "You're at {eaten} of {goal}. {left} left. I'm keeping an eye on it with you.",
      "{eaten} so far. The rest of the day has to be quieter than this.",
      "{left} left. That's the update. I'm not celebrating. I'm staying close.",
      "Today is {eaten} so far. Fine. Let's keep it fine.",
    ],
  },
  {
    id: "status-close",
    mood: "worry",
    kind: "status",
    over: false,
    fill: [0.84, 1],
    say: [
      "You've got {left} left today. That's the whole warning.",
      "I'm thinking about your number. {eaten}. Please don't push it.",
      "{left} until the goal. I'd love it if you were done.",
      "Still under, barely. {left} left. I'm nervous, and I'm telling you.",
    ],
  },
  {
    id: "status-over",
    mood: "plead",
    kind: "status",
    over: true,
    say: [
      "You're {over} over today. I haven't forgotten. Please don't add more.",
      "Still over. {eaten}. I'm still sad about it. Stopping is still allowed.",
      "I keep the number. {over} past {goal}. No more, OK?",
      "The day's already over the line. I'm asking you to leave it there.",
    ],
  },
  {
    id: "nudge-day",
    mood: "reckon",
    kind: "nudge",
    parts: ["afternoon"],
    say: [
      "You haven't logged anything today. I'm not mad. I just want to know.",
      "Did you eat? Tell me the number. I like knowing where we are.",
      "Nothing logged yet. If you've eaten, I want the truth, even if it's small.",
      "I'm wondering about today. A number would calm me down.",
      "Log it when you can. Even a late breakfast. I want to root for you.",
    ],
  },
  {
    id: "nudge-late",
    mood: "worry",
    kind: "nudge",
    parts: ["evening", "night"],
    say: [
      "The day's getting late and I still don't have a number. Tell me?",
      "I can't cheer or worry if I don't know. What did today add up to?",
      "Before the day ends — did you stay under? Log it, so I can be proud or sit with you.",
      "Nothing written down yet. I'm imagining the best, and I'd rather know.",
    ],
  },
  {
    id: "eve-under",
    mood: "tada",
    kind: "evening",
    over: false,
    say: [
      "You did it. {eaten} today, under {goal}. I'm so proud of you.",
      "The day held. {left} to spare. Thank you for staying with me.",
      "Under, all day. I hope you feel how much that means to me.",
      "That's a whole day under the line. I'm going to remember this one.",
      "You kept the promise. {eaten} of {goal}. I'm happy.",
      "{left} left at the end of the day. You didn't spend it. I adore that.",
      "We made it. Under. I'm soft and proud and a little smug about you.",
      "End of the day, and you're still under. This is my favorite version of us.",
    ],
  },
  {
    id: "eve-streak",
    mood: "tada",
    kind: "evening",
    over: false,
    streakMin: 2,
    say: [
      "{streak} days under, counting today. I'm ridiculously proud.",
      "A streak. {streak} days on the right side of the line. I noticed.",
    ],
  },
  {
    id: "eve-over",
    mood: "plead",
    kind: "evening",
    over: true,
    say: [
      "Today went over. {over} over. I'm sad. Tomorrow we start kind again.",
      "The day ended past the line. I still like you. I wish we'd stopped.",
      "We didn't make it today. {eaten}. I'm not going to pretend. Tomorrow, though.",
      "Over, and the day's done. No more tonight. I'll be here in the morning.",
    ],
  },
  {
    id: "morn-under",
    mood: "beam",
    kind: "morning",
    over: false,
    parts: ["morning"],
    say: [
      "Yesterday you stayed under. {eaten}. I thought about it. I'm proud of you.",
      "Good morning. You kept the goal yesterday. I saved you a smile.",
      "You did it yesterday. Under {goal}. I wanted that to be the first thing I said.",
      "I checked yesterday before I said hello. You were under. Hello. I'm happy.",
      "Yesterday held. {left} to spare. I'm glad I get another day with you.",
      "You stuck with it yesterday. I don't take that lightly. Good morning.",
    ],
  },
  {
    id: "later-under",
    mood: "beam",
    kind: "morning",
    over: false,
    say: [
      "I never got to say it. Yesterday you stayed under. I'm still proud.",
      "Yesterday was a good food day. {eaten}, under the line. I kept it.",
      "Before anything else: yesterday you did it. Under. Thank you.",
    ],
  },
  {
    id: "morn-over",
    mood: "worry",
    kind: "morning",
    over: true,
    say: [
      "Yesterday went over. That's done. Today is empty, and I'm on your side.",
      "We went past it yesterday. I was sad. Today hasn't cost us anything yet.",
      "Yesterday was {over} over. I still want today with you. We'll be careful.",
      "I'm not bringing yesterday up to hurt you. We went over. Today we don't.",
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
