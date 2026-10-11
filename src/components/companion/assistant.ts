import type { DeleteRule, Given, Report, Step } from "@/lib/companion/work";

// What Mote says while helping you with files: the jobs on offer, how they
// greet what you give them, and how they report back afterwards. The
// conversation itself (and the window it happens in) is Helper.tsx.

/** Jobs for a folder, in the order "Do all of these" runs them. */
export const FOLDER_JOBS = [
  "archives",
  "quarantine",
  "names",
  "convert",
  "metadata",
  "delete",
  "compress",
] as const;
/** Jobs for videos. */
export const VIDEO_JOBS = ["trim-start", "trim-end", "mp3"] as const;

export type JobId = (typeof FOLDER_JOBS)[number] | (typeof VIDEO_JOBS)[number];

export const JOBS: Record<JobId, { label: string; hint: string; doing: string; asks?: true }> = {
  archives: {
    label: "Open archives",
    hint: "Unpack zips, rars and the like where they are, then delete them",
    doing: "Opening archives…",
  },
  quarantine: {
    label: "Clear out clutter",
    hint: "Delete exact duplicates; set aside look-alikes, frame grabs, still videos and empty things",
    doing: "Clearing out clutter…",
  },
  names: {
    label: "Tidy names",
    hint: "Plain letters, numbers, spaces, _ and -",
    doing: "Tidying names…",
  },
  convert: {
    label: "Convert to MP4",
    hint: "Other video formats and animated GIFs become MP4",
    doing: "Converting to MP4…",
  },
  metadata: {
    label: "Remove metadata",
    hint: "Strip hidden location, camera and date info from photos and videos",
    doing: "Scrubbing metadata…",
  },
  delete: {
    label: "Delete files…",
    hint: "By a rule you pick. I’ll show you first",
    doing: "Deleting…",
    asks: true,
  },
  compress: {
    label: "Compress media…",
    hint: "Make pictures and videos smaller",
    doing: "Squishing things smaller…",
    asks: true,
  },
  "trim-start": {
    label: "Trim the start…",
    hint: "Cut seconds off the beginning",
    doing: "Trimming…",
    asks: true,
  },
  "trim-end": {
    label: "Trim the end…",
    hint: "Cut seconds off the end",
    doing: "Trimming…",
    asks: true,
  },
  mp3: {
    label: "Save the audio as MP3",
    hint: "Next to the video",
    doing: "Pulling the audio out…",
  },
};

export const DELETE_RULES: Array<{
  rule: DeleteRule["kind"];
  label: string;
  /** What to ask for, if anything. */
  needs?: "size" | "days" | "extensions" | "text";
}> = [
  { rule: "leftovers", label: "Temporary, cache and download leftovers" },
  { rule: "videos", label: "All videos" },
  { rule: "images", label: "All pictures" },
  { rule: "audio", label: "All audio" },
  { rule: "archives", label: "All archives" },
  { rule: "documents", label: "Documents and text files" },
  { rule: "sidecars", label: "Metadata, subtitle and sidecar files" },
  { rule: "zero-byte", label: "Empty (zero-byte) files" },
  { rule: "larger", label: "Files bigger than…", needs: "size" },
  { rule: "smaller", label: "Files smaller than…", needs: "size" },
  { rule: "older", label: "Files older than…", needs: "days" },
  { rule: "newer", label: "Files newer than…", needs: "days" },
  { rule: "extensions", label: "Files ending in…", needs: "extensions" },
  { rule: "name-contains", label: "Files whose name contains…", needs: "text" },
  { rule: "everything", label: "Every file" },
];

const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function size(bytes: number) {
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return i === 0
    ? `${Math.round(v)} ${units[0]}`
    : `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

/** Parses "500MB", "2 GB", "120k"… into bytes. */
export function parseSize(text: string): number | null {
  const m = text
    .trim()
    .toLowerCase()
    .match(/^([0-9]+(?:\.[0-9]+)?)\s*(b|bytes?|k|kb|kib|m|mb|mib|g|gb|gib|t|tb|tib)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? "b")[0];
  const mult = { b: 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 }[unit] ?? 1;
  const bytes = Math.round(n * mult);
  return bytes > 0 ? bytes : null;
}

export function describeRule(rule: DeleteRule): string {
  switch (rule.kind) {
    case "larger":
      return `files bigger than ${size(rule.bytes)}`;
    case "smaller":
      return `files smaller than ${size(rule.bytes)}`;
    case "older":
      return `files older than ${plural(rule.days, "day")}`;
    case "newer":
      return `files newer than ${plural(rule.days, "day")}`;
    case "extensions":
      return `.${rule.list.join(", .")} files`;
    case "name-contains":
      return `files with “${rule.text}” in their name`;
    default:
      return (DELETE_RULES.find((r) => r.rule === rule.kind)?.label ?? "those files").toLowerCase();
  }
}

/** What Mote says when you hand them something. */
export function greet(g: Given): string {
  if (g.kind === "folder") {
    const what = g.files
      ? `${plural(g.files, "file")}, ${size(g.bytes)}`
      : "it looks empty, but let’s see";
    return pick([
      `Ooh, *${g.name}*! (${what}) What should I do with it?`,
      `*${g.name}*, got it. (${what}) Where do we start?`,
    ]);
  }
  if (g.kind === "videos") {
    const what = g.names.length === 1 ? `*${g.names[0]}*` : `${plural(g.names.length, "video")}`;
    return pick([
      `${cap(what)}! What should I do with ${g.names.length === 1 ? "it" : "them"}?`,
      `Ooh, ${what}. What’ll it be?`,
    ]);
  }
  switch (g.reason) {
    case "important":
      return "That looks like something your Mac needs. I’d better not touch it!";
    case "app":
      return "That’s an app! I can help with folders, or with videos.";
    case "mixed":
      return "One thing at a time, please! A single folder, or some videos.";
    case "not-video":
      return g.names.length === 1
        ? `I don’t know what to do with *${g.names[0]}*. Give me a folder, or a video!`
        : "I don’t know what to do with those. Give me a folder, or some videos!";
    default:
      return "Hmm, I couldn’t find that.";
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What Mote says when asked "what next?" after a job. */
export const NEXT = ["What next?", "Anything else?", "What now?", "Next?"];

/** How a job went, in Mote’s words. */
export function report(step: Step["step"], r: Report, seconds?: number): string {
  const f = (k: string) => r.facts[k] ?? 0;
  const parts: string[] = [];
  switch (step) {
    case "archives":
      if (f("opened")) parts.push(`Opened ${plural(f("opened"), "archive")}!`);
      else if (!r.problem_count) parts.push("No archives in here.");
      break;
    case "quarantine": {
      if (f("duplicates")) parts.push(`Deleted ${plural(f("duplicates"), "exact duplicate")}.`);
      const aside = [
        [f("similar"), "look-alike"],
        [f("frames"), "frame grab"],
        [f("still"), "video that never moves", "videos that never move"],
        [f("empty-files") + f("empty-folders"), "empty thing"],
      ] as Array<[number, string, string?]>;
      const moved = aside.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many));
      if (moved.length) parts.push(`Set aside ${list(moved)} in *_quarantined_media*.`);
      if (!parts.length && !r.problem_count) parts.push("Nothing cluttery in here. Very tidy!");
      break;
    }
    case "names":
      parts.push(
        f("renamed") ? `Tidied ${plural(f("renamed"), "name")}.` : "Every name was already tidy!",
      );
      break;
    case "convert": {
      const vids = f("copied") + f("reencoded");
      const done = [vids && plural(vids, "video"), f("gifs") && plural(f("gifs"), "GIF")].filter(
        Boolean,
      ) as string[];
      if (done.length)
        parts.push(`Turned ${list(done)} into MP4${vids + f("gifs") === 1 ? "" : "s"}.`);
      else if (!r.problem_count) parts.push("Nothing needed converting.");
      if (f("saved")) parts.push(`Saved ${size(f("saved"))}.`);
      break;
    }
    case "metadata":
      parts.push(
        f("cleaned")
          ? `Scrubbed ${plural(f("cleaned"), "file")} clean.`
          : "No photos or videos to scrub.",
      );
      break;
    case "delete":
      if (f("deleted")) {
        parts.push(`Deleted ${plural(f("deleted"), "file")}`);
        if (f("folders-removed"))
          parts[0] += ` and ${plural(f("folders-removed"), "folder")} they left empty`;
        parts[0] += ".";
      } else if (!r.problem_count) parts.push("Nothing to delete.");
      break;
    case "compress":
      if (f("converted"))
        parts.push(`Shrunk ${plural(f("converted"), "file")}, saving ${size(f("saved"))}!`);
      else if (f("handed"))
        parts.push(
          `Optimage worked through ${plural(f("handed"), "file")} and saved ${size(f("saved"))}.`,
        );
      else if (!r.problem_count) parts.push("Nothing to squish.");
      if (f("nogain"))
        parts.push(
          `${plural(f("nogain"), "file")} wouldn’t get any smaller, so I left ${f("nogain") === 1 ? "it" : "them"}.`,
        );
      break;
    case "trim-start":
    case "trim-end": {
      const where = step === "trim-start" ? "start" : "end";
      if (f("trimmed")) {
        parts.push(
          `Trimmed ${seconds ?? ""}${seconds ? " seconds" : ""} off the ${where}${f("trimmed") > 1 ? ` of ${plural(f("trimmed"), "video")}` : ""}.`.replace(
            "  ",
            " ",
          ),
        );
        if (f("approximate"))
          parts.push("(I had to cut at the nearest keyframe, so it might be a hair off.)");
      }
      if (f("too-short"))
        parts.push(
          `${f("too-short") === 1 ? "It’s" : `${f("too-short")} were`} shorter than that, so I left ${f("too-short") === 1 ? "it" : "them"} alone.`,
        );
      break;
    }
    case "mp3":
      if (f("created"))
        parts.push(
          `Saved ${plural(f("created"), "MP3")} next to the video${f("created") === 1 ? "" : "s"}.`,
        );
      if (f("no-audio")) parts.push(`${plural(f("no-audio"), "video")} had no sound.`);
      if (f("exists")) parts.push(`${plural(f("exists"), "video")} already had an MP3.`);
      break;
  }
  if (r.problem_count) {
    parts.push(
      r.problem_count === 1
        ? "One thing went wrong, though:"
        : `${plural(r.problem_count, "thing")} went wrong, though:`,
    );
  }
  return parts.join(" ") || "Done!";
}

function list(xs: string[]) {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

export const STOPPED = ["Okay, I stopped.", "Stopped! Whatever was half-done is left as it was."];
export const BYE = ["Happy to help!", "All done. That was fun!", "Anytime!"];
