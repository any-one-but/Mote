// Mote's long-term memory of media: each song, video or show Mote has watched
// or listened to with you, and how it went. Things that make Mote happier
// while something plays make them like it more; things that upset them make
// them like it less. Next time it comes on, Mote remembers.

export type MediaMemory = {
  key: string;
  /** A tidied-up title to say out loud. */
  name: string;
  app: string | null;
  /** How much Mote likes it: below −2 is disliked, above 2 is liked. */
  score: number;
  /** How many times it has come on. */
  times: number;
  /** When it last came on (ms since 1970). */
  last: number;
};

export const LIKED = 2;
export const DISLIKED = -2;

const STORE = "mote.memory";

/**
 * Turns a window title into the name of the thing playing: drops the app and
 * site names, file extensions, and "(Official Video)"-style tags.
 */
export function cleanTitle(title: string | null, app: string | null): string | null {
  if (!title) return null;
  let t = title.trim();
  const tails = [
    / [-–—|·] YouTube( Music)?$/i,
    / [-–—|·] VLC media player$/i,
    / [-–—|·] (Google Chrome|Safari|Firefox|Arc|Microsoft Edge|Brave)$/i,
    / [-–—|·] Netflix$/i,
    / [-–—|·] Spotify$/i,
    / [-–—|·] Twitch$/i,
    / [-–—|·] Vimeo$/i,
  ];
  for (let i = 0; i < 3; i++) for (const r of tails) t = t.replace(r, "");
  t = t.replace(/^\(\d+\)\s*/, ""); // unread counts like "(3) "
  t = t.replace(/\.(mp3|mp4|m4a|m4v|mkv|mov|avi|flac|wav|aac|ogg|webm)$/i, "");
  t = t.replace(/\s*[([](official|lyric|music|audio|hd|4k)[^)\]]*[)\]]/gi, "");
  t = t.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t || (app && t.toLowerCase() === app.toLowerCase())) return null;
  return t.length > 42 ? `${t.slice(0, 40).trimEnd()}…` : t;
}

/** What to remember a piece of media by: its title, or failing that its app. */
export function mediaKey(title: string | null, app: string | null) {
  const name = cleanTitle(title, app);
  if (name) return { key: `${(app ?? "").toLowerCase()}|${name.toLowerCase()}`, name };
  if (app) return { key: `${app.toLowerCase()}|`, name: app };
  return null;
}

export function loadMemories(): Record<string, MediaMemory> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, MediaMemory>;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function saveMemories(memories: Record<string, MediaMemory>) {
  try {
    // Keep the 200 most recent, so the list can't grow forever.
    const kept = Object.values(memories)
      .sort((a, b) => b.last - a.last)
      .slice(0, 200);
    localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(kept.map((m) => [m.key, m]))));
  } catch {
    // Fine: the memories just won't carry over to the next launch.
  }
}
