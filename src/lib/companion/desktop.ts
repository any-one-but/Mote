import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** True inside the Mac app, false in a plain browser. */
export function isDesktopApp() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function openSettingsWindow() {
  if (isDesktopApp()) void invoke("open_settings").catch(() => {});
  else window.open("settings.html", "mote-settings", "popup,width=440,height=680");
}

export function showDebugWindow(open: boolean) {
  if (isDesktopApp()) void invoke("set_debug_window", { open }).catch(() => {});
  else if (open) window.open("debug.html", "mote-debug", "popup,width=600,height=780");
}

export function setFloatOnTop(on: boolean) {
  if (isDesktopApp()) void invoke("set_float_on_top", { on }).catch(() => {});
}

/**
 * The Mac app watches for other visible windows playing sound and reports
 * where the loudest one is relative to Mote's window (null when none is).
 */
export function onAudioElsewhere(cb: (audio: { dx: number; dy: number } | null) => void) {
  if (!isDesktopApp()) return () => {};
  let stop: (() => void) | null = null;
  let dead = false;
  void listen<{ playing: boolean; dx: number; dy: number }>("audio-elsewhere", (e) =>
    cb(e.payload.playing ? { dx: e.payload.dx, dy: e.payload.dy } : null),
  )
    .then((un) => (dead ? un() : (stop = un)))
    .catch(() => {});
  return () => {
    dead = true;
    stop?.();
  };
}

/** How far Mote's own window just moved, in CSS pixels. */
export function onWindowMoved(cb: (dx: number, dy: number) => void) {
  if (!isDesktopApp()) return () => {};
  let last: { x: number; y: number } | null = null;
  let stop: (() => void) | null = null;
  let dead = false;
  void getCurrentWindow()
    .onMoved(({ payload }) => {
      const ratio = window.devicePixelRatio || 1;
      const at = { x: payload.x / ratio, y: payload.y / ratio };
      if (last) cb(at.x - last.x, at.y - last.y);
      last = at;
    })
    .then((un) => (dead ? un() : (stop = un)))
    .catch(() => {});
  return () => {
    dead = true;
    stop?.();
  };
}

/** Called when someone closes the debug window with its close button. */
export function onDebugWindowClosed(cb: () => void): () => void {
  if (!isDesktopApp()) return () => {};
  let stop: (() => void) | null = null;
  let dead = false;
  void listen("debug-window-closed", cb)
    .then((un) => (dead ? un() : (stop = un)))
    .catch(() => {});
  return () => {
    dead = true;
    stop?.();
  };
}
