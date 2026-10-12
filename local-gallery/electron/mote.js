// Mote: the part of this copy that only Mote's carried Local Gallery has.
//
// Mote keeps the passcode for this copy (see Mote's src-tauri/src/gallery.rs).
// The page's own passcode screen stays switched off here (the page asks
// `mote_keeps_passcode`, and the library's lock.log.json is ignored), and this
// file makes sure the gallery only ever opens from Mote:
//
// - Mote opens it with a one-time ticket: a random word written to a file in
//   Mote's folder, and the same word on the command line. They must match, and
//   be fresh; the file is thrown away either way. Without a match, the gallery
//   says where to open it from and quits, before any window or library.
// - While it's open, it notes its process number for Mote, so Mote knows not
//   to ask for the passcode again just to bring it to the front.
// - "Lock now" (and hiding the library folder) in Mote's Settings leave a
//   close request; the page saves what it's doing and the gallery quits.
//
// An unpackaged run (`npm start` in local-gallery/) skips the ticket, for
// working on the gallery itself.

"use strict";

const { app, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

// Mote's own folder (its app ID), where Mote writes these.
const MOTE_DIR = path.join(app.getPath("appData"), "com.anyonebut.mote");
const TICKET = path.join(MOTE_DIR, "gallery-ticket.json");
const RUNNING = path.join(MOTE_DIR, "gallery-running");
const CLOSE = path.join(MOTE_DIR, "gallery-close");
// A ticket older than this was never used, and won't be.
const TICKET_LIFE_MS = 2 * 60 * 1000;

function remove(file) {
  try {
    fs.unlinkSync(file);
  } catch {}
}

function ticketFromArgs() {
  const arg = process.argv.find((a) => a.startsWith("--mote-ticket="));
  return arg ? arg.slice("--mote-ticket=".length) : "";
}

function ticketIsGood() {
  const given = ticketFromArgs();
  let saved = null;
  try {
    saved = JSON.parse(fs.readFileSync(TICKET, "utf8"));
  } catch {}
  // One use only, right or wrong.
  remove(TICKET);
  if (!given || !saved || typeof saved.ticket !== "string") return false;
  const fresh = Date.now() - Number(saved.at || 0) < TICKET_LIFE_MS;
  return fresh && saved.ticket.length >= 32 && saved.ticket === given;
}

/** Whether this run may go ahead. Call once the app is ready. */
function admit() {
  if (!app.isPackaged) return true;
  if (ticketIsGood()) return true;
  dialog.showMessageBoxSync({
    type: "info",
    message: "Local Gallery opens from Mote.",
    detail: "Press the picture frame on Mote’s window to open it.",
    buttons: ["OK"],
  });
  return false;
}

/** Note that the gallery is open, and listen for Mote asking it to close. */
function watch(getWindow) {
  try {
    fs.mkdirSync(MOTE_DIR, { recursive: true });
    fs.writeFileSync(RUNNING, String(process.pid), { mode: 0o600 });
  } catch {}
  // Anything left over from before this run isn't meant for it.
  remove(CLOSE);
  let closing = false;
  setInterval(() => {
    if (closing || !fs.existsSync(CLOSE)) return;
    closing = true;
    remove(CLOSE);
    const win = getWindow();
    // Save what the page has waiting first (at most a few seconds), then quit.
    const save =
      win && !win.isDestroyed()
        ? win.webContents
            .executeJavaScript(
              "(async () => { try { await flushPendingMetadataSaveNow(); } catch {} })()",
            )
            .catch(() => {})
        : Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 5000));
    Promise.race([save, timeout]).then(() => app.quit());
  }, 1000);
  app.on("will-quit", () => {
    try {
      if (fs.readFileSync(RUNNING, "utf8").trim() === String(process.pid)) remove(RUNNING);
    } catch {}
  });
}

/** The page asks this to know its passcode screen stays off. */
const commands = {
  mote_keeps_passcode: () => true,
};

module.exports = { admit, watch, commands };
