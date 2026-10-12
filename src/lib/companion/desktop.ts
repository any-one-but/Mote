import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Media } from "@/components/companion/engine";

/** True inside the Mac app, false in a plain browser. */
export function isDesktopApp() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function openSettingsWindow() {
  if (isDesktopApp()) void invoke("open_settings").catch(() => {});
  else window.open("settings.html", "mote-settings", "popup,width=440,height=680");
}

export function openCaloriesWindow() {
  if (isDesktopApp()) void invoke("open_calories").catch(() => {});
  else window.open("calories.html", "mote-calories", "popup,width=760,height=840");
}

export function showDebugWindow(open: boolean) {
  if (isDesktopApp()) void invoke("set_debug_window", { open }).catch(() => {});
  else if (open) window.open("debug.html", "mote-debug", "popup,width=600,height=780");
}

/** Grows Mote's window to fit the options while helping (or the board while
 * playing), and back after. */
export function setHelpingSize(helping: boolean, size?: { width: number; height: number }) {
  if (isDesktopApp()) {
    void invoke("set_helping_size", { helping, width: size?.width, height: size?.height }).catch(() => {});
  }
}

/** Opens Local Gallery (a separate app Mote carries). Resolves to whether it opened. */
export async function openLocalGallery(): Promise<boolean> {
  if (!isDesktopApp()) return false;
  try {
    await invoke("open_local_gallery");
    return true;
  } catch {
    return false;
  }
}

/** Whether Mote opens when you log in to your Mac. */
export async function opensAtLogin(): Promise<boolean> {
  if (!isDesktopApp()) return false;
  return invoke<boolean>("login_item_enabled").catch(() => false);
}

export async function setOpensAtLogin(on: boolean): Promise<boolean> {
  if (!isDesktopApp()) return false;
  try {
    await invoke("set_login_item", { on });
    return true;
  } catch {
    return false;
  }
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

export type DroppedLink = { url: string; title: string | null };

/** Opens a saved link in your browser. */
export function openLink(url: string) {
  if (isDesktopApp()) void invoke("open_link", { url }).catch(() => {});
  else window.open(url, "_blank", "noopener");
}

const LINK_FILE = /\.(webloc|inetloc)$/i;

/**
 * Things dragged over and dropped on Mote's window: files and folders (where
 * they are on disk, for Mote to help with), or a link (from a browser, or a
 * link file from Finder), for Mote to save. A plain browser can't say where
 * files are, so there it passes just their names, and Mote only pretends.
 */
export function onDropped(
  hover: (over: boolean) => void,
  drop: (paths: string[]) => void,
  link: (link: DroppedLink) => void,
) {
  if (isDesktopApp()) {
    let stop: (() => void) | null = null;
    let dead = false;
    void getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (payload.type === "enter" || payload.type === "over") hover(true);
        else if (payload.type === "leave") hover(false);
        else if (payload.type === "drop") {
          hover(false);
          const paths = payload.paths;
          // A link isn't a file, so a dragged link arrives with no paths;
          // the app reads it from the drag itself.
          if (!paths.length || (paths.length === 1 && LINK_FILE.test(paths[0]))) {
            void invoke<DroppedLink | null>("read_dropped_link", { paths })
              .then((l) => l && link(l))
              .catch(() => {});
          } else drop(paths);
        }
      })
      .then((un) => (dead ? un() : (stop = un)))
      .catch(() => {});
    return () => {
      dead = true;
      stop?.();
    };
  }

  const over = (e: DragEvent) => {
    const types = e.dataTransfer?.types ?? [];
    if (!types.includes("Files") && !types.includes("text/uri-list")) return;
    e.preventDefault();
    hover(true);
  };
  const leave = (e: DragEvent) => {
    if (!e.relatedTarget) hover(false);
  };
  const dropped = (e: DragEvent) => {
    e.preventDefault();
    hover(false);
    const url = e.dataTransfer
      ?.getData("text/uri-list")
      ?.split("\n")
      .find((l) => /^https?:/i.test(l.trim()));
    if (url && !e.dataTransfer?.files.length) {
      link({ url: url.trim(), title: null });
      return;
    }
    const items = Array.from(e.dataTransfer?.items ?? []);
    const names = Array.from(e.dataTransfer?.files ?? []).map((file, i) =>
      items[i]?.webkitGetAsEntry?.()?.isDirectory ? `${file.name}/` : file.name,
    );
    if (names.length) drop(names);
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
