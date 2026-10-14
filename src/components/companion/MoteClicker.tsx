import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { FaceEngine } from "@/components/companion/engine";
import type { ClickerEvent } from "@/components/companion/clicker-lines";
import {
  THINGS,
  buyThing,
  buyUpgrade,
  canAfford,
  catchGolden,
  catchUp,
  click,
  ecoBonus,
  ecoStep,
  fresh,
  goldenStay,
  goldenWait,
  illion,
  milestone,
  offers,
  osBonus,
  perClick,
  perSecond,
  revive,
  thingCost,
  thingRate,
  tick,
  toSaved,
  words,
  type Clicker,
  type D,
  type Upgrade,
} from "@/lib/clicker/game";
import { CloseButton } from "./board-ui";
import { MoteMark, useLook } from "./MoteMark";
import { LineIcon, ThingIcon } from "./clicker-icons";
import { load, store } from "./board-store";
import "./clicker.css";

// Mote Clicker: click the little Mote for motes, and spend them on Mac
// things that make more on their own (see lib/clicker/game.ts for the
// numbers). Mote watches while you play, cheers the big moments, and goes
// back to their own business when you leave it running. Nothing resets:
// it's saved as you go, and keeps making motes while it's put away.

type Props = {
  engine: () => FaceEngine | null;
  onClose: () => void;
};

const SAVE = "mote.clicker";
/** How often the numbers move (ms). */
const TICK_MS = 100;
const SAVE_MS = 5000;
/** Mote only watches while you've done something in the last little while. */
const WATCH_MS = 30_000;
/** Mote's remarks are spaced out at least this much (big moments aside). */
const QUIET_MS = 40_000;
/** Away at least this long and Mote mentions what was made meanwhile. */
const AWAY_MS = 60_000;

type Amount = 1 | 10 | 100 | "max";
type Tab = "things" | "upgrades";

/** A "+12" floating up from a click, and the little motes that pop out. */
type Pop = { id: number; x: number; y: number; text: string };

type Golden = { id: number; x: number; y: number; until: number };

/** A number split for showing big: "1.23" and "million". */
function bigParts(d: D): { num: string; name: string } {
  const w = words(d);
  const at = w.indexOf(" ");
  if (at < 0 || w.includes("×")) return { num: w, name: "" };
  return { num: w.slice(0, at), name: w.slice(at + 1) };
}

/** "a million", "a thousand", for Mote to say. */
const milestoneWords = (m: number) => {
  const name = illion(m - 1);
  return name ? `a ${name}` : "so many";
};

export function MoteClicker({ engine, onClose }: Props) {
  const look = useLook();
  // The saved game, caught up on whatever was made while it was put away.
  const start = useMemo(() => {
    const saved = revive(load(SAVE));
    if (!saved) return { game: fresh(), away: null as null | { got: D; ms: number }, resumed: false };
    const { game, got, ms } = catchUp(saved);
    return { game, away: ms >= AWAY_MS && got.gt(0) ? { got, ms } : null, resumed: true };
  }, []);
  const [game, setGame] = useState<Clicker>(start.game);
  // The game as it is this moment (clicks can come faster than the screen
  // redraws, so each one builds on the last, not on what's drawn).
  const gameRef = useRef(game);
  const commit = useCallback((next: Clicker) => {
    gameRef.current = next;
    setGame(next);
  }, []);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>("things");
  const [amount, setAmount] = useState<Amount>(1);
  const [pops, setPops] = useState<Pop[]>([]);
  const [golden, setGolden] = useState<Golden | null>(null);
  const [note, setNote] = useState<string | null>(
    start.away ? `While you were away: ${words(start.away.got)} motes` : null,
  );
  const [squish, setSquish] = useState(0);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const popId = useRef(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<SVGSVGElement>(null);

  // Mote's remarks, spaced out so they never become noise.
  const lastSaid = useRef(0);
  const tell = useCallback(
    (event: ClickerEvent, said?: { thing?: string; amount?: string; os?: string }, always = false) => {
      const t = Date.now();
      if (!always && t - lastSaid.current < QUIET_MS) return;
      lastSaid.current = t;
      engine()?.clicker(event, said);
    },
    [engine],
  );

  // Mote watches while you play, and drifts back to their own things when
  // you leave it running.
  const lastActive = useRef(Date.now());
  const watching = useRef(false);
  const active = useCallback(() => {
    lastActive.current = Date.now();
    if (!watching.current) {
      watching.current = true;
      engine()?.setBoardGame("you");
    }
  }, [engine]);

  const save = useCallback(() => store(SAVE, toSaved(gameRef.current)), []);

  useEffect(() => {
    active();
    if (start.away) tell("away", { amount: words(start.away.got) }, true);
    else tell(start.resumed ? "resume" : "start", undefined, true);
    const onHide = () => save();
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      save();
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onHide);
      engine()?.setBoardGame(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Time passing: motes made, buffs running out, Mote looking away when
  // you've wandered off, and saving now and then.
  useEffect(() => {
    let last = Date.now();
    let lastSave = last;
    const t = window.setInterval(() => {
      const at = Date.now();
      commit(tick(gameRef.current, at - last, at));
      last = at;
      setNow(at);
      if (watching.current && at - lastActive.current > WATCH_MS) {
        watching.current = false;
        engine()?.setBoardGame(null);
      }
      if (at - lastSave > SAVE_MS) {
        lastSave = at;
        save();
      }
    }, TICK_MS);
    return () => window.clearInterval(t);
  }, [engine, save, commit]);

  // Milestones: each new named number the all-time total passes.
  const reached = useRef(milestone(game.total));
  useEffect(() => {
    const m = milestone(game.total);
    if (m <= reached.current) return;
    reached.current = m;
    // Early on these come quickly; Mote only cheers the ones from a million.
    if (m >= 2) tell("milestone", { amount: milestoneWords(m) });
  }, [game.total, tell]);

  // Golden motes: one turns up now and then, drifts about for a little
  // while, and is gone if nobody catches it.
  useEffect(() => {
    if (golden) {
      const left = golden.until - Date.now();
      const t = window.setTimeout(() => {
        setGolden(null);
        tell("golden-missed");
      }, Math.max(0, left));
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      const g = gameRef.current;
      setGolden({
        id: Date.now(),
        x: 0.12 + Math.random() * 0.76,
        y: 0.18 + Math.random() * 0.64,
        until: Date.now() + goldenStay(g) * 1000,
      });
      tell("golden");
    }, goldenWait(gameRef.current) * 1000);
    return () => window.clearTimeout(t);
    // A new wait starts each time one goes (caught or not).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [golden]);

  // Lots of clicking, fast: Mote notices (now and then).
  const recentClicks = useRef<number[]>([]);
  const lastSpree = useRef(0);

  const addPop = (x: number, y: number, text: string) => {
    const id = ++popId.current;
    setPops((p) => [...p.slice(-14), { id, x, y, text }]);
    window.setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 900);
  };

  const clickMote = (e: ReactPointerEvent<HTMLButtonElement>) => {
    active();
    const at = Date.now();
    const { game: next, got } = click(gameRef.current, at);
    commit(next);
    setSquish((n) => n + 1);
    const box = heroRef.current?.getBoundingClientRect();
    // Keyboard presses pop from the middle.
    const x = box ? (e.clientX && e.clientY ? e.clientX - box.left : box.width * 0.22) : 0;
    const y = box ? (e.clientX && e.clientY ? e.clientY - box.top : box.height * 0.4) : 0;
    addPop(x, y, `+${words(got)}`);
    const recent = [...recentClicks.current.filter((c) => at - c < 8000), at];
    recentClicks.current = recent;
    if (recent.length >= 45 && at - lastSpree.current > 5 * 60_000) {
      lastSpree.current = at;
      tell("spree");
    }
  };

  const catchIt = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    active();
    const at = Date.now();
    const { game: next, what } = catchGolden(gameRef.current, at);
    commit(next);
    setGolden(null);
    const box = heroRef.current?.getBoundingClientRect();
    if (box) addPop(e.clientX - box.left, e.clientY - box.top, what.kind === "lucky" ? `+${words(what.got)}` : what.kind === "frenzy" ? "×7" : "Clicks ×77");
    if (what.kind === "lucky") {
      setNote(`Lucky! ${words(what.got)} motes`);
      tell("golden-lucky", { amount: words(what.got) }, true);
    } else if (what.kind === "frenzy") {
      setNote(`Seven times the motes, for ${what.seconds} seconds`);
      tell("golden-frenzy", undefined, true);
    } else {
      setNote(`Clicks are worth 77 times as much, for ${what.seconds} seconds`);
      tell("golden-clicks", undefined, true);
    }
  };

  // The little Mote looks at the pointer.
  const look_ = (e: React.PointerEvent) => {
    const r = markRef.current?.getBoundingClientRect();
    if (!r) return;
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 160) * 5;
    setGaze({ x: (dx / d) * k, y: (dy / d) * k * 0.8 });
  };

  const howMany = (i: number) => (amount === "max" ? Math.max(1, canAfford(game, i)) : amount);

  const buy = (i: number) => {
    const n = howMany(i);
    const before = gameRef.current;
    const next = buyThing(before, i, n);
    if (!next) return;
    active();
    commit(next);
    if (!before.owned[i]) tell("first-thing", { thing: THINGS[i].name });
  };

  const upgrade = (u: Upgrade) => {
    const next = buyUpgrade(gameRef.current, u.id);
    if (!next) return;
    active();
    commit(next);
    if (u.line === "os") tell("os", { os: u.name });
    else tell("upgrade");
  };

  /** Every upgrade you can afford, cheapest first. */
  const buyAll = () => {
    let g = gameRef.current;
    let os: string | null = null;
    for (let n = 0; n < 200; n++) {
      const u = offers(g).find((o) => g.bank.gte(o.cost));
      if (!u) break;
      g = buyUpgrade(g, u.id) ?? g;
      if (u.line === "os") os = u.name;
    }
    if (g === gameRef.current) return;
    active();
    commit(g);
    if (os) tell("os", { os });
    else tell("upgrade");
  };

  const rate = perSecond(game, now);
  const per = perClick(game, now);
  const bank = bigParts(game.bank);
  const offered = offers(game);
  const ready = offered.filter((u) => game.bank.gte(u.cost)).length;
  const buff = game.buff && game.buff.until > now ? game.buff : null;

  // The things on show: everything you have, and the next one or two.
  const firstNew = game.owned.findIndex((n) => n === 0);
  const shown = THINGS.map((_, i) => i).filter((i) => firstNew < 0 || i <= firstNew + 1);

  // Upgrades can't be bought in tens; Max buys the most of a thing you can.
  const status = note ?? `${motes(game.total)} made in all`;
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 6000);
    return () => window.clearTimeout(t);
  }, [note]);

  return (
    <div className="ck mc" onPointerMove={look_}>
      <div className="ck-head">
        <p className="ck-meta">
          <strong>Mote Clicker</strong>
        </p>
        <CloseButton onClick={onClose} />
      </div>

      <div className="mc-hero" ref={heroRef}>
        <button
          type="button"
          className="mc-mote"
          aria-label={`Click for ${words(per)} motes`}
          onPointerDown={(e) => {
            if (e.button === 0) clickMote(e);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            clickMote(e as unknown as ReactPointerEvent<HTMLButtonElement>);
          }}
        >
          <svg ref={markRef} viewBox="0 0 100 100" className="mc-mark" key={squish} aria-hidden="true">
            <MoteMark look={look} cx={50} cy={48} r={42} drop={5} gaze={gaze} />
          </svg>
        </button>

        <div className="mc-count">
          <p className="mc-bank" aria-live="off">
            <span className="mc-num">{bank.num}</span>
            <span className="mc-unit">{bank.name ? `${bank.name} motes` : bank.num === "1" ? "mote" : "motes"}</span>
          </p>
          <p className="mc-rate">
            {words(rate)} a second
            {buff ? (
              <span className="mc-buff">
                {buff.kind === "frenzy" ? "×7" : "Clicks ×77"} · {Math.ceil((buff.until - now) / 1000)}s
              </span>
            ) : null}
          </p>
          <p className="mc-per">{words(per)} a click</p>
        </div>

        {pops.map((p) => (
          <span key={p.id} className="mc-pop" style={{ left: p.x, top: p.y }} aria-hidden="true">
            {p.text}
          </span>
        ))}

        {golden ? (
          <button
            key={golden.id}
            type="button"
            className="mc-golden"
            style={{ left: `${golden.x * 100}%`, top: `${golden.y * 100}%`, animationDuration: `${goldenStay(game)}s` }}
            aria-label="Catch the golden mote"
            onPointerDown={catchIt}
          >
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <circle className="mc-golden-glow" cx="16" cy="16" r="15" />
              <circle className="mc-golden-body" cx="16" cy="16" r="10" />
              <rect className="mc-golden-eye" x="12" y="12.5" width="2.6" height="6" rx="1.3" />
              <rect className="mc-golden-eye" x="17.4" y="12.5" width="2.6" height="6" rx="1.3" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="mc-bar">
        <div className="mc-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "things"} className={tab === "things" ? "is-on" : ""} onClick={() => setTab("things")}>
            Mac things
          </button>
          <button type="button" role="tab" aria-selected={tab === "upgrades"} className={tab === "upgrades" ? "is-on" : ""} onClick={() => setTab("upgrades")}>
            Upgrades
            {ready ? <span className="mc-badge">{ready}</span> : null}
          </button>
        </div>
        {tab === "things" ? (
          <div className="mc-amounts" role="group" aria-label="How many to buy">
            {([1, 10, 100, "max"] as Amount[]).map((a) => (
              <button key={a} type="button" className={amount === a ? "is-on" : ""} onClick={() => setAmount(a)}>
                {a === "max" ? "Max" : `×${a}`}
              </button>
            ))}
          </div>
        ) : ready > 1 ? (
          <button type="button" className="ck-quiet mc-all" onClick={buyAll}>
            Buy all {ready}
          </button>
        ) : null}
      </div>

      <div className="mc-list">
        {tab === "things"
          ? shown.map((i) => {
              const thing = THINGS[i];
              const owned = game.owned[i];
              const unknown = !owned && i > 0 && game.owned[i - 1] === 0;
              const n = howMany(i);
              const cost = thingCost(game, i, n);
              const can = game.bank.gte(cost);
              const each = thingRate({ ...game, owned: game.owned.map((o, k) => (k === i ? 1 : o)) }, i, now);
              const detail = owned
                ? `Each makes ${words(each)} a second; all ${owned} make ${words(thingRate(game, i, now))}.`
                : `Each makes ${words(each)} a second.`;
              return (
                <button
                  key={i}
                  type="button"
                  className={`mc-row${can ? " is-can" : ""}${unknown ? " is-unknown" : ""}`}
                  onClick={() => buy(i)}
                  disabled={!can}
                  title={unknown ? undefined : `${thing.about} ${detail}`}
                >
                  <span className={`mc-tile is-${thing.kind}`}>
                    <ThingIcon i={i} />
                  </span>
                  <span className="mc-what">
                    <span className="mc-name">{unknown ? "Something new" : thing.name}</span>
                    <span className="mc-about">{unknown ? "Keep going to find out." : thing.about}</span>
                  </span>
                  <span className="mc-price">
                    <span className="mc-cost">
                      {amount !== 1 && n > 1 ? `${n} for ` : ""}
                      {words(cost)}
                    </span>
                    {owned ? <span className="mc-owned">{owned.toLocaleString("en-US")} owned</span> : null}
                  </span>
                </button>
              );
            })
          : null}
        {tab === "upgrades" ? (
          offered.length ? (
            offered.map((u) => {
              const can = game.bank.gte(u.cost);
              return (
                <button
                  key={u.id}
                  type="button"
                  className={`mc-row${can ? " is-can" : ""}`}
                  onClick={() => upgrade(u)}
                  disabled={!can}
                >
                  <span className={`mc-tile is-${u.line}`}>
                    <LineIcon line={u.line} thing={u.thing} />
                  </span>
                  <span className="mc-what">
                    <span className="mc-name">{u.name}</span>
                    <span className="mc-about">{u.about}</span>
                  </span>
                  <span className="mc-price">
                    <span className="mc-cost">{words(u.cost)}</span>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="mc-empty">Nothing yet. Buy a few Mac things and upgrades will turn up here.</p>
          )
        ) : null}
      </div>

      <p className={`ck-status mc-status${note ? " is-note" : ""}`} aria-live="polite" title={stats(game)}>
        {status}
      </p>
    </div>
  );
}

/** "1 mote", "12 motes", "3.4 million motes". */
const motes = (d: D) => {
  const w = words(d);
  return `${w} ${w === "1" ? "mote" : "motes"}`;
};

/** The fine print, for hovering over the line along the bottom. */
function stats(g: Clicker): string {
  const owned = g.owned.reduce((n, k) => n + k, 0);
  return [
    `${words(g.total)} motes made in all, ${words(g.byClicks)} of them by clicking (${g.clicks.toLocaleString("en-US")} clicks).`,
    `${owned.toLocaleString("en-US")} Mac things, each making everything ${+(ecoStep(g) * 100).toFixed(3)}% better: ×${words(ecoBonus(g))} in all.`,
    g.os ? `macOS: ×${words(osBonus(g))}.` : "",
    g.goldens ? `${g.goldens} golden motes caught.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
