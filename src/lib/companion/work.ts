import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isDesktopApp } from "@/lib/companion/desktop";
import type { Pace } from "@/lib/companion/settings";

// Talking to Mote's helping hands in the Mac app (src-tauri/src/tidy): what
// was dropped, starting and stopping jobs, and hearing how they go. In a
// plain browser nothing can touch your files, so everything here is pretend:
// handy for trying out the conversation.

/** What you gave Mote, worked out. */
export type Given =
  | { kind: "folder"; path: string; name: string; files: number; bytes: number }
  | { kind: "videos"; paths: string[]; names: string[]; bytes: number }
  | {
      kind: "other";
      reason: "nothing" | "app" | "mixed" | "important" | "not-video";
      names: string[];
    };

export type DeleteRule =
  | { kind: "videos" | "images" | "audio" | "archives" | "documents" | "sidecars" }
  | { kind: "zero-byte" | "leftovers" | "everything" }
  | { kind: "larger" | "smaller"; bytes: number }
  | { kind: "older" | "newer"; days: number }
  | { kind: "extensions"; list: string[] }
  | { kind: "name-contains"; text: string };

export type Step =
  | { step: "archives" | "quarantine" | "names" | "convert" | "metadata" | "mp3" }
  | { step: "delete"; list: string[] }
  | { step: "compress"; method: "optimage" | "encode" }
  | { step: "trim-start" | "trim-end"; seconds: number };

export type Report = {
  facts: Record<string, number>;
  problems: string[];
  problem_count: number;
  nothing: boolean;
};

export type Finished = {
  ok: boolean;
  cancelled: boolean;
  report: Report | null;
  error: string | null;
};
export type Progress = { label: string; done: number; total: number };
export type DeletePreview = { files: string[]; count: number; bytes: number; examples: string[] };
export type Missing = { formulas: string[]; apps: string[]; brew: boolean };

export async function inspect(paths: string[]): Promise<Given> {
  if (isDesktopApp()) return invoke<Given>("work_inspect", { paths });
  return pretendInspect(paths);
}

export async function startJob(job: Step & { folder?: string; files?: string[]; pace: Pace }) {
  if (isDesktopApp()) return invoke<void>("work_start", { job });
  pretendRun(job.step);
}

export async function cancelJob() {
  if (isDesktopApp()) return invoke<void>("work_cancel");
  pretendCancel = true;
}

export async function previewDelete(folder: string, rule: DeleteRule): Promise<DeletePreview> {
  if (isDesktopApp()) return invoke<DeletePreview>("work_preview_delete", { folder, rule });
  const files = ["old clip.mov", "notes.tmp", "Thumbs.db"].map((f) => `${folder}/${f}`);
  return {
    files,
    count: files.length,
    bytes: 48_000_000,
    examples: files.map((f) => f.split("/").pop()!),
  };
}

export async function missingTools(step: string, method?: string): Promise<Missing> {
  if (isDesktopApp()) return invoke<Missing>("work_missing", { step, method: method ?? null });
  return { formulas: [], apps: [], brew: true };
}

export async function installTools(formulas: string[]) {
  if (isDesktopApp()) return invoke<void>("work_install", { formulas });
  await new Promise((r) => setTimeout(r, 1500));
}

/** Hears how the running job is going. Returns a function that stops listening. */
export function onWork(handlers: {
  progress: (p: Progress) => void;
  finished: (f: Finished) => void;
}) {
  pretendHandlers = handlers;
  if (!isDesktopApp()) return () => (pretendHandlers = null);
  const stops: Array<Promise<() => void>> = [
    listen<Progress>("work-progress", (e) => handlers.progress(e.payload)),
    listen<Finished>("work-finished", (e) => handlers.finished(e.payload)),
  ];
  return () => {
    for (const s of stops) void s.then((un) => un()).catch(() => {});
  };
}

// ── Pretend mode (plain browser only) ──────────────────────────────────

let pretendHandlers: Parameters<typeof onWork>[0] | null = null;
let pretendCancel = false;

const VIDEO = /\.(mp4|m4v|mov|wmv|flv|avi|webm|mkv|mpg|mpeg|3gp|m2ts|vob|ogv|gifv)$/i;

function pretendInspect(paths: string[]): Given {
  const names = paths.map((p) => p.replace(/\/$/, "").split("/").pop() ?? p);
  if (!paths.length) return { kind: "other", reason: "nothing", names };
  if (paths.length === 1 && (paths[0].endsWith("/") || !/\.[a-z0-9]+$/i.test(paths[0]))) {
    return {
      kind: "folder",
      path: paths[0].replace(/\/$/, ""),
      name: names[0],
      files: 1284,
      bytes: 6.2e9,
    };
  }
  if (paths.every((p) => VIDEO.test(p))) return { kind: "videos", paths, names, bytes: 3.4e8 };
  return { kind: "other", reason: paths.some((p) => VIDEO.test(p)) ? "mixed" : "not-video", names };
}

const PRETEND_FACTS: Record<string, Record<string, number>> = {
  archives: { opened: 3, passes: 1 },
  quarantine: {
    duplicates: 12,
    similar: 7,
    frames: 2,
    still: 1,
    "empty-files": 3,
    "empty-folders": 2,
  },
  names: { renamed: 41 },
  convert: { copied: 4, reencoded: 1, gifs: 6, saved: 18_400_000 },
  metadata: { cleaned: 512 },
  delete: { deleted: 3, "folders-removed": 1 },
  compress: { converted: 380, nogain: 22, saved: 1_480_000_000 },
  "trim-start": { trimmed: 1 },
  "trim-end": { trimmed: 1 },
  mp3: { created: 1 },
};

function pretendRun(step: string) {
  pretendCancel = false;
  const total = 40;
  let done = 0;
  const tick = () => {
    if (pretendCancel) {
      pretendHandlers?.finished({ ok: false, cancelled: true, report: null, error: null });
      return;
    }
    done++;
    pretendHandlers?.progress({ label: "Pretending to work", done, total });
    if (done < total) {
      setTimeout(tick, 60);
      return;
    }
    const problems = step === "archives" ? ["broken.rar (couldn’t open it)"] : [];
    pretendHandlers?.finished({
      ok: problems.length === 0,
      cancelled: false,
      report: {
        facts: PRETEND_FACTS[step] ?? {},
        problems,
        problem_count: problems.length,
        nothing: false,
      },
      error: null,
    });
  };
  setTimeout(tick, 200);
}
