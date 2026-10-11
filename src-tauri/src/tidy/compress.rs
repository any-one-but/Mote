// Step: make media smaller, one of two ways.
//
// - Optimage, at the app's own settings: larger files, higher quality.
//   Absolute paths on purpose: given a relative one, Optimage quietly does
//   nothing and still says it worked.
// - Re-encode: pictures to AVIF (Lanczos3 shrink to the biggest screen
//   attached, then avifenc at quality 45), videos to AV1 (SVT-AV1 CRF 32,
//   preset 6, Opus audio). Smaller files, lower quality. A file is only
//   replaced when the new one is smaller.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Deserialize;

use super::convert::tmp_beside;
use super::tools::{
    cpu_count, find_any, find_tool, pool, size_of, threads_per_job, turbo_width, Ctx, OPTIMAGE_BIN,
};
use super::walk::{rel, Walk};
use super::Report;

#[derive(Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Method {
    Optimage,
    Encode,
}

const OPTIMAGE_KINDS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "tif", "tiff", "bmp", "tga", "svg", "pdf", "ico",
    "icns", "mp4", "m4v", "mov", "mkv", "webm", "mpg", "mpeg",
];
const OPTIMAGE_BATCH: usize = 200;

const IMAGE_KINDS: &[&str] = &["jpg", "jpeg", "png", "bmp", "tif", "tiff", "webp", "avif"];
const VIDEO_KINDS: &[&str] = &["mp4", "m4v", "mov", "mkv", "webm", "avi"];
const AVIF_QUALITY: &str = "45";
const AVIF_SPEED: &str = "6";
const AV1_CRF: &str = "32";
const AV1_PRESET: &str = "6";
const FALLBACK_MAX_HEIGHT: u64 = 3200;

pub fn run(ctx: &Ctx, method: Method) -> Report {
    match method {
        Method::Optimage => optimage(ctx),
        Method::Encode => encode(ctx),
    }
}

fn total_bytes(files: &[PathBuf]) -> u64 {
    files.iter().map(|f| size_of(f)).sum()
}

fn optimage(ctx: &Ctx) -> Report {
    let mut r = Report::default();
    if !Path::new(OPTIMAGE_BIN).is_file() {
        r.fail("Optimage isn’t in your Applications folder".into());
        return r;
    }
    let files = Walk::library().files_with(&ctx.root, OPTIMAGE_KINDS);
    if files.is_empty() {
        r.nothing = true;
        return r;
    }
    let before = total_bytes(&files);
    let total = files.len();
    // Turbo runs several copies of Optimage side by side (one copy fills
    // about seven cores); each takes every Nth file.
    let streams = if ctx.turbo() { (cpu_count() / 7).max(2).min(total) } else { 1 };
    let shares: Vec<Vec<PathBuf>> =
        (0..streams).map(|k| files.iter().skip(k).step_by(streams).cloned().collect()).collect();
    let mut done = 0;
    let mut failed_batches = 0;
    let batches: Vec<Vec<PathBuf>> = shares
        .into_iter()
        .flat_map(|share| share.chunks(OPTIMAGE_BATCH).map(|c| c.to_vec()).collect::<Vec<_>>())
        .collect();
    pool(
        ctx,
        streams,
        batches,
        |batch| {
            let mut c = ctx.cmd(OPTIMAGE_BIN);
            c.args(["-exit", "YES"]).args(batch);
            ctx.run(c, false).ok
        },
        |batch, ok| {
            if !ok && !ctx.cancelled() {
                failed_batches += 1;
            }
            done += batch.len();
            ctx.progress("Compressing with Optimage", done, total);
        },
    );
    if failed_batches > 0 {
        r.fail(format!("Optimage reported a problem with {failed_batches} batch(es)"));
    }
    let after = total_bytes(&files);
    r.add("handed", total as u64);
    r.add("saved", before.saturating_sub(after));
    r
}

/// The biggest screen attached, as width × height pixels (from
/// system_profiler), so pictures are never kept bigger than you can see.
fn biggest_display(ctx: &Ctx) -> Option<u64> {
    let mut c = ctx.cmd("/usr/sbin/system_profiler");
    c.arg("SPDisplaysDataType");
    let out = ctx.run(c, true).stdout;
    let (mut pending, mut online, mut any) = (0u64, 0u64, 0u64);
    for line in out.lines() {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix("Resolution:") {
            let nums: Vec<u64> = rest
                .split(|c: char| !c.is_ascii_digit())
                .filter(|s| !s.is_empty())
                .take(2)
                .filter_map(|s| s.parse().ok())
                .collect();
            if nums.len() == 2 {
                pending = nums[0] * nums[1];
                any = any.max(pending);
            }
        } else if t.starts_with("Online: Yes") {
            online = online.max(pending);
            pending = 0;
        } else if t.starts_with("Online: No") {
            pending = 0;
        }
    }
    let px = if online > 0 { online } else { any };
    (px > 0).then_some(px)
}

enum Enc {
    Converted(u64),
    NoGain,
    Same,
    Exists,
    Av1,
    Probe,
    Failed,
}

/// Sets the thread budget tools read from the environment (turbo only).
fn limit_threads(c: &mut Command, threads: Option<usize>) {
    if let Some(t) = threads {
        let t = t.to_string();
        c.env("MAGICK_THREAD_LIMIT", &t).env("OMP_NUM_THREADS", &t).env("RAYON_NUM_THREADS", &t);
    }
}

fn replace_if_smaller(file: &Path, tmp: &Path, out: &Path) -> Enc {
    let (old, new) = (size_of(file), size_of(tmp));
    if new >= old {
        let _ = std::fs::remove_file(tmp);
        return Enc::NoGain;
    }
    if std::fs::rename(tmp, out).is_err() {
        let _ = std::fs::remove_file(tmp);
        return Enc::Failed;
    }
    if out != file {
        let _ = std::fs::remove_file(file);
    }
    Enc::Converted(old - new)
}

fn encode_image(ctx: &Ctx, file: &Path, geometry: &str, threads: Option<usize>) -> Enc {
    let (Some(magick), Some(avifenc)) = (find_any(&["magick", "convert"]), find_tool("avifenc")) else {
        return Enc::Failed;
    };
    if super::tools::ext_of(file) == "avif" {
        return Enc::Same;
    }
    let out = file.with_extension("avif");
    if out.exists() && out != file {
        return Enc::Exists;
    }
    let tmp = tmp_beside(file, "recompress-tmp", "avif");
    let stage = ctx.scratch("png");
    let mut c = ctx.cmd(magick);
    limit_threads(&mut c, threads);
    c.arg(file)
        .args(["-colorspace", "sRGB", "-filter", "Lanczos", "-resize", geometry, "-depth", "8", "-strip"])
        .arg(&stage);
    if !ctx.run(c, false).ok || size_of(&stage) == 0 {
        let _ = std::fs::remove_file(&stage);
        return Enc::Failed;
    }
    let jobs = threads.map(|t| t.to_string()).unwrap_or_else(|| "all".into());
    let mut c = ctx.cmd(avifenc);
    limit_threads(&mut c, threads);
    c.args(["-q", AVIF_QUALITY, "-s", AVIF_SPEED, "-y", "420", "-j", &jobs, "--cicp", "1/13/6"])
        .args(["--range", "full", "--ignore-exif", "--ignore-xmp", "--ignore-icc"])
        .arg(&stage)
        .arg(&tmp);
    let ok = ctx.run(c, false).ok;
    let _ = std::fs::remove_file(&stage);
    if !ok || size_of(&tmp) == 0 {
        let _ = std::fs::remove_file(&tmp);
        return Enc::Failed;
    }
    replace_if_smaller(file, &tmp, &out)
}

fn encode_video(ctx: &Ctx, file: &Path, threads: Option<usize>) -> Enc {
    let (Some(ffmpeg), Some(ffprobe)) = (find_tool("ffmpeg"), find_tool("ffprobe")) else {
        return Enc::Failed;
    };
    let mut c = ctx.cmd(ffprobe);
    c.args(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "csv=p=0"])
        .arg(file);
    let codec = ctx.run(c, true).stdout.lines().next().unwrap_or("").trim().to_string();
    if codec.is_empty() {
        return Enc::Probe;
    }
    if codec == "av1" {
        return Enc::Av1;
    }
    let out = file.with_extension("mp4");
    if out.exists() && out != file {
        return Enc::Exists;
    }
    let tmp = tmp_beside(file, "av1-tmp", "mp4");
    let mut c = ctx.cmd(ffmpeg);
    limit_threads(&mut c, threads);
    c.args(["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i"])
        .arg(file)
        .args(["-map", "0:v:0", "-map", "0:a?", "-c:v", "libsvtav1", "-crf", AV1_CRF, "-preset", AV1_PRESET]);
    if let Some(t) = threads {
        c.args(["-threads", &t.to_string(), "-svtav1-params", &format!("lp={t}")]);
    }
    c.args(["-c:a", "libopus", "-b:a", "96k", "-movflags", "+faststart"]).arg(&tmp);
    if !ctx.run(c, false).ok || size_of(&tmp) == 0 {
        let _ = std::fs::remove_file(&tmp);
        return Enc::Failed;
    }
    replace_if_smaller(file, &tmp, &out)
}

fn tally(ctx: &Ctx, r: &mut Report, f: &Path, e: Enc) {
    match e {
        Enc::Converted(saved) => {
            r.add("converted", 1);
            r.add("saved", saved);
        }
        Enc::NoGain => r.add("nogain", 1),
        Enc::Same | Enc::Av1 => r.add("already", 1),
        Enc::Exists => r.add("skipped", 1),
        Enc::Probe => r.fail(format!("{} (couldn’t read the video)", rel(&ctx.root, f))),
        Enc::Failed => r.fail(format!("{} (couldn’t re-encode it)", rel(&ctx.root, f))),
    }
}

fn encode(ctx: &Ctx) -> Report {
    let mut r = Report::default();
    let walk = Walk::library();
    let images = walk.files_with(&ctx.root, IMAGE_KINDS);
    let videos = walk.files_with(&ctx.root, VIDEO_KINDS);
    if images.is_empty() && videos.is_empty() {
        r.nothing = true;
        return r;
    }
    if !images.is_empty() {
        if find_any(&["magick", "convert"]).is_none() || find_tool("avifenc").is_none() {
            r.fail("Couldn’t re-encode pictures: ImageMagick and avifenc are needed".into());
        } else {
            ctx.progress("Measuring your screen", 0, 1);
            let geometry = match biggest_display(ctx) {
                Some(px) => format!("{px}@>"),
                None => format!("x{FALLBACK_MAX_HEIGHT}>"),
            };
            let jobs = if ctx.turbo() { turbo_width(false) } else { 1 };
            let threads = ctx.turbo().then(|| threads_per_job(jobs));
            let total = images.len();
            let mut n = 0;
            pool(ctx, jobs, images, |f| encode_image(ctx, f, &geometry, threads), |f, e| {
                tally(ctx, &mut r, f, e);
                n += 1;
                ctx.progress("Re-encoding pictures to AVIF", n, total);
            });
        }
    }
    if !videos.is_empty() && !ctx.cancelled() {
        let jobs = if ctx.turbo() { turbo_width(true) } else { 1 };
        let threads = ctx.turbo().then(|| threads_per_job(jobs));
        let total = videos.len();
        let mut n = 0;
        pool(ctx, jobs, videos, |f| encode_video(ctx, f, threads), |f, e| {
            tally(ctx, &mut r, f, e);
            n += 1;
            ctx.progress("Re-encoding videos to AV1", n, total);
        });
    }
    r
}
