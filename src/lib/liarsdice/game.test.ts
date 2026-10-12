import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bidHolds,
  bidWords,
  chanceAtLeast,
  chanceTrue,
  chooseMove,
  isRaise,
  lowestRaise,
  roll,
  sharpness,
  type Bid,
} from "./game.ts";

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test("raises go up: more dice, or as many of a higher number", () => {
  const prev: Bid = { count: 3, face: 4 };
  assert.ok(isRaise({ count: 3, face: 5 }, prev));
  assert.ok(isRaise({ count: 4, face: 1 }, prev));
  assert.ok(!isRaise({ count: 3, face: 4 }, prev));
  assert.ok(!isRaise({ count: 3, face: 2 }, prev));
  assert.ok(!isRaise({ count: 11, face: 6 }, null));
  assert.deepEqual(lowestRaise(6, prev), { count: 3, face: 6 });
  assert.deepEqual(lowestRaise(2, prev), { count: 4, face: 2 });
  assert.equal(lowestRaise(1, { count: 10, face: 6 }), null);
});

test("a bid holds when both hands together have enough", () => {
  assert.ok(bidHolds({ count: 3, face: 5 }, [5, 5, 1, 2, 3], [5, 4, 4, 4, 4]));
  assert.ok(!bidHolds({ count: 4, face: 5 }, [5, 5, 1, 2, 3], [5, 4, 4, 4, 4]));
});

test("the odds", () => {
  assert.equal(chanceAtLeast(0), 1);
  assert.equal(chanceAtLeast(6), 0);
  assert.ok(Math.abs(chanceAtLeast(1) - (1 - (5 / 6) ** 5)) < 1e-9);
  // Mote holding three 5s makes "three 5s" certain.
  assert.equal(chanceTrue({ count: 3, face: 5 }, [5, 5, 5, 1, 2], []), 1);
  // You bidding 5s makes more of them likelier.
  const own = [1, 2, 3, 4, 6];
  assert.ok(chanceTrue({ count: 2, face: 5 }, own, [5]) > chanceTrue({ count: 2, face: 5 }, own, []));
});

test("Mote calls an impossible-looking bid and backs a sure one", () => {
  const own = [1, 2, 3, 4, 6];
  for (let i = 0; i < 50; i++) {
    const rand = seeded(i);
    assert.equal(chooseMove(own, { count: 6, face: 5 }, { sharp: 1, yourFaces: [5], rand }).kind, "call");
  }
  const strong = [5, 5, 5, 5, 2];
  for (let i = 0; i < 50; i++) {
    const move = chooseMove(strong, { count: 2, face: 5 }, { sharp: 1, yourFaces: [5], rand: seeded(i) });
    assert.equal(move.kind, "bid");
  }
});

test("every bid Mote makes is a legal raise, round after round", () => {
  const rand = seeded(7);
  for (let round = 0; round < 300; round++) {
    const own = roll(rand);
    let prev: Bid | null = null;
    for (let turn = 0; turn < 20; turn++) {
      const move = chooseMove(own, prev, { sharp: rand(), yourFaces: [], rand });
      if (move.kind === "call") {
        assert.ok(prev, "Mote never calls before anyone has bid");
        break;
      }
      assert.ok(isRaise(move.bid, prev), `${JSON.stringify(move.bid)} over ${JSON.stringify(prev)}`);
      prev = move.bid;
    }
  }
});

test("Mote eases off when ahead lately", () => {
  assert.equal(sharpness([]), 1);
  assert.equal(sharpness(["mote"]), 0.7);
  assert.equal(sharpness(["mote", "mote", "you", "mote"]), 0.35);
  assert.equal(sharpness(["you", "you"]), 1);
});

test("bids in words", () => {
  assert.equal(bidWords({ count: 4, face: 5 }), "four 5s");
  assert.equal(bidWords({ count: 1, face: 6 }), "one 6");
});
