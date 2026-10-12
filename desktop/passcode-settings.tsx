import { useCallback, useEffect, useState } from "react";
import type { PasscodeEvent, PasscodeInfo } from "@/components/companion/engine";
import { PasscodePad } from "@/components/companion/PasscodePad";
import { waitWords } from "@/components/companion/speech";
import { send } from "@/lib/companion/bus";
import {
  checkPasscode,
  galleryError,
  galleryStatus,
  lockGalleryNow,
  readGalleryLibrary,
  setGalleryHidden,
  setPasscode,
  turnOffPasscode,
  type GalleryStatus,
  type LibraryReport,
  type PasscodeCheck,
} from "@/lib/companion/gallery";
import { Row, Section, Toggle } from "./ui";

// Settings' Local Gallery section: the gallery's passcode, which Mote keeps
// (and asks for before opening the gallery), with everything the gallery's
// own Passcode menu had: set or change it, lock now, turn it off, and hide
// the library folder. The same care as there: a new passcode is typed twice,
// and the current one is asked for before changing it, turning it off, or
// hiding or showing the folder. Mote, in their own window, reacts to each.

type Job = "set" | "change" | "off" | "hide" | "show";
type Step = "current" | "new" | "again";

type Flow = {
  job: Job;
  step: Step;
  /** The current passcode, once it's been checked. */
  current?: string;
  /** The new one, the first time it was typed. */
  first?: string;
  message?: string | null;
  wrong: number;
  busy: boolean;
};

const TITLE: Record<Job, string> = {
  set: "Set a passcode",
  change: "Change passcode",
  off: "Turn passcode off",
  hide: "Hide gallery folder",
  show: "Show gallery folder",
};

const PROMPT: Record<Step, string> = {
  current: "Enter your current passcode",
  new: "Choose four digits",
  again: "Type them again",
};

const tell = (event: PasscodeEvent, info?: PasscodeInfo) => send({ type: "gallery", event, info });

function agoWords(ms: number | null) {
  if (!ms) return null;
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return "just now";
  if (s < 90 * 60) return `${Math.round(s / 60)} minutes ago`;
  if (s < 36 * 3600) return `${Math.round(s / 3600)} hours ago`;
  const days = Math.round(s / 86400);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function LocalGallerySection({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState<GalleryStatus | null>(null);
  const [library, setLibrary] = useState<LibraryReport | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  // What happened last, under the buttons.
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await galleryStatus());
  }, []);
  useEffect(() => {
    void refresh();
    void readGalleryLibrary().then(setLibrary);
    // The gallery opens and closes, and the wait after wrong tries runs out.
    const t = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(t);
  }, [refresh]);

  if (!status) return null;
  const set = status.passcode;

  const start = (job: Job) => {
    setNote(null);
    if (set && status.wait > 0 && job !== "set") {
      tell("waiting", { wait: status.wait });
      setNote(`Too many wrong tries. Try again in ${waitWords(status.wait)}.`);
      return;
    }
    const needsCurrent = set && job !== "set";
    if (!needsCurrent && (job === "hide" || job === "show")) {
      void hide(job === "hide", null);
      return;
    }
    setFlow({ job, step: needsCurrent ? "current" : "new", wrong: 0, busy: false });
  };

  const finish = (text: string, event?: PasscodeEvent) => {
    setFlow(null);
    setNote(text);
    if (event) tell(event);
    onChange();
    void refresh();
  };

  /** A wrong current passcode: shake and say so, or stop if that was too many. */
  const denied = (check: PasscodeCheck) => {
    if (check.result === "wrong") {
      tell("wrong", { triesLeft: check.triesLeft });
      const left = check.triesLeft;
      setFlow(
        (f) =>
          f && {
            ...f,
            busy: false,
            wrong: f.wrong + 1,
            message:
              left === 1
                ? "That passcode isn’t right. One try left."
                : left === 2
                  ? "That passcode isn’t right. Two tries left."
                  : "That passcode isn’t right.",
          },
      );
      return;
    }
    if (check.result === "refused" || check.result === "waiting") {
      tell(check.result === "refused" ? "refuse" : "waiting", { wait: check.wait });
      setFlow(null);
      setNote(`Too many wrong tries. Try again in ${waitWords(check.wait)}.`);
      void refresh();
    }
  };

  const failed = (err: unknown) => {
    setFlow(null);
    setNote(galleryError(err));
    void refresh();
  };

  const hide = async (hidden: boolean, current: string | null) => {
    try {
      const result = await setGalleryHidden(current, hidden);
      if (result.result === "denied") return denied(result.check);
      finish(
        hidden
          ? `Hidden: the folder is “.Local Gallery” now, so Finder doesn’t show it.${result.reopened ? " Local Gallery closed for a moment and opened again." : ""}`
          : `Showing: the folder is “Local Gallery” again.${result.reopened ? " Local Gallery closed for a moment and opened again." : ""}`,
        hidden ? "hidden" : "shown",
      );
      void readGalleryLibrary().then(setLibrary);
    } catch (err) {
      failed(err);
    }
  };

  const enter = async (pin: string) => {
    const f = flow;
    if (!f) return;
    setFlow({ ...f, busy: true });
    try {
      if (f.step === "current") {
        if (f.job === "off") {
          const result = await turnOffPasscode(pin);
          if (result.result === "denied") return denied(result.check);
          return finish("Passcode off. Mote opens Local Gallery straight away now.", "off");
        }
        if (f.job === "hide" || f.job === "show") return void (await hide(f.job === "hide", pin));
        const check = await checkPasscode(pin);
        if (check.result !== "right") return denied(check);
        setFlow({ ...f, step: "new", current: pin, busy: false, message: null });
        return;
      }
      if (f.step === "new") {
        setFlow({ ...f, step: "again", first: pin, busy: false, message: null });
        return;
      }
      // Typed twice: they have to agree, so a slip can't lock the gallery.
      if (pin !== f.first) {
        setFlow({
          ...f,
          step: "new",
          first: undefined,
          busy: false,
          wrong: f.wrong + 1,
          message: "Those didn’t match. Try again.",
        });
        return;
      }
      const result = await setPasscode(f.current ?? null, pin);
      if (result.result === "denied") return denied(result.check);
      finish(
        f.job === "change"
          ? "Passcode changed."
          : "Passcode set. Mote asks for it before opening Local Gallery.",
        f.job === "change" ? "changed" : "set",
      );
    } catch (err) {
      failed(err);
    }
  };

  const lockNow = async () => {
    setNote(null);
    try {
      const was = await lockGalleryNow();
      finish(
        was
          ? "Locked. Local Gallery saved and closed; it needs the passcode to open again."
          : "Local Gallery isn’t open, so it’s locked already.",
        was ? "locked" : "was-locked",
      );
    } catch (err) {
      failed(err);
    }
  };

  const t = library?.totals;
  const facts = [
    t?.taggedFolders != null ? `${t.taggedFolders.toLocaleString()} folders tagged` : null,
    t?.journalDays != null ? `${t.journalDays.toLocaleString()} journal days` : null,
    t?.lastSaved ? `last used ${agoWords(t.lastSaved)}` : null,
  ].filter(Boolean);

  return (
    <Section title="Local Gallery">
      {flow ? (
        <div className="passcode-flow">
          <PasscodePad
            title={TITLE[flow.job]}
            prompt={PROMPT[flow.step]}
            message={flow.message ?? (flow.step === "current" ? null : "Mote isn’t looking.")}
            calm={!flow.message}
            wrong={flow.wrong}
            step={["current", "new", "again"].indexOf(flow.step)}
            busy={flow.busy}
            onEnter={(pin) => void enter(pin)}
            onCancel={() => setFlow(null)}
          />
        </div>
      ) : (
        <>
          <Row
            label="Passcode"
            hint={
              set
                ? "Mote asks for it before opening Local Gallery. Without it, the gallery doesn’t open."
                : "Four digits Mote asks for before opening Local Gallery."
            }
          >
            <span className={`passcode-state${set ? " is-on" : ""}`}>{set ? "On" : "Off"}</span>
          </Row>
          <div className="button-row">
            <button
              type="button"
              className={`btn${set ? "" : " is-accent"}`}
              onClick={() => start(set ? "change" : "set")}
            >
              {set ? "Change passcode" : "Set a passcode"}
            </button>
            {set ? (
              <>
                <button type="button" className="btn" onClick={() => void lockNow()}>
                  Lock now
                </button>
                <button type="button" className="btn" onClick={() => start("off")}>
                  Turn passcode off
                </button>
              </>
            ) : null}
          </div>
          {note ? <p className="key-message">{note}</p> : null}
          {status.library ? (
            <Row
              label="Hide gallery folder"
              hint={
                status.both
                  ? "There’s both a “Local Gallery” and a “.Local Gallery” folder in Documents. Combine them by hand first."
                  : "Renames the library in Documents to “.Local Gallery”, so Finder doesn’t show it. If the gallery is open, it closes for a moment while that happens."
              }
            >
              <Toggle
                label="Hide gallery folder"
                checked={status.hidden}
                onChange={(hidden) => start(hidden ? "hide" : "show")}
              />
            </Row>
          ) : null}
          {library?.found ? (
            <p className="passcode-library">
              {library.hidden ? "Documents/.Local Gallery" : "Documents/Local Gallery"}
              {facts.length ? ` · ${facts.join(" · ")}` : ""}
            </p>
          ) : null}
          <p className="passcode-fine">
            Mote keeps only a scrambled fingerprint of the passcode, never the digits. After five
            wrong tries in a row, Mote stops taking any for a while. It keeps the gallery shut, but
            your pictures in Documents aren’t locked.
          </p>
        </>
      )}
    </Section>
  );
}
