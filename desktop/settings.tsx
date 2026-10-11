import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Energy } from "@/components/companion/engine";
import { isDesktopApp, showDebugWindow } from "@/lib/companion/desktop";
import { useSettings, type Pace, type Settings } from "@/lib/companion/settings";
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
        <Row label="Energy" hint="How often Mote does something on their own." stacked>
          <Segmented
            label="Energy"
            options={ENERGY}
            value={settings.energy}
            onChange={(energy) => set({ energy })}
          />
        </Row>
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
