import { useEffect, useRef } from "react";
import { Face } from "@/components/companion/Face";
import type { FaceEngine } from "@/components/companion/engine";
import { DEBUG_DEFAULTS, listenBus, send, type DebugState } from "@/lib/companion/bus";
import { useSettings } from "@/lib/companion/settings";

export function Companion() {
  const engineRef = useRef<FaceEngine | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [settings] = useSettings();
  const debugState = useRef<DebugState>({ ...DEBUG_DEFAULTS });
  const events = useRef<string[]>([]);

  const { followPointer, naps, energy, debug } = settings;
  useEffect(() => {
    engineRef.current?.configure({ followPointer, naps, energy });
  }, [followPointer, naps, energy]);

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
      else if (cmd.do === "manual") {
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
  }, [debug]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="window"
      aria-label="Mote"
      onPointerDown={() => engineRef.current?.poke()}
    >
      <Face
        onEngine={(engine) => {
          engineRef.current = engine;
          engine?.configure({ followPointer, naps, energy });
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
