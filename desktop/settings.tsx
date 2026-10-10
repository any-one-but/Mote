import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Energy } from "@/components/companion/engine";
import { isDesktopApp, showDebugWindow } from "@/lib/companion/desktop";
import { useSettings, type Settings } from "@/lib/companion/settings";
import { MiniMote, Page, Row, Section, Segmented, Toggle } from "./ui";

const ENERGY: Array<{ value: Energy; label: string }> = [
  { value: "calm", label: "Calm" },
  { value: "normal", label: "Normal" },
  { value: "lively", label: "Lively" },
];

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
        <MiniMote hop={hop} headphones={settings.headphones} mustache={settings.mustache} />
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
          label="Friendly mode"
          hint="Mote never gets cross or hurt: no grumpiness, sulking or sharp words."
        >
          <Toggle
            label="Friendly mode"
            checked={settings.friendly}
            onChange={(friendly) => set({ friendly })}
          />
        </Row>
        <Row label="Naps when left alone" hint="When Mote gets sleepy and is left alone, they nap.">
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
