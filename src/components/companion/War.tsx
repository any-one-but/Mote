import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { FaceEngine } from "@/components/companion/engine";
import type { WarEvent } from "@/components/companion/war-lines";
import { rankWord } from "@/lib/cards";
import { rollMayWin } from "@/lib/close-game";
import { deal, fight, reviveWar, winnerOf, type Battle, type Side, type WarGame } from "@/lib/war/game";
import { CloseButton, EndPanel } from "./board-ui";
import { addToStats, load, readStats, sleep, store, type Stats } from "./board-store";
import { CardBack, CardFace } from "./cards";
import "./war.css";

// War in Mote's window. Click your pile (or Flip) to turn your top card;
// Mote turns theirs, and the higher card takes both. A tie is a war. Keep
// flipping turns the cards for you, round after round, until you stop it.
// Like every game here, it's saved as you go, and Mote keeps it close (see
// lib/war/game.ts).

type Props = {
  engine: () => FaceEngine | null;
  onClose: () => void;
};

type Saved = { game: unknown; mayWin?: boolean };

const SAVE = "mote.war";
const STATS = "mote.war.stats";
/** How long between rounds when flipping for you (longer after a war). */
const AUTO_MS = 650;
const AFTER_WAR_MS = 1500;

/** War, against Mote. */
export function War({ engine, onClose }: Props) {
  const saved = useRef(load<Saved>(SAVE));
  const resumed = useRef(reviveWar(saved.current?.game));
  const mayWin = useRef(saved.current?.mayWin === true);
  const [game, setGame] = useState<WarGame>(() => {
    if (resumed.current) return resumed.current;
    mayWin.current = rollMayWin();
    return deal({ mayWin: mayWin.current });
  });
  const [battle, setBattle] = useState<Battle | null>(null);
  const [auto, setAuto] = useState(false);
  const [stats, setStats] = useState<Stats>(() => readStats(STATS));
  const [sure, setSure] = useState(false);
  const [round, setRound] = useState(0);
  const alive = useRef(true);
  const gameRef = useRef(game);
  gameRef.current = game;
  const busy = useRef(false);
  // What's been said about the lead and low piles, so it's said once.
  const said = useRef({ lead: "" as "" | Side, low: "" as "" | Side });

  const tell = useCallback((event: WarEvent) => engine()?.war(event), [engine]);
  const winner = winnerOf(game);

  useEffect(() => {
    alive.current = true;
    tell(resumed.current ? "resume" : "start");
    return () => {
      alive.current = false;
      engine()?.setBoardGame(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mote watches the cards, and settles back once it's over.
  useEffect(() => {
    engine()?.setBoardGame(winner ? "idle" : "you");
  }, [engine, winner]);

  useEffect(() => {
    store(SAVE, winner ? null : { game, mayWin: mayWin.current });
  }, [game, winner]);

  /** One round. Returns whether there was a war (for the pause after it). */
  const flip = useCallback(async (): Promise<boolean> => {
    const g = gameRef.current;
    if (busy.current || winnerOf(g)) return false;
    busy.current = true;
    const { game: next, battle: b } = fight(g);
    setBattle(b);
    setRound((n) => n + 1);
    setGame(next);
    gameRef.current = next;
    if (b.wars) {
      tell("war");
      await sleep(900);
      if (!alive.current) return true;
      tell(b.winner === "you" ? "you-win-war" : "mote-win-war");
    }
    const end = winnerOf(next);
    if (end) {
      setAuto(false);
      setStats(addToStats(STATS, end));
      tell(end === "you" ? "you-win" : "mote-win");
      busy.current = false;
      return b.wars > 0;
    }
    // The lead changing hands, and a pile running low, said once each.
    const lead = next.mote.length - next.you.length;
    const s = said.current;
    if (Math.abs(lead) <= 4) s.lead = "";
    if (lead >= 10 && s.lead !== "mote") {
      s.lead = "mote";
      tell("mote-ahead");
    } else if (lead <= -10 && s.lead !== "you") {
      s.lead = "you";
      tell("you-ahead");
    } else if (next.mote.length <= 5 && s.low !== "mote") {
      s.low = "mote";
      tell("mote-low");
    } else if (next.you.length <= 5 && s.low !== "you") {
      s.low = "you";
      tell("you-low");
    } else if (!b.wars) tell(b.winner === "you" ? "you-take" : "mote-take");
    if (next.mote.length > 8 && next.you.length > 8) s.low = "";
    busy.current = false;
    return b.wars > 0;
  }, [tell]);

  // Keep flipping: round after round until stopped (or it's over).
  useEffect(() => {
    if (!auto) return;
    let stop = false;
    void (async () => {
      while (!stop && alive.current && !winnerOf(gameRef.current)) {
        const war = await flip();
        await sleep(war ? AFTER_WAR_MS : AUTO_MS);
      }
    })();
    return () => {
      stop = true;
    };
  }, [auto, flip]);

  const newGame = () => {
    if (!winner && game.rounds > 0 && !sure) {
      setSure(true);
      window.setTimeout(() => alive.current && setSure(false), 3000);
      return;
    }
    setSure(false);
    setAuto(false);
    mayWin.current = rollMayWin();
    const g = deal({ mayWin: mayWin.current });
    setGame(g);
    gameRef.current = g;
    setBattle(null);
    said.current = { lead: "", low: "" };
    tell("start");
  };

  const close = () => {
    setAuto(false);
    if (!winner && game.rounds > 0) tell("pause");
    onClose();
  };

  const record = stats.you + stats.mote > 0 ? `You ${stats.you} · Mote ${stats.mote}` : null;

  return (
    <div className="ck war">
      <div className="ck-head">
        <p className="ck-meta">
          <strong>War</strong>
          {record ? <span>{record}</span> : null}
        </p>
        <button type="button" className={`ck-quiet${sure ? " is-sure" : ""}`} onClick={newGame}>
          {sure ? "Sure?" : "New game"}
        </button>
        <CloseButton onClick={close} />
      </div>

      <div className="war-table">
        <TableSide who="mote" count={game.mote.length} laid={battle?.mote ?? []} won={battle?.winner === "mote"} round={round} />
        <p className={`war-call${battle?.wars ? " is-war" : ""}`} aria-live="polite">
          {callFor(battle)}
        </p>
        <TableSide
          who="you"
          count={game.you.length}
          laid={battle?.you ?? []}
          won={battle?.winner === "you"}
          round={round}
          onFlip={winner || auto ? undefined : () => void flip()}
        />
      </div>

      {winner ? (
        <EndPanel onAgain={newGame} onDone={onClose}>
          {winner === "you" ? "You win the war!" : "Mote wins the war."}
        </EndPanel>
      ) : (
        <div className="ck-buttons war-foot">
          <button type="button" className="ck-primary" onClick={() => void flip()} disabled={auto}>
            Flip
          </button>
          <button type="button" className="ck-secondary" onClick={() => setAuto((a) => !a)}>
            {auto ? "Stop" : "Keep flipping"}
          </button>
        </div>
      )}
    </div>
  );
}

/** What happened this round, in words. */
function callFor(b: Battle | null): string {
  if (!b) return "Flip your top card.";
  const top = (laid: Battle["you"]) => laid[laid.length - 1];
  const yours = top(b.you);
  const motes = top(b.mote);
  const war = b.wars === 1 ? "War! " : b.wars > 1 ? `${b.wars} wars! ` : "";
  if (!yours || !motes) return `${war}${b.winner === "you" ? "Mote ran out" : "You ran out"}.`;
  return b.winner === "you"
    ? `${war}Your ${rankWord(yours)} takes ${b.wars ? "it all" : `Mote’s ${rankWord(motes)}`}.`
    : `${war}Mote’s ${rankWord(motes)} takes ${b.wars ? "it all" : `your ${rankWord(yours)}`}.`;
}

/** One side of the table: the pile (yours is clicked to flip), how many cards
 * are in it, and what was laid this round. */
function TableSide({
  who,
  count,
  laid,
  won,
  round,
  onFlip,
}: {
  who: Side;
  count: number;
  laid: Battle["you"];
  won: boolean;
  round: number;
  onFlip?: () => void;
}) {
  // A thicker pile looks thicker: up to three backs, a little apart.
  const layers = count > 30 ? 3 : count > 12 ? 2 : count > 0 ? 1 : 0;
  const pile = (
    <>
      {layers === 0 ? <span className="war-empty" /> : null}
      {Array.from({ length: layers }, (_, i) => (
        <CardBack key={i} style={{ transform: `translate(${-i * 2}px, ${-i * 2}px)` } as CSSProperties} />
      ))}
    </>
  );
  const lastUp = laid.length - 1;
  return (
    <div className={`war-side is-${who}`}>
      <div className="war-pile-wrap">
        {onFlip ? (
          <button type="button" className="war-pile" aria-label={`Your pile, ${count} cards: flip the top one`} onClick={onFlip}>
            {pile}
          </button>
        ) : (
          <div className="war-pile" aria-label={`${who === "you" ? "Your" : "Mote’s"} pile, ${count} cards`}>
            {pile}
          </div>
        )}
        <span className="war-count">{count}</span>
      </div>
      <div className="war-laid" key={round}>
        {laid.map((card, i) =>
          card.up ? (
            <CardFace
              key={i}
              card={card}
              className={`war-card${i === lastUp && won ? " is-won" : ""}${i < lastUp ? " is-past" : ""}`}
            />
          ) : (
            <CardBack key={i} className="war-card is-down-laid" />
          ),
        )}
      </div>
    </div>
  );
}
