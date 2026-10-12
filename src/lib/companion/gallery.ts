import { invoke } from "@tauri-apps/api/core";
import { isDesktopApp } from "@/lib/companion/desktop";

// Local Gallery, which Mote carries and opens, and its passcode, which Mote
// keeps. The checking happens on the Mac side (src-tauri/src/gallery.rs):
// the digits go there and only "right" or "wrong" comes back.

/** How a passcode try went. */
export type PasscodeCheck =
  | { result: "right" }
  /** Not it; this many tries left before Mote stops taking them. */
  | { result: "wrong"; triesLeft: number }
  /** One wrong try too many: no more for `wait` seconds. */
  | { result: "refused"; wait: number }
  /** Still not taking tries, for `wait` seconds more. */
  | { result: "waiting"; wait: number };

export type GalleryStatus = {
  /** This copy of Mote has the gallery inside. */
  carried: boolean;
  /** A passcode is set. */
  passcode: boolean;
  /** The gallery is open right now. */
  open: boolean;
  /** Seconds before Mote takes another try (0: they will now). */
  wait: number;
  triesLeft: number;
  /** Where the library folder is, if there is one. */
  library: string | null;
  /** The library folder is hidden from Finder (named “.Local Gallery”). */
  hidden: boolean;
  /** Both a hidden and a visible library folder exist. */
  both: boolean;
};

export type GalleryOpened =
  | { result: "opened" }
  | { result: "alreadyOpen" }
  | { result: "needPasscode" }
  | { result: "denied"; check: PasscodeCheck }
  | { result: "failed"; message: string };

export type Changed = { result: "done" } | { result: "denied"; check: PasscodeCheck };

export type Hid =
  { result: "done"; reopened: boolean } | { result: "denied"; check: PasscodeCheck };

/** One file in the library's log folder: its shape, never its contents. */
export type LogFile = {
  name: string;
  about: string | null;
  size: number;
  modified: number | null;
  state: "ok" | "empty" | "broken" | "ignored";
  schema: number | null;
  updated: number | null;
  counts: Array<[string, number]>;
};

export type LibraryReport = {
  found: boolean;
  library: string | null;
  hidden: boolean;
  both: boolean;
  logs_found: boolean;
  logs: LogFile[];
  totals: {
    taggedFolders: number | null;
    scoredFolders: number | null;
    journalDays: number | null;
    inTrash: number | null;
    thumbnails: number | null;
    lastSaved: number | null;
  };
};

const message = (err: unknown) => (typeof err === "string" ? err : "Something went wrong.");

// In a plain browser there's no Mac side, so there's a pretend gallery
// instead (like the Debug window's pretend folders), for trying the passcode
// pad and Mote's reactions: its passcode starts as 1234, and the same rules
// apply (five wrong tries, then a wait). Shared by the browser's windows.
type Pretend = { passcode: string | null; wrong: number; waits: number; until: number; open: boolean; hidden: boolean };
const PRETEND_KEY = "mote.pretend-gallery";

function pretend(): Pretend {
  try {
    const p = JSON.parse(localStorage.getItem(PRETEND_KEY) ?? "null") as Pretend | null;
    if (p && typeof p === "object") return p;
  } catch {
    // Start over below.
  }
  return { passcode: "1234", wrong: 0, waits: 0, until: 0, open: false, hidden: false };
}

function keep(p: Pretend) {
  try {
    localStorage.setItem(PRETEND_KEY, JSON.stringify(p));
  } catch {
    // Pretend for this window only, then.
  }
}

const pause = () => new Promise((r) => setTimeout(r, 250));

function pretendCheck(pin: string): PasscodeCheck {
  const p = pretend();
  const wait = Math.ceil((p.until - Date.now()) / 1000);
  if (!p.passcode) return { result: "right" };
  if (wait > 0) return { result: "waiting", wait };
  if (pin === p.passcode) {
    keep({ ...p, wrong: 0, waits: 0 });
    return { result: "right" };
  }
  const wrong = p.wrong + 1;
  if (wrong >= 5) {
    const ms = Math.min(15 * 60_000, 30_000 * 2 ** p.waits);
    keep({ ...p, wrong: 0, waits: p.waits + 1, until: Date.now() + ms });
    return { result: "refused", wait: ms / 1000 };
  }
  keep({ ...p, wrong });
  return { result: "wrong", triesLeft: 5 - wrong };
}

export async function galleryStatus(): Promise<GalleryStatus | null> {
  if (!isDesktopApp()) {
    const p = pretend();
    return {
      carried: true,
      passcode: !!p.passcode,
      open: p.open,
      wait: Math.max(0, Math.ceil((p.until - Date.now()) / 1000)),
      triesLeft: 5 - p.wrong,
      library: "Pretend Local Gallery",
      hidden: p.hidden,
      both: false,
    };
  }
  return invoke<GalleryStatus>("gallery_status").catch(() => null);
}

/** Opens Local Gallery, with the passcode when one is set. */
export async function openGallery(passcode?: string): Promise<GalleryOpened> {
  if (!isDesktopApp()) {
    await pause();
    const p = pretend();
    if (p.open) return { result: "alreadyOpen" };
    if (p.passcode) {
      if (passcode == null) return { result: "needPasscode" };
      const check = pretendCheck(passcode);
      if (check.result !== "right") return { result: "denied", check };
    }
    // Pretend it opened (and was closed again): there's nothing to show.
    return { result: "opened" };
  }
  try {
    return await invoke<GalleryOpened>("open_local_gallery", { passcode: passcode ?? null });
  } catch (err) {
    return { result: "failed", message: message(err) };
  }
}

/** Checks the passcode, nothing more. Wrong tries count all the same. */
export async function checkPasscode(passcode: string): Promise<PasscodeCheck> {
  if (!isDesktopApp()) return pause().then(() => pretendCheck(passcode));
  return invoke<PasscodeCheck>("gallery_check_passcode", { passcode });
}

/** Sets the passcode, or changes it (`current` is needed then). */
export async function setPasscode(current: string | null, passcode: string): Promise<Changed> {
  if (!isDesktopApp()) {
    const check = pretendCheck(current ?? "");
    if (check.result !== "right") return { result: "denied", check };
    keep({ ...pretend(), passcode, wrong: 0, waits: 0, until: 0 });
    return { result: "done" };
  }
  return invoke<Changed>("gallery_set_passcode", { current, passcode });
}

export async function turnOffPasscode(current: string): Promise<Changed> {
  if (!isDesktopApp()) {
    const check = pretendCheck(current);
    if (check.result !== "right") return { result: "denied", check };
    keep({ ...pretend(), passcode: null, wrong: 0, waits: 0, until: 0 });
    return { result: "done" };
  }
  return invoke<Changed>("gallery_turn_off_passcode", { current });
}

/** Closes the gallery if it's open (it saves first). Resolves to whether it was. */
export async function lockGalleryNow(): Promise<boolean> {
  if (!isDesktopApp()) return false;
  return invoke<boolean>("gallery_lock_now");
}

/** Hides the library folder from Finder, or shows it again. */
export async function setGalleryHidden(current: string | null, hidden: boolean): Promise<Hid> {
  if (!isDesktopApp()) {
    const check = pretendCheck(current ?? "");
    if (check.result !== "right") return { result: "denied", check };
    keep({ ...pretend(), hidden });
    return { result: "done", reopened: false };
  }
  return invoke<Hid>("gallery_set_hidden", { current, hidden });
}

export async function readGalleryLibrary(): Promise<LibraryReport | null> {
  if (!isDesktopApp()) return null;
  return invoke<LibraryReport>("gallery_library").catch(() => null);
}

export { message as galleryError };
