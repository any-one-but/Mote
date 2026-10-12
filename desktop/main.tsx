import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Companion } from "@/components/companion/Companion";
import {
  isDesktopApp,
  onDebugWindowClosed,
  openSettingsWindow,
  setFloatOnTop,
  showDebugWindow,
} from "@/lib/companion/desktop";
import { featureOn, readFeatures } from "@/lib/companion/features";
import { readSettings, useSettings } from "@/lib/companion/settings";
import "../src/styles.css";
import "./desktop.css";

// The Mac app's main window: Mote, a strip along the top for dragging, and the
// window-level parts of Settings (floating, the debug window, ⌘,).
function App() {
  const [settings, update] = useSettings();

  useEffect(() => setFloatOnTop(settings.floatOnTop), [settings.floatOnTop]);

  useEffect(() => {
    // Open again if it was open last time (and it's still unlocked).
    if (readSettings().debug && featureOn(readFeatures(), "debug")) showDebugWindow(true);
    return onDebugWindowClosed(() => update({ debug: false }));
  }, [update]);

  // In the Mac app the menu owns ⌘, — this covers a plain browser.
  useEffect(() => {
    if (isDesktopApp()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ",") {
        e.preventDefault();
        openSettingsWindow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="drag-strip" data-tauri-drag-region />
      <Companion />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
