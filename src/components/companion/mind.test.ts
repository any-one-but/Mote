import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

// The memories live in localStorage; a stand-in for it here.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { awayFor, FRIENDLY_FLOOR, lastingMoods, nudge, quadrant, tickMind } = await import("./mind.ts");
const { chatLine, loadMemories, marginOf, recordGame, startLine, streakLine, whenWords } = await import(
  "./memories.ts"
);

const base = { joy: 0, peace: 0, fullness: 7, rest: 7 };
const ctx = {
  asleep: false,
  sinceAttention: 0,
  youAround: false,
  busyTogether: false,
  hour: 14,
  friendly: false,
};

describe("Mote's mood", () => {
  it("puts each corner of the chart in the right place", () => {
    assert.equal(quadrant({ ...base, joy: 5, peace: 5 }), "happy");
    assert.equal(quadrant({ ...base, joy: 5, peace: -5 }), "needy");
    assert.equal(quadrant({ ...base, joy: -5, peace: 5 }), "grumpy");
    assert.equal(quadrant({ ...base, joy: -5, peace: -5 }), "miserable");
    assert.equal(quadrant({ ...base, joy: 1, peace: -1 }), "okay");
    assert.equal(quadrant({ ...base, joy: 4, peace: -0.2 }), "cheerful");
    assert.equal(quadrant({ ...base, joy: 0, peace: -4 }), "lonely");
  });

  it("is satisfied by company, and slides when ignored, faster when you're right there", () => {
    const together = tickMind(base, 60, ctx);
    const away = tickMind(base, 60, { ...ctx, sinceAttention: 45 });
    const ignoredHere = tickMind(base, 60, { ...ctx, sinceAttention: 45, youAround: true });
    assert.ok(together.peace > 2);
    assert.ok(away.peace < 0);
    assert.ok(ignoredHere.peace < away.peace);
  });

  it("gets hungry and tired awake, and rests up asleep", () => {
    const awake = tickMind(base, 120, ctx);
    assert.ok(awake.fullness < base.fullness - 4);
    assert.ok(awake.rest < base.rest - 2);
    const night = tickMind(base, 120, { ...ctx, hour: 23 });
    assert.ok(night.rest < awake.rest);
    const asleep = tickMind({ ...base, rest: 1 }, 30, { ...ctx, asleep: true });
    assert.ok(asleep.rest > 8);
    assert.ok(lastingMoods({ ...base, fullness: 2 }).includes("hungry"));
    assert.ok(lastingMoods({ ...base, rest: 0.5 }).includes("exhausted"));
  });

  it("lets joy settle, and keeps Friendly mode out of the deep end", () => {
    assert.ok(tickMind({ ...base, joy: 6 }, 100, ctx).joy < 6);
    const hurt = nudge(base, { joy: -9, peace: -9 }, true);
    assert.equal(hurt.joy, FRIENDLY_FLOOR);
    assert.equal(hurt.peace, FRIENDLY_FLOOR);
    const ignored = tickMind(base, 10_000, { ...ctx, sinceAttention: 500, friendly: true });
    assert.equal(ignored.peace, FRIENDLY_FLOOR);
  });

  it("sleeps through time away, a little hungrier and a little lonely", () => {
    const night = awayFor({ joy: 5, peace: 6, fullness: 8, rest: 1 }, 8 * 60);
    assert.equal(night.rest, 10);
    assert.equal(night.peace, 6);
    const days = awayFor({ joy: 5, peace: 6, fullness: 8, rest: 1 }, 48 * 60);
    assert.equal(days.fullness, 3);
    assert.equal(days.peace, -2);
    assert.equal(days.joy, 0);
  });
});

describe("Mote's memories of games", () => {
  beforeEach(() => store.clear());

  const result = (winner: "mote" | "you" | "draw", lead: number, worst = 0) => ({
    game: "checkers" as const,
    winner,
    how: "no-moves",
    lead,
    worst,
    moves: 40,
  });

  it("judges how decisive a result was", () => {
    assert.equal(marginOf("checkers", 7), "crushing");
    assert.equal(marginOf("checkers", 4), "clear");
    assert.equal(marginOf("chess", 2), "close");
  });

  it("enjoys a close win most, and minds losses more each time in a row", () => {
    const now = Date.now();
    const close = recordGame(result("mote", 1), now);
    assert.equal(close.effects.joy, 2.5);
    assert.ok((close.effects.peace ?? 0) > 0);
    const first = recordGame(result("you", 7), now + 1000).effects.joy ?? 0;
    const second = recordGame(result("you", 7), now + 2000).effects.joy ?? 0;
    assert.ok(first < 0);
    assert.ok(second < first);
    const comeback = recordGame(result("mote", 1, -4), now + 3000);
    assert.equal(comeback.memory.comeback, true);
  });

  it("says when, the way a person would", () => {
    const now = new Date(2026, 9, 12, 15, 0).getTime();
    assert.equal(whenWords(now - 5 * 60_000, now), "just now");
    assert.equal(whenWords(new Date(2026, 9, 12, 9, 0).getTime(), now), "this morning");
    assert.equal(whenWords(new Date(2026, 9, 11, 21, 0).getTime(), now), "last night");
    assert.equal(whenWords(new Date(2026, 9, 11, 10, 0).getTime(), now), "yesterday");
    assert.equal(whenWords(new Date(2026, 9, 9, 10, 0).getTime(), now), "the other day");
    assert.equal(whenWords(new Date(2026, 8, 20, 10, 0).getTime(), now), null);
  });

  it("nods to the last game when starting the next, and notices streaks", () => {
    const now = Date.now();
    recordGame(result("you", 7), now - 3 * 60_000);
    const rematch = startLine("checkers", { friendly: false, rand: () => 0, now });
    assert.ok(rematch && /Rematch|Again/.test(rematch.text), rematch?.text);
    recordGame(result("you", 7), now - 2 * 60_000);
    recordGame(result("you", 7), now - 60_000);
    assert.match(streakLine("checkers", { friendly: false, rand: () => 0, now }) ?? "", /3 in a row/);
    assert.match(startLine("checkers", { friendly: false, rand: () => 0, now })?.text ?? "", /3/);
  });

  it("brings up memorable games later, but not right away, not old ones, and not over and over", () => {
    const now = Date.now();
    recordGame({ ...result("mote", 1, -5), game: "chess" }, now - 10 * 60_000);
    assert.equal(chatLine({ friendly: false, rand: () => 0, now }), null);
    const later = now + 3 * 3_600_000;
    const line = chatLine({ friendly: false, rand: () => 0, now: later });
    assert.ok(line && /chess/.test(line.text), line?.text);
    assert.equal(chatLine({ friendly: false, rand: () => 0, now: now + 10 * 86_400_000 }), null);
    const list = loadMemories();
    list[0].mentioned = 2;
    store.set("mote.memories.games", JSON.stringify(list));
    assert.equal(chatLine({ friendly: false, rand: () => 0, now: later }), null);
  });
});
