// Uno for two: you and Mote. The usual deck of 108: in each of four colours
// one 0 and two each of 1–9, Skip, Reverse and Draw Two, plus four Wilds and
// four Wild Draw Fours. Seven cards each; match the top card's colour, number
// or symbol, or play a wild and pick the colour. Can't (or won't) play? Draw
// one, and play it if it fits. With two players a Reverse is just a Skip.
// A Wild Draw Four only goes down when you have nothing of the colour asked
// for (so it's always fair, with no challenging). Down to your last card,
// you'd better have said "Uno!" (see `catchable`).
//
// Everything here is plain data in, new data out, so it can be tested alone;
// Uno.tsx draws it and Mote's choices are in `chooseMove`.

export type Color = "red" | "yellow" | "green" | "blue";
export const COLORS: Color[] = ["red", "yellow", "green", "blue"];
export type Kind = "number" | "skip" | "reverse" | "draw2" | "wild" | "wild4";
export type Who = "you" | "mote";

/** A card: wilds have no colour of their own. */
export type UnoCard = { id: number; kind: Kind; color: Color | null; n?: number };

export type Uno = {
  /** The draw pile (its top is the last card). */
  deck: UnoCard[];
  /** The discard pile (its top is the last card). */
  pile: UnoCard[];
  hands: Record<Who, UnoCard[]>;
  /** The colour to match: the top card's, or the one a wild named. */
  color: Color;
  turn: Who;
  /** The card the player whose turn it is just drew, if they have: only it
   * can be played now, or they pass. */
  drawn: number | null;
  /** Said "Uno!" this turn (with two cards in hand, about to play one). */
  said: Record<Who, boolean>;
  winner: Who | null;
  /** Cards played and drawn, both of you. */
  moves: number;
};

export const other = (w: Who): Who => (w === "you" ? "mote" : "you");
export const top = (g: Uno) => g.pile[g.pile.length - 1];

/** The whole deck, in order. */
export function fullDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let id = 0;
  for (const color of COLORS) {
    cards.push({ id: id++, kind: "number", color, n: 0 });
    for (let n = 1; n <= 9; n++) for (let k = 0; k < 2; k++) cards.push({ id: id++, kind: "number", color, n });
    for (const kind of ["skip", "reverse", "draw2"] as const) {
      for (let k = 0; k < 2; k++) cards.push({ id: id++, kind, color });
    }
  }
  for (let k = 0; k < 4; k++) cards.push({ id: id++, kind: "wild", color: null });
  for (let k = 0; k < 4; k++) cards.push({ id: id++, kind: "wild4", color: null });
  return cards;
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A shuffled deal: seven each, and a number card turned up to start. */
export function deal(first: Who = "you", rand: () => number = Math.random): Uno {
  const deck = shuffle(fullDeck(), rand);
  const you = deck.splice(deck.length - 7, 7);
  const mote = deck.splice(deck.length - 7, 7);
  // Turn up the first number card; anything else goes back under the pile.
  let start = deck.pop()!;
  while (start.kind !== "number") {
    deck.unshift(start);
    start = deck.pop()!;
  }
  return {
    deck,
    pile: [start],
    hands: { you, mote },
    color: start.color!,
    turn: first,
    drawn: null,
    said: { you: false, mote: false },
    winner: null,
    moves: 0,
  };
}

/** Does this card go on the pile right now (for whoever holds it)? */
export function fits(g: Uno, card: UnoCard, hand: UnoCard[]): boolean {
  if (card.kind === "wild") return true;
  // Only with nothing of the colour to match (wilds don't count).
  if (card.kind === "wild4") return !hand.some((c) => c.id !== card.id && c.color === g.color);
  if (card.color === g.color) return true;
  const t = top(g);
  if (card.kind === "number") return t.kind === "number" && t.n === card.n;
  return t.kind === card.kind;
}

/** The cards this player could play now. */
export function playable(g: Uno, who: Who): UnoCard[] {
  if (g.winner || g.turn !== who) return [];
  const hand = g.hands[who];
  const options = g.drawn === null ? hand : hand.filter((c) => c.id === g.drawn);
  return options.filter((c) => fits(g, c, hand));
}

const clone = (g: Uno): Uno => ({
  ...g,
  deck: g.deck.slice(),
  pile: g.pile.slice(),
  hands: { you: g.hands.you.slice(), mote: g.hands.mote.slice() },
  said: { ...g.said },
});

/** Takes `count` cards off the draw pile (shuffling the discards back under
 * when it runs out; there may still be too few). */
function take(g: Uno, who: Who, count: number, rand: () => number) {
  for (let i = 0; i < count; i++) {
    if (!g.deck.length) {
      const keep = g.pile.pop()!;
      g.deck = shuffle(g.pile, rand);
      g.pile = [keep];
    }
    const c = g.deck.pop();
    if (!c) return;
    g.hands[who].push(c);
    g.moves += 1;
  }
}

/** Is there anything to draw at all? */
export const canDraw = (g: Uno) => g.deck.length + g.pile.length > 1;

/** Plays a card (it must fit). A wild names `color`. */
export function play(g: Uno, who: Who, id: number, color?: Color, rand: () => number = Math.random): Uno {
  const n = clone(g);
  const hand = n.hands[who];
  const at = hand.findIndex((c) => c.id === id);
  const card = hand[at];
  hand.splice(at, 1);
  n.pile.push(card);
  n.moves += 1;
  n.drawn = null;
  n.color = card.color ?? color ?? n.color;
  const them = other(who);
  if (!hand.length) {
    n.winner = who;
    return n;
  }
  // Two players: Skip and Reverse both mean going again.
  if (card.kind === "skip" || card.kind === "reverse") n.turn = who;
  else if (card.kind === "draw2") {
    take(n, them, 2, rand);
    n.turn = who;
  } else if (card.kind === "wild4") {
    take(n, them, 4, rand);
    n.turn = who;
  } else n.turn = them;
  // Saying "Uno!" counts for the card it was said with.
  n.said = { you: false, mote: false };
  n.said[who] = g.said[who] && hand.length === 1;
  return n;
}

/** Draws one card, instead of playing. If it fits, it can be played; if
 * not, the turn passes. */
export function draw(g: Uno, who: Who, rand: () => number = Math.random): Uno {
  const n = clone(g);
  take(n, who, 1, rand);
  const card = n.hands[who][n.hands[who].length - 1];
  const got = n.hands[who].length > g.hands[who].length;
  if (got && fits(n, card, n.hands[who])) n.drawn = card.id;
  else {
    n.drawn = null;
    n.turn = other(who);
    n.said = { you: false, mote: false };
  }
  return n;
}

/** Keeps the card just drawn (or there was nothing to draw): the turn passes. */
export function pass(g: Uno, who: Who): Uno {
  return { ...clone(g), drawn: null, turn: other(who), said: { you: false, mote: false } };
}

/** Says "Uno!": two cards in hand, about to play one of them. */
export function sayUno(g: Uno, who: Who): Uno {
  const n = clone(g);
  n.said[who] = true;
  return n;
}

/** Down to one card without having said "Uno!": the other can call it out. */
export const catchable = (g: Uno, who: Who) => !g.winner && g.hands[who].length === 1 && !g.said[who];

/** Caught out: two cards for forgetting to say "Uno!". */
export function penalty(g: Uno, who: Who, rand: () => number = Math.random): Uno {
  const n = clone(g);
  take(n, who, 2, rand);
  n.said[who] = false;
  return n;
}

/** The colour there's most of in a hand (for naming with a wild). */
export function bestColor(hand: UnoCard[], rand: () => number = Math.random): Color {
  const count = (c: Color) => hand.filter((h) => h.color === c).length;
  const most = Math.max(...COLORS.map(count));
  const ties = COLORS.filter((c) => count(c) === most);
  return ties[Math.floor(rand() * ties.length)] ?? "red";
}

export type MoteMove = { play: UnoCard; color?: Color } | { draw: true } | { pass: true };

/**
 * Mote's turn. Mote plays well: they hit you with the nasty cards when
 * you're nearly out, keep their wilds for when nothing else fits, and stay
 * in the colour they hold most of. But like every game with Mote, they keep
 * it close (see close-game.ts): ahead of you and not one of the games they
 * may win, they hold back (drawing instead of playing, going easy on Draw
 * Twos), so the win stays within your reach.
 */
export function chooseMove(g: Uno, opts: { mayWin: boolean }, rand: () => number = Math.random): MoteMove {
  const options = playable(g, "mote");
  const hand = g.hands.mote;
  const yours = g.hands.you.length;
  if (!options.length) return g.drawn !== null || !canDraw(g) ? { pass: true } : { draw: true };

  // Keeping it close: well ahead, Mote often draws instead of playing (a
  // card they've just drawn, they just keep). Going out while you still have
  // a handful, almost never.
  const lead = yours - hand.length;
  if (!opts.mayWin && lead >= 1) {
    const out = hand.length === 1;
    const chance = out ? (yours > 1 ? 0.85 : 0.5) : Math.min(0.75, 0.25 + 0.15 * lead);
    if (rand() < chance) return g.drawn !== null || !canDraw(g) ? { pass: true } : { draw: true };
  }

  const mine = (c: Color) => hand.filter((h) => h.color === c).length;
  const score = (c: UnoCard) => {
    let s = 0;
    if (c.kind === "wild" || c.kind === "wild4") s -= 6;
    else s += mine(c.color!) * 0.6;
    if (c.kind === "number") s += (c.n ?? 0) * 0.05;
    const nasty = c.kind === "draw2" || c.kind === "wild4" || c.kind === "skip" || c.kind === "reverse";
    // Nasty cards when you're nearly out; easier on them when Mote's ahead.
    if (nasty) s += yours <= 2 ? 8 : !opts.mayWin && lead >= 0 ? -2 : 1;
    return s + rand() * 0.5;
  };
  const pick = options.slice().sort((a, b) => score(b) - score(a))[0];
  const rest = hand.filter((h) => h.id !== pick.id);
  return pick.color ? { play: pick } : { play: pick, color: bestColor(rest.length ? rest : hand, rand) };
}

/** Is this a saved game that can be picked up again? */
export function reviveUno(raw: unknown): Uno | null {
  const g = raw as Uno | null;
  if (!g || typeof g !== "object") return null;
  const ok =
    Array.isArray(g.deck) &&
    Array.isArray(g.pile) &&
    g.pile.length > 0 &&
    Array.isArray(g.hands?.you) &&
    Array.isArray(g.hands?.mote) &&
    COLORS.includes(g.color) &&
    (g.turn === "you" || g.turn === "mote") &&
    !g.winner;
  if (!ok) return null;
  const count = g.deck.length + g.pile.length + g.hands.you.length + g.hands.mote.length;
  if (count !== 108) return null;
  return { ...g, drawn: g.drawn ?? null, said: g.said ?? { you: false, mote: false }, moves: g.moves ?? 0 };
}

/** A card in words, for Mote to say: "a red 7", "a blue Skip", "a Wild". */
export function unoWords(c: UnoCard): string {
  const name =
    c.kind === "number"
      ? String(c.n)
      : c.kind === "skip"
        ? "Skip"
        : c.kind === "reverse"
          ? "Reverse"
          : c.kind === "draw2"
            ? "Draw Two"
            : c.kind === "wild"
              ? "Wild"
              : "Wild Draw Four";
  return c.color ? `${c.color} ${name}` : name;
}
