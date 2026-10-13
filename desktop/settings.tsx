import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  isDesktopApp,
  opensAtLogin,
  setOpensAtLogin,
  widenSettingsWindow,
} from "@/lib/companion/desktop";
import { featureOn, useFeatures } from "@/lib/companion/features";
import {
  lookOf,
  nameOf,
  useDark,
  useMode,
  useSettings,
  type MoteAppearance,
  type Settings,
  type Theme,
} from "@/lib/companion/settings";
import { DebugPanel } from "./debug";
import { MiniMote, Page, Row, Section, Segmented, Toggle } from "./ui";

const MOTE_APPEARANCE: Array<{ value: MoteAppearance; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "jack", label: "Jack-o’-lantern" },
  { value: "ghost", label: "Ghost" },
];

const MOTE_APPEARANCE_HINT: Record<MoteAppearance, string> = {
  normal: "Just Mote.",
  jack: "Pumpkin orange, triangle eyes, and a carved, toothy grin. Happy Halloween!",
  ghost: "Mote under a sheet: round eye holes, and a wavy hem that floats along behind them. Boo!",
};

const THEME: Array<{ value: Theme; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/**
 * The Settings window: how Mote looks (light or dark), and how Mote sits on
 * your Mac. With Debug unlocked, it's the Debug tabs too, Settings first.
 */
function SettingsWindow() {
  const [settings] = useSettings();
  const [features, { unlockTyped }] = useFeatures();
  const debug = featureOn(features, "debug");
  useDark(settings.theme);
  useMode(lookOf(settings));
  // Debug's key, typed anywhere in this window (there's no box for it).
  const typed = useRef("");
  useEffect(() => {
    if (debug) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      typed.current = (typed.current + e.key).slice(-40);
      void unlockTyped(typed.current).then((id) => {
        if (id) typed.current = "";
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [debug, unlockTyped]);
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

      <Section title="You">
        <Row label="Your name" hint="What Mote calls you." stacked>
          <NameField value={settings.name} onChange={(name) => set({ name })} />
        </Row>
      </Section>

      <Section title="Mote">
        <Row label="Mote Appearance" hint={MOTE_APPEARANCE_HINT[settings.moteAppearance]} stacked>
          <Segmented
            label="Mote Appearance"
            options={MOTE_APPEARANCE}
            value={settings.moteAppearance}
            onChange={(moteAppearance) => set({ moteAppearance })}
          />
        </Row>
        <Row label="Light or dark" hint="Dark swaps Mote’s colours: a dark face with cream eyes." stacked>
          <Segmented
            label="Light or dark"
            options={THEME}
            value={settings.theme}
            onChange={(theme) => set({ theme })}
          />
        </Row>
      </Section>

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
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsWindow />
  </StrictMode>,
);

/** Your name, saved when you're done typing it (Return, or clicking away),
 * so Mote hears it once, not a letter at a time. */
function NameField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const name = nameOf(text);
    setText(name);
    if (name !== value) onChange(name);
  };
  return (
    <input
      className="text-input name-input"
      aria-label="Your name"
      placeholder="Your name"
      autoComplete="off"
      spellCheck={false}
      maxLength={40}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
      }}
    />
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
