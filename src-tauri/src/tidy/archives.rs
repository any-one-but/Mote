// Step: open every archive in place, then delete it. Opening one can reveal
// more archives, so the folder is checked again (up to 8 passes). An archive
// that won't open is left where it is and not tried again.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use super::tools::{find_any, find_tool, unique_target, Ctx};
use super::walk::{rel, Walk};
use super::Report;

const MAX_PASSES: usize = 8;

pub fn is_archive(p: &Path) -> bool {
    let n = p.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
    const ENDINGS: &[&str] = &[
        ".tar.gz", ".tar.bz2", ".tar.xz", ".tar.zst", ".tar.lzma", ".tar.lz", ".tar", ".tgz", ".tbz",
        ".tbz2", ".txz", ".tzst", ".zip", ".zipx", ".cbz", ".rar", ".cbr", ".7z", ".cb7", ".gz", ".bz2",
        ".xz", ".zst", ".lzma", ".cab", ".arj", ".lha", ".lzh", ".sit", ".sitx",
    ];
    ENDINGS.iter().any(|e| n.ends_with(e))
}

/// The archive's name without its ending ("album.tar.gz" → "album").
fn stem(name: &str) -> String {
    let lower = name.to_lowercase();
    let two = [".tar.gz", ".tar.bz2", ".tar.xz", ".tar.zst", ".tar.lzma", ".tar.lz"];
    let base = if let Some(e) = two.iter().find(|e| lower.ends_with(*e)) {
        name[..name.len() - e.len()].to_string()
    } else if let Some(i) = name.rfind('.') {
        name[..i].to_string()
    } else {
        name.to_string()
    };
    if base.is_empty() {
        "archive".into()
    } else {
        base
    }
}

/// Opens one archive into `dest`. unar reads every format; the rest are
/// fallbacks for a Mac without it.
fn extract(ctx: &Ctx, file: &Path, dest: &Path) -> bool {
    let lower = file.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
    if let Some(unar) = find_tool("unar") {
        let mut c = ctx.cmd(unar);
        c.args(["-q", "-f", "-D", "-o"]).arg(dest).arg(file);
        if ctx.run(c, false).ok {
            return true;
        }
    }
    let tarry = [
        ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz", ".tbz2", ".tar.xz", ".txz", ".tar.zst", ".tzst",
        ".tar.lzma", ".tar.lz",
    ];
    if tarry.iter().any(|e| lower.ends_with(e)) {
        let mut c = ctx.cmd("/usr/bin/tar");
        c.arg("-xf").arg(file).arg("-C").arg(dest);
        if ctx.run(c, false).ok {
            return true;
        }
    } else if [".zip", ".zipx", ".cbz"].iter().any(|e| lower.ends_with(e)) {
        let mut c = ctx.cmd("/usr/bin/unzip");
        c.args(["-qq", "-o"]).arg(file).arg("-d").arg(dest);
        if ctx.run(c, false).ok {
            return true;
        }
    } else if [".rar", ".cbr"].iter().any(|e| lower.ends_with(e)) {
        if let Some(unrar) = find_tool("unrar") {
            let mut c = ctx.cmd(unrar);
            c.args(["x", "-o+", "-idq"]).arg(file).arg(format!("{}/", dest.display()));
            if ctx.run(c, false).ok {
                return true;
            }
        }
    } else if [".gz", ".bz2", ".xz", ".zst", ".lzma"].iter().any(|e| lower.ends_with(e)) {
        // A bare compressed file holds one file, named after the archive.
        let name = file.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        let out = dest.join(stem(&name));
        let tool = if lower.ends_with(".gz") {
            find_tool("gzip").map(|t| (t, vec!["-cd"]))
        } else if lower.ends_with(".bz2") {
            find_tool("bzip2").map(|t| (t, vec!["-cd"]))
        } else if lower.ends_with(".zst") {
            find_tool("zstd").map(|t| (t, vec!["-cdq"]))
        } else {
            find_tool("xz").map(|t| (t, vec!["-cd"]))
        };
        if let Some((t, args)) = tool {
            let mut c = ctx.cmd(t);
            c.args(args).arg(file);
            if ctx.run_to(c, &out) && super::tools::size_of(&out) > 0 {
                return true;
            }
            let _ = std::fs::remove_file(&out);
        }
    }
    if let Some(seven) = find_any(&["7zz", "7z"]) {
        let mut c = ctx.cmd(seven);
        c.args(["x", "-y", "-bso0", "-bsp0"]).arg(format!("-o{}", dest.display())).arg(file);
        if ctx.run(c, false).ok {
            return true;
        }
    }
    false
}

pub fn run(ctx: &Ctx) -> Report {
    let mut r = Report::default();
    let root = &ctx.root;
    let walk = Walk { prune_prefix: Some(".lg_unpack."), ..Walk::library() };
    let mut failed: HashSet<PathBuf> = HashSet::new();
    let mut stage_seq = 0;
    let mut passes = 0;

    for pass in 1..=MAX_PASSES {
        let archives: Vec<PathBuf> =
            walk.files(root).into_iter().filter(|p| is_archive(p) && !failed.contains(p)).collect();
        if archives.is_empty() {
            break;
        }
        passes += 1;
        let label = if pass == 1 { "Opening archives".to_string() } else { format!("Opening archives (pass {pass})") };
        let total = archives.len();
        ctx.progress(&label, 0, total);
        for (i, file) in archives.iter().enumerate() {
            if ctx.cancelled() {
                return r;
            }
            let parent = file.parent().unwrap_or(root).to_path_buf();
            stage_seq += 1;
            let stage = parent.join(format!(".lg_unpack.{}.{}", std::process::id(), stage_seq));
            let _ = std::fs::remove_dir_all(&stage);
            let _ = std::fs::create_dir_all(&stage);

            let opened = extract(ctx, file, &stage);
            let entries: Vec<PathBuf> = if opened {
                std::fs::read_dir(&stage).map(|d| d.flatten().map(|e| e.path()).collect()).unwrap_or_default()
            } else {
                vec![]
            };
            if entries.is_empty() {
                let _ = std::fs::remove_dir_all(&stage);
                failed.insert(file.clone());
                r.fail(format!("{} (couldn’t open it)", rel(root, file)));
                ctx.progress(&label, i + 1, total);
                continue;
            }
            // One thing inside goes straight into the folder the archive was
            // in; more get a folder named after the archive.
            let name = file.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            let target = if entries.len() == 1 {
                let t = unique_target(&parent.join(entries[0].file_name().unwrap()));
                let ok = std::fs::rename(&entries[0], &t).is_ok();
                let _ = std::fs::remove_dir_all(&stage);
                ok.then_some(t)
            } else {
                let t = unique_target(&parent.join(stem(&name)));
                std::fs::rename(&stage, &t).is_ok().then_some(t)
            };
            match target {
                Some(t) if t.exists() => {
                    let _ = std::fs::remove_file(file);
                    r.add("opened", 1);
                }
                _ => {
                    let _ = std::fs::remove_dir_all(&stage);
                    failed.insert(file.clone());
                    r.fail(format!("{} (its contents didn’t appear)", rel(root, file)));
                }
            }
            ctx.progress(&label, i + 1, total);
        }
    }
    if passes == 0 {
        r.nothing = true;
    }
    r.add("passes", passes as u64);
    r
}
