import type { CSSProperties, ReactNode } from "react";
import { cardWords, isRed, RANK_NAME, type Card, type Suit } from "@/lib/cards";
import "./cards.css";

// Playing cards, for the card games. They follow STYLE.md: no outlines,
// only tone. Their size comes from `--cw` (a card's width) on whatever holds
// them.

/** A card, face up: its rank and suit in the corner, and a big one in the middle. */
export function CardFace({
  card,
  held = false,
  hint = false,
  style,
  className,
  id,
  onClick,
  onDoubleClick,
}: {
  card: Card;
  /** Which card this is, for a game following cards as they move. */
  id?: string;
  held?: boolean;
  hint?: boolean;
  style?: CSSProperties;
  /** More classes, for a game's own states. */
  className?: string;
  /** Left out, the card can't be clicked. */
  onClick?: () => void;
  onDoubleClick?: () => void;
}) {
  const face = card.rank > 10;
  const cls = [
    "deck-card is-up",
    isRed(card) ? "is-red" : "is-black",
    held ? "is-held" : "",
    hint ? "is-hint" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const inside = (
    <>
      <span className="deck-index" aria-hidden="true">
        <span className="deck-rank">{RANK_NAME[card.rank]}</span>
        <SuitMark suit={card.suit} className="deck-small" />
      </span>
      <span className="deck-middle" aria-hidden="true">
        {face ? (
          <span className="deck-face-letter">{RANK_NAME[card.rank]}</span>
        ) : (
          <SuitMark suit={card.suit} className="deck-big" />
        )}
      </span>
    </>
  );
  if (!onClick) {
    return (
      <span className={cls} style={style} data-card={id} role="img" aria-label={cardWords(card)}>
        {inside}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      style={style}
      data-card={id}
      aria-label={cardWords(card)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
      }}
    >
      {inside}
    </button>
  );
}

/** A card, face down: Mote's colour, with a little pair of Mote eyes. */
export function CardBack({
  style,
  hint = false,
  className,
  id,
}: {
  style?: CSSProperties;
  hint?: boolean;
  className?: string;
  /** Which card this is, for a game following cards as they move. */
  id?: string;
}) {
  return (
    <span
      className={["deck-card is-down", hint ? "is-hint" : "", className ?? ""].filter(Boolean).join(" ")}
      style={style}
      data-card={id}
      aria-hidden="true"
    >
      <svg viewBox="0 0 50 70" className="deck-back-eyes">
        <rect x="16.5" y="27" width="6" height="14" rx="3" />
        <rect x="27.5" y="27" width="6" height="14" rx="3" />
      </svg>
    </span>
  );
}

const SUIT_SHAPES: Record<Suit, ReactNode> = {
  hearts: (
    <path d="M12 21.2C12 21.2 2.8 14.8 2.8 8.6C2.8 5.5 5.2 3.4 8 3.4C9.8 3.4 11.2 4.4 12 5.9C12.8 4.4 14.2 3.4 16 3.4C18.8 3.4 21.2 5.5 21.2 8.6C21.2 14.8 12 21.2 12 21.2Z" />
  ),
  diamonds: <path d="M12 2.6L19.6 12L12 21.4L4.4 12Z" />,
  spades: (
    <path d="M12 2.6C12 2.6 3 9.4 3 14.4C3 17.2 5.2 19 7.6 19C9.2 19 10.5 18.3 11.2 17.2C11 19 10.2 20.5 8.6 21.5H15.4C13.8 20.5 13 19 12.8 17.2C13.5 18.3 14.8 19 16.4 19C18.8 19 21 17.2 21 14.4C21 9.4 12 2.6 12 2.6Z" />
  ),
  clubs: (
    <>
      <circle cx="12" cy="7.4" r="4.4" />
      <circle cx="7.2" cy="13.6" r="4.4" />
      <circle cx="16.8" cy="13.6" r="4.4" />
      <path d="M10.8 12.5H13.2L14.8 21.5H9.2Z" />
    </>
  ),
};

/** A suit, as a solid shape (no outline). */
export function SuitMark({ suit, className }: { suit: Suit; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`deck-suit ${className}`}>
      {SUIT_SHAPES[suit]}
    </svg>
  );
}
