// Steps for single videos you give Mote: trim seconds off the start or the
// end, or pull the audio out as an MP3 beside the video.
//
// Trims re-encode (H.264 CRF 20) so the cut lands exactly where asked; if
// that fails they fall back to a straight copy, which can only cut at a
// keyframe and so may keep a little more than asked.

use std::path::{Path, PathBuf};

use super::convert::tmp_beside;
use super::tools::{ext_of, find_tool, size_of, Ctx};
use super::Report;

fn name(p: &Path) -> String {
    p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
}

fn duration(ctx: &Ctx, ffprobe: &Path, file: &Path) -> Option<f64> {
    let mut c = ctx.cmd(ffprobe);
    c.args(["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0"]).arg(file);
    ctx.run(c, true).stdout.lines().next().and_then(|l| l.trim().parse().ok())
}

/// Trims `seconds` off the start (`from_start`) or the end of each video.
pub fn trim(ctx: &Ctx, files: &[PathBuf], seconds: f64, from_start: bool) -> Report {
    let mut r = Report::default();
    let (Some(ffmpeg), Some(ffprobe)) = (find_tool("ffmpeg"), find_tool("ffprobe")) else {
        r.fail("ffmpeg isn’t installed".into());
        return r;
    };
    let label = if from_start { "Trimming the start" } else { "Trimming the end" };
    let total = files.len();
    for (i, file) in files.iter().enumerate() {
        if ctx.cancelled() {
            break;
        }
        ctx.progress(label, i, total);
        let length = duration(ctx, &ffprobe, file);
        if !from_start && length.is_none() {
            r.fail(format!("{} (couldn’t tell how long it is)", name(file)));
            continue;
        }
        if length.is_some_and(|d| d <= seconds) {
            r.add("too-short", 1);
            continue;
        }
        let keep = length.map(|d| d - seconds).unwrap_or(0.0);
        let ext = ext_of(file);
        let tag = if from_start { "trimstart-tmp" } else { "trimend-tmp" };
        let tmp = tmp_beside(file, tag, &ext);
        let _ = std::fs::remove_file(&tmp);
        let cut: Vec<String> = if from_start {
            vec!["-ss".into(), format!("{seconds}")]
        } else {
            vec!["-t".into(), format!("{keep:.6}")]
        };
        let mut c = ctx.cmd(&ffmpeg);
        c.args(["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i"])
            .arg(file)
            .args(&cut)
            .args(["-map", "0", "-map_metadata", "0", "-c:v", "libx264", "-crf", "20", "-preset", "medium"])
            .args(["-c:a", "aac", "-c:s", "copy", "-c:d", "copy", "-c:t", "copy"])
            .arg(&tmp);
        if ctx.run(c, false).ok && size_of(&tmp) > 0 && std::fs::rename(&tmp, file).is_ok() {
            r.add("trimmed", 1);
            continue;
        }
        let _ = std::fs::remove_file(&tmp);
        if ctx.cancelled() {
            break;
        }
        // The keyframe fallback: -ss before -i for the start.
        let mut c = ctx.cmd(&ffmpeg);
        c.args(["-nostdin", "-hide_banner", "-loglevel", "error", "-y"]);
        if from_start {
            c.args(&cut).arg("-i").arg(file);
        } else {
            c.arg("-i").arg(file).args(&cut);
        }
        c.args(["-map", "0", "-c", "copy", "-avoid_negative_ts", "make_zero"]).arg(&tmp);
        if ctx.run(c, false).ok && size_of(&tmp) > 0 && std::fs::rename(&tmp, file).is_ok() {
            r.add("trimmed", 1);
            r.add("approximate", 1);
        } else {
            let _ = std::fs::remove_file(&tmp);
            r.fail(format!("{} (couldn’t trim it)", name(file)));
        }
    }
    ctx.progress(label, total, total);
    r
}

/// Saves each video's sound as an MP3 next to it (skipping ones with no
/// sound, or that already have an MP3).
pub fn mp3(ctx: &Ctx, files: &[PathBuf]) -> Report {
    let mut r = Report::default();
    let (Some(ffmpeg), Some(ffprobe)) = (find_tool("ffmpeg"), find_tool("ffprobe")) else {
        r.fail("ffmpeg isn’t installed".into());
        return r;
    };
    let total = files.len();
    for (i, file) in files.iter().enumerate() {
        if ctx.cancelled() {
            break;
        }
        ctx.progress("Saving the audio as MP3", i, total);
        let out = file.with_extension("mp3");
        if out.is_file() {
            r.add("exists", 1);
            continue;
        }
        let mut c = ctx.cmd(&ffprobe);
        c.args(["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=index", "-of", "csv=p=0"])
            .arg(file);
        if ctx.run(c, true).stdout.trim().is_empty() {
            r.add("no-audio", 1);
            continue;
        }
        let tmp = tmp_beside(file, "tmp", "mp3");
        let mut c = ctx.cmd(&ffmpeg);
        c.args(["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i"])
            .arg(file)
            .args(["-map", "0:a:0", "-map_metadata", "0", "-vn", "-c:a", "libmp3lame", "-q:a", "2"])
            .arg(&tmp);
        if ctx.run(c, false).ok && size_of(&tmp) > 0 && std::fs::rename(&tmp, &out).is_ok() {
            r.add("created", 1);
        } else {
            let _ = std::fs::remove_file(&tmp);
            r.fail(format!("{} (couldn’t get the audio out)", name(file)));
        }
    }
    ctx.progress("Saving the audio as MP3", total, total);
    r
}
