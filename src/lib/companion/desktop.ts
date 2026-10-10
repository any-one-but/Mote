import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

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
