import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Energy } from "@/components/companion/engine";
import {
  isDesktopApp,
  openCaloriesWindow,
  openLink,
  opensAtLogin,
  setOpensAtLogin,
  widenSettingsWindow,
} from "@/lib/companion/desktop";
import { markCalorieCare } from "@/lib/companion/calorie-store";
import { featureOn, KEYED, useFeatures } from "@/lib/companion/features";
import { useDark, useSettings, type Pace, type Settings, type Theme } from "@/lib/companion/settings";
import {
  linkName,
  loadLinks,
  onLinksChanged,
  removeLink,
  type SavedLink,
} from "@/components/companion/links";
import { DebugPanel } from "./debug";
import { LocalGallerySection } from "./passcode-settings";
import { MiniMote, Page, Row, Section, Segmented, Toggle } from "./ui";

const ENERGY: Array<{ value: Energy; label: string }> = [
  { value: "calm", label: "Calm" },
  { value: "normal", label: "Normal" },
  { value: "lively", label: "Lively" },
];

const THEME: Array<{ value: Theme; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
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

/**
 * The Settings window. With Debug unlocked and on, it's the Debug tabs too,
 * Settings first.
 */
function SettingsWindow() {
  const [settings] = useSettings();
  const [features] = useFeatures();
  const debug = featureOn(features, "debug");
  useDark(settings.theme);
  // The Debug tabs need more room.
  useEffect(() => {
    if (debug) widenSettingsWindow();
  }, [debug]);
  return debug ? (
    <DebugPanel settingsTab={<SettingsPanel />} />
  ) : (
    <Page>
      <SettingsPanel />
    </Page>
  );
}

function SettingsPanel() {
  const [settings, update] = useSettings();
  const [features] = useFeatures();
  const diet = featureOn(features, "diet");
  const gallery = featureOn(features, "gallery");
  const links = featureOn(features, "links");
  const files = featureOn(features, "files");
  const [hop, setHop] = useState(0);

  // Every change makes the little Mote in the corner do a happy hop.
  const set = (patch: Partial<Settings>) => {
    update(patch);
    setHop((n) => n + 1);
  };

  return (
    <>
      <header className="header">
        <MiniMote hop={hop} />
        <div>
          <h1>Settings</h1>
          <p>Little ways to make Mote yours.</p>
        </div>
      </header>

      <Section title="Mote">
        <Row label="Appearance" hint="Dark swaps Mote’s colours: a dark face with cream eyes." stacked>
          <Segmented
            label="Appearance"
            options={THEME}
            value={settings.theme}
            onChange={(theme) => set({ theme })}
          />
        </Row>
        <Row
          label="Friendly mode"
          hint="Mote never gets too upset: hurt counts for half, and no sulking or sharp words."
        >
          <Toggle
            label="Friendly mode"
            checked={settings.friendly}
            onChange={(friendly) => set({ friendly })}
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

      {diet ? (
        <Section title="Calories">
          <Row label="Daily goal" hint="Set it to 0 to stop tracking.">
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
      ) : null}

      {gallery ? <LocalGallerySection onChange={() => setHop((n) => n + 1)} /> : null}

      {files ? (
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
      ) : null}

      {links ? (
        <Section title="Saved links">
          <SavedLinks />
        </Section>
      ) : null}

      {isDesktopApp() ? (
        <Section title="On your Mac">
          <OpenAtLogin onChange={() => setHop((n) => n + 1)} />
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
        <FeatureKey />
      </div>
    </>
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

/** Lives on the Mac rather than in Mote's settings, so it's asked for. */
function OpenAtLogin({ onChange }: { onChange: () => void }) {
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void opensAtLogin().then(setOn);
  }, []);
  return (
    <Row
      label="Open at login"
      hint={failed ? "That didn’t work. Try again?" : "Mote starts up when you log in to your Mac."}
    >
      <Toggle
        label="Open at login"
        checked={on}
        onChange={(next) => {
          setOn(next);
          void setOpensAtLogin(next).then((ok) => {
            setFailed(!ok);
            if (ok) onChange();
            else setOn(!next);
          });
        }}
      />
    </Row>
  );
}

/**
 * Feature Key: type a key to unlock a feature kept out of reach (for now,
 * just Debug). Every unlocked feature is listed underneath, with a
 * switch.
 */
function FeatureKey() {
  const [features, { unlock, setOn }] = useFeatures();
  const [key, setKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const tryKey = async () => {
    if (!key.trim()) return;
    const got = await unlock(key);
    const name = got && KEYED.find((f) => f.id === got.id)?.name;
    setMessage(got ? (got.already ? `${name} is already unlocked.` : `Unlocked: ${name}.`) : "That key doesn’t unlock anything.");
    if (got) setKey("");
  };
  const unlocked = KEYED.filter((f) => features.unlocked.includes(f.id));
  return (
    <Section title="Feature Key">
      <form
        className="key-row"
        onSubmit={(e) => {
          e.preventDefault();
          void tryKey();
        }}
      >
        <input
          className="text-input"
          aria-label="Feature Key"
          placeholder="Feature Key"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setMessage(null);
          }}
        />
        <button type="button" className="btn is-accent" onClick={() => void tryKey()}>
          Unlock
        </button>
      </form>
      {message ? <p className="key-message">{message}</p> : null}
      {unlocked.map((f) => (
        <Row key={f.id} label={f.name} hint={f.about}>
          <Toggle
            label={f.name}
            checked={featureOn(features, f.id)}
            onChange={(on) => setOn(f.id, on)}
          />
        </Row>
      ))}
    </Section>
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
