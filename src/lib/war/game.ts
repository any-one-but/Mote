// War: the card game. The deck is dealt in half, face down. Each round you
// and Mote both turn over your top card, and the higher one (aces high) takes
// both, onto the bottom of their pile. A tie is a war: each lays three cards
// face down and one face up, and the higher of those takes everything (a tie
// again is another war). Whoever runs out of cards loses; short of cards in a
// war, you lay what you have, and with none left to turn up, you lose it.
//
// There are no choices in War, so Mote keeps it close (see close-game.ts for
// how every game plays) the only way there is: by the shuffle. Everything
// after the deal follows from the shuffle (even the order won cards go under
// a pile is drawn from it), so before dealing Mote tries shuffles, plays each
// one out to the end, and keeps one that's close: Mote ahead for a while,
// you edging back, nobody running away with it, not too long, and you
// winning in the end. In the games Mote may win (about one in seven), it's
// a close one Mote wins instead. Nothing is touched once the cards are
// dealt.

import { isCard, shuffledDeck, type Card } from "../cards.ts";

export type Side = "you" | "mote";

export type WarGame = {
  /** Each pile, top card first. */
  you: Card[];
  mote: Card[];
  rounds: number;
  /** Where the shuffle's random numbers have got to. */
  rng: number;
};

/** One round: the cards each side laid (in order: up, then for each war,
 * three down and one up), how many wars, and who took it. */
export type Battle = { you: Card[]; mote: Card[]; wars: number; winner: Side };

/** Aces high. */
export const value = (c: Card) => (c.rank === 1 ? 14 : c.rank);

/** A small random number generator whose whole state is one number, so a
 * game can be saved and picked up exactly where it was. */
function step(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

/** Random numbers from a state, noting where they got to. */
function stream(state: number) {
  let s = state;
  return {
    rand: () => {
      const [v, next] = step(s);
      s = next;
      return v;
    },
    state: () => s,
  };
}

function dealFrom(seed: number): WarGame {
  const r = stream(seed);
  const deck = shuffledDeck(r.rand);
  return { you: deck.slice(0, 26), mote: deck.slice(26), rounds: 0, rng: r.state() };
}

export function winnerOf(g: WarGame): Side | null {
  if (!g.you.length) return "mote";
  if (!g.mote.length) return "you";
  return null;
}

/** Plays a round. */
export function fight(g: WarGame): { game: WarGame; battle: Battle } {
  const r = stream(g.rng);
  const you = g.you.slice();
  const mote = g.mote.slice();
  const laidYou: Card[] = [];
  const laidMote: Card[] = [];
  let wars = 0;
  let winner: Side | null = null;
  let upYou = you.shift();
  let upMote = mote.shift();
  while (!winner) {
    if (!upYou) {
      winner = "mote";
      break;
    }
    if (!upMote) {
      winner = "you";
      break;
    }
    laidYou.push({ ...upYou, up: true });
    laidMote.push({ ...upMote, up: true });
    const a = value(upYou);
    const b = value(upMote);
    if (a !== b) {
      winner = a > b ? "you" : "mote";
      break;
    }
    // War: three down (or as many as can be spared), then one up.
    wars++;
    const down = (pile: Card[], laid: Card[]) => {
      const n = Math.min(3, Math.max(0, pile.length - 1));
      for (let k = 0; k < n; k++) laid.push({ ...pile.shift()!, up: false });
    };
    down(you, laidYou);
    down(mote, laidMote);
    upYou = you.shift();
    upMote = mote.shift();
  }
  // The cards taken go under the winner's pile, in whatever order they were
  // picked up.
  const won = [...laidYou, ...laidMote].map((c) => ({ ...c, up: false }));
  for (let i = won.length - 1; i > 0; i--) {
    const j = Math.floor(r.rand() * (i + 1));
    [won[i], won[j]] = [won[j], won[i]];
  }
  (winner === "you" ? you : mote).push(...won);
  return {
    game: { you, mote, rounds: g.rounds + 1, rng: r.state() },
    battle: { you: laidYou, mote: laidMote, wars, winner },
  };
}

/** How a deal would go, played to the end. */
export function playOut(g: WarGame, limit = 1000) {
  let game = g;
  let moteBest = 0;
  let youBest = 0;
  while (!winnerOf(game) && game.rounds < limit) {
    game = fight(game).game;
    const lead = game.mote.length - game.you.length;
    moteBest = Math.max(moteBest, lead);
    youBest = Math.max(youBest, -lead);
  }
  return { winner: winnerOf(game), rounds: game.rounds, moteBest, youBest };
}

/** How good a deal is for a close game won by `want`: 0 is just right. */
function miss(o: ReturnType<typeof playOut>, want: Side): number {
  let m = 0;
  if (o.winner !== want) m += 1000;
  // Not too short, not too long.
  if (o.rounds < 50) m += 50 - o.rounds;
  if (o.rounds > 140) m += o.rounds - 140;
  // The loser was ahead properly at some point...
  const loserBest = want === "you" ? o.moteBest : o.youBest;
  if (loserBest < 6) m += (6 - loserBest) * 10;
  // ...and nobody ran away with it.
  const most = Math.max(o.moteBest, o.youBest);
  if (most > 22) m += (most - 22) * 10;
  return m;
}

/**
 * A new game: shuffles tried and played out until one is close and won by
 * the right side (you, or Mote in the games they may win).
 */
export function deal(close: { mayWin: boolean }, rand: () => number = Math.random): WarGame {
  const want: Side = close.mayWin ? "mote" : "you";
  let best: WarGame | null = null;
  let bestMiss = Infinity;
  for (let tries = 0; tries < 400; tries++) {
    const g = dealFrom(Math.floor(rand() * 4294967296));
    const m = miss(playOut(g, 400), want);
    if (m < bestMiss) {
      best = g;
      bestMiss = m;
    }
    if (m === 0) break;
  }
  return best!;
}

/** A saved game read back, or null if it doesn't add up to a whole deck. */
export function reviveWar(raw: unknown): WarGame | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<WarGame>;
  if (!Array.isArray(g.you) || !Array.isArray(g.mote)) return null;
  if (!g.you.every(isCard) || !g.mote.every(isCard)) return null;
  const all = [...g.you, ...g.mote];
  if (all.length !== 52 || new Set(all.map((c) => `${c.suit}${c.rank}`)).size !== 52) return null;
  if (!Number.isFinite(g.rng)) return null;
  return { you: g.you, mote: g.mote, rounds: Number.isFinite(g.rounds) ? Number(g.rounds) : 0, rng: Number(g.rng) };
}
