// A deck of playing cards, shared by the card games (Solitaire, War).

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
/** `rank` is 1 (ace) to 13 (king). */
export type Card = { suit: Suit; rank: number; up: boolean };

export const isRed = (c: Card) => c.suit === "hearts" || c.suit === "diamonds";
export const RANK_NAME = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_WORD = ["", "ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king"];
export const rankWord = (c: Card) => RANK_WORD[c.rank];
export const cardWords = (c: Card) => `${RANK_WORD[c.rank]} of ${c.suit}`;

/** All 52, face down, shuffled. */
export function shuffledDeck(rand: () => number = Math.random): Card[] {
  const deck: Card[] = SUITS.flatMap((suit) =>
    Array.from({ length: 13 }, (_, i) => ({ suit, rank: i + 1, up: false })),
  );
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export const isCard = (c: unknown): c is Card =>
  !!c &&
  typeof c === "object" &&
  SUITS.includes((c as Card).suit) &&
  Number.isInteger((c as Card).rank) &&
  (c as Card).rank >= 1 &&
  (c as Card).rank <= 13 &&
  typeof (c as Card).up === "boolean";
