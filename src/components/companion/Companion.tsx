import { useCallback, useEffect, useRef, useState } from "react";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import { Face } from "@/components/companion/Face";
import { Helper, type Gift } from "@/components/companion/Helper";
import { SpeechBubble } from "@/components/companion/SpeechBubble";
import type { Bubble } from "@/components/companion/speech";
import { GEO } from "@/lib/companion/theme";
import type { EngineOptions, FaceEngine } from "@/components/companion/engine";
import { DEBUG_DEFAULTS, listenBus, send, type DebugState } from "@/lib/companion/bus";
import {
  onDropped,
  openCaloriesWindow,
  openLink,
  onMediaElsewhere,
  onPointerElsewhere,
  onTypingElsewhere,
  onWindowMoved,
  setHelpingSize,
  windowPlacement,
} from "@/lib/companion/desktop";
import { useSettings } from "@/lib/companion/settings";
import { CaloriePad } from "@/components/companion/CaloriePad";
import { applyToBook, dateKey, readBook } from "@/lib/companion/calories";
import { markCalorieCare, useCalorieBook } from "@/lib/companion/calorie-store";

type MediaInfo = EngineOptions["media"];

/** The debug window's pretend media: a window off to one side playing something. */
function pretend(side: "left" | "right"): NonNullable<MediaInfo> {
  return { dx: side === "left" ? -700 : 700, dy: 0, app: "Pretend" };
}

export function Companion() {
  const engineRef = useRef<FaceEngine | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [settings] = useSettings();
  const [book, commitBook] = useCalorieBook();
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [logging, setLogging] = useState(false);
  const debugState = useRef<DebugState>({ ...DEBUG_DEFAULTS });
  const events = useRef<string[]>([]);
  const realMedia = useRef<MediaInfo>(null);
  const press = useRef<{ x: number; y: number; moved: number; stroked: number; at: number } | null>(
    null,
  );
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [gift, setGift] = useState<Gift | null>(null);
  const [helping, setHelping] = useState(false);
  const getEngine = useCallback(() => engineRef.current, []);
  // Mote's own resizing moves the window; that isn't someone flinging it.
  const ownMoveUntil = useRef(0);
  useEffect(() => {
    ownMoveUntil.current = performance.now() + 800;
    setHelpingSize(helping);
  }, [helping]);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });

  // The bubble's tail points down at Mote, just above the eyes.
  const measure = useCallback(() => {
    const svg = buttonRef.current?.querySelector("svg.face");
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const eyeTop = (GEO.eyeY - GEO.eyeH / 2 - 6) / GEO.vbH;
    setAnchor({ x: r.left + r.width / 2, y: r.top + r.height * eyeTop });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Let Mote know roughly where on the screen the window is.
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const placement = await windowPlacement();
      if (alive) engineRef.current?.configure({ placement });
    };
    void check();
    const t = window.setInterval(check, 3000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  // Media playing in another window, or the debug window's pretend version of it.
  const applyAudio = () => {
    const { fakeAudio } = debugState.current;
    engineRef.current?.configure({
      media: fakeAudio ? pretend(fakeAudio) : realMedia.current,
    });
  };

  const { followPointer, naps, energy, debug, pace, calorieGoal } = settings;
  useEffect(() => {
    engineRef.current?.configure({ followPointer, naps, energy, calorieGoal });
  }, [followPointer, naps, energy, calorieGoal]);

  useEffect(
    () =>
      onMediaElsewhere((media) => {
        const was = realMedia.current;
        realMedia.current = media;
        if ((was === null) !== (media === null)) {
          events.current.push(media ? "sound playing in another window" : "other sound stopped");
        }
        applyAudio();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(
    () =>
      onWindowMoved((dx, dy) => {
        if (performance.now() > ownMoveUntil.current) engineRef.current?.windowMoved(dx, dy);
      }),
    [],
  );
  useEffect(
    () =>
      onPointerElsewhere((dx, dy, inside) => engineRef.current?.pointerElsewhere(dx, dy, inside)),
    [],
  );
  useEffect(() => onTypingElsewhere((dx, dy) => engineRef.current?.typingAt(dx, dy)), []);
  // Folders and videos dropped on the window, for Mote to help with.
  const give = useCallback((paths: string[]) => {
    setGift((g) => ({ paths, seq: (g?.seq ?? 0) + 1 }));
  }, []);
  useEffect(
    () =>
      onDropped(
        (over) => engineRef.current?.dragHover(over),
        (paths) => give(paths),
        (link) => engineRef.current?.saveLink(link.url, link.title),
      ),
    [give],
  );

  // Debug mode: take orders from the debug window and report back ~10× a second.
  useEffect(() => {
    if (!debug) {
      const e = engineRef.current;
      if (e) {
        e.setTimeScale(1);
        e.setFrozen(false);
        e.setAutoMoods(true);
        e.setLoop(false);
        e.setGuides(false);
        e.setManual(null);
      }
      debugState.current = { ...DEBUG_DEFAULTS };
      applyAudio();
      events.current = [];
      return;
    }
    const stop = listenBus((msg) => {
      const e = engineRef.current;
      if (msg.type !== "debug" || !e) return;
      const cmd = msg.cmd;
      const d = debugState.current;
      if (cmd.do === "force") e.force(cmd.mood);
      else if (cmd.do === "blink") e.blink(cmd.double);
      else if (cmd.do === "poke") e.poke();
      else if (cmd.do === "timeScale") e.setTimeScale((d.timeScale = cmd.value));
      else if (cmd.do === "frozen") e.setFrozen((d.frozen = cmd.value));
      else if (cmd.do === "autoMoods") e.setAutoMoods((d.autoMoods = cmd.value));
      else if (cmd.do === "loop") e.setLoop((d.loop = cmd.value));
      else if (cmd.do === "guides") e.setGuides((d.guides = cmd.value));
      else if (cmd.do === "feeling") e.setFeeling(cmd.attr, cmd.value);
      else if (cmd.do === "resetFeelings") e.resetFeelings();
      else if (cmd.do === "react") e.react(cmd.id);
      else if (cmd.do === "say") e.say(cmd.id);
      else if (cmd.do === "give") give(cmd.paths);
      else if (cmd.do === "saveLink") e.saveLink(cmd.url, cmd.title);
      else if (cmd.do === "suggestLink") e.suggestLink(cmd.url);
      else if (cmd.do === "fakeAudio") {
        d.fakeAudio = cmd.value;
        applyAudio();
      } else if (cmd.do === "manual") {
        d.manual = cmd.face !== null;
        e.setManual(cmd.face);
      }
    });
    const timer = window.setInterval(() => {
      const e = engineRef.current;
      if (!e) return;
      send({
        type: "state",
        snap: e.snapshot(),
        debug: { ...debugState.current },
        events: events.current.splice(0),
      });
    }, 100);
    return () => {
      stop();
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debug]);

  useEffect(() => {
    if (!menuAt) return;
    const close = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Element && target.closest(".mote-menu")) return;
      setMenuAt(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (menuAt) setMenuAt(null);
      else if (logging) setLogging(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuAt, logging]);

  const todayTotal = book.days[dateKey()]?.total ?? 0;
  const changeCalories = (kind: "add" | "sub" | "set", amount: number) => {
    const result = applyToBook(readBook(), calorieGoal, { kind, amount });
    if (!result) return;
    commitBook(result.book);
    engineRef.current?.noteCalories(result.moment);
  };

  // A quick press on Mote's body is a poke; pressing and dragging across it is
  // petting. Presses on the empty window around Mote do nothing. A right-click
  // opens Mote's menu.
  return (
    <div
      className={`stage${helping ? " is-helping" : ""}${logging ? " is-logging" : ""}`}
      onContextMenu={(e) => {
        const target = e.target;
        if (target instanceof Element && target.closest("input, textarea")) return;
        e.preventDefault();
        // Not while Mote is helping with files: that conversation has the window.
        if (helping) return;
        if (target instanceof Element && target.closest(".cal-pad, .mote-menu")) return;
        const width = 196;
        const height = 100;
        setMenuAt({
          x: Math.max(8, Math.min(e.clientX, window.innerWidth - width - 8)),
          y: Math.max(8, Math.min(e.clientY, window.innerHeight - height - 8)),
        });
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="window"
        aria-label="Mote"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if (!engineRef.current?.hitTest(e.clientX, e.clientY)) {
            engineRef.current?.react("empty-click");
            return;
          }
          press.current = {
            x: e.clientX,
            y: e.clientY,
            moved: 0,
            stroked: 0,
            at: performance.now(),
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = press.current;
          const engine = engineRef.current;
          if (!p || !engine) return;
          const step = Math.hypot(e.clientX - p.x, e.clientY - p.y);
          p.moved += step;
          p.x = e.clientX;
          p.y = e.clientY;
          if (!engine.hitTest(e.clientX, e.clientY)) return;
          // It only counts as petting after a proper stroke: well over a second
          // of moving across the face, covering a good distance.
          p.stroked += step;
          const width = e.currentTarget.getBoundingClientRect().width || 300;
          if (p.stroked > width * 1.6 && performance.now() - p.at > 1100) {
            engine.pet(e.clientX, e.clientY);
          }
        }}
        onPointerUp={() => {
          const p = press.current;
          press.current = null;
          if (p && p.moved < 8) engineRef.current?.poke();
        }}
        onPointerCancel={() => {
          press.current = null;
        }}
        onClick={(e) => {
          // Enter or Space on the focused window counts as a poke too.
          if (e.detail === 0) engineRef.current?.poke();
        }}
      >
        <Face
          onEngine={(engine) => {
            engineRef.current = engine;
            engine?.configure({ followPointer, naps, energy, calorieGoal });
            applyAudio();
          }}
          onMood={(label) => {
            const button = buttonRef.current;
            if (!button) return;
            const next = label ?? "Mote";
            if (button.getAttribute("aria-label") !== next) button.setAttribute("aria-label", next);
          }}
          onEvent={(text) => {
            if (!debug) return;
            events.current.push(text);
            if (events.current.length > 200) events.current.shift();
          }}
          onOpenLink={openLink}
          onSpeech={(b) => {
            if (b) measure();
            setBubble(b);
          }}
        />
      </button>
      <Helper
        engine={getEngine}
        pace={pace}
        gift={gift}
        onOpen={(open) => {
          setHelping(open);
          if (open) setLogging(false);
        }}
      />
      {menuAt ? (
        <div className="mote-menu" style={{ left: menuAt.x, top: menuAt.y }} role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuAt(null);
              setLogging(true);
              markCalorieCare();
            }}
          >
            Log calories
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuAt(null);
              markCalorieCare();
              openCaloriesWindow();
            }}
          >
            See the days
          </button>
        </div>
      ) : null}
      {logging ? (
        <CaloriePad
          total={todayTotal}
          goal={calorieGoal}
          onAdd={(amount) => changeCalories("add", amount)}
          onSub={(amount) => changeCalories("sub", amount)}
          onSet={(amount) => changeCalories("set", amount)}
          onClose={() => setLogging(false)}
        />
      ) : null}
      <SpeechBubble
        bubble={bubble}
        anchor={anchor}
        onAnswer={(yes) => engineRef.current?.answer(yes)}
        onDismiss={() => engineRef.current?.dismissSpeech()}
      />
    </div>
  );
}
