// Local Gallery: a separate app (Electron) that Mote carries and opens. Mote
// doesn't run any of it; it only finds the app and asks macOS to open it,
// exactly as if you'd double-clicked it. Its code lives in ../local-gallery.
//
// Mote also keeps the gallery's passcode. The gallery's own passcode screen is
// switched off in the copy Mote carries (and its `lock.log.json` ignored);
// instead Mote asks for the passcode before opening it, and without the right
// one the gallery never opens at all. The same precautions as the gallery's
// own: four digits, kept only as a salted, slowly worked hash (PBKDF2-SHA256,
// 150,000 rounds, never the digits), a new passcode typed twice, and the
// current one asked for before changing it, turning it off, or hiding the
// library folder. On top of that, too many wrong tries in a row and Mote stops
// taking any for a while, longer each time.
//
// So the carried copy can't simply be opened from inside Mote.app to get
// round all this, Mote hands it a one-time ticket as it opens it (a random
// word in a file only Mote and the gallery read, plus the same word on the
// command line). The gallery checks the two match, throws the file away, and
// without a match quits before showing anything. The gallery side of this is
// local-gallery/electron/mote.js.
//
// Mote also reads the library's log folder (`<library>/.local-gallery`), to
// show what's in it: only file names, sizes, dates and how many entries each
// holds, never any folder names, tags or anything else from inside.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const APP: &str = "Local Gallery.app";
/// The library folder, in Documents, under its usual name or hidden (dotted).
const LIBRARY: &str = "Local Gallery";
const LIBRARY_HIDDEN: &str = ".Local Gallery";
/// The library's own log folder, inside it.
const LOGS: &str = ".local-gallery";
/// The gallery's own passcode record, which Mote's copy ignores.
const GALLERY_LOCK: &str = "lock.log.json";

/// In Mote's own folder (~/Library/Application Support/com.anyonebut.mote).
const RECORD: &str = "gallery-passcode.json";
const TRIES: &str = "gallery-tries.json";
/// Shared with the gallery (see local-gallery/electron/mote.js).
const TICKET: &str = "gallery-ticket.json";
const RUNNING: &str = "gallery-running";
const CLOSE: &str = "gallery-close";

const ITERATIONS: u32 = 150_000;
const PIN_LEN: usize = 4;
/// Wrong tries in a row before Mote stops taking any for a while.
const MAX_TRIES: u32 = 5;
/// The first wait, doubled each time after, up to the longest.
const FIRST_WAIT_MS: u64 = 30_000;
const LONGEST_WAIT_MS: u64 = 15 * 60_000;

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

// --- Where things are ------------------------------------------------------

/// Where the carried copy is: inside Mote.app's Resources when built, or the
/// copy built in the project folder while developing.
fn gallery_app(app: &AppHandle) -> Option<PathBuf> {
    let bundled = app.path().resource_dir().ok().map(|dir| dir.join(APP));
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../local-gallery/dist-electron/mac-arm64")
        .join(APP);
    bundled.into_iter().chain(std::iter::once(dev)).find(|p| p.exists())
}

fn mote_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Where the library lives (the gallery's own rule: Documents, or Pictures if
/// there's no Documents folder).
fn library_base(app: &AppHandle) -> Option<PathBuf> {
    app.path().document_dir().ok().or_else(|| app.path().picture_dir().ok())
}

struct Library {
    base: PathBuf,
    /// The folder in use: the hidden one wins, as in the gallery.
    path: Option<PathBuf>,
    hidden: bool,
    /// Both names exist (the gallery refuses to hide or show then).
    both: bool,
}

fn library(app: &AppHandle) -> Option<Library> {
    let base = library_base(app)?;
    let visible = base.join(LIBRARY);
    let dotted = base.join(LIBRARY_HIDDEN);
    let (v, d) = (visible.is_dir(), dotted.is_dir());
    let path = if d { Some(dotted) } else if v { Some(visible) } else { None };
    Some(Library { base, path, hidden: d, both: v && d })
}

// --- The passcode record ---------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
struct Record {
    schema: u32,
    enabled: bool,
    #[serde(default)]
    algo: String,
    #[serde(default)]
    salt: String,
    #[serde(default)]
    hash: String,
    #[serde(default)]
    iterations: u32,
    #[serde(rename = "updatedAt", default)]
    updated_at: u64,
}

fn read_record(dir: &Path) -> Option<Record> {
    let text = fs::read_to_string(dir.join(RECORD)).ok()?;
    let rec: Record = serde_json::from_str(&text).ok()?;
    (rec.enabled && !rec.hash.is_empty() && !rec.salt.is_empty()).then_some(rec)
}

/// Written whole to a side file and moved into place, so a half-written
/// record can never lock you out; readable only by you.
fn write_private(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    let mut f = fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(&tmp)
        .map_err(|e| e.to_string())?;
    f.write_all(bytes).map_err(|e| e.to_string())?;
    f.sync_all().map_err(|e| e.to_string())?;
    drop(f);
    let _ = fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600));
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn write_record(dir: &Path, rec: &Record) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(rec).map_err(|e| e.to_string())?;
    write_private(&dir.join(RECORD), &json)
}

// macOS's own CommonCrypto (part of the system library every app links).
extern "C" {
    fn CCKeyDerivationPBKDF(
        algorithm: u32,
        password: *const u8,
        password_len: usize,
        salt: *const u8,
        salt_len: usize,
        prf: u32,
        rounds: u32,
        derived: *mut u8,
        derived_len: usize,
    ) -> i32;
    fn CCRandomGenerateBytes(bytes: *mut u8, count: usize) -> i32;
}
const K_CC_PBKDF2: u32 = 2;
const K_CC_PRF_HMAC_SHA256: u32 = 3;

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn unhex(s: &str) -> Vec<u8> {
    (0..s.len() / 2).map(|i| u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).unwrap_or(0)).collect()
}

fn random_hex(len: usize) -> Result<String, String> {
    let mut bytes = vec![0u8; len];
    // SAFETY: writes exactly `len` bytes into a buffer of that size.
    let status = unsafe { CCRandomGenerateBytes(bytes.as_mut_ptr(), len) };
    if status != 0 {
        return Err("Couldn’t make a random number.".into());
    }
    Ok(hex(&bytes))
}

fn derive(pin: &str, salt_hex: &str, rounds: u32) -> Result<String, String> {
    let salt = unhex(salt_hex);
    let mut out = [0u8; 32];
    // SAFETY: every pointer comes with its own length.
    let status = unsafe {
        CCKeyDerivationPBKDF(
            K_CC_PBKDF2,
            pin.as_ptr(),
            pin.len(),
            salt.as_ptr(),
            salt.len(),
            K_CC_PRF_HMAC_SHA256,
            rounds.max(1000),
            out.as_mut_ptr(),
            out.len(),
        )
    };
    if status != 0 {
        return Err("Couldn’t check the passcode.".into());
    }
    Ok(hex(&out))
}

fn make_record(pin: &str) -> Result<Record, String> {
    let salt = random_hex(16)?;
    let hash = derive(pin, &salt, ITERATIONS)?;
    Ok(Record {
        schema: 1,
        enabled: true,
        algo: "pbkdf2".into(),
        salt,
        hash,
        iterations: ITERATIONS,
        updated_at: now_ms(),
    })
}

fn pin_ok(pin: &str) -> bool {
    pin.len() == PIN_LEN && pin.bytes().all(|b| b.is_ascii_digit())
}

fn matches(pin: &str, rec: &Record) -> bool {
    if !pin_ok(pin) {
        return false;
    }
    let Ok(hash) = derive(pin, &rec.salt, rec.iterations) else { return false };
    // Compared all the way through, whatever differs first.
    hash.len() == rec.hash.len()
        && hash.bytes().zip(rec.hash.bytes()).fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0
}

// --- Wrong tries -------------------------------------------------------------

/// Kept on disk, so quitting Mote doesn't start the count over.
#[derive(Serialize, Deserialize, Default)]
struct Tries {
    /// Wrong tries in a row.
    wrong: u32,
    /// How many times Mote has stopped taking tries (each wait is longer).
    waits: u32,
    /// No tries taken until then (ms since 1970).
    until: u64,
}

fn read_tries(dir: &Path) -> Tries {
    fs::read_to_string(dir.join(TRIES))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn write_tries(dir: &Path, tries: &Tries) {
    if let Ok(json) = serde_json::to_vec(tries) {
        let _ = write_private(&dir.join(TRIES), &json);
    }
}

/// One answer at a time, so two windows can't race each other's count.
static CHECKING: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[derive(Serialize, Clone, Copy)]
#[serde(tag = "result", rename_all = "camelCase")]
pub enum Check {
    /// The right passcode (or none is set).
    Right,
    /// Not it; this many tries left before Mote stops taking them.
    Wrong {
        #[serde(rename = "triesLeft")]
        tries_left: u32,
    },
    /// That was one wrong try too many: no more for this many seconds.
    Refused { wait: u64 },
    /// Still not taking tries, for this many seconds more.
    Waiting { wait: u64 },
}

fn wait_secs(until: u64) -> u64 {
    until.saturating_sub(now_ms()).div_ceil(1000)
}

fn check(dir: &Path, pin: &str) -> Check {
    let _one = CHECKING.lock().unwrap_or_else(|e| e.into_inner());
    let Some(rec) = read_record(dir) else { return Check::Right };
    let mut tries = read_tries(dir);
    if tries.until > now_ms() {
        return Check::Waiting { wait: wait_secs(tries.until) };
    }
    if matches(pin, &rec) {
        if tries.wrong > 0 || tries.waits > 0 {
            write_tries(dir, &Tries::default());
        }
        return Check::Right;
    }
    tries.wrong += 1;
    let verdict = if tries.wrong >= MAX_TRIES {
        let wait = FIRST_WAIT_MS.saturating_mul(1 << tries.waits.min(10)).min(LONGEST_WAIT_MS);
        tries.wrong = 0;
        tries.waits += 1;
        tries.until = now_ms() + wait;
        Check::Refused { wait: wait_secs(tries.until) }
    } else {
        Check::Wrong { tries_left: MAX_TRIES - tries.wrong }
    };
    write_tries(dir, &tries);
    verdict
}

/// The current passcode, when one is set, before anything that changes it.
fn require(dir: &Path, current: Option<&str>) -> Result<(), Check> {
    if read_record(dir).is_none() {
        return Ok(());
    }
    match check(dir, current.unwrap_or("")) {
        Check::Right => Ok(()),
        other => Err(other),
    }
}

// --- Whether the gallery is open ---------------------------------------------

/// The carried gallery notes its process number while it's open (mote.js).
fn running_pid(app: &AppHandle) -> Option<i32> {
    let text = fs::read_to_string(mote_dir(app).ok()?.join(RUNNING)).ok()?;
    let pid: i32 = text.trim().parse().ok()?;
    // SAFETY: signal 0 only asks whether the process exists.
    if pid <= 0 || unsafe { libc::kill(pid, 0) } != 0 {
        return None;
    }
    // A number can be reused by something else after a crash: check the name.
    let out = Command::new("/bin/ps").args(["-p", &pid.to_string(), "-o", "comm="]).output().ok()?;
    String::from_utf8_lossy(&out.stdout).contains("Local Gallery").then_some(pid)
}

/// Asks the open gallery to save what it's doing and quit, and waits for it.
fn close_gallery(app: &AppHandle) -> Result<bool, String> {
    let Some(pid) = running_pid(app) else { return Ok(false) };
    write_private(&mote_dir(app)?.join(CLOSE), now_ms().to_string().as_bytes())?;
    let deadline = Instant::now() + Duration::from_secs(15);
    // SAFETY: signal 0 only asks whether the process exists.
    while unsafe { libc::kill(pid, 0) } == 0 {
        if Instant::now() > deadline {
            let _ = fs::remove_file(mote_dir(app)?.join(CLOSE));
            return Err("Local Gallery didn’t close.".into());
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    Ok(true)
}

/// Opens the gallery with a fresh one-time ticket, so it agrees to start.
fn launch(app: &AppHandle) -> Result<(), String> {
    let path = gallery_app(app).ok_or("Local Gallery isn’t in this copy of Mote.")?;
    let dir = mote_dir(app)?;
    // A close request left over from before must not shut the new one.
    let _ = fs::remove_file(dir.join(CLOSE));
    let ticket = random_hex(24)?;
    let json = serde_json::json!({ "ticket": ticket, "at": now_ms() });
    write_private(&dir.join(TICKET), json.to_string().as_bytes())?;
    let status = Command::new("/usr/bin/open")
        .arg(&path)
        .arg("--args")
        .arg(format!("--mote-ticket={ticket}"))
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        let _ = fs::remove_file(dir.join(TICKET));
        Err("Local Gallery wouldn’t open.".into())
    }
}

/// Brings the gallery that's already open to the front.
fn bring_forward(app: &AppHandle) -> Result<(), String> {
    let path = gallery_app(app).ok_or("Local Gallery isn’t in this copy of Mote.")?;
    Command::new("/usr/bin/open").arg(&path).status().map_err(|e| e.to_string())?;
    Ok(())
}

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())
}

// --- Commands ----------------------------------------------------------------

#[derive(Serialize)]
pub struct Status {
    /// This copy of Mote has the gallery inside.
    carried: bool,
    /// A passcode is set.
    passcode: bool,
    /// The gallery is open right now.
    open: bool,
    /// Seconds before Mote takes another try (0 when they will now).
    wait: u64,
    #[serde(rename = "triesLeft")]
    tries_left: u32,
    /// The library folder, if there is one.
    library: Option<String>,
    hidden: bool,
    both: bool,
}

#[tauri::command]
pub async fn gallery_status(app: AppHandle) -> Result<Status, String> {
    blocking(move || {
        let dir = mote_dir(&app)?;
        let tries = read_tries(&dir);
        let lib = library(&app);
        Ok(Status {
            carried: gallery_app(&app).is_some(),
            passcode: read_record(&dir).is_some(),
            open: running_pid(&app).is_some(),
            wait: wait_secs(tries.until),
            tries_left: MAX_TRIES.saturating_sub(tries.wrong),
            library: lib.as_ref().and_then(|l| l.path.as_ref()).map(|p| p.display().to_string()),
            hidden: lib.as_ref().is_some_and(|l| l.hidden),
            both: lib.as_ref().is_some_and(|l| l.both),
        })
    })
    .await?
}

#[derive(Serialize)]
#[serde(tag = "result", rename_all = "camelCase")]
pub enum Opened {
    Opened,
    /// It was open already: brought to the front, nothing asked.
    AlreadyOpen,
    /// A passcode is set and none was given.
    NeedPasscode,
    /// The passcode wasn't right, or Mote isn't taking tries.
    Denied { check: Check },
}

/// Opens Local Gallery: straight away if no passcode is set (or it's already
/// open), otherwise only with the right one.
#[tauri::command]
pub async fn open_local_gallery(app: AppHandle, passcode: Option<String>) -> Result<Opened, String> {
    blocking(move || {
        if gallery_app(&app).is_none() {
            return Err("Local Gallery isn’t in this copy of Mote.".to_string());
        }
        if running_pid(&app).is_some() {
            bring_forward(&app)?;
            return Ok(Opened::AlreadyOpen);
        }
        let dir = mote_dir(&app)?;
        if read_record(&dir).is_some() {
            let Some(pin) = passcode else { return Ok(Opened::NeedPasscode) };
            match check(&dir, &pin) {
                Check::Right => {}
                other => return Ok(Opened::Denied { check: other }),
            }
        }
        launch(&app)?;
        Ok(Opened::Opened)
    })
    .await?
}

/// Checks the passcode without doing anything else (Settings asks for the
/// current one first, before asking for a new one). Wrong tries count.
#[tauri::command]
pub async fn gallery_check_passcode(app: AppHandle, passcode: String) -> Result<Check, String> {
    blocking(move || Ok(check(&mote_dir(&app)?, &passcode))).await?
}

#[derive(Serialize)]
#[serde(tag = "result", rename_all = "camelCase")]
pub enum Changed {
    Done,
    Denied { check: Check },
}

/// Sets a passcode, or changes it (the current one is needed for that).
#[tauri::command]
pub async fn gallery_set_passcode(
    app: AppHandle,
    current: Option<String>,
    passcode: String,
) -> Result<Changed, String> {
    blocking(move || {
        if !pin_ok(&passcode) {
            return Err("A passcode is four digits.".to_string());
        }
        let dir = mote_dir(&app)?;
        if let Err(check) = require(&dir, current.as_deref()) {
            return Ok(Changed::Denied { check });
        }
        write_record(&dir, &make_record(&passcode)?)?;
        write_tries(&dir, &Tries::default());
        Ok(Changed::Done)
    })
    .await?
}

/// Turns the passcode off (the current one is needed).
#[tauri::command]
pub async fn gallery_turn_off_passcode(app: AppHandle, current: String) -> Result<Changed, String> {
    blocking(move || {
        let dir = mote_dir(&app)?;
        if let Err(check) = require(&dir, Some(&current)) {
            return Ok(Changed::Denied { check });
        }
        let off = Record {
            schema: 1,
            enabled: false,
            algo: String::new(),
            salt: String::new(),
            hash: String::new(),
            iterations: 0,
            updated_at: now_ms(),
        };
        write_record(&dir, &off)?;
        write_tries(&dir, &Tries::default());
        Ok(Changed::Done)
    })
    .await?
}

/// Lock now: the open gallery saves and quits, so opening it again needs the
/// passcode. Resolves to whether it was open.
#[tauri::command]
pub async fn gallery_lock_now(app: AppHandle) -> Result<bool, String> {
    blocking(move || close_gallery(&app)).await?
}

#[derive(Serialize)]
#[serde(tag = "result", rename_all = "camelCase")]
pub enum Hid {
    /// Done; `reopened` if the gallery was open and has been opened again.
    Done { reopened: bool },
    Denied { check: Check },
}

/// Hides the library folder from Finder (renames it to `.Local Gallery`) or
/// shows it again. The gallery can't be open while its folder is renamed, so
/// an open one saves and closes first, and opens again afterwards.
#[tauri::command]
pub async fn gallery_set_hidden(
    app: AppHandle,
    current: Option<String>,
    hidden: bool,
) -> Result<Hid, String> {
    blocking(move || {
        if let Err(check) = require(&mote_dir(&app)?, current.as_deref()) {
            return Ok(Hid::Denied { check });
        }
        let lib = library(&app).ok_or("There’s no Documents folder to look in.")?;
        let visible = lib.base.join(LIBRARY);
        let dotted = lib.base.join(LIBRARY_HIDDEN);
        let (from, to) = if hidden { (&visible, &dotted) } else { (&dotted, &visible) };
        if from.is_dir() && to.is_dir() {
            return Err(format!(
                "There’s both a “{LIBRARY}” and a “{LIBRARY_HIDDEN}” folder in Documents. Combine them by hand first."
            ));
        }
        if !from.is_dir() {
            // Already the way you asked (or there's no library yet).
            return Ok(Hid::Done { reopened: false });
        }
        let was_open = close_gallery(&app)
            .map_err(|_| "Local Gallery didn’t close, so the folder was left as it was.".to_string())?;
        fs::rename(from, to).map_err(|e| e.to_string())?;
        if was_open {
            launch(&app)?;
        }
        Ok(Hid::Done { reopened: was_open })
    })
    .await?
}

// --- Reading the log folder ---------------------------------------------------

#[derive(Serialize)]
pub struct LogFile {
    name: String,
    /// What it is, in plain words (for the files Mote knows).
    about: Option<&'static str>,
    size: u64,
    /// When the file was last saved (ms since 1970).
    modified: Option<u64>,
    /// "ok", "empty", "broken" (not readable JSON), or "ignored".
    state: &'static str,
    schema: Option<i64>,
    /// The `updatedAt` written inside it, if any.
    updated: Option<u64>,
    /// How many entries each part of it holds, e.g. ("folders", 10581).
    counts: Vec<(String, usize)>,
}

#[derive(Serialize, Default)]
pub struct Totals {
    #[serde(rename = "taggedFolders")]
    tagged_folders: Option<usize>,
    #[serde(rename = "scoredFolders")]
    scored_folders: Option<usize>,
    #[serde(rename = "journalDays")]
    journal_days: Option<usize>,
    #[serde(rename = "inTrash")]
    in_trash: Option<usize>,
    thumbnails: Option<usize>,
    /// The latest any log was saved: roughly when the gallery was last used.
    #[serde(rename = "lastSaved")]
    last_saved: Option<u64>,
}

#[derive(Serialize)]
pub struct LibraryReport {
    found: bool,
    library: Option<String>,
    hidden: bool,
    both: bool,
    /// The log folder exists.
    logs_found: bool,
    logs: Vec<LogFile>,
    totals: Totals,
}

fn about(name: &str) -> Option<&'static str> {
    if name.contains(".before-") {
        return Some("An old copy, kept from before a change");
    }
    Some(match name {
        "lock.log.json" => "Local Gallery’s own passcode. Ignored: Mote keeps the passcode now",
        "tags.log.json" => "Tags on folders",
        "scores.log.json" => "Scores",
        "score-history.log.json" => "Score history",
        "daily-journals.log.json" => "The daily journal",
        "trash.log.json" => "What’s in the gallery’s trash",
        "custom-thumbnails.log.json" => "Thumbnails you picked",
        "appearance-presets.log.json" => "Saved looks",
        "appearance-assignments.log.json" => "Which folders use which look",
        "keyboard-configuration.log.json" => "Keyboard shortcuts",
        "tabs.log.json" => "Open tabs",
        "tag-albums.log.json" => "Tag albums",
        "aspect-ratios.log.json" => "Picture shapes",
        "folder-scores.log.json" => "Folder scores",
        "folder-tags.log.json" => "Folder tags",
        "folder-votes.log.json" => "Folder votes",
        "variations.json" => "Variations",
        "preferences.log.json" => "Preferences",
        "preferences.general.log.json" => "Preferences: general",
        "preferences.appearance.log.json" => "Preferences: appearance",
        "preferences.controls.log.json" => "Preferences: controls",
        "preferences.filenames.log.json" => "Preferences: names",
        "preferences.notifications.log.json" => "Preferences: messages",
        "preferences.playback.log.json" => "Preferences: playback",
        "preferences.thumbnails.log.json" => "Preferences: thumbnails",
        _ => return None,
    })
}

fn modified_ms(meta: &fs::Metadata) -> Option<u64> {
    meta.modified().ok()?.duration_since(UNIX_EPOCH).ok().map(|d| d.as_millis() as u64)
}

/// One log file: only its shape (how many entries in each part), never what
/// the entries say.
fn read_log(path: &Path, name: String, meta: &fs::Metadata) -> LogFile {
    let mut file = LogFile {
        about: about(&name),
        name,
        size: meta.len(),
        modified: modified_ms(meta),
        state: "ok",
        schema: None,
        updated: None,
        counts: Vec::new(),
    };
    if file.name == GALLERY_LOCK {
        file.state = "ignored";
        return file;
    }
    let Ok(text) = fs::read_to_string(path) else {
        file.state = "broken";
        return file;
    };
    if text.trim().is_empty() {
        file.state = "empty";
        return file;
    }
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) else {
        file.state = "broken";
        return file;
    };
    if let Some(obj) = value.as_object() {
        file.schema = obj.get("schema").or_else(|| obj.get("version")).and_then(|v| v.as_i64());
        file.updated = obj
            .get("updatedAt")
            .or_else(|| obj.get("savedAt"))
            .and_then(|v| v.as_u64());
        for (key, v) in obj {
            let n = match v {
                serde_json::Value::Object(o) => o.len(),
                serde_json::Value::Array(a) => a.len(),
                _ => continue,
            };
            file.counts.push((key.clone(), n));
        }
    } else if let Some(a) = value.as_array() {
        file.counts.push(("entries".into(), a.len()));
    }
    file
}

fn count_of(logs: &[LogFile], name: &str, key: &str) -> Option<usize> {
    let file = logs.iter().find(|l| l.name == name && l.state == "ok")?;
    file.counts.iter().find(|(k, _)| k == key).map(|(_, n)| *n)
}

fn read_library(app: &AppHandle) -> LibraryReport {
    let lib = library(app);
    let path = lib.as_ref().and_then(|l| l.path.clone());
    let mut report = LibraryReport {
        found: path.is_some(),
        library: path.as_ref().map(|p| p.display().to_string()),
        hidden: lib.as_ref().is_some_and(|l| l.hidden),
        both: lib.as_ref().is_some_and(|l| l.both),
        logs_found: false,
        logs: Vec::new(),
        totals: Totals::default(),
    };
    let Some(logs_dir) = path.map(|p| p.join(LOGS)) else { return report };
    let Ok(entries) = fs::read_dir(&logs_dir) else { return report };
    report.logs_found = true;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_dir() {
            if name == "thumbs" {
                report.totals.thumbnails = fs::read_dir(entry.path()).ok().map(|d| d.count());
            }
            continue;
        }
        if !name.ends_with(".json") {
            continue;
        }
        report.logs.push(read_log(&entry.path(), name, &meta));
    }
    report.logs.sort_by(|a, b| a.name.cmp(&b.name));
    let logs = &report.logs;
    report.totals.tagged_folders = count_of(logs, "tags.log.json", "folders");
    report.totals.scored_folders = count_of(logs, "scores.log.json", "folders");
    report.totals.journal_days = count_of(logs, "daily-journals.log.json", "days");
    report.totals.in_trash = count_of(logs, "trash.log.json", "itemsByTrashPath");
    report.totals.last_saved = logs
        .iter()
        .filter(|l| l.state != "ignored" && !l.name.contains(".before-"))
        .filter_map(|l| l.modified)
        .max();
    report
}

/// What's in the library's log folder (see `read_log`: shapes, not contents).
#[tauri::command]
pub async fn gallery_library(app: AppHandle) -> Result<LibraryReport, String> {
    blocking(move || read_library(&app)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The same hash Local Gallery's own passcode makes (WebCrypto's PBKDF2,
    /// SHA-256, 256 bits), for the same digits and salt.
    #[test]
    fn hash_matches_the_gallerys() {
        let salt = "00112233445566778899aabbccddeeff";
        assert_eq!(
            derive("1234", salt, 1000).unwrap(),
            "b8ad0f1dacec0beb4f418fadcb2ee5939ef45823391bb89692028dd1b67e9cef"
        );
        let rec = Record {
            schema: 1,
            enabled: true,
            algo: "pbkdf2".into(),
            salt: salt.into(),
            hash: derive("1234", salt, 1000).unwrap(),
            iterations: 1000,
            updated_at: 0,
        };
        assert!(matches("1234", &rec));
        assert!(!matches("1235", &rec));
        assert!(!matches("123", &rec));
        assert!(!matches("12a4", &rec));
    }

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("mote-gallery-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn no_passcode_means_right() {
        let dir = scratch("none");
        assert!(matches!(check(&dir, "0000"), Check::Right));
        assert!(require(&dir, None).is_ok());
    }

    #[test]
    fn wrong_tries_then_a_wait() {
        let dir = scratch("tries");
        write_record(&dir, &make_record("2468").unwrap()).unwrap();
        let mode = fs::metadata(dir.join(RECORD)).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        // Never the digits on disk.
        assert!(!fs::read_to_string(dir.join(RECORD)).unwrap().contains("2468"));
        for left in (1..MAX_TRIES).rev() {
            match check(&dir, "1111") {
                Check::Wrong { tries_left } => assert_eq!(tries_left, left),
                _ => panic!("expected wrong"),
            }
        }
        assert!(matches!(check(&dir, "1111"), Check::Refused { wait } if wait == 30));
        // While waiting, even the right one isn't taken.
        assert!(matches!(check(&dir, "2468"), Check::Waiting { .. }));
        // Once the wait is over the right one works and the count starts over;
        // a second wait would have been longer.
        let mut tries = read_tries(&dir);
        assert_eq!(tries.waits, 1);
        tries.until = 0;
        write_tries(&dir, &tries);
        assert!(matches!(check(&dir, "2468"), Check::Right));
        assert_eq!(read_tries(&dir).waits, 0);
        assert!(matches!(require(&dir, Some("2468")), Ok(())));
        assert!(require(&dir, None).is_err());
    }

    #[test]
    fn reads_a_log_folder() {
        let dir = scratch("logs");
        fs::write(dir.join("tags.log.json"), r#"{"schema":1,"updatedAt":5,"folders":{"a":{},"b":{}}}"#).unwrap();
        fs::write(dir.join("aspect-ratios.log.json"), "").unwrap();
        fs::write(dir.join("lock.log.json"), r#"{"hash":"x"}"#).unwrap();
        fs::write(dir.join("broken.log.json"), "{nope").unwrap();
        let read = |n: &str| read_log(&dir.join(n), n.to_string(), &fs::metadata(dir.join(n)).unwrap());
        let tags = read("tags.log.json");
        assert_eq!(tags.state, "ok");
        assert_eq!(tags.updated, Some(5));
        assert_eq!(tags.counts, vec![("folders".to_string(), 2)]);
        assert_eq!(read("aspect-ratios.log.json").state, "empty");
        assert_eq!(read("lock.log.json").state, "ignored");
        assert_eq!(read("broken.log.json").state, "broken");
    }
}
