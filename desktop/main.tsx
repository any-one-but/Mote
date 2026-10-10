import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Companion } from "@/components/companion/Companion";
import "../src/styles.css";
import "./desktop.css";

// The Mac app: just Mote, plus a strip along the top for dragging the window.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="drag-strip" data-tauri-drag-region />
    <Companion />
  </StrictMode>,
);
