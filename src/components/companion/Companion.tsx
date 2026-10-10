import { useEffect, useRef } from "react";
import { Face } from "@/components/companion/Face";
import type { EngineOptions, FaceEngine } from "@/components/companion/engine";
import { DEBUG_DEFAULTS, listenBus, send, type DebugState } from "@/lib/companion/bus";
import { onAudioElsewhere, onWindowMoved } from "@/lib/companion/desktop";
import { useSettings } from "@/lib/companion/settings";

type Audio = EngineOptions["audio"];

/** Where the debug window's pretend sound comes from, in screen points. */
const FAKE_AUDIO: Record<"left" | "right", NonNullable<Audio>> = {
  left: { dx: -700, dy: 0 },
  right: { dx: 700, dy: 0 },
};

export function Companion() {
  const engineRef = useRef<FaceEngine | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [settings] = useSettings();
  const debugState = useRef<DebugState>({ ...DEBUG_DEFAULTS });
  const events = useRef<string[]>([]);
  const realAudio = useRef<Audio>(null);
  const press = useRef<{ x: number; y: number; moved: number; stroked: number; at: number } | null>(
    null,
  );

  // Sound playing in another window, or the debug window's pretend version of it.
  const applyAudio = () => {
    const fake = debugState.current.fakeAudio;
    engineRef.current?.configure({ audio: fake ? FAKE_AUDIO[fake] : realAudio.current });
  };

  const { followPointer, naps, energy, headphones, mustache, debug } = settings;
  useEffect(() => {
    engineRef.current?.configure({ followPointer, naps, energy, headphones, mustache });
  }, [followPointer, naps, energy, headphones, mustache]);

  useEffect(
    () =>
      onAudioElsewhere((audio) => {
        const was = realAudio.current !== null;
        realAudio.current = audio;
        if (was !== (audio !== null)) {
          events.current.push(audio ? "sound playing in another window" : "other sound stopped");
        }
        applyAudio();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => onWindowMoved((dx, dy) => engineRef.current?.windowMoved(dx, dy)), []);

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

  // A quick press on Mote's body is a poke; pressing and dragging across it is
  // petting. Presses on the empty window around Mote do nothing.
  return (
    <button
      ref={buttonRef}
      type="button"
      className="window"
      aria-label="Mote"
      onPointerDown={(e) => {
        if (!engineRef.current?.hitTest(e.clientX, e.clientY)) return;
        press.current = { x: e.clientX, y: e.clientY, moved: 0, stroked: 0, at: performance.now() };
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
          engine?.configure({ followPointer, naps, energy, headphones, mustache });
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
      />
    </button>
  );
}
