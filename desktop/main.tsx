import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Companion } from "@/components/companion/Companion";
import { openSettingsWindow, setDockHidden, setFloatOnTop } from "@/lib/companion/desktop";
import { useSettings } from "@/lib/companion/settings";
import "../src/styles.css";
import "./desktop.css";

// The Mac app's main window: Mote, a strip along the top for dragging, and the
// window-level parts of Settings (floating, ⌘,).
function App() {
  const [settings] = useSettings();

  useEffect(() => setFloatOnTop(settings.floatOnTop), [settings.floatOnTop]);
  useEffect(() => setDockHidden(settings.hideDock), [settings.hideDock]);

  // ⌘, opens Settings: the menu has it too, but with the Dock icon hidden the
  // menu bar isn't there, so Mote's window listens as well (and in a plain
  // browser, it's the only way). Opening it twice just brings it forward.
  useEffect(() => {
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
