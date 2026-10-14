import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { FaceEngine } from "@/components/companion/engine";
import type { SolitaireEvent } from "@/components/companion/solitaire-lines";
import {
  apply,
  canFinish,
  cardWords,
  deal,
  finishMove,
  hint,
  isLegal,
  isRed,
  isWon,
  movingCard,
  reviveGame,
  stuck,
  type Card,
  type Game,
  type Move,
  type Place,
} from "@/lib/solitaire/game";
import { CloseButton } from "./board-ui";
import { CardBack, CardFace } from "./cards";
import { load, sleep, store } from "./board-store";
import "./solitaire.css";

// Solitaire in Mote's window, with Mote on your side: they watch, cheer the
// good bits, and point out a move when you ask (or when you've been looking a
// while). Click a card and it glides wherever it can go (home first), or
// drag it where you want it (a face-up card in a column takes the cards on
// it along).
// Click the deck to turn a card; when it's empty, click it to turn the pile
// back over. Like every game here, it's saved as you go.

type Props = {
  engine: () => FaceEngine | null;
  onClose: () => void;
};

type Stats = { played: number; won: number };

const SAVE = "mote.solitaire";
const STATS = "mote.solitaire.stats";
/** How many cards Mote moves when you let them play. */
const MOTE_MOVES = 3;
/** How long Mote waits, while you look, before offering a move. */
const NUDGE_MS = 25_000;

function readStats(): Stats {
  const s = load<Stats>(STATS);
  return { played: Number(s?.played) || 0, won: Number(s?.won) || 0 };
}

/** A card's name, to follow it from pile to pile. */
const idOf = (c: Card) => `${c.suit}-${c.rank}`;
/** How long a card takes to fly to where it's going (ms). */
const FLY_MS = 260;

/** Where every card was on screen just before a change, to fly them from. */
type Before = {
  rects: Map<string, DOMRect>;
  stock: DOMRect | null;
  waste: DOMRect | null;
  game: Game;
  /** A fresh deal: every card comes off the deck, one after another. */
  dealing: boolean;
};

/** A card being dragged: where from, which cards, and where the pointer
 * started. It only counts as a drag once the pointer has moved a little. */
type Drag = {
  from: Place;
  count: number;
  ids: string[];
  x: number;
  y: number;
  els: HTMLElement[];
  moving: boolean;
};

/** A spot cards can be dropped on, from its `data-drop`. */
function dropPlace(name: string | undefined): Place | null {
  const [pile, i] = (name ?? "").split("-");
  if (pile === "tableau" || pile === "foundation") return { pile, i: Number(i) };
  return null;
}

const samePlace = (a: Place, b: Place) =>
  a.pile === b.pile && ("i" in a ? a.i : -1) === ("i" in b ? b.i : -1);

/** Mote's advice in words: "the 7 of clubs on the 8 of hearts". */
function advice(g: Game, m: Extract<Move, { type: "move" }>): string {
  const card = `the ${cardWords(movingCard(g, m))}`;
  if (m.to.pile === "foundation") return `${card} home`;
  const col = g.tableau[(m.to as { i: number }).i];
  const under = col[col.length - 1];
  return under ? `${card} on the ${cardWords(under)}` : `${card} into the empty column`;
}

/** Solitaire, played together. */
export function Solitaire({ engine, onClose }: Props) {
  const resumed = useRef(reviveGame(load(SAVE)));
  const [game, setGame] = useState<Game>(() => resumed.current ?? deal());
  const [history, setHistory] = useState<Game[]>([]);
  const [hinted, setHinted] = useState<Move | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>(readStats);
  const [finishing, setFinishing] = useState(false);
  /** Mote's taking a few moves. */
  const [helping, setHelping] = useState(false);
  const busy = finishing || helping;
  const [sure, setSure] = useState(false);
  const alive = useRef(true);
  const gameRef = useRef(game);
  gameRef.current = game;
  const counted = useRef(false);
  const table = useRef<HTMLDivElement>(null);
  const stockSpot = useRef<HTMLButtonElement>(null);
  const wasteSpot = useRef<HTMLDivElement>(null);
  const before = useRef<Before | null>(null);

  /** Notes where every card is now, just before the game changes, so they
   * can fly from there to where they end up. */
  const remember = (dealing = false) => {
    const rects = new Map<string, DOMRect>();
    table.current?.querySelectorAll<HTMLElement>("[data-card]").forEach((el) => {
      rects.set(el.dataset.card!, el.getBoundingClientRect());
    });
    before.current = {
      rects,
      stock: stockSpot.current?.getBoundingClientRect() ?? null,
      waste: wasteSpot.current?.getBoundingClientRect() ?? null,
      game: gameRef.current,
      dealing,
    };
  };

  // Cards fly from where they were to where they are now; a card turned
  // over flips; a card off the deck comes from the deck.
  useLayoutEffect(() => {
    const b = before.current;
    before.current = null;
    if (!b || !table.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const wasDown = new Set(b.game.tableau.flat().filter((c) => !c.up).map(idOf));
    const inStock = new Set(b.game.stock.map(idOf));
    const els = [...table.current.querySelectorAll<HTMLElement>("[data-card]")];
    els.forEach((el, n) => {
      const id = el.dataset.card!;
      const to = el.getBoundingClientRect();
      let from = b.dealing ? b.stock : b.rects.get(id);
      if (!from && inStock.has(id)) from = b.stock;
      // Turned back over: the deck comes from the pile.
      if (!from && id === "stock" && b.game.waste.length) from = b.waste;
      const delay = b.dealing ? n * 18 : 0;
      if (from) {
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        if (Math.abs(dx) + Math.abs(dy) > 1) {
          el.style.zIndex = "20";
          const fly = el.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
            { duration: FLY_MS, delay, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" },
          );
          fly.onfinish = fly.oncancel = () => {
            el.style.zIndex = "";
          };
        }
      }
      if (!b.dealing && wasDown.has(id) && el.classList.contains("is-up")) {
        el.animate([{ transform: "scaleX(0.05)" }, { transform: "scaleX(1)" }], {
          duration: 220,
          delay: 60,
          easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          fill: "backwards",
        });
      }
    });
  }, [game]);

  const tell = useCallback((event: SolitaireEvent, move?: string) => engine()?.solitaire(event, move), [engine]);

  // Dragging cards. A drag that ends somewhere a card can go plays the move
  // (the cards land from where they were dropped); anywhere else, they slide
  // back. The click that ends a drag doesn't also pick the card up.
  const drag = useRef<Drag | null>(null);
  const justDragged = useRef(false);
  const playRef = useRef<(m: Move) => boolean>(() => false);
  /** Where a card is, and how many cards would come with it. */
  const whereIs = (id: string): { from: Place; count: number; ids: string[] } | null => {
    const g = gameRef.current;
    const w = g.waste[g.waste.length - 1];
    if (w && idOf(w) === id) return { from: { pile: "waste" }, count: 1, ids: [id] };
    for (let i = 0; i < 4; i++) {
      const f = g.foundations[i];
      const t = f[f.length - 1];
      if (t && idOf(t) === id) return { from: { pile: "foundation", i }, count: 1, ids: [id] };
    }
    for (let i = 0; i < 7; i++) {
      const col = g.tableau[i];
      const k = col.findIndex((c) => idOf(c) === id);
      if (k >= 0 && col[k].up) return { from: { pile: "tableau", i }, count: col.length - k, ids: col.slice(k).map(idOf) };
    }
    return null;
  };
  const grab = (e: ReactPointerEvent) => {
    if (e.button !== 0 || done || busy) return;
    const id = (e.target as Element).closest<HTMLElement>("[data-card]")?.dataset.card;
    if (!id || id === "stock") return;
    const at = whereIs(id);
    if (!at || !canPick(at.from, at.count)) return;
    drag.current = { ...at, x: e.clientX, y: e.clientY, els: [], moving: false };
  };
  useEffect(() => {
    const letGo = (d: Drag) =>
      d.els.forEach((el) => {
        el.style.transform = "";
        el.style.transition = "";
        el.style.zIndex = "";
        el.style.pointerEvents = "";
        el.classList.remove("is-dragging");
      });
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moving) {
        if (Math.hypot(dx, dy) < 6) return;
        d.moving = true;
        d.els = d.ids
          .map((id) => table.current?.querySelector<HTMLElement>(`[data-card="${id}"]`))
          .filter((el): el is HTMLElement => !!el);
        d.els.forEach((el) => {
          el.style.transition = "none";
          el.style.zIndex = "30";
          el.style.pointerEvents = "none";
          el.classList.add("is-dragging");
        });
        setHinted(null);
        setNote(null);
      }
      d.els.forEach((el) => {
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.moving) return;
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 0);
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-drop]");
      const to = dropPlace(over?.dataset.drop);
      // Playing it first notes where the cards were dropped, so they land
      // from there.
      const played = !!to && !samePlace(to, d.from) && playRef.current({ type: "move", from: d.from, to, count: d.count });
      letGo(d);
      if (played) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.els.forEach((el) =>
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
          duration: 240,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        }),
      );
      if (to && !samePlace(to, d.from)) setNote("That doesn’t go there.");
    };
    const cancel = () => {
      const d = drag.current;
      drag.current = null;
      if (d?.moving) letGo(d);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, []);

  useEffect(() => {
    alive.current = true;
    tell(resumed.current ? "resume" : "start");
    return () => {
      alive.current = false;
      engine()?.setBoardGame(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const won = isWon(game);
  const done = won || stuck(game);

  // Mote watches you play, and settles back once it's over.
  useEffect(() => {
    engine()?.setBoardGame(done ? "idle" : "you");
  }, [engine, done]);

  useEffect(() => {
    store(SAVE, won ? null : game);
  }, [game, won]);

  const addStats = (win: boolean) => {
    const next = { played: stats.played + 1, won: stats.won + (win ? 1 : 0) };
    setStats(next);
    store(STATS, next);
  };

  // How it's going: a win, being stuck, or everything showing.
  const said = useRef<string>("");
  useEffect(() => {
    const key = won ? "win" : stuck(game) ? "stuck" : canFinish(game) ? "finish" : "";
    if (!key || said.current === key) return;
    said.current = key;
    if (key === "win" && !counted.current) {
      counted.current = true;
      addStats(true);
    }
    tell(key as SolitaireEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // Looking a while: Mote offers a move (one that's on the table, not the deck).
  useEffect(() => {
    if (done || busy) return;
    const t = window.setTimeout(() => {
      const g = gameRef.current;
      const h = hint(g);
      if (!alive.current || !h || h.type !== "move") return;
      setHinted(h);
      tell("nudge", advice(g, h));
    }, NUDGE_MS);
    return () => window.clearTimeout(t);
  }, [game, done, busy, tell]);

  /** Plays a move, if it's allowed, and says something if it's worth it
   * (unless it's Mote's own move, which they talk about themselves). */
  const play = (m: Move, quiet = false): boolean => {
    const g = gameRef.current;
    if (!isLegal(g, m)) return false;
    const next = apply(g, m);
    remember();
    setHistory((h) => [...h.slice(-99), g]);
    setGame(next);
    gameRef.current = next;
    setHinted(null);
    setNote(null);
    if (m.type === "move" && !quiet) {
      const col = m.from.pile === "tableau" ? next.tableau[m.from.i] : null;
      const before = m.from.pile === "tableau" ? g.tableau[m.from.i] : null;
      const revealed = !!col?.length && !!before && before.length - m.count > 0 && !before[before.length - m.count - 1].up;
      const card = movingCard(g, m);
      const home = m.to.pile === "foundation";
      if (home && card.rank === 1) tell("home-ace");
      else if (home && card.rank === 13) tell("home-king");
      else if (col && col.length === 0 && card.rank !== 13) tell("cleared");
      else if (revealed) tell("reveal");
      else if (home && card.rank === 2) tell("home-two");
      else if (home) tell("home");
    }
    return true;
  };

  playRef.current = play;

  const canPick = (from: Place, count: number) =>
    // Picking up is allowed if it could go somewhere at all; anything that
    // isn't an ordered, face-up run can't.
    from.pile !== "tableau" || isLegalRun(gameRef.current, from.i, count);

  /** Clicking a card or an empty spot. */
  /**
   * Where a card (and any on it) goes when clicked: home, if it's a top card
   * that can go there; otherwise the first column it fits on, one with cards
   * before an empty one (and never an empty column for a card that's already
   * the bottom of its own). Null: nowhere yet.
   */
  const destination = (g: Game, from: Place, count: number): Place | null => {
    const fits = (to: Place) => !samePlace(to, from) && isLegal(g, { type: "move", from, to, count });
    if (count === 1 && from.pile !== "foundation") {
      for (let i = 0; i < 4; i++) if (fits({ pile: "foundation", i })) return { pile: "foundation", i };
    }
    const bottom = from.pile === "tableau" && g.tableau[from.i].length === count;
    let empty: Place | null = null;
    for (let i = 0; i < 7; i++) {
      const to: Place = { pile: "tableau", i };
      if (!fits(to)) continue;
      if (g.tableau[i].length) return to;
      if (!empty && !bottom) empty = to;
    }
    return empty;
  };

  /** Until when clicks are ignored: the second click of a double-click. */
  const quietUntil = useRef(0);

  /** Clicking a card: it goes wherever it can, gliding there. */
  const clickAt = (place: Place, count: number) => {
    if (done || busy || justDragged.current || count === 0 || performance.now() < quietUntil.current) return;
    const g = gameRef.current;
    if (!canPick(place, count)) {
      if (place.pile === "tableau" && g.tableau[place.i].length) setNote("Only cards in order move together.");
      return;
    }
    const to = destination(g, place, count);
    if (!to) return setNote("Nowhere for that one to go yet.");
    play({ type: "move", from: place, to, count });
    quietUntil.current = performance.now() + 320;
  };

  const clickStock = () => {
    if (done || busy) return;
    const g = gameRef.current;
    play(g.stock.length ? { type: "draw" } : { type: "recycle" });
  };

  const askMote = () => {
    const g = gameRef.current;
    const h = hint(g);
    if (!h) return tell("stuck");
    setHinted(h);
    if (h.type === "draw") tell("hint-draw");
    else if (h.type === "recycle") tell("hint-recycle");
    else tell("hint", advice(g, h));
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev || busy) return;
    remember();
    setHistory((h) => h.slice(0, -1));
    setGame(prev);
    setHinted(null);
    setNote(null);
    said.current = "";
    tell("undo");
  };

  const newDeal = () => {
    if (game.moves > 0 && !done && !sure) {
      setSure(true);
      window.setTimeout(() => alive.current && setSure(false), 3000);
      return;
    }
    if (game.moves > 0 && !counted.current) addStats(won);
    setSure(false);
    const g = deal();
    remember(true);
    setGame(g);
    setHistory([]);
    setHinted(null);
    setNote(null);
    said.current = "";
    counted.current = false;
    tell("new-deal");
  };

  /** Everything's showing: Mote puts the cards away, one at a time. */
  const finish = async () => {
    setFinishing(true);
    setHinted(null);
    let g = gameRef.current;
    while (alive.current && !isWon(g)) {
      const m = finishMove(g);
      if (!m) break;
      g = apply(g, m);
      remember();
      setGame(g);
      gameRef.current = g;
      await sleep(110);
    }
    if (alive.current) setFinishing(false);
  };

  /** Mote takes a few moves: the ones they'd suggest, turning the deck as
   * they need to. Each is its own step for Undo. */
  const letMotePlay = async () => {
    if (done || busy) return;
    setHelping(true);
    setHinted(null);
    setNote(null);
    engine()?.setBoardGame("mote");
    tell("mote-turn");
    const start = gameRef.current;
    const progress = (g: Game) =>
      g.foundations.reduce((n, f) => n + f.length, 0) - g.tableau.flat().filter((c) => !c.up).length;
    await sleep(700);
    let placed = 0;
    // A few cards moved, and never more than a lap or two of the deck.
    for (let n = 0; n < 60 && placed < MOTE_MOVES && alive.current; n++) {
      const g = gameRef.current;
      if (isWon(g) || canFinish(g)) break;
      const m = hint(g);
      if (!m) break;
      if (m.type === "move") placed++;
      play(m, true);
      await sleep(m.type === "move" ? 560 : 200);
    }
    if (!alive.current) return;
    setHelping(false);
    const g = gameRef.current;
    const over = isWon(g) || stuck(g);
    engine()?.setBoardGame(over ? "idle" : "you");
    // A win, being stuck or everything showing says itself.
    if (over || canFinish(g)) return;
    if (!placed) tell("mote-nothing");
    else tell(progress(g) > progress(start) ? "mote-good" : "mote-done");
  };

  const close = () => {
    onClose();
  };

  // What Mote pointed at.
  const hintFrom = hinted?.type === "move" ? hinted : null;
  const isHintSource = (place: Place, index: number, length: number) =>
    !!hintFrom && samePlace(hintFrom.from, place) && index >= length - hintFrom.count;
  const isHintTarget = (place: Place) => !!hintFrom && samePlace(hintFrom.to, place);

  const home = game.foundations.reduce((n, f) => n + f.length, 0);
  const status = note
    ? note
    : won
      ? "Every card home!"
      : stuck(game)
        ? "Nothing left that helps."
        : finishing
          ? "Mote’s putting them away…"
          : helping
            ? "Mote’s playing…"
          : `${home} of 52 home`;

  const topWaste = game.waste[game.waste.length - 1];

  return (
    <div className="ck sol">
      <div className="ck-head">
        <p className="ck-meta">
          <strong>Solitaire</strong>
          {stats.played ? <span>Won {stats.won} of {stats.played}</span> : null}
        </p>
        <button type="button" className="ck-quiet" onClick={undo} disabled={!history.length || busy}>
          Undo
        </button>
        <button type="button" className={`ck-quiet${sure ? " is-sure" : ""}`} onClick={newDeal} disabled={busy}>
          {sure ? "Sure?" : "New deal"}
        </button>
        <CloseButton onClick={close} />
      </div>

      <div className="sol-table" ref={table} onPointerDown={grab}>
        <div className="sol-row">
          <button
            ref={stockSpot}
            type="button"
            className={`sol-spot${game.stock.length ? "" : " is-empty"}${hinted && hinted.type !== "move" ? " is-hint-target" : ""}`}
            aria-label={game.stock.length ? `Deck, ${game.stock.length} cards: turn one` : "Turn the pile back over"}
            onClick={clickStock}
          >
            {game.stock.length ? <CardBack id="stock" hint={!!hinted && hinted.type === "draw"} /> : <RoundArrow />}
          </button>
          <div className="sol-spot is-empty" ref={wasteSpot}>
            {topWaste ? (
              <CardFace
                key={idOf(topWaste)}
                id={idOf(topWaste)}
                card={topWaste}
                hint={isHintSource({ pile: "waste" }, 0, 1)}
                onClick={() => clickAt({ pile: "waste" }, 1)}
              />
            ) : null}
          </div>
          <div />
          {game.foundations.map((f, i) => {
            const place: Place = { pile: "foundation", i };
            const c = f[f.length - 1];
            return (
              <div
                key={i}
                className={`sol-spot is-empty${isHintTarget(place) ? " is-hint-target" : ""}`}
                data-drop={`foundation-${i}`}
                onClick={c ? undefined : () => clickAt(place, 0)}
                aria-label={c ? undefined : "Empty foundation"}
              >
                {c ? (
                  <CardFace
                    key={idOf(c)}
                    id={idOf(c)}
                    card={c}
                    hint={false}
                    onClick={() => clickAt(place, 1)}
                  />
                ) : (
                  <span className="sol-slot-mark">A</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="sol-row is-columns">
          {game.tableau.map((col, i) => {
            const place: Place = { pile: "tableau", i };
            const downs = col.filter((c) => !c.up).length;
            const ups = col.length - downs;
            // Face-up cards spread less in a long column, so it stays in the window.
            const up = ups > 1 ? Math.min(0.34, 2.9 / (ups - 1)) : 0.34;
            let y = 0;
            const tops = col.map((c) => {
              const at = y;
              y += c.up ? up : 0.16;
              return at;
            });
            const height = (col.length ? tops[tops.length - 1] : 0) + 1.4;
            return (
              <div
                key={i}
                className={`sol-col${col.length ? "" : " is-empty"}${isHintTarget(place) && !col.length ? " is-hint-target" : ""}`}
                data-drop={`tableau-${i}`}
                style={{ height: `calc(var(--cw) * ${height.toFixed(3)})` } as CSSProperties}
                onClick={col.length ? undefined : () => clickAt(place, 0)}
                aria-label={col.length ? undefined : "Empty column"}
              >
                {col.map((c, k) => {
                  const style = { top: `calc(var(--cw) * ${tops[k].toFixed(3)})` } as CSSProperties;
                  if (!c.up) return <CardBack key={idOf(c)} id={idOf(c)} style={style} />;
                  const count = col.length - k;
                  const last = k === col.length - 1;
                  return (
                    <CardFace
                      key={idOf(c)}
                      id={idOf(c)}
                      card={c}
                      style={style}
                      hint={isHintSource(place, k, col.length) || (last && isHintTarget(place))}
                      onClick={() => clickAt(place, count)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <p className={`ck-status${note ? " is-note" : ""}`} aria-live="polite">
        {status}
      </p>
      <div className="ck-buttons sol-foot">
        {won || stuck(game) ? (
          <button type="button" className="ck-primary" onClick={newDeal} autoFocus>
            Deal again
          </button>
        ) : canFinish(game) ? (
          <button type="button" className="ck-primary" onClick={() => void finish()} disabled={finishing}>
            Let Mote finish
          </button>
        ) : null}
        {!done ? (
          <button type="button" className="ck-secondary" onClick={askMote} disabled={busy}>
            Ask Mote
          </button>
        ) : null}
        {!done && !canFinish(game) ? (
          <button type="button" className="ck-secondary" onClick={() => void letMotePlay()} disabled={busy}>
            Let Mote play
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Can the top `count` cards of a column be picked up together? */
function isLegalRun(g: Game, i: number, count: number): boolean {
  const col = g.tableau[i];
  if (count < 1 || count > col.length) return false;
  const run = col.slice(col.length - count);
  return run.every(
    (c, k) => c.up && (k === 0 || (run[k - 1].rank === c.rank + 1 && isRed(run[k - 1]) !== isRed(c))),
  );
}

/** The empty deck: turn the pile back over. */
function RoundArrow() {
  return (
    <svg viewBox="0 0 24 24" className="sol-round" aria-hidden="true">
      <path d="M18.5 12a6.5 6.5 0 1 1-2.2-4.9" />
      <path d="M17.5 3.5v4h-4" />
    </svg>
  );
}
