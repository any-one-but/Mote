import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};

const page = (name: string) => fileURLToPath(new URL(`./${name}.html`, import.meta.url));

// A plain multi-page build of Mote for the Mac app (see src-tauri/): Mote's
// window, Settings and Debug. gallery.html is only served while developing.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [viteReact(), tailwindcss()],
  define: { __MOTE_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  },
  server: { port: 1420, strictPort: true, host: "127.0.0.1" },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: page("index"),
        settings: page("settings"),
        calories: page("calories"),
      },
    },
  },
  clearScreen: false,
});
