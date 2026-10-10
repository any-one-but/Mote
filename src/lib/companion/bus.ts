import { emit, listen } from "@tauri-apps/api/event";
import type { EngineSnapshot, ManualFace, Mood } from "@/components/companion/engine";
import type { Settings } from "@/lib/companion/settings";
import { isDesktopApp } from "@/lib/companion/desktop";

/** What the debug window can ask Mote's window to do. */
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
  | { do: "manual"; face: ManualFace | null };

/** The debug knobs as Mote's window currently has them. */
export type DebugState = {
  timeScale: number;
  frozen: boolean;
  autoMoods: boolean;
  loop: boolean;
  guides: boolean;
  manual: boolean;
};

export const DEBUG_DEFAULTS: DebugState = {
  timeScale: 1,
  frozen: false,
  autoMoods: true,
  loop: false,
  guides: false,
  manual: false,
};

export type BusMessage =
  | { type: "settings"; settings: Settings }
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
