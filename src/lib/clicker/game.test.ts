import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Decimal,
  THINGS,
  buyThing,
  buyUpgrade,
  canAfford,
  catchGolden,
  catchUp,
  click,
  fresh,
  illion,
  milestone,
  offers,
  perClick,
  perSecond,
  revive,
  thingCost,
  tick,
  tierAt,
  toSaved,
  words,
  type Clicker,
} from "./game.ts";

const rich = (s: Clicker, n: number | string) => ({ ...s, bank: new Decimal(n), total: Decimal.max(s.total, new Decimal(n)) });

test("a click makes a mote, and the total only goes up", () => {
  let s = fresh(0);
  ({ game: s } = click(s, 0));
  assert.equal(s.bank.toNumber(), 1);
  assert.equal(s.total.toNumber(), 1);
  assert.equal(s.clicks, 1);
  s = rich(s, 1000);
  const total = s.total;
  s = buyThing(s, 0)!;
  assert.ok(s.bank.lt(1000));
  assert.ok(s.total.eq(total), "spending never takes from the all-time total");
});

test("each one of a thing costs 15% more, and buying many adds them up", () => {
  let s = rich(fresh(0), 1e9);
  const first = thingCost(s, 1).toNumber();
  s = buyThing(s, 1)!;
  assert.ok(Math.abs(thingCost(s, 1).toNumber() - first * 1.15) < 1e-6);
  const ten = thingCost(s, 1, 10).toNumber();
  let sum = 0;
  for (let k = 0; k < 10; k++) sum += THINGS[1].cost * 1.15 ** (1 + k);
  assert.ok(Math.abs(ten - sum) / sum < 1e-9);
  assert.equal(buyThing(rich(fresh(0), 10), 0), null, "can't buy what you can't afford");
  const max = canAfford(rich(fresh(0), 1000), 0);
  assert.ok(thingCost(fresh(0), 0, max).lte(1000) && thingCost(fresh(0), 0, max + 1).gt(1000));
});

test("things make motes over time, and while you're away", () => {
  let s = rich(fresh(0), 1000);
  s = buyThing(s, 1)!;
  const rate = perSecond(s, 0).toNumber();
  assert.ok(rate > 0);
  const after = tick(s, 10_000, 0);
  assert.ok(Math.abs(after.bank.minus(s.bank).toNumber() - rate * 10) < 1e-6);
  const { game, got, ms } = catchUp({ ...s, savedAt: 0 }, 60_000);
  assert.equal(ms, 60_000);
  assert.ok(Math.abs(got.toNumber() - rate * 60) < 1e-6);
  assert.equal(game.savedAt, 60_000);
});

test("doubling upgrades unlock at 1, 5, 25, 50 and every 50 after, forever", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(tierAt), [1, 5, 25, 50, 100, 150]);
  let s = rich(fresh(0), 1e300);
  assert.ok(!offers(s).some((u) => u.id === "tier-2"));
  s = { ...s, owned: s.owned.map((n, i) => (i === 2 ? 1 : n)) };
  const before = perSecond(s, 0);
  assert.ok(offers(s).some((u) => u.id === "tier-2"));
  s = buyUpgrade(s, "tier-2")!;
  assert.equal(s.tiers[2], 1);
  assert.ok(Math.abs(perSecond(s, 0).div(before).toNumber() - 2) < 1e-9);
  // Far along, there's still a next one.
  s = { ...s, owned: s.owned.map((n, i) => (i === 2 ? 5000 : n)), tiers: s.tiers.map((t, i) => (i === 2 ? 90 : t)) };
  const next = offers(rich(s, "1e2000")).find((u) => u.id === "tier-2");
  assert.ok(next && next.name.length > 0);
});

test("macOS and Magic Trackpads go on past their names", () => {
  let s = rich({ ...fresh(0), owned: THINGS.map(() => 30), os: 40, trackpad: 30 }, "1e500");
  const os = offers(s).find((u) => u.id === "os")!;
  assert.match(os.name, /^macOS \d+$/);
  const pad = offers(s).find((u) => u.id === "trackpad")!;
  assert.match(pad.name, /^Magic Trackpad \d+$/);
  const click1 = perClick(s, 0);
  s = buyUpgrade(s, "trackpad")!;
  assert.ok(perClick(s, 0).gt(click1));
});

test("golden motes: a lump, or a while of far more", () => {
  const s = rich({ ...fresh(0), owned: THINGS.map((_, i) => (i < 3 ? 10 : 0)) }, 1e6);
  const lucky = catchGolden(s, 0, () => 0.9);
  assert.equal(lucky.what.kind, "lucky");
  assert.ok(lucky.game.bank.gt(s.bank));
  assert.equal(lucky.game.goldens, 1);
  const frenzy = catchGolden(s, 0, () => 0.3);
  assert.equal(frenzy.what.kind, "frenzy");
  assert.ok(Math.abs(perSecond(frenzy.game, 1).div(perSecond(s, 1)).toNumber() - 7) < 1e-9);
  assert.ok(perSecond(frenzy.game, 10_000_000).eq(perSecond(s, 10_000_000)), "and it wears off");
  const clicks = catchGolden(s, 0, () => 0.05);
  assert.equal(clicks.what.kind, "clicks");
  assert.ok(perClick(clicks.game, 1).gt(perClick(s, 1)));
});

test("saved games come back as they were, and junk comes back as zero", () => {
  let s = rich({ ...fresh(0), owned: THINGS.map((_, i) => i), os: 3 }, "1.5e400");
  ({ game: s } = click(s, 0));
  const back = revive(JSON.parse(JSON.stringify(toSaved(s, 5))), 10)!;
  assert.ok(back.bank.eq(s.bank));
  assert.ok(back.total.eq(s.total));
  assert.deepEqual(back.owned, s.owned);
  assert.equal(back.os, 3);
  assert.equal(back.savedAt, 5);
  const junk = revive({ bank: "nope", owned: [-3, "x"], total: 5, os: Infinity }, 0)!;
  assert.ok(junk.bank.eq(0));
  assert.equal(junk.owned[0], 0);
  assert.equal(junk.os, 0);
  assert.equal(revive(null), null);
});

test("every big number has a name", () => {
  assert.equal(illion(0), "thousand");
  assert.equal(illion(1), "million");
  assert.equal(illion(9), "nonillion");
  assert.equal(illion(10), "decillion");
  assert.equal(illion(11), "undecillion");
  assert.equal(illion(13), "tredecillion");
  assert.equal(illion(20), "vigintillion");
  assert.equal(illion(23), "tresvigintillion");
  assert.equal(illion(27), "septemvigintillion");
  assert.equal(illion(100), "centillion");
  assert.equal(illion(1000), "millinillion");
  assert.equal(words(999_999), "999,999");
  assert.equal(words(1e6), "1 million");
  assert.equal(words(1_234_567_890), "1.23 billion");
  assert.equal(words(new Decimal("1e33")), "1 decillion");
  assert.equal(words(new Decimal("4.56e5000")), "4.56 × 10^5,000");
  assert.equal(milestone(new Decimal(999)), 0);
  assert.equal(milestone(new Decimal(1e6)), 2);
});

test("it never runs out of numbers", () => {
  const s = rich({ ...fresh(0), owned: THINGS.map(() => 20_000), tiers: THINGS.map(() => 400), os: 2000, trackpad: 500, eco: 8 }, 0);
  const rate = perSecond(s, 0);
  assert.ok(Number.isFinite(rate.mantissa) && rate.exponent > 308, "past where plain numbers give up");
  assert.ok(thingCost(s, 19).gt(0));
});

test("the pace: quick to start, and still going hours in", () => {
  // A player clicking three times a second who buys whatever pays for
  // itself soonest, a few seconds at a time.
  let s = fresh(0);
  let t = 0;
  const income = (g: Clicker) => perSecond(g, 0).plus(perClick(g, 0).times(3));
  let million = -1;
  while (t < 60 * 60) {
    for (let k = 0; k < 20; k++) {
      const inc = income(s);
      let best: { score: number; next: Clicker; cost: Decimal } | null = null;
      const consider = (cost: Decimal, next: Clicker | null) => {
        if (!next) return;
        const gain = income(next).minus(inc);
        if (gain.lte(0)) return;
        const score = cost.div(gain).toNumber() + Math.max(0, cost.minus(s.bank).div(inc.max(1e-9)).toNumber());
        if (!best || score < best.score) best = { score, next, cost };
      };
      THINGS.forEach((_, i) => consider(thingCost(s, i), buyThing({ ...s, bank: thingCost(s, i) }, i)));
      for (const u of offers(s)) consider(u.cost, buyUpgrade({ ...s, bank: u.cost }, u.id));
      const pick = best as { next: Clicker; cost: Decimal } | null;
      if (!pick || s.bank.lt(pick.cost)) break;
      s = { ...pick.next, bank: s.bank.minus(pick.cost), total: s.total };
    }
    const got = income(s).times(5);
    s = { ...s, bank: s.bank.plus(got), total: s.total.plus(got) };
    t += 5;
    if (million < 0 && s.total.gte(1e6)) million = t;
  }
  assert.ok(million > 0 && million < 25 * 60, `a million motes in under 25 minutes (took ${million}s)`);
  assert.ok(s.owned.filter((n) => n > 0).length < THINGS.length, "but not everything in the first hour");
});
