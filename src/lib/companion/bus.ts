import { emit, listen } from "@tauri-apps/api/event";
import type { EngineSnapshot, ManualFace, Mood } from "@/components/companion/engine";
import type { MindKey } from "@/components/companion/mind";
import type { FeatureState } from "@/lib/companion/features";
import type { Settings } from "@/lib/companion/settings";
import { isDesktopApp } from "@/lib/companion/desktop";

/** Debug's pretend media: sound, or music to dance to, on one side. */
export type FakeAudio = "left" | "right" | "music-slow" | "music-fast";

/** What the Debug tabs can ask Mote's window to do. */
export type DebugCommand =
  | { do: "hello" }
  | { do: "force"; mood: Mood }
  | { do: "blink"; double: boolean }
  | { do: "poke" }
  | { do: "timeScale"; value: number }
  | { do: "frozen"; value: boolean }
  | { do: "autoMoods"; value: boolean }
  | { do: "loop"; value: boolean }
  | { do: "guides"; value: boolean }
  | { do: "fakeAudio"; value: FakeAudio | null }
  | { do: "feeling"; attr: MindKey; value: number }
  | { do: "resetFeelings" }
  | { do: "react"; id: string }
  | { do: "say"; id?: string }
  | { do: "give"; paths: string[] }
  | { do: "saveLink"; url: string; title: string | null }
  | { do: "suggestLink"; url?: string }
  /** Forget your name and meet Mote again from the start. */
  | { do: "meet" }
  | { do: "manual"; face: ManualFace | null };

/** The debug knobs as Mote's window currently has them. */
export type DebugState = {
  timeScale: number;
  frozen: boolean;
  autoMoods: boolean;
  loop: boolean;
  guides: boolean;
  manual: boolean;
  fakeAudio: FakeAudio | null;
};

export const DEBUG_DEFAULTS: DebugState = {
  timeScale: 1,
  frozen: false,
  autoMoods: true,
  loop: false,
  guides: false,
  manual: false,
  fakeAudio: null,
};

export type BusMessage =
  | { type: "settings"; settings: Settings }
  | { type: "features"; features: FeatureState }
  | { type: "debug"; cmd: DebugCommand }
  | { type: "state"; snap: EngineSnapshot; debug: DebugState; events: string[] };

type Packet = BusMessage & { from: string };

// Messages between Mote's windows: Tauri events in the Mac app, a
// BroadcastChannel in a plain browser.
const NAME = "mote-bus";
const ID = Math.random().toString(36).slice(2);
let channel: BroadcastChannel | null = null;

export function send(msg: BusMessage) {
  const packet: Packet = { ...msg, from: ID };
  if (isDesktopApp()) {
    void emit(NAME, packet).catch(() => {});
    return;
  }
  if (typeof BroadcastChannel === "undefined") return;
  channel ??= new BroadcastChannel(NAME);
  channel.postMessage(packet);
}

export function listenBus(cb: (msg: BusMessage) => void): () => void {
  const handle = (p: Packet) => {
    if (p && p.from !== ID) cb(p);
  };
  if (isDesktopApp()) {
    let stop: (() => void) | null = null;
    let dead = false;
    void listen<Packet>(NAME, (e) => handle(e.payload))
      .then((un) => (dead ? un() : (stop = un)))
      .catch(() => {});
    return () => {
      dead = true;
      stop?.();
    };
  }
  if (typeof BroadcastChannel === "undefined") return () => {};
  const ch = new BroadcastChannel(NAME);
  ch.onmessage = (e: MessageEvent<Packet>) => handle(e.data);
  return () => ch.close();
}
