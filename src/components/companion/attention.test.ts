import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextTurn, type Focus } from "./attention.ts";

/** Plays out a minute of turns: who got looked at, and for how long in all. */
function playOut(candidates: Focus[]) {
  const lastTurn: Record<Focus, number> = { media: 0, pointer: 0, typing: 0 };
  let focus: Focus | null = null;
  let now = 0;
  const order: Focus[] = [];
  const time: Record<Focus, number> = { media: 0, pointer: 0, typing: 0 };
  while (now < 60_000) {
    const turn = nextTurn(candidates, focus, lastTurn);
    focus = turn.focus;
    lastTurn[focus] = now;
    order.push(focus);
    time[focus] += turn.ms;
    now += turn.ms;
  }
  return { order, time };
}

describe("attention", () => {
  it("watches what's playing most of the time, glancing at the pointer between", () => {
    const { order, time } = playOut(["media", "pointer"]);
    assert.ok(time.media > time.pointer * 4, `media ${time.media}, pointer ${time.pointer}`);
    // Never two glances away in a row: always back to what's playing.
    for (let i = 1; i < order.length; i++) assert.ok(order[i] === "media" || order[i - 1] === "media");
    assert.ok(order.includes("pointer"));
  });

  it("takes turns with the pointer and typing alongside media", () => {
    const { order } = playOut(["media", "pointer", "typing"]);
    const away = order.filter((f) => f !== "media");
    // The glances away alternate between the two.
    for (let i = 1; i < away.length; i++) assert.notEqual(away[i], away[i - 1]);
  });

  it("without media, goes back and forth between the pointer and typing", () => {
    const { order, time } = playOut(["pointer", "typing"]);
    for (let i = 1; i < order.length; i++) assert.notEqual(order[i], order[i - 1]);
    assert.ok(time.pointer > 10_000 && time.typing > 10_000);
  });

  it("keeps looking at the only thing going on", () => {
    const { order } = playOut(["pointer"]);
    assert.ok(order.every((f) => f === "pointer"));
  });
});
