import Decimal from "break_infinity.js";

// Mote Clicker: click the little Mote for motes, spend them on Mac things
// that make motes on their own, and on upgrades that make everything make
// more. Nothing ever resets: the motes you've made all-time only go up, and
// there's always something more to buy.
//
// Numbers are Decimals (break_infinity.js): a mantissa and an exponent, so
// they keep going far past where ordinary numbers turn into "Infinity"
// (about 10^308), all the way to 10^(9×10^15).
//
// How it stays quick without running out:
// - Each Mac thing costs 15% more than the last one of its kind.
// - Owning 1, 5, 25, 50, then every 50 more of a thing unlocks an upgrade
//   that doubles it, forever.
// - The ecosystem: every thing you own makes everything a little better
//   (it compounds), so even a cheap old Magic Mouse is always worth buying.
// - Two upgrade lines go on forever: macOS versions (everything ×1.5) and
//   Magic Trackpads (each click also earns a share of your motes a second).
//
// Everything here is plain data in, new data out (but Decimals), so it can
// be tested alone; MoteClicker.tsx draws it.

export { Decimal };
export type D = Decimal;

export type Thing = {
  name: string;
  /** Mac hardware, or one of the Mac's own apps. */
  kind: "mac" | "app";
  about: string;
  cost: number;
  /** Motes a second, for one. */
  rate: number;
};

export const THINGS: Thing[] = [
  { name: "Magic Mouse", kind: "mac", about: "Clicks all by itself. Don’t ask how.", cost: 15, rate: 0.1 },
  { name: "Stickies", kind: "app", about: "Each one remembers to make a mote.", cost: 100, rate: 1 },
  { name: "Calculator", kind: "app", about: "Adds up motes. Carries the one.", cost: 1_100, rate: 8 },
  { name: "Magic Keyboard", kind: "mac", about: "Types motes into being, very softly.", cost: 12_000, rate: 47 },
  { name: "TextEdit", kind: "app", about: "Writes motes down in plain text.", cost: 130_000, rate: 260 },
  { name: "Photo Booth", kind: "app", about: "Snaps motes with the silly effects on.", cost: 1.4e6, rate: 1_400 },
  { name: "iMac G3", kind: "mac", about: "Bondi blue, and full of motes.", cost: 2e7, rate: 7_800 },
  { name: "Chess", kind: "app", about: "Plays itself, and wins motes.", cost: 3.3e8, rate: 44_000 },
  { name: "GarageBand", kind: "app", about: "Jams motes out of thin air.", cost: 5.1e9, rate: 260_000 },
  { name: "MacBook Air", kind: "mac", about: "So thin the motes slip right out.", cost: 7.5e10, rate: 1.6e6 },
  { name: "Terminal", kind: "app", about: "sudo make motes", cost: 1e12, rate: 1e7 },
  { name: "Mac mini", kind: "mac", about: "Small box. Big mote energy.", cost: 1.4e13, rate: 6.5e7 },
  { name: "Automator", kind: "app", about: "A little robot that makes motes for you.", cost: 1.7e14, rate: 4.3e8 },
  { name: "Time Machine", kind: "app", about: "Brings back motes from yesterday.", cost: 2.1e15, rate: 2.9e9 },
  { name: "Mac Studio", kind: "mac", about: "A whole studio, just for motes.", cost: 2.6e16, rate: 2.1e10 },
  { name: "Spotlight", kind: "app", about: "Finds motes you didn’t know you had.", cost: 3.1e17, rate: 1.5e11 },
  { name: "Mac Pro", kind: "mac", about: "Grates motes like cheese.", cost: 7.1e19, rate: 1.1e12 },
  { name: "Finder", kind: "app", about: "That happy face knows where every mote is.", cost: 1.2e22, rate: 8.3e12 },
  { name: "Xserve", kind: "mac", about: "A whole rack, serving motes.", cost: 1.9e24, rate: 6.4e13 },
  { name: "Apple silicon", kind: "mac", about: "Motes, etched in at three nanometres.", cost: 5.4e26, rate: 5.1e14 },
];

/** Everything makes this many times its listed rate: the knob for how
 * quick the early game feels. */
const PACE = 1.5;

/** Each one of a thing costs this much more than the last. */
export const GROWTH = 1.15;

/** How much better everything gets for each thing you own (compounding),
 * for each kind of thing you have. With all twenty kinds it's just under
 * what keeps up with prices, so the game slows down very gently, forever,
 * and never runs away; with only a few kinds it's small, so the early game
 * doesn't run away either. */
export const ECO_PER_KIND = 0.00026;

export type Buff = { kind: "frenzy" | "clicks"; until: number };

export type Clicker = {
  /** Motes to spend. */
  bank: D;
  /** Every mote ever made. Never goes down. */
  total: D;
  /** Motes made by clicking. */
  byClicks: D;
  clicks: number;
  owned: number[];
  /** Doubling upgrades bought, per thing. */
  tiers: number[];
  /** Upgrade lines: how far along each one you are. */
  trackpad: number;
  os: number;
  eco: number;
  gold: number;
  goldens: number;
  buff: Buff | null;
  /** When the game was last saved (ms), for motes made while away. */
  savedAt: number;
  started: number;
};

export function fresh(now = Date.now()): Clicker {
  return {
    bank: new Decimal(0),
    total: new Decimal(0),
    byClicks: new Decimal(0),
    clicks: 0,
    owned: THINGS.map(() => 0),
    tiers: THINGS.map(() => 0),
    trackpad: 0,
    os: 0,
    eco: 0,
    gold: 0,
    goldens: 0,
    buff: null,
    savedAt: now,
    started: now,
  };
}

// ---------------------------------------------------------------------------
// Making motes

const totalOwned = (s: Clicker) => s.owned.reduce((n, k) => n + k, 0);

const kinds = (s: Clicker) => s.owned.filter((n) => n > 0).length;

/** How much better each thing you own makes everything. */
export const ecoStep = (s: Clicker) => ECO_PER_KIND * kinds(s);

/** Everything's multiplier from the ecosystem: each thing owned makes
 * everything a little better, and each Continuity upgrade doubles it. */
export const ecoBonus = (s: Clicker): D => Decimal.pow(1 + ecoStep(s), totalOwned(s)).times(2 ** s.eco);

/** Everything's multiplier from macOS. */
export const osBonus = (s: Clicker): D => Decimal.pow(1.5, s.os);

const buffOn = (s: Clicker, kind: Buff["kind"], now: number) => !!s.buff && s.buff.kind === kind && s.buff.until > now;

/** How much a golden mote's buff multiplies by. */
export const FRENZY = 7;
export const CLICK_FRENZY = 77;

/** Motes a second from one kind of thing (all of them together). */
export function thingRate(s: Clicker, i: number, now = Date.now()): D {
  if (!s.owned[i]) return new Decimal(0);
  return new Decimal(THINGS[i].rate * PACE)
    .times(s.owned[i])
    .times(Decimal.pow(2, s.tiers[i]))
    .times(ecoBonus(s))
    .times(osBonus(s))
    .times(buffOn(s, "frenzy", now) ? FRENZY : 1);
}

export function perSecond(s: Clicker, now = Date.now()): D {
  let sum = new Decimal(0);
  for (let i = 0; i < THINGS.length; i++) sum = sum.plus(thingRate(s, i, now));
  return sum;
}

/** Share of your motes a second that each click also earns. */
export const clickShare = (s: Clicker) => Math.max(0, s.trackpad - TRACKPAD_DOUBLES.length) * 0.02;

/** Motes from one click. */
export function perClick(s: Clicker, now = Date.now()): D {
  const doubles = Math.min(s.trackpad, TRACKPAD_DOUBLES.length);
  const base = new Decimal(2 ** doubles).times(osBonus(s));
  return base
    .plus(perSecond(s, now).times(clickShare(s)))
    .times(buffOn(s, "clicks", now) ? CLICK_FRENZY : 1);
}

const earn = (s: Clicker, amount: D): Clicker => ({ ...s, bank: s.bank.plus(amount), total: s.total.plus(amount) });

/** A click on the little Mote. */
export function click(s: Clicker, now = Date.now()): { game: Clicker; got: D } {
  const got = perClick(s, now);
  const next = earn(s, got);
  return { game: { ...next, clicks: s.clicks + 1, byClicks: s.byClicks.plus(got) }, got };
}

/** Time passing: `ms` of making motes. */
export function tick(s: Clicker, ms: number, now = Date.now()): Clicker {
  let next = s;
  if (s.buff && s.buff.until <= now) next = { ...next, buff: null };
  if (ms <= 0) return next;
  return earn(next, perSecond(next, now).times(ms / 1000));
}

/** Motes made while the game was put away (at the usual rate, no buffs),
 * from when it was last saved until now. */
export function catchUp(s: Clicker, now = Date.now()): { game: Clicker; got: D; ms: number } {
  const ms = Math.max(0, now - s.savedAt);
  const calm = { ...s, buff: null };
  const got = perSecond(calm, now).times(ms / 1000);
  return { game: { ...earn(calm, got), savedAt: now }, got, ms };
}

// ---------------------------------------------------------------------------
// Buying things

/** What `count` more of a thing would cost. */
export function thingCost(s: Clicker, i: number, count = 1): D {
  return Decimal.sumGeometricSeries(count, THINGS[i].cost, GROWTH, s.owned[i]);
}

/** How many of a thing you could buy now (at least 0). */
export function canAfford(s: Clicker, i: number): number {
  const n = Decimal.affordGeometricSeries(s.bank, THINGS[i].cost, GROWTH, s.owned[i]).toNumber();
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function buyThing(s: Clicker, i: number, count = 1): Clicker | null {
  if (count < 1) return null;
  const cost = thingCost(s, i, count);
  if (s.bank.lt(cost)) return null;
  const owned = [...s.owned];
  owned[i] += count;
  return { ...s, bank: s.bank.minus(cost), owned };
}

// ---------------------------------------------------------------------------
// Upgrades

export type Line = "tier" | "trackpad" | "os" | "eco" | "gold";

export type Upgrade = {
  /** e.g. "tier-3", "os", "trackpad" (each line only ever offers its next). */
  id: string;
  line: Line;
  /** The thing it's for (tier upgrades). */
  thing?: number;
  name: string;
  about: string;
  cost: D;
};

/** How many of a thing unlock its `t`th doubling: 1, 5, 25, 50, then every 50. */
export const tierAt = (t: number) => (t < 3 ? [1, 5, 25][t] : 50 * (t - 2));

/** Words for the doubling upgrades. Past the end of the list, they come
 * round again with a number on. */
const TIER_WORDS = [
  "Retina",
  "Unibody",
  "Space Gray",
  "Pro",
  "Max",
  "Ultra",
  "Aluminium",
  "Midnight",
  "Starlight",
  "Thunderbolt",
  "ProMotion",
  "MagSafe",
  "Touch ID",
  "Fusion",
  "Neural Engine",
  "Liquid Glass",
  "Titanium",
  "Dark Mode",
  "Silent",
  "Rose Gold",
];

export function roman(n: number): string {
  const parts: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [v, s] of parts)
    while (n >= v) {
      out += s;
      n -= v;
    }
  return out;
}

export function tierName(i: number, t: number): string {
  const word = TIER_WORDS[t % TIER_WORDS.length];
  const round = Math.floor(t / TIER_WORDS.length);
  return `${word} ${THINGS[i].name}${round ? ` ${roman(round + 1)}` : ""}`;
}

/** Clicks double with these, then each Magic Trackpad after adds a share
 * of your motes a second to every click. */
const TRACKPAD_DOUBLES = ["Tap to click", "Force Touch"];
const TRACKPAD_COSTS = [100, 1_000];

export function trackpadName(k: number): string {
  if (k < TRACKPAD_DOUBLES.length) return TRACKPAD_DOUBLES[k];
  const gen = k - TRACKPAD_DOUBLES.length + 1;
  return gen === 1 ? "Magic Trackpad" : `Magic Trackpad ${gen}`;
}

const MACOS = [
  "Cheetah",
  "Puma",
  "Jaguar",
  "Panther",
  "Tiger",
  "Leopard",
  "Snow Leopard",
  "Lion",
  "Mountain Lion",
  "Mavericks",
  "Yosemite",
  "El Capitan",
  "Sierra",
  "High Sierra",
  "Mojave",
  "Catalina",
  "Big Sur",
  "Monterey",
  "Ventura",
  "Sonoma",
  "Sequoia",
  "Tahoe",
];

/** macOS, in order, and then whatever comes after Tahoe (27, 28…). */
export function osName(k: number): string {
  return k < MACOS.length ? `macOS ${MACOS[k]}` : `macOS ${27 + k - MACOS.length}`;
}

const CONTINUITY = [
  "Handoff",
  "AirDrop",
  "Universal Clipboard",
  "iCloud Drive",
  "Sidecar",
  "Continuity Camera",
  "Universal Control",
  "iPhone Mirroring",
];

/** Golden motes: more often, longer on screen, longer lasting. */
const GOLD = [
  { name: "Night Shift", about: "Golden motes turn up twice as often.", cost: 7.77e5 },
  { name: "True Tone", about: "Golden motes stay around twice as long.", cost: 7.77e7 },
  { name: "Focus", about: "What golden motes do lasts twice as long.", cost: 7.77e9 },
  { name: "Do Not Disturb", about: "Golden motes turn up twice as often again.", cost: 7.77e12 },
];

/** Everything on offer right now: the next of each line, if it's unlocked. */
export function offers(s: Clicker): Upgrade[] {
  const out: Upgrade[] = [];
  THINGS.forEach((thing, i) => {
    const t = s.tiers[i];
    if (s.owned[i] < tierAt(t)) return;
    out.push({
      id: `tier-${i}`,
      line: "tier",
      thing: i,
      name: tierName(i, t),
      about: `Twice the motes from every ${thing.name}.`,
      // About ten times what the one that unlocked it cost.
      cost: new Decimal(thing.cost).times(Decimal.pow(GROWTH, tierAt(t))).times(10),
    });
  });

  const k = s.trackpad;
  const doubling = k < TRACKPAD_DOUBLES.length;
  out.push({
    id: "trackpad",
    line: "trackpad",
    name: trackpadName(k),
    about: doubling ? "Clicks make twice as many motes." : "Each click also makes 2% of your motes a second.",
    cost: doubling
      ? new Decimal(TRACKPAD_COSTS[k])
      : new Decimal(1e4).times(Decimal.pow(50, k - TRACKPAD_DOUBLES.length)),
  });

  // macOS starts once there's something to run it on.
  if (totalOwned(s) >= 25)
    out.push({
      id: "os",
      line: "os",
      name: osName(s.os),
      about: "Everything makes half as many motes again.",
      cost: new Decimal(1e5).times(Decimal.pow(100, s.os)),
    });

  if (s.eco < CONTINUITY.length && totalOwned(s) >= 50)
    out.push({
      id: "eco",
      line: "eco",
      name: CONTINUITY[s.eco],
      about: "Everything makes twice as many motes.",
      cost: new Decimal(1e8).times(Decimal.pow(1e7, s.eco)),
    });

  if (s.gold < GOLD.length && s.goldens > 0) {
    const g = GOLD[s.gold];
    out.push({ id: "gold", line: "gold", name: g.name, about: g.about, cost: new Decimal(g.cost) });
  }

  // Only what's in sight: nothing more than a long way off.
  const seen = Decimal.max(s.total, 100).times(50);
  return out.filter((u) => u.cost.lte(seen)).sort((a, b) => a.cost.cmp(b.cost));
}

export function buyUpgrade(s: Clicker, id: string): Clicker | null {
  const u = offers(s).find((o) => o.id === id);
  if (!u || s.bank.lt(u.cost)) return null;
  const next = { ...s, bank: s.bank.minus(u.cost) };
  switch (u.line) {
    case "tier": {
      const tiers = [...s.tiers];
      tiers[u.thing!] += 1;
      return { ...next, tiers };
    }
    case "trackpad":
      return { ...next, trackpad: s.trackpad + 1 };
    case "os":
      return { ...next, os: s.os + 1 };
    case "eco":
      return { ...next, eco: s.eco + 1 };
    case "gold":
      return { ...next, gold: s.gold + 1 };
  }
}

// ---------------------------------------------------------------------------
// Golden motes

/** Seconds until the next golden mote, and how long one stays. */
export function goldenWait(s: Clicker, rand = Math.random): number {
  const faster = (s.gold >= 1 ? 2 : 1) * (s.gold >= 4 ? 2 : 1);
  return (90 + rand() * 150) / faster;
}
export const goldenStay = (s: Clicker) => (s.gold >= 2 ? 24 : 12);
const buffLength = (s: Clicker, seconds: number) => seconds * (s.gold >= 3 ? 2 : 1) * 1000;

export type GoldenWhat = { kind: "lucky"; got: D } | { kind: "frenzy"; seconds: number } | { kind: "clicks"; seconds: number };

/** A golden mote caught: a lump of motes, or a while of making far more. */
export function catchGolden(s: Clicker, now = Date.now(), rand = Math.random): { game: Clicker; what: GoldenWhat } {
  const roll = rand();
  const counted = { ...s, goldens: s.goldens + 1 };
  if (roll < 0.15 && (!s.buff || s.buff.until <= now)) {
    const ms = buffLength(s, 13);
    return { game: { ...counted, buff: { kind: "clicks", until: now + ms } }, what: { kind: "clicks", seconds: ms / 1000 } };
  }
  if (roll < 0.5 && (!s.buff || s.buff.until <= now)) {
    const ms = buffLength(s, 77);
    return { game: { ...counted, buff: { kind: "frenzy", until: now + ms } }, what: { kind: "frenzy", seconds: ms / 1000 } };
  }
  // A lucky lump: a share of the bank, up to fifteen minutes of making
  // motes, and never less than a good few clicks.
  const rate = perSecond({ ...s, buff: null }, now);
  const got = Decimal.max(Decimal.min(s.bank.times(0.15), rate.times(900)), perClick(s, now).times(13)).plus(13);
  return { game: earn(counted, got), what: { kind: "lucky", got } };
}

// ---------------------------------------------------------------------------
// Saving

type Saved = {
  v: 1;
  bank: string;
  total: string;
  byClicks: string;
  clicks: number;
  owned: number[];
  tiers: number[];
  trackpad: number;
  os: number;
  eco: number;
  gold: number;
  goldens: number;
  buff: Buff | null;
  savedAt: number;
  started: number;
};

export function toSaved(s: Clicker, now = Date.now()): Saved {
  return {
    v: 1,
    bank: s.bank.toString(),
    total: s.total.toString(),
    byClicks: s.byClicks.toString(),
    clicks: s.clicks,
    owned: s.owned,
    tiers: s.tiers,
    trackpad: s.trackpad,
    os: s.os,
    eco: s.eco,
    gold: s.gold,
    goldens: s.goldens,
    buff: s.buff,
    savedAt: now,
    started: s.started,
  };
}

const dec = (x: unknown): D => {
  try {
    const d = new Decimal(typeof x === "string" || typeof x === "number" ? x : 0);
    return !Number.isFinite(d.mantissa) || d.lt(0) ? new Decimal(0) : d;
  } catch {
    return new Decimal(0);
  }
};
const count = (x: unknown) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.floor(Number(x)) : 0);
const counts = (x: unknown) => THINGS.map((_, i) => count(Array.isArray(x) ? x[i] : 0));

/** A saved game back again (anything missing or odd is just zero). */
export function revive(raw: unknown, now = Date.now()): Clicker | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Saved>;
  const total = dec(r.total);
  const bank = dec(r.bank);
  const buff = r.buff && (r.buff.kind === "frenzy" || r.buff.kind === "clicks") && Number.isFinite(r.buff.until) ? r.buff : null;
  return {
    bank,
    // The all-time total can't be less than what's in the bank.
    total: Decimal.max(total, bank),
    byClicks: dec(r.byClicks),
    clicks: count(r.clicks),
    owned: counts(r.owned),
    tiers: counts(r.tiers),
    trackpad: count(r.trackpad),
    os: count(r.os),
    eco: Math.min(count(r.eco), CONTINUITY.length),
    gold: Math.min(count(r.gold), GOLD.length),
    goldens: count(r.goldens),
    buff,
    savedAt: Number.isFinite(r.savedAt) && r.savedAt! <= now ? r.savedAt! : now,
    started: Number.isFinite(r.started) ? r.started! : now,
  };
}

// ---------------------------------------------------------------------------
// Numbers in words

const SMALL = ["thousand", "million", "billion", "trillion", "quadrillion", "quintillion", "sextillion", "septillion", "octillion", "nonillion"];
const UNITS = ["", "un", "duo", "tre", "quattuor", "quin", "se", "septe", "octo", "nove"];
const TENS = ["", "deci", "viginti", "triginta", "quadraginta", "quinquaginta", "sexaginta", "septuaginta", "octoginta", "nonaginta"];
const HUNDREDS = ["", "centi", "ducenti", "trecenti", "quadringenti", "quingenti", "sescenti", "septingenti", "octingenti", "nongenti"];
/** Which letters each tens or hundreds part lets the unit before it take on
 * (the Conway–Wechsler rules: tres, sex/ses, septem/septen, novem/noven). */
const TENS_MARK = ["", "n", "ms", "ns", "ns", "ns", "n", "n", "mx", ""];
const HUNDREDS_MARK = ["", "nx", "n", "ns", "ns", "ns", "n", "n", "mx", ""];

/**
 * The name of 1000^(n+1): n = 0 is a thousand, 1 a million, 2 a billion…,
 * on through decillion, vigintillion and centillion, up to n = 1000 (about
 * 10^3003). Built the Conway–Wechsler way, so every one has a name.
 */
export function illion(n: number): string | null {
  if (n < 0 || n > 1000) return null;
  if (n < SMALL.length) return SMALL[n];
  if (n === 1000) return "millinillion";
  const u = n % 10;
  const t = Math.floor(n / 10) % 10;
  const h = Math.floor(n / 100);
  const mark = t ? TENS_MARK[t] : HUNDREDS_MARK[h];
  let unit = UNITS[u];
  if (unit === "tre" && /[sx]/.test(mark)) unit = "tres";
  else if (unit === "se") unit = mark.includes("x") ? "sex" : mark.includes("s") ? "ses" : "se";
  else if (unit === "septe" || unit === "nove") unit += mark.includes("m") ? "m" : mark.includes("n") ? "n" : "";
  const word = unit + TENS[t] + HUNDREDS[h];
  return `${word.replace(/[aeiou]$/, "")}illion`;
}

/** A number of motes for reading: 1,234 / 12.3 million / 4.56 × 10^4,000. */
export function words(d: D | number, digits = 3): string {
  const x = d instanceof Decimal ? d : new Decimal(d);
  if (x.lt(1e6)) {
    const n = x.toNumber();
    return n < 100 && n % 1 ? n.toFixed(1) : Math.floor(n).toLocaleString("en-US");
  }
  const e = x.exponent;
  const group = Math.floor(e / 3);
  const name = illion(group - 1);
  const lead = x.mantissa * 10 ** (e - group * 3);
  const shown = trim(lead, digits);
  if (name) return `${shown} ${name}`;
  return `${trim(x.mantissa, digits)} × 10^${e.toLocaleString("en-US")}`;
}

/** Up to `digits` significant figures, without trailing zeros (and never
 * rounding up to 1000). */
function trim(x: number, digits: number): string {
  const places = Math.max(0, digits - Math.floor(Math.log10(Math.max(x, 1))) - 1);
  const f = 10 ** places;
  return String(Math.floor(x * f + 1e-9) / f);
}

/** The milestone a total has passed: 0 under a thousand, 1 at a thousand, 2
 * at a million, and so on. */
export const milestone = (d: D) => (d.lt(1000) ? 0 : Math.floor(d.exponent / 3));
