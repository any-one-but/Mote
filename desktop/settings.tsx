import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Energy } from "@/components/companion/engine";
import { isDesktopApp, openCaloriesWindow, openLink, showDebugWindow } from "@/lib/companion/desktop";
import { markCalorieCare } from "@/lib/companion/calorie-store";
import { useSettings, type Pace, type Settings } from "@/lib/companion/settings";
import {
  linkName,
  loadLinks,
  onLinksChanged,
  removeLink,
  type SavedLink,
} from "@/components/companion/links";
import { MiniMote, Page, Row, Section, Segmented, Toggle } from "./ui";

const ENERGY: Array<{ value: Energy; label: string }> = [
  { value: "calm", label: "Calm" },
  { value: "normal", label: "Normal" },
  { value: "lively", label: "Lively" },
];

const PACE: Array<{ value: Pace; label: string }> = [
  { value: "gentle", label: "Gentle" },
  { value: "normal", label: "Normal" },
  { value: "turbo", label: "Turbo" },
];

const PACE_HINT: Record<Pace, string> = {
  gentle: "Works quietly in the background. Easy on your Mac, but slower.",
  normal: "Works through one thing at a time.",
  turbo: "Works on many things at once. Much faster, but your Mac will be busy.",
};

function SettingsWindow() {
  const [settings, update] = useSettings();
  const [hop, setHop] = useState(0);

  // Every change makes the little Mote in the corner do a happy hop.
  const set = (patch: Partial<Settings>) => {
    update(patch);
    setHop((n) => n + 1);
  };

  return (
    <Page>
      <header className="header">
        <MiniMote hop={hop} />
        <div>
          <h1>Settings</h1>
          <p>Little ways to make Mote yours.</p>
        </div>
      </header>

      <Section title="Mote">
        <Row label="Follows your pointer" hint="Mote’s eyes track wherever your pointer goes.">
          <Toggle
            label="Follows your pointer"
            checked={settings.followPointer}
            onChange={(followPointer) => set({ followPointer })}
          />
        </Row>
        <Row
          label="Naps when left alone"
          hint="Left be for a few minutes, Mote dozes off. A poke wakes them."
        >
          <Toggle
            label="Naps when left alone"
            checked={settings.naps}
            onChange={(naps) => set({ naps })}
          />
        </Row>
        <Row label="Energy" hint="How often Mote does something on their own." stacked>
          <Segmented
            label="Energy"
            options={ENERGY}
            value={settings.energy}
            onChange={(energy) => set({ energy })}
          />
        </Row>
      </Section>

      <Section title="Calories">
        <Row
          label="Daily goal"
          hint="Stay under this. Mote is glad when you do, and sad if you go past it."
        >
          <GoalField
            value={settings.calorieGoal}
            onChange={(calorieGoal) => {
              set({ calorieGoal });
              markCalorieCare();
            }}
          />
        </Row>
        <div className="button-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              markCalorieCare();
              openCaloriesWindow();
            }}
          >
            Show the days
          </button>
        </div>
      </Section>

      <Section title="Helping with files">
        <Row label="Pace" hint={PACE_HINT[settings.pace]} stacked>
          <Segmented
            label="Pace"
            options={PACE}
            value={settings.pace}
            onChange={(pace) => set({ pace })}
          />
        </Row>
      </Section>

      <Section title="Saved links">
        <SavedLinks />
      </Section>

      {isDesktopApp() ? (
        <Section title="Window">
          <Row label="Float above other windows" hint="Keeps Mote in sight while you work.">
            <Toggle
              label="Float above other windows"
              checked={settings.floatOnTop}
              onChange={(floatOnTop) => set({ floatOnTop })}
            />
          </Row>
        </Section>
      ) : null}

      <div className="settings-foot">
        <Section>
          <Row label="Debug mode" hint="Opens a separate window of testing tools.">
            <Toggle
              label="Debug mode"
              checked={settings.debug}
              onChange={(debug) => {
                set({ debug });
                showDebugWindow(debug);
              }}
            />
          </Row>
        </Section>
      </div>
    </Page>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsWindow />
  </StrictMode>,
);

/**
 * The links you've dragged onto Mote, newest first, with how they've gone
 * when Mote brought them up. Removing one here means it never comes up again.
 */
function SavedLinks() {
  const [links, setLinks] = useState<SavedLink[]>([]);
  useEffect(() => {
    const read = () => setLinks(loadLinks().slice().reverse());
    read();
    return onLinksChanged(read);
  }, []);
  if (!links.length) {
    return (
      <p className="links-empty">
        Drag a link from your browser onto Mote to save it. Every now and then, Mote will bring one
        up and ask if you’d like to go there.
      </p>
    );
  }
  return (
    <ul className="links">
      {links.map((l) => (
        <li key={l.url} className="link-row">
          <div className="link-text">
            <a
              href={l.url}
              className="link-name"
              onClick={(e) => {
                e.preventDefault();
                openLink(l.url);
              }}
            >
              {linkName(l)}
            </a>
            <span className="link-stats">
              {host(l.url)} ·{" "}
              {l.suggested
                ? `suggested ${times(l.suggested)}, ${l.opened ? `opened ${times(l.opened)}` : "never opened"}`
                : "not suggested yet"}
            </span>
          </div>
          <button
            type="button"
            className="link-remove"
            aria-label={`Remove ${linkName(l)}`}
            title="Remove"
            onClick={() => {
              removeLink(l.url);
              setLinks(loadLinks().slice().reverse());
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}

function GoalField({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Math.max(0, Math.min(20000, Math.round(Number(text) || 0)));
    setText(String(n));
    if (n !== value) onChange(n);
  };
  return (
    <input
      className="num-input"
      inputMode="numeric"
      aria-label="Daily calorie goal"
      value={text}
      onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
      }}
    />
  );
}

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
