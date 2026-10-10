import { useCallback, useEffect, useRef, useState } from "react";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import { Face } from "@/components/companion/Face";
import { SpeechBubble } from "@/components/companion/SpeechBubble";
import type { Bubble } from "@/components/companion/speech";
import { GEO } from "@/lib/companion/theme";
import type { EngineOptions, FaceEngine, Item, MediaKind } from "@/components/companion/engine";
import { DEBUG_DEFAULTS, listenBus, send, type DebugState } from "@/lib/companion/bus";
import {
  onMediaElsewhere,
  onPointerElsewhere,
  onTypingElsewhere,
  onWindowMoved,
  windowPlacement,
} from "@/lib/companion/desktop";
import { useSettings } from "@/lib/companion/settings";

type MediaInfo = EngineOptions["media"];

/** The debug window's pretend media: a window off to one side playing something. */
function pretend(side: "left" | "right", kind: MediaKind): NonNullable<MediaInfo> {
  return { dx: side === "left" ? -700 : 700, dy: 0, kind, app: "Pretend" };
}

export function Companion() {
  const engineRef = useRef<FaceEngine | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [settings] = useSettings();
  const debugState = useRef<DebugState>({ ...DEBUG_DEFAULTS });
  const events = useRef<string[]>([]);
  const realMedia = useRef<MediaInfo>(null);
  const press = useRef<{ x: number; y: number; moved: number; stroked: number; at: number } | null>(
    null,
  );
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [sleepSet, setSleepSet] = useState(false);
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
    const { fakeAudio, fakeKind } = debugState.current;
    engineRef.current?.configure({
      media: fakeAudio ? pretend(fakeAudio, fakeKind) : realMedia.current,
    });
  };

  const { followPointer, naps, energy, headphones, mustache, friendly, debug } = settings;
  useEffect(() => {
    engineRef.current?.configure({ followPointer, naps, energy, headphones, mustache, friendly });
  }, [followPointer, naps, energy, headphones, mustache, friendly]);

  useEffect(
    () =>
      onMediaElsewhere((media) => {
        const was = realMedia.current;
        realMedia.current = media;
        if ((was === null) !== (media === null)) {
          events.current.push(
            media ? `${media.kind} playing in another window` : "other media stopped",
          );
        }
        applyAudio();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => onWindowMoved((dx, dy) => engineRef.current?.windowMoved(dx, dy)), []);
  useEffect(
    () =>
      onPointerElsewhere((dx, dy, inside) => engineRef.current?.pointerElsewhere(dx, dy, inside)),
    [],
  );
  useEffect(() => onTypingElsewhere((dx, dy) => engineRef.current?.typingAt(dx, dy)), []);

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
        e.setSleepLine(false);
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
      else if (cmd.do === "sleepLine") e.setSleepLine((d.sleepLine = cmd.value));
      else if (cmd.do === "feeling") e.setFeeling(cmd.attr, cmd.value);
      else if (cmd.do === "resetFeelings") e.resetFeelings();
      else if (cmd.do === "react") e.react(cmd.id);
      else if (cmd.do === "say") e.say(cmd.id);
      else if (cmd.do === "fakeKind") {
        d.fakeKind = cmd.value;
        applyAudio();
      } else if (cmd.do === "fakeAudio") {
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

  // A quick press on Mote's body is a poke; pressing and dragging across it is
  // petting. Presses on the empty window around Mote do nothing.
  return (
    <div className="stage">
      <button
        ref={buttonRef}
        type="button"
        className="window"
        aria-label="Mote"
        onPointerDown={(e) => {
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
            engine?.configure({ followPointer, naps, energy, headphones, mustache, friendly });
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
          onSpeech={(b) => {
            if (b) measure();
            setBubble(b);
          }}
          onSleepSet={setSleepSet}
        />
      </button>
      <Tray sleepSet={sleepSet} onUse={(item) => engineRef.current?.useItem(item)} />
      <SpeechBubble
        bubble={bubble}
        anchor={anchor}
        onAnswer={(yes) => engineRef.current?.answer(yes)}
        onDismiss={() => engineRef.current?.dismissSpeech()}
      />
    </div>
  );
}

/**
 * Things to give Mote, along the bottom of the window. Tucked away until the
 * pointer comes into the window.
 */
function Tray({ sleepSet, onUse }: { sleepSet: boolean; onUse: (item: Item) => void }) {
  return (
    <div className="tray" role="toolbar" aria-label="Things to give Mote">
      <button
        type="button"
        className="tray-item"
        aria-pressed={sleepSet}
        aria-label={sleepSet ? "Take off the earmuffs and sleep mask" : "Earmuffs and sleep mask"}
        title={sleepSet ? "Take off the earmuffs and mask" : "Earmuffs and sleep mask"}
        onClick={() => onUse("sleepset")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            className="tray-fill"
            d="M3 10.5Q12 6 21 10.5Q22.5 14.5 19.5 16.5Q15.5 17.5 12 15.5Q8.5 17.5 4.5 16.5Q1.5 14.5 3 10.5Z"
          />
          <path className="tray-cut" d="M6.5 12.2Q8 13.6 9.5 12.2M14.5 12.2Q16 13.6 17.5 12.2" />
        </svg>
      </button>
      <button
        type="button"
        className="tray-item"
        aria-label="Give Mote a snack"
        title="A snack"
        onClick={() => onUse("snack")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="tray-cookie" cx="12" cy="12" r="8" />
          <circle className="tray-chip" cx="9.5" cy="10" r="1.3" />
          <circle className="tray-chip" cx="14.5" cy="11.5" r="1.1" />
          <circle className="tray-chip" cx="11" cy="15" r="1.2" />
        </svg>
      </button>
      <button
        type="button"
        className="tray-item"
        aria-label="Play ball with Mote"
        title="Play ball"
        onClick={() => onUse("ball")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="tray-ball" cx="12" cy="12" r="8" />
          <path className="tray-seam" d="M4.5 10.5Q12 15 19.5 10.5M8.5 5Q12 12 8.5 19" />
        </svg>
      </button>
    </div>
  );
}
