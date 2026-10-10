import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// A plain single-page build of Mote for the Mac app (see src-tauri/).
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [viteReact(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  },
  server: { port: 1420, strictPort: true, host: "127.0.0.1" },
  build: { outDir: "dist", emptyOutDir: true },
  clearScreen: false,
});
