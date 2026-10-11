// Step: delete files that match a rule you pick (all videos, files over a
// size, files with a word in their name…). Files only, never folders, and
// never anything inside a .git folder. Mote always shows you what matched
// and asks first; then exactly that list is deleted, and any folder the
// delete leaves empty (but for Finder's .DS_Store) goes too.

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use serde::Deserialize;

use super::archives::is_archive;
use super::tools::{ext_of, size_of, Ctx};
use super::walk::{is_image, is_video, rel, Walk};
use super::Report;

#[derive(Deserialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Rule {
    Videos,
    Images,
    Audio,
    Archives,
    Documents,
    Sidecars,
    ZeroByte,
    Larger { bytes: u64 },
    Smaller { bytes: u64 },
    Older { days: u64 },
    Newer { days: u64 },
    Extensions { list: Vec<String> },
    NameContains { text: String },
    Leftovers,
    Everything,
}

const AUDIO: &[&str] = &[
    "mp3", "m4a", "aac", "flac", "wav", "aiff", "aif", "ogg", "oga", "opus", "wma", "alac", "ape", "mka", "mid",
    "midi",
];
const DOCUMENTS: &[&str] = &[
    "pdf", "txt", "md", "markdown", "rtf", "doc", "docx", "odt", "pages", "xls", "xlsx", "ods", "csv", "tsv",
    "ppt", "pptx", "odp", "epub", "mobi", "azw", "azw3",
];
const SIDECARS: &[&str] = &[
    "xmp", "json", "xml", "nfo", "srt", "vtt", "ass", "ssa", "sub", "idx", "cue", "m3u", "m3u8", "pls", "sfv",
    "md5", "sha1", "sha256",
];

fn is_leftover(rel_path: &str) -> bool {
    let lower = format!("./{}", rel_path.to_lowercase());
    let base = lower.rsplit('/').next().unwrap_or("");
    if [".ds_store", "thumbs.db", "desktop.ini"].contains(&base) || base.ends_with('~') {
        return true;
    }
    let endings = [
        ".tmp", ".temp", ".bak", ".old", ".orig", ".swp", ".swo", ".part", ".download", ".crdownload", ".cache",
    ];
    if endings.iter().any(|e| base.ends_with(e)) {
        return true;
    }
    ["/__macosx/", "/.cache/", "/cache/", "/tmp/", "/temp/", "/.trash/"].iter().any(|d| lower.contains(d))
}

/// Whole days since the file was last changed.
fn age_days(p: &Path) -> Option<u64> {
    let m = std::fs::metadata(p).ok()?.modified().ok()?;
    Some(SystemTime::now().duration_since(m).map(|d| d.as_secs() / 86_400).unwrap_or(0))
}

/// Everything the rule matches, for you to look over before it's deleted.
pub fn matches(root: &Path, rule: &Rule) -> Vec<PathBuf> {
    let walk = Walk { prune_top: vec![], prune_any: vec![".git"], prune_prefix: None };
    walk.files(root)
        .into_iter()
        .filter(|p| {
            let ext = ext_of(p);
            match rule {
                Rule::Videos => is_video(p),
                Rule::Images => is_image(p),
                Rule::Audio => AUDIO.contains(&ext.as_str()),
                Rule::Archives => is_archive(p),
                Rule::Documents => DOCUMENTS.contains(&ext.as_str()),
                Rule::Sidecars => SIDECARS.contains(&ext.as_str()),
                Rule::ZeroByte => size_of(p) == 0,
                Rule::Larger { bytes } => size_of(p) > *bytes,
                Rule::Smaller { bytes } => size_of(p) < *bytes,
                Rule::Older { days } => age_days(p).is_some_and(|a| a > *days),
                Rule::Newer { days } => age_days(p).is_some_and(|a| a < *days),
                Rule::Extensions { list } => {
                    list.iter().any(|e| e.trim().trim_start_matches('.').eq_ignore_ascii_case(&ext))
                }
                Rule::NameContains { text } => {
                    let needle = text.to_lowercase();
                    !needle.is_empty() && format!("./{}", rel(root, p)).to_lowercase().contains(&needle)
                }
                Rule::Leftovers => is_leftover(&rel(root, p)),
                Rule::Everything => true,
            }
        })
        .collect()
}

fn only_ds_store(dir: &Path) -> bool {
    std::fs::read_dir(dir)
        .map(|d| d.flatten().all(|e| e.file_name() == ".DS_Store"))
        .unwrap_or(false)
}

/// Deletes exactly these files (all inside `ctx.root`), then the folders
/// that leaves empty.
pub fn run(ctx: &Ctx, files: &[PathBuf]) -> Report {
    let mut r = Report::default();
    if files.is_empty() {
        r.nothing = true;
        return r;
    }
    let total = files.len();
    for (i, f) in files.iter().enumerate() {
        if ctx.cancelled() {
            break;
        }
        // Belt and braces: only ever inside the folder you gave Mote.
        if !f.starts_with(&ctx.root) {
            continue;
        }
        if std::fs::symlink_metadata(f).is_err() {
            r.add("missing", 1);
        } else if std::fs::remove_file(f).is_ok() {
            r.add("deleted", 1);
        } else {
            r.fail(format!("{} (couldn’t delete it)", rel(&ctx.root, f)));
        }
        ctx.progress("Deleting files", i + 1, total);
    }
    // Folders the delete emptied go too, working upward, but only up to the
    // folder you gave Mote.
    for f in files {
        if f.exists() {
            continue;
        }
        let mut dir = f.parent().map(Path::to_path_buf);
        while let Some(d) = dir {
            if d == ctx.root || !d.starts_with(&ctx.root) || !d.is_dir() || !only_ds_store(&d) {
                break;
            }
            let _ = std::fs::remove_file(d.join(".DS_Store"));
            if std::fs::remove_dir(&d).is_err() {
                break;
            }
            r.add("folders-removed", 1);
            dir = d.parent().map(Path::to_path_buf);
        }
    }
    r
}
