import { test } from "node:test";
import assert from "node:assert/strict";
import { heardName, inShort, inWords, leftLine, nameAsked, nameProblem, span, wantsNew, type Countdown } from "./countdown-store.ts";
import { understand, type IntentId } from "./converse.ts";

const DAY = 86_400_000;
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const cd = (name: string, end = Date.now() + 10 * DAY): Countdown => ({ id: name, name, end, timed: false, created: 0 });

test("spans count years and months by the calendar", () => {
  assert.deepEqual(span(at(2026, 1, 31), at(2026, 3, 1)), { years: 0, months: 1, days: 1, hours: 0, minutes: 0, seconds: 0 });
  assert.equal(span(at(2026, 10, 18), at(2029, 1, 18)).years, 2);
  assert.equal(span(at(2026, 10, 18), at(2029, 1, 18)).months, 3);
});

test("time left reads like a person said it", () => {
  assert.equal(inWords(at(2029, 1, 18) - at(2026, 10, 18)), "2 years and 3 months");
  assert.equal(inWords(23 * DAY + 5 * 3_600_000), "23 days");
  assert.equal(inWords(3 * DAY + 5 * 3_600_000), "3 days and 5 hours");
  assert.equal(inWords(DAY), "1 day");
  assert.equal(inWords(5 * 3_600_000 + 20 * 60_000), "5 hours and 20 minutes");
  assert.equal(inWords(12 * 60_000 + 5000), "12 minutes");
  assert.equal(inWords(20_000), "less than a minute");
  assert.equal(inShort(5 * 3_600_000 + 20 * 60_000 + 11_000), "5:20:11");
  assert.equal(inShort(4 * 60_000 + 3000), "4:03");
});

test("Mote says the name and the time", () => {
  const line = leftLine(cd("Birthday", 1_000 + 41 * DAY + 3_600_000), 1_000);
  assert.match(line, /Birthday|birthday/);
  assert.match(line, /1 month|41 days/);
  assert.match(leftLine(cd("the trip", 1_000), 2 * DAY), /The trip|the trip/);
});

test("a countdown's name is heard, typos and all", () => {
  const list = [cd("Birthday"), cd("Mom’s birthday"), cd("The trip"), cd("Summer holidays"), cd("Xmas")];
  assert.equal(heardName("birthday", list)?.name, "Birthday");
  assert.equal(heardName("how long until my birthday?", list)?.name, "Birthday");
  assert.equal(heardName("moms birthday", list)?.name, "Mom’s birthday");
  assert.equal(heardName("trip", list)?.name, "The trip");
  assert.equal(heardName("the trip", list)?.name, "The trip");
  assert.equal(heardName("brithday", list)?.name, "Birthday");
  assert.equal(heardName("summer holiday", list)?.name, "Summer holidays");
  assert.equal(heardName("xmas", list)?.name, "Xmas");
  assert.equal(heardName("countdown", list), null);
  assert.equal(heardName("timer", list), null);
  assert.equal(heardName("play chess", list), null);
  assert.equal(heardName("", list), null);
});

test("starting one from what was said", () => {
  assert.equal(nameAsked("countdown to my birthday!"), "My birthday");
  assert.equal(nameAsked("set a timer for the trip"), "The trip");
  assert.equal(nameAsked("count down until summer"), "Summer");
  assert.equal(nameAsked("countdown"), null);
  assert.ok(wantsNew("make a new countdown"));
  assert.ok(!wantsNew("my countdowns"));
});

test("names that won't do", () => {
  const list = [cd("Birthday")];
  assert.ok(nameProblem("", list, null));
  assert.ok(nameProblem("Timer", list, null));
  assert.ok(nameProblem("birthday", list, null));
  assert.equal(nameProblem("birthday", list, "Birthday"), null);
  assert.equal(nameProblem("Summer", list, null), null);
});

test("the keywords open the countdowns", () => {
  const known = new Set<IntentId>(["games", "chess", "links", "settings", "countdowns", "help", "greet", "cancel"]);
  const heard = (t: string) => {
    const h = understand(t, { known });
    return h.kind === "unknown" ? "unknown" : `${h.kind}:${h.intent}`;
  };
  for (const t of ["timer", "countdown", "count down", "alarm", "my countdowns", "set a timer", "countdown to my birthday", "timers", "coundown"]) {
    assert.match(heard(t), /:countdowns$/, t);
  }
  assert.equal(heard("play chess"), "do:chess");
});
