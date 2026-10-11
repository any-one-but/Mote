import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CALORIE_LINES,
  CALORIE_SPEECH_COUNT,
  pickCalorieAside,
  pickCalorieReaction,
  rankCalorieLines,
} from "../../components/companion/calorie-lines.ts";
import {
  applyToBook,
  averageIntake,
  colorFor,
  emptyBook,
  streakUnder,
  type CalorieBook,
} from "./calories.ts";

const at = (hour: number, day = 11) => new Date(2026, 9, day, hour, 15);

function logged(total: number, bites: number, day = "2026-10-11"): CalorieBook {
  return { ...emptyBook(at(8)), care: true, days: { [day]: { total, bites } } };
}

describe("calorie colors", () => {
  it("stays cool under the goal, heats up past it, then goes dark", () => {
    const hue = (total: number) => Number(/hsl\(([0-9.]+)/.exec(colorFor(total, 2000))?.[1]);
    assert.ok(hue(0) > 250);
    assert.ok(hue(2000) < 160);
    assert.ok(hue(2100) < hue(2000));
    assert.equal(colorFor(2300, 2000), "#1c1822");
    assert.equal(colorFor(100, 0), "#ebe2d5");
  });
});

describe("calorie days", () => {
  it("counts a higher total as another bite and ignores a no-change", () => {
    const first = applyToBook(emptyBook(at(8)), 2000, { kind: "add", amount: 180 }, at(8));
    assert.ok(first);
    assert.equal(first.moment.first, true);
    assert.equal(first.moment.part, "morning");
    assert.equal(first.book.days["2026-10-11"]?.bites, 1);
    const second = applyToBook(first.book, 2000, { kind: "add", amount: 100 }, at(13));
    assert.equal(second?.moment.later, true);
    assert.equal(second?.book.days["2026-10-11"]?.total, 280);
    assert.equal(applyToBook(second!.book, 2000, { kind: "add", amount: 0 }, at(13)), null);
  });

  it("comes back under without calling it a new bite", () => {
    const back = applyToBook(logged(2200, 3), 2000, { kind: "sub", amount: 400 }, at(19));
    assert.ok(back);
    assert.equal(back.moment.saved, true);
    assert.equal(back.book.days["2026-10-11"]?.bites, 3);
    assert.equal(back.book.days["2026-10-11"]?.total, 1800);
  });

  it("drops a day that lands on zero and counts a streak of days under", () => {
    const book: CalorieBook = {
      ...emptyBook(at(8)),
      care: true,
      days: {
        "2026-10-09": { total: 1500, bites: 2 },
        "2026-10-10": { total: 1700, bites: 2 },
        "2026-10-11": { total: 200, bites: 1 },
      },
    };
    assert.equal(streakUnder(book, 2000, "2026-10-11"), 2);
    const cleared = applyToBook(book, 2000, { kind: "set", amount: 0 }, at(12));
    assert.equal(cleared?.book.days["2026-10-11"], undefined);
    assert.equal(averageIntake(book, new Date(2026, 9, 9), new Date(2026, 9, 11)), 1133);
  });
});

describe("calorie speeches", () => {
  it("has more than a hundred lines", () => {
    assert.ok(CALORIE_LINES.length >= 100);
    assert.ok(CALORIE_SPEECH_COUNT >= 140);
    const ids = new Set(CALORIE_LINES.map((line) => line.id));
    assert.equal(ids.size, CALORIE_LINES.length);
  });

  it("beams for a small breakfast and pleads once the day goes over", () => {
    const breakfast = applyToBook(emptyBook(at(8)), 2000, { kind: "add", amount: 180 }, at(8));
    assert.equal(rankCalorieLines(breakfast!.moment)[0]?.mood, "beam");

    const over = applyToBook(logged(1900, 2), 2000, { kind: "add", amount: 400 }, at(19));
    assert.equal(rankCalorieLines(over!.moment)[0]?.mood, "plead");
    assert.match(pickCalorieReaction(over!.moment, [], () => 0).text, /over|stop|Please|sad/i);
  });

  it("gets plain in the middle, worried near the line, and warm when you come back", () => {
    const mid = applyToBook(logged(900, 1), 2000, { kind: "add", amount: 400 }, at(14));
    assert.equal(rankCalorieLines(mid!.moment)[0]?.mood, "reckon");

    const close = applyToBook(logged(1500, 1), 2000, { kind: "add", amount: 300 }, at(14));
    assert.equal(rankCalorieLines(close!.moment)[0]?.mood, "worry");

    const big = applyToBook(logged(100, 1), 2000, { kind: "add", amount: 700 }, at(12));
    assert.equal(rankCalorieLines(big!.moment)[0]?.mood, "worry");

    const saved = applyToBook(logged(2200, 3), 2000, { kind: "sub", amount: 400 }, at(18));
    assert.equal(rankCalorieLines(saved!.moment)[0]?.mood, "beam");
  });

  it("always has something to say, and the quiet reminders match the day", () => {
    const moments = [
      applyToBook(emptyBook(at(8)), 2000, { kind: "add", amount: 50 }, at(8)),
      applyToBook(logged(1800, 2), 2000, { kind: "add", amount: 50 }, at(21)),
      applyToBook(logged(2400, 4), 2000, { kind: "sub", amount: 100 }, at(22)),
      applyToBook(logged(400, 1), 2000, { kind: "set", amount: 350 }, at(16)),
    ];
    for (const row of moments) {
      const pick = pickCalorieReaction(row!.moment);
      assert.ok(pick.text.length > 8);
      assert.ok(!pick.text.includes("{"));
    }
    const low = pickCalorieAside({
      kind: "status",
      goal: 2000,
      eaten: 400,
      fill: 0.2,
      hour: 15,
      part: "afternoon",
      streak: 0,
      over: false,
    });
    assert.equal(low?.mood, "beam");
    const night = pickCalorieAside({
      kind: "nudge",
      goal: 2000,
      eaten: 0,
      fill: 0,
      hour: 21,
      part: "night",
      streak: 0,
      over: false,
    });
    assert.equal(night?.mood, "worry");
    const praise = pickCalorieAside(
      {
        kind: "evening",
        goal: 2000,
        eaten: 1600,
        fill: 0.8,
        hour: 21,
        part: "night",
        streak: 4,
        over: false,
      },
      [],
      () => 0,
    );
    assert.equal(praise?.mood, "tada");
  });
});
