#!/usr/bin/env node
// Releases Mote: `npm run release:patch` (or `-- --dry-run` to see what it
// would do without changing anything). Works like Local Gallery's release
// script:
//
// 1. Bumps the patch version (0.10.0 -> 0.10.1) everywhere Mote keeps it:
//    package.json, src-tauri/Cargo.toml, Cargo.lock, tauri.conf.json, and the
//    installer's name in README.md.
// 2. Checks first: types, Mote's tests, the Mac side's tests, and that Local
//    Gallery still has Mote's changes. A failure stops the release.
// 3. Builds the Mac app (with Local Gallery inside, and the installer) BEFORE
//    committing anything. The build is the step most likely to fail; if it
//    does, the version bump is put back and nothing is committed or pushed.
// 4. Commits everything (with Mote's own built files) as "release: vX" and
//    pushes.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY_RUN = process.argv.includes("--dry-run");
const at = (p) => join(ROOT, p);

// Mote's own part of the built app, kept in git (the rest is too big).
const BUILT = [
  "src-tauri/target/release/bundle/macos/Mote.app/Contents/Info.plist",
  "src-tauri/target/release/bundle/macos/Mote.app/Contents/MacOS/mote",
];

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

function run(cmd, args, { mutate = false, capture = false, allowFailure = false } = {}) {
  console.log(`> ${[cmd, ...args].join(" ")}${DRY_RUN && mutate ? " [dry-run]" : ""}`);
  if (DRY_RUN && mutate) return { status: 0, stdout: "" };
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
  if (result.error) {
    if (allowFailure) return { status: 1, stdout: "" };
    fail(result.error.message);
  }
  if ((result.status ?? 0) !== 0 && !allowFailure) {
    if (capture && result.stderr) console.error(String(result.stderr).trim());
    process.exit(result.status || 1);
  }
  return result;
}

function bumpPatch(version) {
  const parts = String(version).split(".");
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
    fail(`Unsupported version: ${version}`);
  }
  parts[2] = String(Number(parts[2]) + 1);
  return parts.join(".");
}

/** Replaces exactly one match, or stops: a version that isn't where it's expected is a problem. */
function replaceOnce(text, pattern, replacement, file) {
  const matches = text.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"));
  if (!matches || matches.length !== 1) fail(`Couldn't find the version in ${file} (found ${matches?.length ?? 0}).`);
  return text.replace(pattern, replacement);
}

// --- Work out the new version -------------------------------------------------

const pkg = JSON.parse(readFileSync(at("package.json"), "utf8"));
const current = String(pkg.version || "");
const tauriConf = JSON.parse(readFileSync(at("src-tauri/tauri.conf.json"), "utf8"));
if (tauriConf.version !== current) fail(`package.json (${current}) and tauri.conf.json (${tauriConf.version}) don't match.`);
const next = bumpPatch(current);
console.log(`Releasing Mote ${current} -> ${next}`);

const esc = (s) => s.replace(/\./g, "\\.");
const edits = [
  ["package.json", (t) => replaceOnce(t, new RegExp(`"version": "${esc(current)}"`), `"version": "${next}"`, "package.json")],
  ["src-tauri/tauri.conf.json", (t) => replaceOnce(t, new RegExp(`"version": "${esc(current)}"`), `"version": "${next}"`, "tauri.conf.json")],
  ["src-tauri/Cargo.toml", (t) => replaceOnce(t, new RegExp(`^version = "${esc(current)}"`, "m"), `version = "${next}"`, "Cargo.toml")],
  ["src-tauri/Cargo.lock", (t) => replaceOnce(t, new RegExp(`name = "mote"\\nversion = "${esc(current)}"`), `name = "mote"\nversion = "${next}"`, "Cargo.lock")],
  // The installer's name, wherever the README mentions it.
  ["README.md", (t) => t.replace(/Mote_\d+\.\d+\.\d+_aarch64\.dmg/g, `Mote_${next}_aarch64.dmg`)],
];
const originals = edits.map(([file]) => [file, readFileSync(at(file), "utf8")]);
const changed = originals.map(([file, text], i) => [file, edits[i][1](text)]);

function restore() {
  for (const [file, text] of originals) {
    try {
      writeFileSync(at(file), text);
    } catch (err) {
      console.error(`Couldn't put back ${relative(ROOT, at(file))}: ${err.message}`);
    }
  }
}

// --- Checks, before anything changes ------------------------------------------

const checks = [
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "test:mote"]],
  ["cargo", ["test", "--manifest-path", "src-tauri/Cargo.toml", "--quiet"]],
  ["sh", ["scripts/check-gallery-mote.sh"]],
];
for (const [cmd, args] of checks) {
  if ((run(cmd, args, { allowFailure: true }).status ?? 0) !== 0) {
    fail("A check failed. Nothing was changed, built, committed or pushed.");
  }
}

if (!DRY_RUN) for (const [file, text] of changed) writeFileSync(at(file), text);

// --- Build, then commit and push ----------------------------------------------

const built = run("npm", ["run", "mac:build"], { mutate: true, allowFailure: true });
if ((built.status ?? 0) !== 0) {
  if (!DRY_RUN) restore();
  fail(`The build failed (exit ${built.status || 1}); the version is back to ${current}. Nothing was committed or pushed.`);
}

// Everything but Claude's own settings folder, plus Mote's part of the built app.
run("git", ["add", "-A", "--", ".", ":!.claude"], { mutate: true });
run("git", ["add", "-f", "--", ...BUILT], { mutate: true });
run("git", ["commit", "-m", `release: v${next}`], { mutate: true });

const branch = String(run("git", ["branch", "--show-current"], { capture: true }).stdout || "").trim();
if (!branch) fail("Couldn't tell which branch this is; the release is committed but not pushed.");
const upstream = spawnSync("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], {
  cwd: ROOT,
  encoding: "utf8",
});
run("git", ["push", ...((upstream.status ?? 1) === 0 ? [] : ["-u", "origin", branch])], { mutate: true });

console.log(`\n${DRY_RUN ? "Would release" : "Released"} Mote v${next}.`);
console.log(`  App:       src-tauri/target/release/bundle/macos/Mote.app`);
console.log(`  Installer: src-tauri/target/release/bundle/dmg/Mote_${next}_aarch64.dmg`);
