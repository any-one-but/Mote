// Step: videos in other formats become MP4 (a straight copy into the new
// container when that works, otherwise a re-encode to H.264), and animated
// GIFs become muted MP4s when that makes them smaller. The original is
// removed once its MP4 is safely written.

use std::path::{Path, PathBuf};

use super::tools::{find_tool, pool, size_of, threads_per_job, turbo_width, Ctx};
use super::walk::{rel, Walk};
use super::Report;

const SOURCES: &[&str] = &["m4v", "mov", "mkv", "avi", "webm", "wmv", "flv", "mpg", "mpeg", "3gp"];

enum Done {
    Copied,
    Reencoded,
    Exists,
    Failed,
}

fn convert_video(ctx: &Ctx, ffmpeg: &Path, file: &Path, threads: Option<usize>) -> Done {
    let out = file.with_extension("mp4");
    if out.is_file() {
        return Done::Exists;
    }
    let mut c = ctx.cmd(ffmpeg);
    c.args(["-nostdin", "-hide_banner", "-loglevel", "error", "-i"])
        .arg(file)
        .args(["-c", "copy", "-map", "0", "-movflags", "+faststart"])
        .arg(&out);
    if ctx.run(c, false).ok {
        let _ = std::fs::remove_file(file);
        return Done::Copied;
    }
    let mut c = ctx.cmd(ffmpeg);
    c.args(["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i"])
        .arg(file)
        .args(["-map", "0", "-c:v", "libx264", "-crf", "23", "-preset", "medium"]);
    if let Some(t) = threads {
        c.args(["-threads", &t.to_string()]);
    }
    c.args(["-c:a", "aac", "-movflags", "+faststart"]).arg(&out);
    if ctx.run(c, false).ok {
        let _ = std::fs::remove_file(file);
        return Done::Reencoded;
    }
    let _ = std::fs::remove_file(&out);
    Done::Failed
}

enum Gif {
    Converted(u64),
    Still,
    NoGain,
    Exists,
    Failed,
}

fn frame_count(ctx: &Ctx, file: &Path) -> Option<u64> {
    let ffprobe = find_tool("ffprobe")?;
    let mut c = ctx.cmd(ffprobe);
    c.args(["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries"])
        .args(["stream=nb_read_frames", "-of", "csv=p=0"])
        .arg(file);
    ctx.run(c, true).stdout.lines().next().and_then(|l| l.trim().parse().ok())
}

fn convert_gif(ctx: &Ctx, ffmpeg: &Path, file: &Path, threads: Option<usize>) -> Gif {
    if !frame_count(ctx, file).is_some_and(|f| f > 1) {
        return Gif::Still;
    }
    let out = file.with_extension("mp4");
    if out.exists() {
        return Gif::Exists;
    }
    let tmp = tmp_beside(file, "gifconv-tmp", "mp4");
    let mut c = ctx.cmd(ffmpeg);
    c.args(["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i"])
        .arg(file)
        .args(["-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-pix_fmt", "yuv420p"])
        .args(["-c:v", "libx264", "-crf", "23", "-preset", "medium"]);
    if let Some(t) = threads {
        c.args(["-threads", &t.to_string()]);
    }
    c.args(["-an", "-movflags", "+faststart"]).arg(&tmp);
    if !ctx.run(c, false).ok || size_of(&tmp) == 0 {
        let _ = std::fs::remove_file(&tmp);
        return Gif::Failed;
    }
    let (old, new) = (size_of(file), size_of(&tmp));
    if new >= old {
        let _ = std::fs::remove_file(&tmp);
        return Gif::NoGain;
    }
    if std::fs::rename(&tmp, &out).is_err() {
        let _ = std::fs::remove_file(&tmp);
        return Gif::Failed;
    }
    let _ = std::fs::remove_file(file);
    Gif::Converted(old - new)
}

/// A temporary file next to `file`, named after it, so pool jobs never clash.
pub fn tmp_beside(file: &Path, tag: &str, ext: &str) -> PathBuf {
    let stem = file.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    file.with_file_name(format!("{stem}.{tag}.{}.{ext}", std::process::id()))
}

pub fn run(ctx: &Ctx) -> Report {
    let mut r = Report::default();
    let Some(ffmpeg) = find_tool("ffmpeg") else {
        r.fail("ffmpeg isn’t installed".into());
        return r;
    };
    let walk = Walk::library();
    let videos = walk.files_with(&ctx.root, SOURCES);
    let jobs = if ctx.turbo() { turbo_width(true) } else { 1 };
    let threads = ctx.turbo().then(|| threads_per_job(jobs));
    let total = videos.len();
    let mut n = 0;
    pool(ctx, jobs, videos, |f| convert_video(ctx, &ffmpeg, f, threads), |f, d| {
        match d {
            Done::Copied => r.add("copied", 1),
            Done::Reencoded => r.add("reencoded", 1),
            Done::Exists => r.add("skipped", 1),
            Done::Failed => r.fail(format!("{} (couldn’t convert it)", rel(&ctx.root, f))),
        }
        n += 1;
        ctx.progress("Converting videos to MP4", n, total);
    });
    if ctx.cancelled() {
        return r;
    }
    let gifs = walk.files_with(&ctx.root, &["gif"]);
    let jobs = if ctx.turbo() { turbo_width(false) } else { 1 };
    let threads = ctx.turbo().then(|| threads_per_job(jobs));
    let total = gifs.len();
    let mut n = 0;
    pool(ctx, jobs, gifs, |f| convert_gif(ctx, &ffmpeg, f, threads), |f, g| {
        match g {
            Gif::Converted(saved) => {
                r.add("gifs", 1);
                r.add("saved", saved);
            }
            Gif::Still => r.add("still-gifs", 1),
            Gif::NoGain => r.add("gif-nogain", 1),
            Gif::Exists => r.add("skipped", 1),
            Gif::Failed => r.fail(format!("{} (couldn’t convert the GIF)", rel(&ctx.root, f))),
        }
        n += 1;
        ctx.progress("Turning GIFs into MP4s", n, total);
    });
    r.nothing = r.get("copied") + r.get("reencoded") + r.get("gifs") == 0 && r.problems.is_empty();
    r
}
