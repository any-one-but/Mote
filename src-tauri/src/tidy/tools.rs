// The plumbing every job shares: finding the command-line tools, running
// them at the chosen pace, stopping them when a job is cancelled, and
// reporting progress back to Mote.

use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// Where Homebrew and the system keep tools. A Mac app doesn't see your
/// shell's PATH, so these are searched as well as whatever PATH it has.
const TOOL_DIRS: &[&str] = &["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];

pub const OPTIMAGE_BIN: &str = "/Applications/Optimage.app/Contents/MacOS/Optimage";

/// The PATH every tool is started with: Homebrew's folders first.
pub fn search_path() -> String {
    let mut dirs: Vec<String> = TOOL_DIRS.iter().map(|d| d.to_string()).collect();
    if let Ok(p) = std::env::var("PATH") {
        for d in p.split(':') {
            if !d.is_empty() && !dirs.iter().any(|x| x == d) {
                dirs.push(d.to_string());
            }
        }
    }
    dirs.join(":")
}

/// The full path of a tool, if it's installed.
pub fn find_tool(name: &str) -> Option<PathBuf> {
    if name.starts_with('/') {
        let p = PathBuf::from(name);
        return p.is_file().then_some(p);
    }
    search_path()
        .split(':')
        .map(|d| Path::new(d).join(name))
        .find(|p| p.is_file())
}

/// The first of these tools that's installed.
pub fn find_any(names: &[&str]) -> Option<PathBuf> {
    names.iter().find_map(|n| find_tool(n))
}

/// How hard the computer works: as each step always has, as much at once as
/// it can take, or quietly in the background.
#[derive(Clone, Copy, PartialEq, Eq, Debug, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Pace {
    Normal,
    Turbo,
    Gentle,
}

pub fn cpu_count() -> usize {
    std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4).max(1)
}

pub fn mem_gb() -> usize {
    let mut bytes: u64 = 0;
    let mut size = std::mem::size_of::<u64>();
    let name = std::ffi::CString::new("hw.memsize").unwrap();
    let ok = unsafe {
        libc::sysctlbyname(
            name.as_ptr(),
            &mut bytes as *mut u64 as *mut libc::c_void,
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    } == 0;
    if !ok || bytes < 1 << 30 {
        return 8;
    }
    (bytes >> 30) as usize
}

/// How many files turbo keeps in flight: a core each for pictures (their
/// jobs barely thread), half the cores for videos (their encoders already
/// use about two), never past what memory allows or 32. Measured in the
/// cleaner script this all comes from.
pub fn turbo_width(video: bool) -> usize {
    let cores = cpu_count();
    let mem = mem_gb();
    let (jobs, cap) = if video { (cores / 2, mem / 2) } else { (cores, mem) };
    jobs.max(2).min(cap.max(2)).min(32)
}

#[derive(Serialize, Clone)]
struct Progress<'a> {
    label: &'a str,
    done: usize,
    total: usize,
}

/// Everything a running job needs: where it works, its pace, its way to
/// report back, and whether it has been told to stop.
pub struct Ctx {
    app: Option<AppHandle>,
    pub root: PathBuf,
    pub pace: Pace,
    cancel: Arc<AtomicBool>,
    children: Arc<Mutex<HashSet<u32>>>,
    last_progress: Mutex<(String, usize, Instant)>,
    seq: AtomicU64,
}

pub struct Out {
    pub ok: bool,
    pub stdout: String,
}

impl Ctx {
    pub fn new(
        app: Option<AppHandle>,
        root: PathBuf,
        pace: Pace,
        cancel: Arc<AtomicBool>,
        children: Arc<Mutex<HashSet<u32>>>,
    ) -> Ctx {
        Ctx {
            app,
            root,
            pace,
            cancel,
            children,
            last_progress: Mutex::new((String::new(), usize::MAX, Instant::now())),
            seq: AtomicU64::new(0),
        }
    }

    pub fn turbo(&self) -> bool {
        self.pace == Pace::Turbo
    }

    pub fn cancelled(&self) -> bool {
        self.cancel.load(Ordering::Relaxed)
    }

    /// Moves the progress bar (no more often than the percentage changes or
    /// every fifth of a second).
    pub fn progress(&self, label: &str, done: usize, total: usize) {
        let total = total.max(1);
        let pct = done * 100 / total;
        {
            let mut last = self.last_progress.lock().unwrap();
            if last.0 == label && last.1 == pct && done < total && last.2.elapsed() < Duration::from_millis(200) {
                return;
            }
            *last = (label.to_string(), pct, Instant::now());
        }
        if let Some(app) = &self.app {
            let _ = app.emit("work-progress", Progress { label, done, total });
        }
    }

    /// A command for a tool, started the way this job's pace says: in the
    /// background at low priority when gentle. Its working folder is the
    /// job's folder.
    pub fn cmd(&self, tool: impl AsRef<OsStr>) -> Command {
        let mut c = if self.pace == Pace::Gentle {
            let mut c = Command::new("/usr/sbin/taskpolicy");
            c.args(["-b", "/usr/bin/nice", "-n", "19"]).arg(tool);
            c
        } else {
            Command::new(tool)
        };
        c.env("PATH", search_path()).current_dir(&self.root).stdin(Stdio::null());
        c
    }

    /// A fresh scratch file name (in the system's temporary folder).
    pub fn scratch(&self, ext: &str) -> PathBuf {
        let n = self.seq.fetch_add(1, Ordering::Relaxed);
        let t = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_micros())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("mote-{}-{t}-{n}.{ext}", std::process::id()))
    }

    /// Runs a command to the end (or until the job is cancelled), keeping
    /// what it prints when `capture` is set.
    pub fn run(&self, mut c: Command, capture: bool) -> Out {
        if self.cancelled() {
            return Out { ok: false, stdout: String::new() };
        }
        // Output goes to a file rather than a pipe, so a chatty tool can
        // never fill a pipe and stall.
        let out_file = capture.then(|| self.scratch("out"));
        match &out_file {
            Some(p) => match std::fs::File::create(p) {
                Ok(f) => {
                    c.stdout(f);
                }
                Err(_) => return Out { ok: false, stdout: String::new() },
            },
            None => {
                c.stdout(Stdio::null());
            }
        }
        c.stderr(Stdio::null());
        let child: Child = match c.spawn() {
            Ok(ch) => ch,
            Err(_) => {
                if let Some(p) = &out_file {
                    let _ = std::fs::remove_file(p);
                }
                return Out { ok: false, stdout: String::new() };
            }
        };
        let ok = self.wait(child);
        let stdout = out_file
            .as_ref()
            .and_then(|p| {
                let s = std::fs::read(p).ok().map(|b| String::from_utf8_lossy(&b).into_owned());
                let _ = std::fs::remove_file(p);
                s
            })
            .unwrap_or_default();
        Out { ok, stdout }
    }

    /// Runs a command whose output goes straight into a file.
    pub fn run_to(&self, mut c: Command, file: &Path) -> bool {
        if self.cancelled() {
            return false;
        }
        let Ok(f) = std::fs::File::create(file) else { return false };
        c.stdout(f).stderr(Stdio::null());
        match c.spawn() {
            Ok(ch) => self.wait(ch),
            Err(_) => false,
        }
    }

    fn wait(&self, mut child: Child) -> bool {
        let pid = child.id();
        self.children.lock().unwrap().insert(pid);
        let ok = loop {
            match child.try_wait() {
                Ok(Some(status)) => break status.success(),
                Ok(None) => {
                    if self.cancelled() {
                        let _ = child.kill();
                        let _ = child.wait();
                        break false;
                    }
                    std::thread::sleep(Duration::from_millis(25));
                }
                Err(_) => break false,
            }
        };
        self.children.lock().unwrap().remove(&pid);
        ok
    }
}

/// Runs `work` on every item, `jobs` at a time, calling `done` with each
/// result (in the order they finish) on this thread.
pub fn pool<T, R, W, D>(ctx: &Ctx, jobs: usize, items: Vec<T>, work: W, mut done: D)
where
    T: Send + Sync,
    R: Send,
    W: Fn(&T) -> R + Send + Sync,
    D: FnMut(&T, R),
{
    let jobs = jobs.clamp(1, items.len().max(1));
    if jobs == 1 {
        for item in &items {
            if ctx.cancelled() {
                break;
            }
            let r = work(item);
            done(item, r);
        }
        return;
    }
    let next = std::sync::atomic::AtomicUsize::new(0);
    let (tx, rx) = std::sync::mpsc::channel::<(usize, R)>();
    std::thread::scope(|scope| {
        for _ in 0..jobs {
            let tx = tx.clone();
            let next = &next;
            let items = &items;
            let work = &work;
            scope.spawn(move || loop {
                if ctx.cancelled() {
                    break;
                }
                let i = next.fetch_add(1, Ordering::Relaxed);
                if i >= items.len() {
                    break;
                }
                let r = work(&items[i]);
                if tx.send((i, r)).is_err() {
                    break;
                }
            });
        }
        drop(tx);
        for (i, r) in rx {
            done(&items[i], r);
        }
    });
}

/// Threads each pool job may use, so the jobs add up to the machine.
pub fn threads_per_job(jobs: usize) -> usize {
    (cpu_count() / jobs.max(1)).max(1)
}

/// A file's size in bytes (0 if it can't be read).
pub fn size_of(p: &Path) -> u64 {
    std::fs::metadata(p).map(|m| m.len()).unwrap_or(0)
}

/// Lowercase extension, without the dot.
pub fn ext_of(p: &Path) -> String {
    p.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default()
}

/// `target`, or `target__dup1`, `target__dup2`… whichever is free.
pub fn unique_target(target: &Path) -> PathBuf {
    if !target.exists() && std::fs::symlink_metadata(target).is_err() {
        return target.to_path_buf();
    }
    let mut i = 1;
    loop {
        let mut s = target.as_os_str().to_owned();
        s.push(format!("__dup{i}"));
        let c = PathBuf::from(s);
        if !c.exists() && std::fs::symlink_metadata(&c).is_err() {
            return c;
        }
        i += 1;
    }
}
