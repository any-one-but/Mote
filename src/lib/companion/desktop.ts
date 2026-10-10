import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Media, MediaKind } from "@/components/companion/engine";

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

/** Listens for an event from the Mac app; a no-op in a plain browser. */
function onAppEvent<T>(name: string, cb: (payload: T) => void) {
  if (!isDesktopApp()) return () => {};
  let stop: (() => void) | null = null;
  let dead = false;
  void listen<T>(name, (e) => cb(e.payload))
    .then((un) => (dead ? un() : (stop = un)))
    .catch(() => {});
  return () => {
    dead = true;
    stop?.();
  };
}

type SensedMedia = {
  dx: number;
  dy: number;
  playing: boolean;
  kind?: MediaKind;
  bpm?: number;
  beatAgo?: number;
  intensity?: number;
  title?: string | null;
  app?: string | null;
};

/**
 * What the Mac app can see playing in other windows (null when nothing you
 * can see is actually playing), and whether Mote has the Screen Recording
 * permission it needs to tell what kind of thing it is.
 */
export function onMediaElsewhere(cb: (media: Media | null, permission: boolean | null) => void) {
  const fromSenses = onAppEvent<{ media: SensedMedia | null; permission: boolean }>("senses", (p) => {
    const m = p.media;
    cb(
      m && m.playing
        ? {
            dx: m.dx,
            dy: m.dy,
            kind: m.kind ?? "unknown",
            bpm: m.bpm ?? null,
            beatAgo: m.beatAgo ?? null,
            intensity: m.intensity ?? 0.5,
            title: m.title ?? null,
            app: m.app ?? null,
          }
        : null,
      p.permission,
    );
  });
  // The simpler check the app falls back to if the helper can't run.
  const fallback = onAppEvent<{ playing: boolean; dx: number; dy: number }>("audio-elsewhere", (p) =>
    cb(
      p.playing
        ? { dx: p.dx, dy: p.dy, kind: "unknown", bpm: null, beatAgo: null, intensity: 0.5, title: null, app: null }
        : null,
      null,
    ),
  );
  return () => {
    fromSenses();
    fallback();
  };
}

/** The pointer anywhere on screen, measured from the centre of Mote's window. */
export function onPointerElsewhere(cb: (dx: number, dy: number, inside: boolean) => void) {
  return onAppEvent<{ dx: number; dy: number; inside: boolean }>("pointer-elsewhere", (p) =>
    cb(p.dx, p.dy, p.inside),
  );
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

/**
 * Where Mote's window sits on its screen: the centre, as 0..1 from the left
 * and from the top. Null if it can't be told.
 */
export async function windowPlacement(): Promise<{ x: number; y: number } | null> {
  try {
    if (isDesktopApp()) {
      const { currentMonitor } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const [pos, size, monitor] = await Promise.all([
        win.outerPosition(),
        win.outerSize(),
        currentMonitor(),
      ]);
      if (!monitor) return null;
      return {
        x: (pos.x + size.width / 2 - monitor.position.x) / monitor.size.width,
        y: (pos.y + size.height / 2 - monitor.position.y) / monitor.size.height,
      };
    }
    return {
      x: (window.screenX + window.outerWidth / 2) / screen.availWidth,
      y: (window.screenY + window.outerHeight / 2) / screen.availHeight,
    };
  } catch {
    return null;
  }
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
