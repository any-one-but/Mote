// Countdowns: days worth waiting for (a birthday, a trip, the end of term),
// counted down for weeks, months or years. Saying "countdown", "timer" or
// "alarm" to Mote opens the list, where they're made, renamed, moved and
// deleted; saying one's name ("birthday", "how long until the trip?") just
// gets Mote saying how long is left. When one runs out while Mote is around
// (or while they were closed), they say so, once.
//
// Nothing here touches the screen: the list is Countdowns.tsx, and Companion
// listens for names.

import { distance, normalize } from "./converse.ts";

export type Countdown = {
  id: string;
  name: string;
  /** When it runs out (ms). */
  end: number;
  /** Whether a time of day was picked (without one, it ends as the day starts). */
  timed: boolean;
  created: number;
  /** Mote has said it ran out. */
  told?: boolean;
};

const KEY = "mote.countdowns";

export function loadCountdowns(): Countdown[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list)
      ? list.filter((c) => typeof c?.id === "string" && typeof c?.name === "string" && Number.isFinite(c?.end))
      : [];
  } catch {
    return [];
  }
}

export function saveCountdowns(list: Countdown[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Not kept, then.
  }
}

/** Soonest first; the ones that have run out after, the latest of them first. */
export function sorted(list: Countdown[], now = Date.now()): Countdown[] {
  const ahead = list.filter((c) => c.end > now).sort((a, b) => a.end - b.end);
  const done = list.filter((c) => c.end <= now).sort((a, b) => b.end - a.end);
  return [...ahead, ...done];
}

// How long is left.

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

const daysIn = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
function addMonths(from: Date, n: number): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, daysIn(d.getFullYear(), d.getMonth())));
  return d;
}

export type Span = { years: number; months: number; days: number; hours: number; minutes: number; seconds: number };

/** The time between two moments, with years and months by the calendar. */
export function span(from: number, to: number): Span {
  if (to < from) [from, to] = [to, from];
  const a = new Date(from);
  const b = new Date(to);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  while (months > 0 && addMonths(a, months).getTime() > to) months--;
  let rest = to - addMonths(a, months).getTime();
  const days = Math.floor(rest / DAY);
  rest -= days * DAY;
  const hours = Math.floor(rest / HOUR);
  rest -= hours * HOUR;
  const minutes = Math.floor(rest / MINUTE);
  rest -= minutes * MINUTE;
  return { years: Math.floor(months / 12), months: months % 12, days, hours, minutes, seconds: Math.floor(rest / 1000) };
}

const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const both = (a: string, b: string | null) => (b ? `${a} and ${b}` : a);

/** In words, the two biggest parts that matter: "2 years and 3 months",
 * "23 days", "3 days and 5 hours", "12 minutes". */
export function inWords(ms: number): string {
  const s = span(0, Math.max(0, ms));
  if (s.years || s.months) {
    const parts = [
      s.years ? unit(s.years, "year") : null,
      s.months ? unit(s.months, "month") : null,
      s.days ? unit(s.days, "day") : null,
    ].filter((p): p is string => !!p);
    return both(parts[0], parts[1] ?? null);
  }
  if (s.days >= 7) return unit(s.days, "day");
  if (s.days) return both(unit(s.days, "day"), s.hours ? unit(s.hours, "hour") : null);
  if (s.hours) return both(unit(s.hours, "hour"), s.minutes ? unit(s.minutes, "minute") : null);
  if (s.minutes) return unit(s.minutes, "minute");
  return "less than a minute";
}

/** Under a day, the clock itself ("5:20:11"); otherwise the words. */
export function inShort(ms: number): string {
  if (ms >= DAY) return inWords(ms);
  const s = span(0, Math.max(0, ms));
  const two = (n: number) => String(n).padStart(2, "0");
  return s.hours ? `${s.hours}:${two(s.minutes)}:${two(s.seconds)}` : `${s.minutes}:${two(s.seconds)}`;
}

/** When it ends, the way you'd write it on a calendar. */
export function endsOn(c: Countdown): string {
  const d = new Date(c.end);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const day = d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return c.timed ? `${day}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : day;
}

// What Mote says.

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fill = (line: string, what: string, time: string) =>
  capital(line.replaceAll("{what}", what).replaceAll("{time}", time));

const LEFT = [
  "{what} is in {time}.",
  "{time} until {what}!",
  "{what}: {time} to go.",
  "Only {time} until {what}.",
  "{time} left until {what}. I’m counting!",
  "{what}? {time} to go.",
];
/** Under a day to go. */
const SOON = ["{what} is so close! {time} to go.", "Just {time} until {what}!", "{what} is nearly here: {time}."];
/** Run out. */
const DONE = ["{what} is here!", "It’s {what}! The countdown’s done.", "{what} is here! We made it."];
const DONE_AGO = ["{what} was {time} ago!", "{what} came {time} ago. The countdown’s done.", "That one’s done: {what} was {time} ago."];

/** How long is left, as Mote would say it. */
export function leftLine(c: Countdown, now = Date.now()): string {
  const left = c.end - now;
  if (left <= 0) return doneLine(c, now);
  return fill(pick(left < DAY ? SOON : LEFT), c.name, inWords(left));
}

/** It ran out (just now, or a while ago). */
export function doneLine(c: Countdown, now = Date.now()): string {
  const ago = now - c.end;
  return ago < HOUR ? fill(pick(DONE), c.name, "") : fill(pick(DONE_AGO), c.name, inWords(ago));
}

/** A new one, said as it's made. */
export const madeLine = (c: Countdown, now = Date.now()) =>
  fill(pick(["Counting down to {what}. {time} to go!", "Got it! {time} until {what}.", "{what}, in {time}. I’ll keep count."]), c.name, inWords(c.end - now));

// Hearing a countdown's name.

/** Words around a name that don't change which one it is. */
const FILLER = new Set(
  (
    "how long until till til untill before to the my our a an is it its when whens left time remaining " +
    "many much days day weeks months years hours there for of on in at what about with counter countdown " +
    "countdowns count down timer timers alarm alarms please mote hey still"
  ).split(" "),
);
/** Words a name can drop and still be heard ("the trip" is "trip"). */
const SOFT = new Set(["the", "my", "our", "a", "an"]);

const words = (s: string) => normalize(s).split(" ").filter(Boolean);
const same = (a: string, b: string) => a === b || a.replace(/s$/, "") === b.replace(/s$/, "");

/** Which countdown was named, if any: the name in what was typed ("how long
 * until my birthday"), or near enough, typos and all, for the whole thing. */
export function heardName(text: string, list: Countdown[]): Countdown | null {
  const typed = words(text);
  if (!typed.length) return null;
  const rest = typed.filter((w) => !FILLER.has(w)).join("");
  let best: { c: Countdown; size: number } | null = null;
  for (const c of list) {
    const all = words(c.name);
    const core = all.filter((w) => !SOFT.has(w));
    const name = core.length ? core : all;
    if (!name.length) continue;
    const size = name.join("").length;
    // The name, word for word, somewhere in it.
    let found = false;
    for (let i = 0; i + name.length <= typed.length && !found; i++) {
      found = name.every((w, j) => same(typed[i + j], w));
    }
    // Or close enough, said on its own (a short name has to be exact).
    if (!found && rest && size >= 4) {
      const allowed = size >= 8 ? 2 : 1;
      found = distance(rest, name.join("")) <= allowed;
    }
    if (found && (!best || size > best.size)) best = { c, size };
  }
  return best?.c ?? null;
}

/** "countdown to my birthday", "timer for the trip": the name to start a new one with. */
export function nameAsked(text: string): string | null {
  const m = text.match(/\b(?:count\s*down|timer|alarm)s?\s+(?:to|for|until|till|til)\s+(.+)$/i);
  const name = m?.[1].replace(/[?!.,\s]+$/, "").trim();
  return name ? capital(name) : null;
}

/** "a new countdown", "set a timer": straight to making one. */
export const wantsNew = (text: string) => /\b(new|make|create|start|add|set|another)\b/i.test(text);

/** Why a name won't do, or null if it's fine. */
export function nameProblem(name: string, list: Countdown[], editing: string | null): string | null {
  const n = words(name);
  if (!n.length) return "Give it a name, so you can ask me about it.";
  if (n.every((w) => FILLER.has(w))) return "That’s what opens this list! Something more like what it’s for?";
  const key = n.join(" ");
  if (list.some((c) => c.id !== editing && words(c.name).join(" ") === key)) return "There’s already one called that.";
  return null;
}
