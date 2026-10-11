// Links you've dragged onto Mote, kept so Mote can suggest one now and then
// ("Remember that video? Want to watch it again?"). Any web link works;
// YouTube and other video sites are just talked about as videos.
//
// For each link Mote remembers how often they've suggested it, how often
// you said yes, and when they last brought it up. Picking one to suggest
// favours links never suggested yet, ones you usually say yes to, and ones
// that haven't come up for a while.

export type SavedLink = {
  url: string;
  title: string | null;
  savedAt: number;
  /** How many times Mote has suggested it, and how many times you opened it. */
  suggested: number;
  opened: number;
  lastSuggested: number | null;
};

const KEY = "mote.links";
/** Plenty, but not unbounded. The oldest go first. */
const MAX = 500;

export function loadLinks(): SavedLink[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((l) => typeof l?.url === "string") : [];
  } catch {
    return [];
  }
}

function saveLinks(list: SavedLink[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    // Not kept, then.
  }
}

/** The same page, give or take tracking bits and a trailing slash. */
function same(a: string, b: string) {
  const norm = (u: string) => {
    try {
      const x = new URL(u);
      for (const k of [...x.searchParams.keys()])
        if (/^utm_|^si$|^feature$/.test(k)) x.searchParams.delete(k);
      return `${x.host.replace(/^www\./, "")}${x.pathname.replace(/\/$/, "")}?${x.searchParams}`;
    } catch {
      return u;
    }
  };
  return norm(a) === norm(b);
}

/** Saves a link. Returns false if it was already saved (its title is updated). */
export function addLink(url: string, title: string | null): boolean {
  const list = loadLinks();
  const old = list.find((l) => same(l.url, url));
  if (old) {
    if (title && !old.title) {
      old.title = title;
      saveLinks(list);
    }
    return false;
  }
  list.push({ url, title, savedAt: Date.now(), suggested: 0, opened: 0, lastSuggested: null });
  saveLinks(list);
  return true;
}

export function removeLink(url: string) {
  saveLinks(loadLinks().filter((l) => l.url !== url));
}

/** Forgets a link's history: as if Mote had never suggested it. */
export function resetLink(url: string) {
  saveLinks(
    loadLinks().map((l) =>
      l.url === url ? { ...l, suggested: 0, opened: 0, lastSuggested: null } : l,
    ),
  );
}

/** Gives a link a new title (or none, with an empty one). */
export function renameLink(url: string, title: string) {
  saveLinks(loadLinks().map((l) => (l.url === url ? { ...l, title: title.trim() || null } : l)));
}

export function clearLinks() {
  saveLinks([]);
}

export function noteSuggested(url: string) {
  const list = loadLinks();
  const l = list.find((x) => x.url === url);
  if (!l) return;
  l.suggested++;
  l.lastSuggested = Date.now();
  saveLinks(list);
}

export function noteOpened(url: string) {
  const list = loadLinks();
  const l = list.find((x) => x.url === url);
  if (!l) return;
  l.opened++;
  saveLinks(list);
}

/** How likely a link is to be picked (see the top of the file). */
export function weight(l: SavedLink, now = Date.now()) {
  const fresh = l.suggested === 0 ? 3 : 1;
  // How often you say yes, starting from an even guess.
  const liked = 1 + 2 * ((l.opened + 1) / (l.suggested + 2));
  // Brought up recently? Much less likely; after two days, fully back.
  const hours = l.lastSuggested ? (now - l.lastSuggested) / 3_600_000 : Number.POSITIVE_INFINITY;
  const rested = Math.min(1, Math.max(0.05, hours / 48));
  return fresh * liked * rested;
}

/** A link to suggest, picked by weight, or null when there are none. */
export function pickLink(now = Date.now()): SavedLink | null {
  const list = loadLinks();
  if (!list.length) return null;
  const total = list.reduce((sum, l) => sum + weight(l, now), 0);
  let r = Math.random() * total;
  for (const l of list) {
    r -= weight(l, now);
    if (r <= 0) return l;
  }
  return list[list.length - 1];
}

const VIDEO_HOSTS =
  /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv|dailymotion\.com|tiktok\.com|nebula\.tv)$/;

export function isVideo(url: string) {
  try {
    return VIDEO_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** What to call a link: its title, or something made from the address. */
export function linkName(l: { url: string; title: string | null }) {
  // (Without the site's name tacked on the end: "… - YouTube".)
  const title = l.title?.replace(/\s+[-–|]\s+YouTube$/i, "").trim();
  if (title) return title.length > 60 ? `${title.slice(0, 57).trimEnd()}…` : title;
  try {
    const u = new URL(l.url);
    const host = u.hostname.replace(/^www\./, "");
    if (/youtube\.com|youtu\.be/.test(host)) return "that YouTube video";
    const path = decodeURIComponent(u.pathname).split("/").filter(Boolean).pop();
    return path ? `${host}/…/${path.replace(/[-_]+/g, " ").slice(0, 40)}` : host;
  } catch {
    return l.url;
  }
}

/** Hears about changes made in other Mote windows (Settings removing one). */
export function onLinksChanged(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
