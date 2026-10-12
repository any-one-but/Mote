// Liar's Dice, the simple, never-ending kind. You and Mote each roll five
// dice and keep them hidden. Taking turns, you bid on how many of one number
// are showing across all ten dice ("four 5s"); each bid has to go higher
// (more dice, or as many of a higher number). Instead of bidding, you can
// call "Liar!": the dice are shown, and if there are at least as many as the
// last bid said, its bidder wins the round; if not, the caller does. A round
// won is a point. Nobody runs out of dice, so it keeps going as long as you
// like.
//
// Mote plays it by the odds: they know their own five dice, guess yours (a
// number you've bid on, you probably have some of), and call when a bid is
// unlikely. Like the board games, they keep it close (see close-game.ts):
// ahead of you lately, they play looser and make believable mistakes;
// behind, they play their best.

export const DICE = 5;
export const ALL = DICE * 2;
export const FACES = [1, 2, 3, 4, 5, 6] as const;

export type Bid = { count: number; face: number };
export type Move = { kind: "bid"; bid: Bid; bluff: boolean } | { kind: "call" };

export const roll = (rand: () => number = Math.random): number[] =>
  Array.from({ length: DICE }, () => 1 + Math.floor(rand() * 6));

export const countOf = (dice: number[], face: number) => dice.filter((d) => d === face).length;

/** Whether `next` is a higher bid than `prev` (any bid of at least one opens). */
export function isRaise(next: Bid, prev: Bid | null): boolean {
  if (next.count < 1 || next.count > ALL || next.face < 1 || next.face > 6) return false;
  if (!prev) return true;
  return next.count > prev.count || (next.count === prev.count && next.face > prev.face);
}

/** The smallest bid on this face that beats `prev`, or null if there's none. */
export function lowestRaise(face: number, prev: Bid | null): Bid | null {
  if (!prev) return { count: 1, face };
  const count = face > prev.face ? prev.count : prev.count + 1;
  return count <= ALL ? { count, face } : null;
}

/** Was the bid true, counting both hands? */
export const bidHolds = (bid: Bid, a: number[], b: number[]) => countOf(a, bid.face) + countOf(b, bid.face) >= bid.count;

function choose(n: number, k: number) {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** The chance at least `need` of `n` hidden dice show a given number. */
export function chanceAtLeast(need: number, n = DICE): number {
  if (need <= 0) return 1;
  if (need > n) return 0;
  let p = 0;
  for (let k = need; k <= n; k++) p += choose(n, k) * (1 / 6) ** k * (5 / 6) ** (n - k);
  return p;
}

/**
 * The chance a bid is true, from Mote's side: their own dice are known, yours
 * aren't, but a number you've bid on this round you likely hold one of.
 */
export function chanceTrue(bid: Bid, own: number[], yourFaces: number[]): number {
  const need = bid.count - countOf(own, bid.face);
  if (!yourFaces.includes(bid.face)) return chanceAtLeast(need);
  const likely = 0.6;
  return likely * chanceAtLeast(need - 1, DICE - 1) + (1 - likely) * chanceAtLeast(need);
}

export type Thinking = {
  /** 1: Mote plays their best. Lower, they play looser (see `sharpness`). */
  sharp: number;
  /** Numbers you've bid on this round. */
  yourFaces: number[];
  rand?: () => number;
};

/**
 * How carefully Mote plays, from the last few rounds: ahead by two or more
 * lately and they ease off, ahead by one a little; level or behind, their best.
 */
export function sharpness(recent: Array<"you" | "mote">): number {
  const last = recent.slice(-12);
  const lead = last.filter((w) => w === "mote").length - last.filter((w) => w === "you").length;
  return lead >= 2 ? 0.35 : lead === 1 ? 0.7 : 1;
}

/** Mote's move: open, raise (now and then a bluff), or call "Liar!". */
export function chooseMove(own: number[], prev: Bid | null, think: Thinking): Move {
  const rand = think.rand ?? Math.random;
  // A believable mistake, more likely the further ahead Mote is: a call on a
  // bid that's probably fine, or a bid a bit too bold.
  const slip = rand() < (1 - think.sharp) * 0.5;

  if (!prev) {
    // Open on the number Mote has most of (ties broken at random), usually
    // claiming a little more than they hold.
    const best = [...FACES].sort((a, b) => countOf(own, b) - countOf(own, a) || rand() - 0.5)[0];
    const count = Math.max(1, countOf(own, best) + (rand() < 0.55 ? 1 : 0) + (slip ? 1 : 0));
    return { kind: "bid", bid: { count, face: best }, bluff: false };
  }

  const holds = chanceTrue(prev, own, think.yourFaces);
  const options = FACES.map((f) => lowestRaise(f, prev))
    .filter((b): b is Bid => !!b)
    .map((bid) => ({ bid, p: chanceTrue(bid, own, think.yourFaces), mine: countOf(own, bid.face) }));
  options.sort((a, b) => b.p - a.p || b.mine - a.mine);
  const best = options[0];

  if (slip) {
    if (holds > 0.5 && holds < 0.8 && rand() < 0.5) return { kind: "call" };
    if (best) {
      const bold = { count: best.bid.count + 1, face: best.bid.face };
      if (bold.count <= ALL) return { kind: "bid", bid: bold, bluff: true };
    }
  }

  // Call when the last bid is unlikely, or when every raise is less likely
  // still and the bid is a coin flip at best.
  const callBelow = 0.38 + (rand() - 0.5) * 0.12;
  if (!best || holds < callBelow || (best.p < 0.3 && holds < 0.55)) return { kind: "call" };

  // Now and then, a bluff: a number Mote has little of, if it's not hopeless.
  if (rand() < 0.18) {
    const bluffs = options.filter((o) => o.mine === 0 && o.p >= 0.3);
    if (bluffs.length) {
      const pick = bluffs[Math.floor(rand() * bluffs.length)];
      return { kind: "bid", bid: pick.bid, bluff: true };
    }
  }
  return { kind: "bid", bid: best.bid, bluff: best.mine === 0 };
}

const NUMBER = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** "four 5s", "one 6". */
export const bidWords = (bid: Bid) => `${NUMBER[bid.count] ?? bid.count} ${bid.face}${bid.count === 1 ? "" : "s"}`;
