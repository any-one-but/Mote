// Step: clear out clutter. Four passes, in order:
//
// 1. exact duplicates are deleted (one copy is kept)
// 2. look-alike pictures and videos: the best of each group stays, the rest
//    go into the quarantine folder
// 3. pictures that are just a frame of a video, and "videos" that never
//    move, go into the quarantine folder
// 4. empty files and folders go into the quarantine folder
//
// Nothing but the exact duplicates is deleted; the quarantine folder is
// `_quarantined_media` inside the folder being cleaned.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use super::tools::{find_any, find_tool, pool, size_of, turbo_width, Ctx};
use super::walk::{is_image, is_video, quarantine, rel, Walk, BUCKET, VIDEO_EXTS};
use super::Report;

pub fn run(ctx: &Ctx) -> Report {
    let mut r = Report::default();
    dupes(ctx, &mut r);
    if !ctx.cancelled() {
        similar(ctx, &mut r);
    }
    if !ctx.cancelled() {
        frame_images(ctx, &mut r);
    }
    if !ctx.cancelled() {
        still_videos(ctx, &mut r);
    }
    if !ctx.cancelled() {
        empties(ctx, &mut r);
    }
    let moved = ["similar", "frames", "still", "empty-files", "empty-folders"]
        .iter()
        .map(|k| r.get(k))
        .sum::<u64>();
    r.nothing = r.get("duplicates") == 0 && moved == 0 && r.problems.is_empty();
    r
}

fn count_files(root: &Path) -> usize {
    Walk { prune_top: vec![], prune_any: vec![], prune_prefix: None }.files(root).len()
}

/// Pass 1: exact duplicates, deleted with fdupes (or czkawka, which hashes on
/// every core, in turbo). Both keep the oldest copy and skip hidden files.
fn dupes(ctx: &Ctx, r: &mut Report) {
    ctx.progress("Looking for duplicates", 0, 1);
    let before = count_files(&ctx.root);
    let root = ctx.root.to_string_lossy().to_string();
    let wildcard = root.chars().any(|c| "*?[]{}".contains(c));
    let czkawka = find_any(&["czkawka", "czkawka_cli", "czkawka-cli"]);
    let ok = match (ctx.turbo() && !wildcard, czkawka, find_tool("fdupes")) {
        (true, Some(cz), _) => {
            let report = ctx.scratch("txt");
            let mut c = ctx.cmd(cz);
            c.args(["dup", "-d", &root, "-m", "1", "-E", &format!("{root}/.*"), "-E", &format!("{root}/*/.*")])
                .args(["-D", "AEO", "-f"])
                .arg(&report)
                .args(["-W", "-N", "-M"]);
            let ok = ctx.run(c, false).ok;
            let _ = std::fs::remove_file(&report);
            ok
        }
        (_, _, Some(fd)) => {
            let mut c = ctx.cmd(fd);
            c.args(["-r", "-A", "-d", "-N", "."]);
            ctx.run(c, false).ok
        }
        _ => {
            r.fail("Couldn’t look for duplicates: fdupes isn’t installed".into());
            false
        }
    };
    if !ok && !ctx.cancelled() {
        r.fail("The duplicate finder stopped with an error".into());
    }
    let after = count_files(&ctx.root);
    r.add("duplicates", before.saturating_sub(after) as u64);
    ctx.progress("Looking for duplicates", 1, 1);
}

#[derive(Clone, Copy, Default)]
struct Metrics {
    px: u64,
    size: u64,
    bitrate: u64,
    duration_ms: u64,
}

fn image_metrics(ctx: &Ctx, p: &Path) -> Metrics {
    let mut c = ctx.cmd("/usr/bin/sips");
    c.args(["-g", "pixelWidth", "-g", "pixelHeight"]).arg(p);
    let out = ctx.run(c, true).stdout;
    let num = |key: &str| {
        out.lines()
            .find_map(|l| l.trim().strip_prefix(key).map(|v| v.trim().parse::<u64>().unwrap_or(0)))
            .unwrap_or(0)
    };
    Metrics { px: num("pixelWidth:") * num("pixelHeight:"), size: size_of(p), ..Default::default() }
}

fn video_metrics(ctx: &Ctx, p: &Path) -> Metrics {
    let Some(ffprobe) = find_tool("ffprobe") else { return Metrics { size: size_of(p), ..Default::default() } };
    let mut c = ctx.cmd(ffprobe);
    c.args(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,bit_rate"])
        .args(["-show_entries", "format=duration,bit_rate", "-of", "default=noprint_wrappers=1:nokey=0"])
        .arg(p);
    let out = ctx.run(c, true).stdout;
    let vals = |key: &str| -> Vec<String> {
        out.lines().filter_map(|l| l.strip_prefix(&format!("{key}=")).map(|v| v.to_string())).collect()
    };
    let int = |v: Option<&String>| v.and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
    let w = int(vals("width").first());
    let h = int(vals("height").first());
    let rates = vals("bit_rate");
    let stream_rate = int(rates.first());
    let format_rate = int(rates.last());
    let bitrate = if stream_rate > 0 { stream_rate } else { format_rate };
    let duration = vals("duration").first().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
    Metrics {
        px: w * h,
        size: size_of(p),
        bitrate,
        duration_ms: if duration > 0.0 { (duration * 1000.0).round() as u64 } else { 0 },
    }
}

/// The groups in a czkawka report: each "Found N … which have similar
/// friends" line starts one, and each `"path" - …` line is a member.
fn report_groups(root: &Path, report: &str, word: &str) -> Vec<Vec<PathBuf>> {
    let mut groups: Vec<Vec<PathBuf>> = Vec::new();
    let mut cur: Vec<PathBuf> = Vec::new();
    let header = format!(" {word} which have similar friends");
    for line in report.lines() {
        if line.starts_with("Found ") && line.contains(&header) {
            if !cur.is_empty() {
                groups.push(std::mem::take(&mut cur));
            }
            continue;
        }
        if let Some(rest) = line.strip_prefix('"') {
            if let Some(end) = rest.find("\" - ") {
                let raw = &rest[..end];
                let p = if raw.starts_with('/') {
                    let p = PathBuf::from(raw);
                    if !p.starts_with(root) {
                        continue;
                    }
                    p
                } else {
                    root.join(raw.trim_start_matches("./"))
                };
                if p.is_file() {
                    cur.push(p);
                }
            }
        }
    }
    if !cur.is_empty() {
        groups.push(cur);
    }
    groups
}

/// Which member of a group is best: most pixels, then (videos) highest
/// bitrate and longest, then biggest file, then first by name.
fn best(video: bool, items: &[(PathBuf, Metrics)]) -> usize {
    let mut best = 0;
    for i in 1..items.len() {
        let (pa, a) = &items[i];
        let (pb, b) = &items[best];
        let key_a = if video { (a.px, a.bitrate, a.duration_ms, a.size) } else { (a.px, 0, 0, a.size) };
        let key_b = if video { (b.px, b.bitrate, b.duration_ms, b.size) } else { (b.px, 0, 0, b.size) };
        if key_a > key_b || (key_a == key_b && pa < pb) {
            best = i;
        }
    }
    best
}

/// Pass 2: look-alike pictures and videos (czkawka, tuned as in the
/// script: Lanczos3 hashing at size 16, Gradient, difference 8; videos
/// compared over 20 seconds at tolerance 10).
fn similar(ctx: &Ctx, r: &mut Report) {
    let Some(cz) = find_any(&["czkawka", "czkawka_cli", "czkawka-cli"]) else {
        r.fail("Couldn’t look for look-alikes: czkawka isn’t installed".into());
        return;
    };
    ctx.progress("Looking for look-alikes", 0, 1);
    let root = ctx.root.to_string_lossy().to_string();
    let bucket = ctx.root.join(BUCKET).to_string_lossy().to_string();
    let image_report = ctx.scratch("txt");
    let video_report = ctx.scratch("txt");
    let scan = |video: bool| {
        let mut c = ctx.cmd(&cz);
        if video {
            c.args(["video", "-d", &root, "-e", &bucket, "-x", "VIDEO", "-t", "10", "-A", "20", "-f"])
                .arg(&video_report);
        } else {
            c.args(["image", "-d", &root, "-e", &bucket, "-x", "IMAGE", "-c", "16", "-g", "Gradient"])
                .args(["-z", "Lanczos3", "-s", "8", "-f"])
                .arg(&image_report);
        }
        c.args(["-W", "-N"]);
        ctx.run(c, false).ok
    };
    let (img_ok, vid_ok) = if ctx.turbo() {
        // Both at once: the video scan waits on its decoder a lot, and the
        // picture scan fills that time.
        std::thread::scope(|s| {
            let v = s.spawn(|| scan(true));
            let i = scan(false);
            (i, v.join().unwrap_or(false))
        })
    } else {
        (scan(false), scan(true))
    };
    if !img_ok && !ctx.cancelled() {
        r.fail("The look-alike picture scan stopped with an error".into());
    }
    if !vid_ok && !ctx.cancelled() {
        r.fail("The look-alike video scan stopped with an error".into());
    }
    let read = |p: &Path| std::fs::read(p).map(|b| String::from_utf8_lossy(&b).into_owned()).unwrap_or_default();
    let image_groups = report_groups(&ctx.root, &read(&image_report), "images");
    let video_groups = report_groups(&ctx.root, &read(&video_report), "videos");
    let _ = std::fs::remove_file(&image_report);
    let _ = std::fs::remove_file(&video_report);

    // Measure everything in every group (all at once in turbo).
    let mut keep: HashSet<PathBuf> = HashSet::new();
    let mut moves: Vec<PathBuf> = Vec::new();
    for (video, groups) in [(false, image_groups), (true, video_groups)] {
        let all: Vec<PathBuf> = groups.iter().flatten().cloned().collect();
        let mut measured: std::collections::HashMap<PathBuf, Metrics> = Default::default();
        let jobs = if ctx.turbo() { turbo_width(false) } else { 1 };
        let total = all.len();
        let mut n = 0;
        pool(
            ctx,
            jobs,
            all,
            |p| if video { video_metrics(ctx, p) } else { image_metrics(ctx, p) },
            |p, m| {
                measured.insert(p.clone(), m);
                n += 1;
                ctx.progress("Comparing look-alikes", n, total);
            },
        );
        for g in groups {
            if g.len() < 2 {
                continue;
            }
            let items: Vec<(PathBuf, Metrics)> =
                g.iter().map(|p| (p.clone(), measured.get(p).copied().unwrap_or_default())).collect();
            let b = best(video, &items);
            keep.insert(items[b].0.clone());
            r.add(if video { "video-groups" } else { "image-groups" }, 1);
            for (i, (p, _)) in items.into_iter().enumerate() {
                if i != b && !moves.contains(&p) {
                    moves.push(p);
                }
            }
        }
    }
    // Never move something that's the keeper of another group.
    let moves: Vec<PathBuf> = moves.into_iter().filter(|p| !keep.contains(p)).collect();
    let total = moves.len();
    for (i, p) in moves.iter().enumerate() {
        if ctx.cancelled() {
            return;
        }
        let sub = if is_video(p) { "similar_videos" } else if is_image(p) { "similar_images" } else { "" };
        if !sub.is_empty() && p.exists() {
            if quarantine(&ctx.root, p, sub) {
                r.add("similar", 1);
            } else {
                r.fail(format!("{} (couldn’t move it)", rel(&ctx.root, p)));
            }
        }
        ctx.progress("Moving look-alikes aside", i + 1, total);
    }
}

const FRAME_FILTER: &str = "format=rgb24,scale=16:16:flags=area,format=gray";

/// A tiny fingerprint of each frame of a video (or of a picture's only frame).
fn frame_hashes(ctx: &Ctx, p: &Path, first_only: bool) -> Vec<String> {
    let Some(ffmpeg) = find_tool("ffmpeg") else { return vec![] };
    let mut c = ctx.cmd(ffmpeg);
    c.args(["-nostdin", "-hide_banner", "-loglevel", "error", "-i"]).arg(p).args(["-map", "0:v:0"]);
    if first_only {
        c.args(["-frames:v", "1"]);
    }
    c.args(["-vf", FRAME_FILTER]);
    if !first_only {
        c.arg("-an");
    }
    c.args(["-f", "framehash", "-hash", "MD5", "-"]);
    ctx.run(c, true)
        .stdout
        .lines()
        .filter(|l| l.starts_with(|c: char| c.is_ascii_digit()))
        .filter_map(|l| l.rsplit(',').next().map(|h| h.trim().to_string()))
        .filter(|h| !h.is_empty())
        .collect()
}

/// Pass 3a: pictures that are exactly a frame from one of the videos.
fn frame_images(ctx: &Ctx, r: &mut Report) {
    let walk = Walk { prune_top: vec![BUCKET], prune_any: vec![], prune_prefix: None };
    let videos = walk.files_with(&ctx.root, VIDEO_EXTS);
    let images = walk.files_with(
        &ctx.root,
        &["jpg", "jpeg", "png", "webp", "bmp", "tif", "tiff", "heic", "heif", "avif"],
    );
    if videos.is_empty() || images.is_empty() {
        return;
    }
    let jobs = if ctx.turbo() { turbo_width(true) } else { 1 };
    let mut hashes: HashSet<String> = HashSet::new();
    let total = videos.len();
    let mut n = 0;
    pool(ctx, jobs, videos, |v| frame_hashes(ctx, v, false), |_, hs| {
        hashes.extend(hs);
        n += 1;
        ctx.progress("Fingerprinting video frames", n, total);
    });
    if hashes.is_empty() || ctx.cancelled() {
        return;
    }
    let jobs = if ctx.turbo() { turbo_width(false) } else { 1 };
    let total = images.len();
    let mut matches = Vec::new();
    let mut n = 0;
    pool(ctx, jobs, images, |i| frame_hashes(ctx, i, true).into_iter().next(), |p, h| {
        if h.is_some_and(|h| hashes.contains(&h)) {
            matches.push(p.clone());
        }
        n += 1;
        ctx.progress("Checking pictures against videos", n, total);
    });
    for p in matches {
        if quarantine(&ctx.root, &p, "video_frame_images") {
            r.add("frames", 1);
        } else {
            r.fail(format!("{} (couldn’t move it)", rel(&ctx.root, &p)));
        }
    }
}

/// Is this video really a still: one frame, or every frame the same?
/// None when it can't be read.
fn is_still(ctx: &Ctx, p: &Path) -> Option<bool> {
    let ffprobe = find_tool("ffprobe")?;
    let mut c = ctx.cmd(ffprobe);
    c.args(["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries"])
        .args(["stream=nb_read_frames", "-of", "csv=p=0"])
        .arg(p);
    let frames = ctx.run(c, true).stdout.lines().next().and_then(|l| l.trim().parse::<u64>().ok());
    if frames.is_some_and(|f| f <= 1) {
        return Some(true);
    }
    let ffmpeg = find_tool("ffmpeg")?;
    let mut c = ctx.cmd(ffmpeg);
    c.args(["-nostdin", "-hide_banner", "-nostats", "-loglevel", "error", "-i"])
        .arg(p)
        .args(["-map", "0:v:0", "-vf", "mpdecimate", "-an", "-f", "null", "-", "-progress", "pipe:1"]);
    let out = ctx.run(c, true);
    let unique = out
        .stdout
        .lines()
        .filter_map(|l| l.strip_prefix("frame="))
        .last()
        .and_then(|v| v.trim().parse::<u64>().ok())?;
    Some(unique <= 1)
}

/// Pass 3b: videos that never move.
fn still_videos(ctx: &Ctx, r: &mut Report) {
    let walk = Walk { prune_top: vec![BUCKET], prune_any: vec![], prune_prefix: None };
    let videos = walk.files_with(&ctx.root, VIDEO_EXTS);
    if videos.is_empty() {
        return;
    }
    let jobs = if ctx.turbo() { turbo_width(true) } else { 1 };
    let total = videos.len();
    let mut stills = Vec::new();
    let mut n = 0;
    pool(ctx, jobs, videos, |v| is_still(ctx, v), |p, still| {
        if still == Some(true) {
            stills.push(p.clone());
        }
        n += 1;
        ctx.progress("Checking for videos that never move", n, total);
    });
    for p in stills {
        if quarantine(&ctx.root, &p, "single_frame_videos") {
            r.add("still", 1);
        } else {
            r.fail(format!("{} (couldn’t move it)", rel(&ctx.root, &p)));
        }
    }
}

/// Pass 4: empty files and empty folders.
fn empties(ctx: &Ctx, r: &mut Report) {
    ctx.progress("Looking for empty things", 0, 1);
    let walk = Walk { prune_top: vec![BUCKET], prune_any: vec![], prune_prefix: None };
    let mut zero = Vec::new();
    let mut empty_dirs = Vec::new();
    for (p, is_dir) in walk.entries_deepest_first(&ctx.root) {
        if is_dir {
            if std::fs::read_dir(&p).map(|mut d| d.next().is_none()).unwrap_or(false) {
                empty_dirs.push(p);
            }
        } else if size_of(&p) == 0 {
            zero.push(p);
        }
    }
    // Only the outermost empty folders (a nested one goes with its parent).
    let tops: Vec<PathBuf> = empty_dirs
        .iter()
        .filter(|d| !empty_dirs.iter().any(|o| o != *d && d.starts_with(o)))
        .cloned()
        .collect();
    let total = zero.len() + tops.len();
    let mut n = 0;
    for f in zero {
        if quarantine(&ctx.root, &f, "zero_size_files") {
            r.add("empty-files", 1);
        } else {
            r.fail(format!("{} (couldn’t move it)", rel(&ctx.root, &f)));
        }
        n += 1;
        ctx.progress("Moving empty things aside", n, total);
    }
    for d in tops {
        if !d.is_dir() || quarantine(&ctx.root, &d, "empty_folders") {
            r.add("empty-folders", 1);
        } else {
            r.fail(format!("{} (couldn’t move it)", rel(&ctx.root, &d)));
        }
        n += 1;
        ctx.progress("Moving empty things aside", n, total);
    }
}
