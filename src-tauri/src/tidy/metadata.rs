// Step: strip hidden metadata (location, camera, dates…) from pictures and
// videos with mat2, in place. Turbo hands mat2 big batches, which it spreads
// over every core; a batch that fails is retried one file at a time.

use std::path::PathBuf;

use super::tools::{cpu_count, find_tool, Ctx};
use super::walk::{rel, Walk};
use super::Report;

const KINDS: &[&str] = &["jpg", "jpeg", "png", "tif", "tiff", "heic", "mp4", "mov", "m4v", "mkv", "webm", "avi"];

pub fn run(ctx: &Ctx) -> Report {
    let mut r = Report::default();
    let Some(mat2) = find_tool("mat2") else {
        r.fail("mat2 isn’t installed".into());
        return r;
    };
    let files = Walk::library().files_with(&ctx.root, KINDS);
    if files.is_empty() {
        r.nothing = true;
        return r;
    }
    let total = files.len();
    let batch = if ctx.turbo() { cpu_count() * 4 } else { 1 };
    let mut done = 0;
    for chunk in files.chunks(batch) {
        if ctx.cancelled() {
            break;
        }
        let one = |f: &PathBuf| {
            let mut c = ctx.cmd(&mat2);
            c.args(["--inplace", "--"]).arg(f);
            ctx.run(c, false).ok
        };
        let mut c = ctx.cmd(&mat2);
        c.args(["--inplace", "--"]).args(chunk);
        if chunk.len() > 1 && ctx.run(c, false).ok {
            r.add("cleaned", chunk.len() as u64);
        } else {
            for f in chunk {
                if one(f) {
                    r.add("cleaned", 1);
                } else if !ctx.cancelled() {
                    r.fail(format!("{} (mat2 couldn’t clean it)", rel(&ctx.root, f)));
                }
            }
        }
        done += chunk.len();
        ctx.progress("Removing metadata", done, total);
    }
    r
}
