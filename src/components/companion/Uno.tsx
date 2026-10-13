import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { FaceEngine } from "@/components/companion/engine";
import type { UnoEvent } from "@/components/companion/uno-lines";
import {
  canDraw,
  catchable,
  chooseMove,
  COLORS,
  deal,
  draw,
  pass,
  penalty,
  play,
  playable,
  reviveUno,
  sayUno,
  top,
  unoWords,
  type Color,
  type Uno as Game,
  type UnoCard,
  type Who,
} from "@/lib/uno/game";
import { rollMayWin } from "@/lib/close-game";
import { BoardHead, EndPanel } from "./board-ui";
import { addToStats, load, margins, noteSwing, readStats, store, type Stats, type Swing } from "./board-store";
import "./uno.css";

// Uno against Mote, in Mote's window. Your hand along the bottom (the cards
// that fit lift up on your turn: click one to play it), Mote's face down
// along the top, the draw pile and the discards between. Click the draw pile
// to draw; a card you draw that fits can be played, or kept. Down to two
// cards, say "Uno!" before you play one (or quickly after), or Mote may catch
// you. Cards fly where they go. Like every game here, it's saved as you go.

type Props = {
  engine: () => FaceEngine | null;
  onClose: () => void;
};

type Saved = { game: Game; mayWin?: boolean; swing?: Swing };

const SAVE = "mote.uno";
const STATS = "mote.uno.stats";
/** Who goes first next time: you and Mote take turns. */
const FIRST = "mote.uno.first";
/** How long a card takes to fly where it's going (ms). */
const FLY_MS = 300;

const sleepFor = (min: number, max: number) => min + Math.random() * (max - min);

/** Where every card was on screen just before a change, to fly them from. */
type Before = { rects: Map<string, DOMRect>; deck: DOMRect | null; game: Game };

export function Uno({ engine, onClose }: Props) {
  const saved = useRef(load<Saved>(SAVE));
  const resumed = useRef(reviveUno(saved.current?.game));
  const [game, setGame] = useState<Game>(() => resumed.current ?? deal());
  const [over, setOver] = useState(false);
  const [choosing, setChoosing] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>(() => readStats(STATS));
  const gameRef = useRef(game);
  gameRef.current = game;
  const mayWin = useRef(saved.current?.mayWin === true);
  const swing = useRef<Swing>(saved.current?.swing ?? { min: 0, max: 0 });
  const alive = useRef(true);
  const table = useRef<HTMLDivElement>(null);
  const deckSpot = useRef<HTMLButtonElement>(null);
  const before = useRef<Before | null>(null);

  const tell = useCallback(
    (event: UnoEvent, words?: { color?: string }) => engine()?.uno(event, words),
    [engine],
  );

  /** Notes where every card is now, just before the game changes. */
  const remember = () => {
    const rects = new Map<string, DOMRect>();
    table.current?.querySelectorAll<HTMLElement>("[data-card]").forEach((el) => {
      rects.set(el.dataset.card!, el.getBoundingClientRect());
    });
    before.current = { rects, deck: deckSpot.current?.getBoundingClientRect() ?? null, game: gameRef.current };
  };

  // Cards fly from where they were to where they are now; a card new to
  // the table comes off the draw pile; one of Mote's turns over as it goes.
  useLayoutEffect(() => {
    const b = before.current;
    before.current = null;
    if (!b || !table.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const inDeck = new Set(b.game.deck.map((c) => String(c.id)));
    const wasMotes = new Set(b.game.hands.mote.map((c) => String(c.id)));
    let n = 0;
    table.current.querySelectorAll<HTMLElement>("[data-card]").forEach((el) => {
      const id = el.dataset.card!;
      const to = el.getBoundingClientRect();
      const from = b.rects.get(id) ?? (inDeck.has(id) ? b.deck : null);
      if (!from) return;
      const dx = from.left - to.left + (from.width - to.width) / 2;
      const dy = from.top - to.top + (from.height - to.height) / 2;
      if (Math.abs(dx) + Math.abs(dy) < 1) return;
      const turned = wasMotes.has(id) && el.classList.contains("is-face");
      el.style.zIndex = "20";
      const fly = el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)${turned ? " scaleX(0.1)" : ""}` },
          { transform: "translate(0, 0)" },
        ],
        // Drawn cards come off one after another.
        { duration: FLY_MS, delay: inDeck.has(id) ? n++ * 70 : 0, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" },
      );
      fly.onfinish = fly.oncancel = () => {
        el.style.zIndex = "";
      };
    });
  }, [game]);

  /** The game moves on: noted for flying cards, saved, and kept track of. */
  const commit = (next: Game) => {
    remember();
    gameRef.current = next;
    swing.current = noteSwing(swing.current, next.hands.you.length - next.hands.mote.length);
    setGame(next);
    setNote(null);
    if (next.winner) finish(next, "out");
  };

  /** What a card just played means, said by Mote. */
  const played = (card: UnoCard, who: Who, color?: Color) => {
    const mine = who === "mote";
    if (card.kind === "skip" || card.kind === "reverse") tell(mine ? "mote-skip" : "you-skip");
    else if (card.kind === "draw2") tell(mine ? "mote-draw2" : "you-draw2");
    else if (card.kind === "wild4") tell(mine ? "mote-wild4" : "you-wild4", { color });
    else if (card.kind === "wild") tell(mine ? "mote-wild" : "you-wild", { color });
  };

  const finish = (g: Game, how: "out" | "resign") => {
    const winner: Who = how === "resign" ? "mote" : g.winner!;
    setOver(true);
    setChoosing(null);
    store(SAVE, null);
    setStats(addToStats(STATS, winner));
    const moteLead = g.hands.you.length - g.hands.mote.length;
    engine()?.gameOver(
      { game: "uno", winner, how, moves: g.moves, ...margins(winner, moteLead, swing.current) },
      how === "resign" ? "resign" : winner === "mote" ? "mote-win" : "you-win",
    );
  };

  const begin = () => {
    const first = load<Who>(FIRST) === "mote" ? "mote" : "you";
    store(FIRST, first === "you" ? "mote" : "you");
    const g = deal(first);
    store(SAVE, null);
    mayWin.current = rollMayWin();
    swing.current = { min: 0, max: 0 };
    setOver(false);
    setChoosing(null);
    setNote(null);
    remember();
    gameRef.current = g;
    setGame(g);
    engine()?.gameStart("uno", first === "mote" ? "mote-first" : undefined);
  };

  // Saved as you go.
  useEffect(() => {
    if (!over) store(SAVE, { game, mayWin: mayWin.current, swing: swing.current });
  }, [game, over]);

  // Whose turn it is shows on Mote's face.
  const moteTurn = !over && game.turn === "mote";
  useEffect(() => {
    engine()?.setBoardGame(over ? "idle" : moteTurn ? "mote" : "you");
  }, [engine, over, moteTurn]);

  const kicked = useRef(false);
  useEffect(() => {
    alive.current = true;
    if (!kicked.current) {
      kicked.current = true;
      if (resumed.current) tell("resume");
      else begin();
    }
    return () => {
      alive.current = false;
      engine()?.setBoardGame(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // You forgot "Uno!": Mote may notice, if you don't say it first.
  useEffect(() => {
    if (over || !catchable(game, "you")) return;
    const t = window.setTimeout(() => {
      const g = gameRef.current;
      if (!alive.current || !catchable(g, "you") || g.winner) return;
      if (Math.random() < 0.7) {
        commit(penalty(g, "you"));
        tell("caught");
      } else {
        // Missed it: you got away with it this time.
        gameRef.current = sayUno(g, "you");
        setGame(gameRef.current);
        tell("missed");
      }
    }, sleepFor(1300, 2100));
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, over]);

  // Mote's turn: a moment's thought, then a card, a draw, or keeping one.
  useEffect(() => {
    if (!moteTurn || game.winner || catchable(game, "you")) return;
    const t = window.setTimeout(
      () => {
        const g = gameRef.current;
        if (!alive.current || g.turn !== "mote" || g.winner) return;
        const move = chooseMove(g, { mayWin: mayWin.current });
        if ("draw" in move) {
          commit(draw(g, "mote"));
          tell("mote-draws");
        } else if ("pass" in move) commit(pass(g, "mote"));
        else {
          // Mote never forgets to say it.
          const last = g.hands.mote.length === 2;
          const said = last ? sayUno(g, "mote") : g;
          commit(play(said, "mote", move.play.id, move.color));
          if (last) tell("mote-uno");
          else played(move.play, "mote", move.color);
        }
      },
      game.drawn !== null ? sleepFor(500, 900) : sleepFor(800, 1500),
    );
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, moteTurn]);

  const yourTurn = !over && game.turn === "you" && choosing === null;
  const options = yourTurn ? playable(game, "you") : [];
  const fitsNow = new Set(options.map((c) => c.id));

  const clickCard = (card: UnoCard) => {
    if (!yourTurn) return;
    if (!fitsNow.has(card.id)) {
      setNote(game.drawn !== null ? "Only the card you just drew can go now." : "That one doesn’t go.");
      return;
    }
    if (!card.color) return setChoosing(card.id);
    commit(play(game, "you", card.id));
    played(card, "you");
  };

  const pickColor = (color: Color) => {
    if (choosing === null) return;
    const card = game.hands.you.find((c) => c.id === choosing)!;
    setChoosing(null);
    commit(play(game, "you", card.id, color));
    played(card, "you", color);
  };

  const clickDeck = () => {
    if (!yourTurn || game.drawn !== null) return;
    if (!canDraw(game)) return commit(pass(game, "you"));
    commit(draw(game, "you"));
  };

  // "Uno!": with two cards on your turn, or one you haven't said it for.
  const canSay =
    !over &&
    !game.said.you &&
    ((yourTurn && game.hands.you.length === 2 && options.length > 0) || catchable(game, "you"));
  const sayIt = () => {
    if (!canSay) return;
    setGame(sayUno(game, "you"));
    tell("you-uno");
  };

  const close = () => {
    if (!over && game.moves > 0) tell("pause");
    onClose();
  };

  const status = note
    ? note
    : over
      ? ""
      : choosing !== null
        ? "Pick a colour."
        : game.turn === "mote"
          ? "Mote’s turn…"
          : game.drawn !== null
            ? "Play it, or keep it."
            : options.length
              ? "Your turn."
              : "Nothing fits. Draw a card.";

  const pile = top(game);
  // Hands fan out, closer together the more cards there are.
  const fan = (n: number) => ({ ["--n" as string]: Math.max(1, n) }) as CSSProperties;

  return (
    <div className="ck uno">
      <BoardHead record={stats} playing={!over} onResign={() => finish(gameRef.current, "resign")} onClose={close} />

      <div className="uno-table" ref={table}>
        <div className="uno-hand is-mote" style={fan(game.hands.mote.length)} aria-label={`Mote has ${game.hands.mote.length} cards`}>
          {game.hands.mote.map((c) => (
            <CardBack key={c.id} id={c.id} />
          ))}
        </div>

        <div className="uno-middle">
          <button
            ref={deckSpot}
            type="button"
            className={`uno-deck${yourTurn && game.drawn === null && !options.length ? " is-hint" : ""}`}
            aria-label="Draw a card"
            onClick={clickDeck}
            disabled={!yourTurn || game.drawn !== null}
          >
            <CardBack id="deck" />
          </button>
          <div className="uno-pile" aria-label={`On the pile: ${unoWords(pile)}`}>
            {/* The card before stays under the new one as it lands. */}
            {game.pile.slice(-2).map((c) => (
              <CardFace key={c.id} card={c} />
            ))}
            {!pile.color ? <span className={`uno-named is-${game.color}`} aria-label={`The colour is ${game.color}`} /> : null}
          </div>
        </div>

        <div className="uno-hand is-you" style={fan(game.hands.you.length)}>
          {sortHand(game.hands.you).map((c) => (
            <CardFace
              key={c.id}
              card={c}
              fits={fitsNow.has(c.id)}
              dim={yourTurn && !fitsNow.has(c.id)}
              chosen={choosing === c.id}
              onClick={() => clickCard(c)}
            />
          ))}
        </div>

        {choosing !== null ? (
          <div className="uno-colors" role="dialog" aria-label="Pick a colour">
            {COLORS.map((color) => (
              <button key={color} type="button" className={`uno-color is-${color}`} aria-label={color} onClick={() => pickColor(color)} />
            ))}
          </div>
        ) : null}
      </div>

      {over ? (
        <EndPanel onAgain={begin} onDone={onClose}>
          {game.winner === "you" ? "You win!" : "Mote wins."}
        </EndPanel>
      ) : (
        <div className="uno-bar">
          <p className={`ck-status${note ? " is-note" : ""}`} aria-live="polite">
            {status}
          </p>
          {canSay ? (
            <button type="button" className="ck-primary uno-say" onClick={sayIt}>
              Uno!
            </button>
          ) : null}
          {yourTurn && game.drawn !== null ? (
            <button type="button" className="ck-secondary" onClick={() => commit(pass(game, "you"))}>
              Keep it
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Your hand in order: by colour, then numbers before symbols, wilds last. */
const KIND_ORDER = ["number", "skip", "reverse", "draw2", "wild", "wild4"];
function sortHand(hand: UnoCard[]): UnoCard[] {
  const rank = (c: UnoCard) =>
    (c.color ? COLORS.indexOf(c.color) : 4) * 100 + KIND_ORDER.indexOf(c.kind) * 10 + (c.n ?? 0);
  return hand.slice().sort((a, b) => rank(a) - rank(b));
}

/** A card face up: its colour, a cream oval, and its number or symbol. */
function CardFace({
  card,
  fits = false,
  dim = false,
  chosen = false,
  onClick,
}: {
  card: UnoCard;
  fits?: boolean;
  dim?: boolean;
  chosen?: boolean;
  onClick?: () => void;
}) {
  const cls = [
    "uno-card is-face",
    `is-${card.color ?? "wild"}`,
    fits ? "is-fits" : "",
    dim ? "is-dim" : "",
    chosen ? "is-chosen" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const corner =
    card.kind === "number" ? String(card.n) : card.kind === "draw2" ? "+2" : card.kind === "wild4" ? "+4" : null;
  const inside = (
    <>
      <span className="uno-oval" aria-hidden="true" />
      <span className="uno-mark" aria-hidden="true">
        <Mark card={card} />
      </span>
      {corner ? (
        <span className="uno-corner" aria-hidden="true">
          {corner}
        </span>
      ) : null}
    </>
  );
  if (!onClick) {
    return (
      <span className={cls} data-card={card.id} role="img" aria-label={unoWords(card)}>
        {inside}
      </span>
    );
  }
  return (
    <button type="button" className={cls} data-card={card.id} aria-label={unoWords(card)} onClick={onClick}>
      {inside}
    </button>
  );
}

/** The middle of a card: a number, or a symbol drawn in thick round strokes. */
function Mark({ card }: { card: UnoCard }) {
  if (card.kind === "number") return <span className="uno-number">{card.n}</span>;
  if (card.kind === "draw2") return <span className="uno-number is-small">+2</span>;
  if (card.kind === "skip") {
    return (
      <svg viewBox="0 0 24 24" className="uno-glyph">
        <circle cx="12" cy="12" r="7.5" />
        <path d="M6.8 17.2L17.2 6.8" />
      </svg>
    );
  }
  if (card.kind === "reverse") {
    return (
      <svg viewBox="0 0 24 24" className="uno-glyph">
        <path d="M5 9.5h11.5M13 6l3.5 3.5L13 13" />
        <path d="M19 14.5H7.5M11 11l-3.5 3.5L11 18" />
      </svg>
    );
  }
  // Wilds: a little four-colour wheel (a Wild Draw Four's +4 is in its corner).
  return (
    <span className="uno-wheel">
      {COLORS.map((c) => (
        <span key={c} className={`is-${c}`} />
      ))}
    </span>
  );
}

/** A card face down: Mote's colour, with a little pair of Mote eyes. */
function CardBack({ id }: { id: number | string }) {
  return (
    <span className="uno-card is-back" data-card={id} aria-hidden="true">
      <svg viewBox="0 0 50 70" className="uno-back-eyes">
        <rect x="16.5" y="27" width="6" height="14" rx="3" />
        <rect x="27.5" y="27" width="6" height="14" rx="3" />
      </svg>
    </span>
  );
}
