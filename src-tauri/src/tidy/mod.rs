// Mote's helping hands: the jobs Mote can do with folders and videos you
// give them. Each job is one step of the cleaner script it grew out of,
// rebuilt here, run in the background with progress reported as it goes.
//
// Folders get the core cleanup: open archives, quarantine clutter, tidy
// names, convert videos, remove metadata, delete by a rule, compress.
// Videos get: trim the start, trim the end, save the audio as an MP3.

mod apps;
mod archives;
mod compress;
mod convert;
mod delete;
mod metadata;
mod names;
mod quarantine;
mod tools;
mod video;
mod walk;

use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use tools::{find_any, find_tool, Ctx, Pace};
use walk::{is_video, Walk};

/// What a job did, for Mote to tell you about.
#[derive(Serialize, Default, Debug)]
pub struct Report {
    /// Counts of what happened (e.g. "opened": 3, "saved": bytes).
    pub facts: BTreeMap<String, u64>,
    /// What went wrong, one line each (the first 20).
    pub problems: Vec<String>,
    pub problem_count: usize,
    /// There was nothing to do.
    pub nothing: bool,
}

impl Report {
    pub fn add(&mut self, key: &str, n: u64) {
        *self.facts.entry(key.to_string()).or_insert(0) += n;
    }
    pub fn get(&self, key: &str) -> u64 {
        self.facts.get(key).copied().unwrap_or(0)
    }
    pub fn fail(&mut self, what: String) {
        self.problem_count += 1;
        if self.problems.len() < 20 {
            self.problems.push(what);
        }
    }
}

/// What you dropped on Mote, worked out.
#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Given {
    Folder { path: String, name: String, files: usize, bytes: u64 },
    Videos { paths: Vec<String>, names: Vec<String>, bytes: u64 },
    /// An app: a game to play, or something for Mote to have an opinion on.
    App { name: String, bundle: Option<String>, game: Option<&'static str> },
    Other { reason: &'static str, names: Vec<String> },
}

/// Places Mote won't work on: the system, apps, your Library, your whole
/// Home folder. Temporary folders are fine.
fn off_limits(p: &Path) -> bool {
    let real = std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
    let text = real.to_string_lossy().to_string();
    if ["/private/var/folders/", "/private/tmp/"].iter().any(|t| text.starts_with(t)) {
        return false;
    }
    if text == "/" || text == "/Volumes" || text == "/Users" {
        return true;
    }
    const SYSTEM: &[&str] =
        &["/System", "/Library", "/usr", "/bin", "/sbin", "/private", "/etc", "/var", "/dev", "/opt", "/Applications", "/cores"];
    if SYSTEM.iter().any(|s| text == *s || text.starts_with(&format!("{s}/"))) {
        return true;
    }
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        if real == home || real.starts_with(home.join("Library")) {
            return true;
        }
    }
    // Inside an app or other bundle.
    real.ancestors().any(|a| {
        a.extension().is_some_and(|e| {
            ["app", "bundle", "framework", "photoslibrary", "plugin"].contains(&e.to_string_lossy().to_lowercase().as_str())
        })
    })
}

fn name_of(p: &Path) -> String {
    p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| p.to_string_lossy().to_string())
}

fn is_bundle(p: &Path) -> bool {
    p.extension().is_some_and(|e| {
        ["app", "bundle", "framework", "photoslibrary", "pkg"].contains(&e.to_string_lossy().to_lowercase().as_str())
    })
}

#[tauri::command]
pub fn work_inspect(paths: Vec<String>) -> Given {
    let items: Vec<PathBuf> = paths.iter().map(PathBuf::from).filter(|p| p.exists()).collect();
    let names: Vec<String> = items.iter().map(|p| name_of(p)).collect();
    if items.is_empty() {
        return Given::Other { reason: "nothing", names };
    }
    let dirs: Vec<&PathBuf> = items.iter().filter(|p| p.is_dir()).collect();
    // An app (the first one, if there are a few): Mote plays it or reacts.
    if let Some(app) = items.iter().find(|p| {
        p.is_dir() && p.extension().is_some_and(|e| e.eq_ignore_ascii_case("app"))
    }) {
        let (name, bundle, game) = apps::inspect(app);
        return Given::App { name, bundle, game };
    }
    if items.iter().any(|p| is_bundle(p)) {
        return Given::Other { reason: "app", names };
    }
    if !dirs.is_empty() {
        if items.len() > 1 {
            return Given::Other { reason: "mixed", names };
        }
        let dir = dirs[0];
        if off_limits(dir) {
            return Given::Other { reason: "important", names };
        }
        let files = Walk::library().files(dir);
        let bytes = files.iter().map(|f| tools::size_of(f)).sum();
        return Given::Folder {
            path: dir.to_string_lossy().to_string(),
            name: name_of(dir),
            files: files.len(),
            bytes,
        };
    }
    if items.iter().all(|p| is_video(p)) {
        if items.iter().any(|p| off_limits(p)) {
            return Given::Other { reason: "important", names };
        }
        let bytes = items.iter().map(|p| tools::size_of(p)).sum();
        return Given::Videos { paths: items.iter().map(|p| p.to_string_lossy().to_string()).collect(), names, bytes };
    }
    Given::Other { reason: if items.iter().any(|p| is_video(p)) { "mixed" } else { "not-video" }, names }
}

#[derive(Deserialize, Debug)]
#[serde(tag = "step", rename_all = "kebab-case")]
pub enum Step {
    Archives,
    Quarantine,
    Names,
    Convert,
    Metadata,
    Delete { list: Vec<String> },
    Compress { method: compress::Method },
    TrimStart { seconds: f64 },
    TrimEnd { seconds: f64 },
    Mp3,
}

#[derive(Deserialize, Debug)]
pub struct Job {
    #[serde(flatten)]
    step: Step,
    /// The folder, for folder steps.
    folder: Option<String>,
    /// The videos, for video steps.
    files: Option<Vec<String>>,
    pace: Pace,
}

#[derive(Serialize, Clone)]
struct Finished {
    ok: bool,
    cancelled: bool,
    report: Option<ReportOut>,
    error: Option<String>,
}

#[derive(Serialize, Clone)]
struct ReportOut {
    facts: BTreeMap<String, u64>,
    problems: Vec<String>,
    problem_count: usize,
    nothing: bool,
}

#[derive(Default)]
pub struct WorkState {
    running: Mutex<Option<(Arc<AtomicBool>, Arc<Mutex<HashSet<u32>>>)>>,
}

fn run_job(ctx: &Ctx, step: &Step, files: &[PathBuf]) -> Report {
    match step {
        Step::Archives => archives::run(ctx),
        Step::Quarantine => quarantine::run(ctx),
        Step::Names => names::run(ctx),
        Step::Convert => convert::run(ctx),
        Step::Metadata => metadata::run(ctx),
        Step::Delete { list } => {
            let list: Vec<PathBuf> = list.iter().map(PathBuf::from).collect();
            delete::run(ctx, &list)
        }
        Step::Compress { method } => compress::run(ctx, *method),
        Step::TrimStart { seconds } => video::trim(ctx, files, *seconds, true),
        Step::TrimEnd { seconds } => video::trim(ctx, files, *seconds, false),
        Step::Mp3 => video::mp3(ctx, files),
    }
}

/// Starts a job in the background. Progress arrives as "work-progress" and
/// "work-note" events, and the end as "work-finished".
#[tauri::command]
pub fn work_start(app: AppHandle, state: tauri::State<'_, Arc<WorkState>>, job: Job) -> Result<(), String> {
    let video_step = matches!(job.step, Step::TrimStart { .. } | Step::TrimEnd { .. } | Step::Mp3);
    let (root, files) = if video_step {
        let files: Vec<PathBuf> = job.files.clone().unwrap_or_default().into_iter().map(PathBuf::from).collect();
        if files.is_empty() || files.iter().any(|f| !f.is_file() || !is_video(f) || off_limits(f)) {
            return Err("Those aren’t videos I can work on.".into());
        }
        let root = files[0].parent().map(Path::to_path_buf).unwrap_or_else(|| PathBuf::from("/"));
        (root, files)
    } else {
        let folder = PathBuf::from(job.folder.clone().unwrap_or_default());
        if !folder.is_dir() || off_limits(&folder) {
            return Err("That folder is off limits.".into());
        }
        (folder, vec![])
    };
    if let Step::TrimStart { seconds } | Step::TrimEnd { seconds } = job.step {
        if !(seconds > 0.0) {
            return Err("Trim by more than 0 seconds.".into());
        }
    }
    let cancel = Arc::new(AtomicBool::new(false));
    let children = Arc::new(Mutex::new(HashSet::new()));
    {
        let mut running = state.running.lock().unwrap();
        if running.is_some() {
            return Err("I’m already busy with something.".into());
        }
        *running = Some((cancel.clone(), children.clone()));
    }
    let state = state.inner().clone();
    std::thread::spawn(move || {
        let ctx = Ctx::new(Some(app.clone()), root, job.pace, cancel.clone(), children);
        let report = run_job(&ctx, &job.step, &files);
        let cancelled = cancel.load(Ordering::Relaxed);
        *state.running.lock().unwrap() = None;
        let _ = app.emit(
            "work-finished",
            Finished {
                ok: report.problem_count == 0 && !cancelled,
                cancelled,
                report: Some(ReportOut {
                    facts: report.facts,
                    problems: report.problems,
                    problem_count: report.problem_count,
                    nothing: report.nothing,
                }),
                error: None,
            },
        );
    });
    Ok(())
}

/// Stops the running job (what's mid-way is stopped and cleaned up).
#[tauri::command]
pub fn work_cancel(state: tauri::State<'_, Arc<WorkState>>) {
    if let Some((cancel, children)) = state.running.lock().unwrap().as_ref() {
        cancel.store(true, Ordering::Relaxed);
        for pid in children.lock().unwrap().iter() {
            unsafe {
                libc::kill(*pid as i32, libc::SIGTERM);
            }
        }
    }
}

#[derive(Serialize)]
pub struct DeletePreview {
    files: Vec<String>,
    count: usize,
    bytes: u64,
    examples: Vec<String>,
}

/// What a delete rule would remove, so you can look before anything goes.
#[tauri::command]
pub async fn work_preview_delete(folder: String, rule: delete::Rule) -> Result<DeletePreview, String> {
    let root = PathBuf::from(&folder);
    if !root.is_dir() || off_limits(&root) {
        return Err("That folder is off limits.".into());
    }
    let files = delete::matches(&root, &rule);
    Ok(DeletePreview {
        count: files.len(),
        bytes: files.iter().map(|f| tools::size_of(f)).sum(),
        examples: files.iter().take(8).map(|f| walk::rel(&root, f)).collect(),
        files: files.iter().map(|f| f.to_string_lossy().to_string()).collect(),
    })
}

#[derive(Serialize)]
pub struct Missing {
    /// Homebrew formulas to install.
    formulas: Vec<&'static str>,
    /// Apps to install yourself (not from Homebrew).
    apps: Vec<&'static str>,
    /// Is Homebrew there to install them with?
    brew: bool,
}

/// What a step needs that isn't installed.
#[tauri::command]
pub fn work_missing(step: String, method: Option<String>) -> Missing {
    let mut formulas = vec![];
    let mut apps = vec![];
    let ffmpeg = || find_tool("ffmpeg").is_some() && find_tool("ffprobe").is_some();
    match step.as_str() {
        "archives" => {
            if find_tool("unar").is_none() {
                formulas.push("unar");
            }
        }
        "quarantine" => {
            if find_tool("fdupes").is_none() {
                formulas.push("fdupes");
            }
            if find_any(&["czkawka", "czkawka_cli", "czkawka-cli"]).is_none() {
                formulas.push("czkawka");
            }
            if !ffmpeg() {
                formulas.push("ffmpeg");
            }
        }
        "metadata" => {
            if find_tool("mat2").is_none() {
                formulas.push("mat2");
            }
        }
        "compress" => {
            if method.as_deref() == Some("optimage") {
                if !Path::new(tools::OPTIMAGE_BIN).is_file() {
                    apps.push("Optimage");
                }
            } else {
                if find_any(&["magick", "convert"]).is_none() {
                    formulas.push("imagemagick");
                }
                if find_tool("avifenc").is_none() {
                    formulas.push("libavif");
                }
                if !ffmpeg() {
                    formulas.push("ffmpeg");
                }
            }
        }
        "convert" | "trim-start" | "trim-end" | "mp3" => {
            if !ffmpeg() {
                formulas.push("ffmpeg");
            }
        }
        _ => {}
    }
    Missing { formulas, apps, brew: find_tool("brew").is_some() }
}

/// Installs tools with Homebrew (only the ones Mote knows it needs).
#[tauri::command]
pub async fn work_install(formulas: Vec<String>) -> Result<(), String> {
    const KNOWN: &[&str] = &["unar", "fdupes", "czkawka", "ffmpeg", "mat2", "imagemagick", "libavif"];
    let brew = find_tool("brew").ok_or("Homebrew isn’t installed.")?;
    for f in formulas {
        if !KNOWN.contains(&f.as_str()) {
            return Err(format!("I don’t know “{f}”."));
        }
        let ok = std::process::Command::new(&brew)
            .args(["install", &f])
            .env("PATH", tools::search_path())
            .env("HOMEBREW_NO_AUTO_UPDATE", "1")
            .stdin(std::process::Stdio::null())
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if !ok {
            return Err(format!("Installing {f} didn’t work."));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    //! Runs every step for real on a throwaway folder. Needs the tools
    //! installed, so it's skipped unless asked for:
    //! `cargo test tidy -- --ignored --nocapture`
    use super::*;
    use std::fs;
    use std::process::Command;

    fn ff(args: &[&str]) {
        let ok = Command::new(find_tool("ffmpeg").unwrap())
            .args(["-hide_banner", "-loglevel", "error", "-y"])
            .args(args)
            .status()
            .unwrap()
            .success();
        assert!(ok, "ffmpeg {args:?}");
    }

    fn ctx(root: &Path, pace: Pace) -> Ctx {
        Ctx::new(None, root.to_path_buf(), pace, Arc::new(AtomicBool::new(false)), Default::default())
    }

    fn tree(root: &Path) -> Vec<String> {
        let mut v: Vec<String> = Walk { prune_top: vec![], prune_any: vec![], prune_prefix: None }
            .files(root)
            .iter()
            .map(|p| walk::rel(root, p))
            .collect();
        v.sort();
        v
    }

    fn build(root: &Path) {
        let _ = fs::remove_dir_all(root);
        fs::create_dir_all(root.join("sub/deeper")).unwrap();
        fs::create_dir_all(root.join("empty dir")).unwrap();
        let p = |n: &str| root.join(n).to_string_lossy().to_string();
        // Pictures: one, an exact copy, a smaller look-alike, a different one.
        ff(&["-f", "lavfi", "-i", "testsrc2=size=640x480", "-frames:v", "1", &p("photo.png")]);
        fs::copy(root.join("photo.png"), root.join("sub/photo copy.png")).unwrap();
        ff(&["-i", &p("photo.png"), "-vf", "scale=320:240", &p("sub/photo small.png")]);
        ff(&["-f", "lavfi", "-i", "mandelbrot=size=640x480", "-frames:v", "1", &p("other ✨ pic!.jpg")]);
        // Videos: a moving one in .mov, a still one, and a frame grab of the moving one.
        ff(&["-f", "lavfi", "-i", "testsrc=size=320x240:rate=10", "-f", "lavfi", "-i", "sine=frequency=440",
            "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", &p("clip.mov")]);
        ff(&["-f", "lavfi", "-i", "color=c=blue:size=320x240:rate=10", "-t", "2", "-c:v", "libx264",
            "-pix_fmt", "yuv420p", &p("sub/still.mp4")]);
        ff(&["-i", &p("clip.mov"), "-frames:v", "1", &p("sub/deeper/grab.png")]);
        // An animated GIF.
        ff(&["-f", "lavfi", "-i", "testsrc=size=160x120:rate=5", "-t", "2", &p("anim.gif")]);
        // An archive with two files in it, and one with one file.
        fs::write(root.join("a.txt"), "hello").unwrap();
        fs::write(root.join("b.txt"), "world").unwrap();
        Command::new("/usr/bin/zip").current_dir(root).args(["-q", "two.zip", "a.txt", "b.txt"]).status().unwrap();
        Command::new("/usr/bin/zip").current_dir(root).args(["-q", "one.zip", "a.txt"]).status().unwrap();
        fs::remove_file(root.join("a.txt")).unwrap();
        fs::remove_file(root.join("b.txt")).unwrap();
        // An empty file, and junk to delete.
        fs::write(root.join("sub/empty.txt"), "").unwrap();
        fs::write(root.join("sub/notes.tmp"), "junk").unwrap();
    }

    #[test]
    #[ignore]
    fn tidy_every_step() {
        for pace in [Pace::Normal, Pace::Turbo] {
            let root = std::env::temp_dir().join(format!("mote-tidy-test-{pace:?}"));
            build(&root);
            let root = fs::canonicalize(&root).unwrap();
            println!("\n=== {pace:?}: before\n{:#?}", tree(&root));
            let c = ctx(&root, pace);
            for (name, step) in [
                ("archives", Step::Archives),
                ("quarantine", Step::Quarantine),
                ("names", Step::Names),
                ("convert", Step::Convert),
                ("metadata", Step::Metadata),
                ("compress", Step::Compress { method: compress::Method::Encode }),
            ] {
                let r = run_job(&c, &step, &[]);
                println!("--- {name}: {:?} problems {:?} nothing {}", r.facts, r.problems, r.nothing);
            }
            let rule = delete::Rule::Leftovers;
            let list: Vec<String> =
                delete::matches(&root, &rule).iter().map(|p| p.to_string_lossy().to_string()).collect();
            let r = run_job(&c, &Step::Delete { list }, &[]);
            println!("--- delete leftovers: {:?} {:?}", r.facts, r.problems);
            println!("=== after\n{:#?}", tree(&root));

            // Video steps on a fresh video.
            let v = root.join("talk.mp4");
            ff(&["-f", "lavfi", "-i", "testsrc=size=320x240:rate=10", "-f", "lavfi", "-i", "sine",
                "-t", "6", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
                &v.to_string_lossy()]);
            let files = vec![v.clone()];
            for (name, step) in [
                ("trim-start", Step::TrimStart { seconds: 1.5 }),
                ("trim-end", Step::TrimEnd { seconds: 2.0 }),
                ("mp3", Step::Mp3),
            ] {
                let r = run_job(&c, &step, &files);
                println!("--- {name}: {:?} {:?}", r.facts, r.problems);
            }
            let probe = Command::new(find_tool("ffprobe").unwrap())
                .args(["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0"])
                .arg(&v)
                .output()
                .unwrap();
            println!("talk.mp4 is now {}s long; mp3 exists: {}",
                String::from_utf8_lossy(&probe.stdout).trim(), root.join("talk.mp3").is_file());
        }
    }

    #[test]
    fn jobs_from_the_window() {
        let job = |v: &str| serde_json::from_str::<Job>(v).unwrap();
        assert!(matches!(job(r#"{"step":"archives","folder":"/x","pace":"turbo"}"#).step, Step::Archives));
        let d = job(r#"{"step":"delete","list":["/x/a"],"folder":"/x","pace":"normal"}"#);
        assert!(matches!(d.step, Step::Delete { ref list } if list.len() == 1));
        assert!(matches!(
            job(r#"{"step":"compress","method":"optimage","folder":"/x","pace":"gentle"}"#).step,
            Step::Compress { method: compress::Method::Optimage }
        ));
        let t = job(r#"{"step":"trim-start","seconds":3.5,"files":["/v.mp4"],"pace":"normal"}"#);
        assert!(matches!(t.step, Step::TrimStart { seconds } if seconds == 3.5));
        assert_eq!(t.files.unwrap().len(), 1);
        let rule = |v: &str| serde_json::from_str::<delete::Rule>(v).unwrap();
        assert!(matches!(rule(r#"{"kind":"larger","bytes":5}"#), delete::Rule::Larger { bytes: 5 }));
        assert!(matches!(rule(r#"{"kind":"name-contains","text":"x"}"#), delete::Rule::NameContains { .. }));
        assert!(matches!(rule(r#"{"kind":"zero-byte"}"#), delete::Rule::ZeroByte));
    }

    #[test]
    fn off_limits_places() {
        let home = std::env::var("HOME").unwrap();
        assert!(off_limits(Path::new("/")));
        assert!(off_limits(Path::new(&home)));
        assert!(off_limits(Path::new(&format!("{home}/Library/Caches"))));
        assert!(off_limits(Path::new("/System/Library")));
        assert!(off_limits(Path::new("/Applications/Safari.app/Contents")));
        assert!(!off_limits(&std::env::temp_dir()));
    }
}
