import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Media, Offering } from "@/components/companion/engine";

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
  app?: string | null;
};

/** Sound coming from a window you can see (null when there's none), and where it is. */
export function onMediaElsewhere(cb: (media: Media | null) => void) {
  const fromSenses = onAppEvent<{ media: SensedMedia | null }>("senses", (p) => {
    const m = p.media;
    cb(m && m.playing ? { dx: m.dx, dy: m.dy, app: m.app ?? null } : null);
  });
  // The simpler check the app falls back to if the helper can't run.
  const fallback = onAppEvent<{ playing: boolean; dx: number; dy: number }>(
    "audio-elsewhere",
    (p) => cb(p.playing ? { dx: p.dx, dy: p.dy, app: null } : null),
  );
  return () => {
    fromSenses();
    fallback();
  };
}

/**
 * You're typing in another app: where its window is, from the centre of
 * Mote's window. (Only *that* you're typing is known, never what.)
 */
export function onTypingElsewhere(cb: (dx: number, dy: number) => void) {
  return onAppEvent<{ dx: number; dy: number }>("typing-elsewhere", (p) => cb(p.dx, p.dy));
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

/** File kinds a browser can at least tell are important, by their ending. */
const IMPORTANT_KINDS =
  /\.(kext|dylib|so|a|plist|keychain|keychain-db|pem|key|p12|pfx|cer|crt|mobileprovision)$/i;

/**
 * Things dragged over and dropped on Mote's window. Only each thing's name
 * and size are found out (and for apps, whether they're a game); nothing is
 * ever opened, changed or moved.
 */
export function onDropped(hover: (over: boolean) => void, drop: (things: Offering[]) => void) {
  if (isDesktopApp()) {
    let stop: (() => void) | null = null;
    let dead = false;
    void getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (payload.type === "enter" || payload.type === "over") hover(true);
        else if (payload.type === "leave") hover(false);
        else if (payload.type === "drop") {
          hover(false);
          void invoke<Offering[]>("inspect_drop", { paths: payload.paths })
            .then((things) => things.length && drop(things))
            .catch(() => {});
        }
      })
      .then((un) => (dead ? un() : (stop = un)))
      .catch(() => {});
    return () => {
      dead = true;
      stop?.();
    };
  }

  // In a browser: a dropped file's name and size, nothing more.
  const over = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    hover(true);
  };
  const leave = (e: DragEvent) => {
    if (!e.relatedTarget) hover(false);
  };
  const dropped = (e: DragEvent) => {
    e.preventDefault();
    hover(false);
    const items = Array.from(e.dataTransfer?.items ?? []);
    const things = Array.from(e.dataTransfer?.files ?? []).map((file, i): Offering => {
      const entry = items[i]?.webkitGetAsEntry?.();
      const app = /\.app$/i.test(file.name);
      return {
        name: app ? file.name.replace(/\.app$/i, "") : file.name,
        size: file.size,
        kind: app ? "app" : entry?.isDirectory ? "folder" : "file",
        game: app && /^chess\.app$/i.test(file.name) ? "chess" : null,
        important: file.name.startsWith(".") || IMPORTANT_KINDS.test(file.name),
      };
    });
    if (things.length) drop(things);
  };
  window.addEventListener("dragenter", over);
  window.addEventListener("dragover", over);
  window.addEventListener("dragleave", leave);
  window.addEventListener("drop", dropped);
  return () => {
    window.removeEventListener("dragenter", over);
    window.removeEventListener("dragover", over);
    window.removeEventListener("dragleave", leave);
    window.removeEventListener("drop", dropped);
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
