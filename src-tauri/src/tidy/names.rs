// Step: tidy file and folder names down to plain letters, digits, spaces,
// "_" and "-" (with the extension kept). Deepest first, so a folder and the
// things inside it are never renamed at the same moment. A rename that would
// leave no name, or clash with something already there, is skipped.

use super::tools::Ctx;
use super::walk::{rel, Walk};
use super::Report;

/// Keeps only ASCII letters, digits, space, "_" and "-", trims the ends and
/// squeezes runs of spaces.
fn clean_part(s: &str) -> String {
    let kept: String =
        s.chars().filter(|c| c.is_ascii_alphanumeric() || *c == ' ' || *c == '_' || *c == '-').collect();
    let mut out = String::with_capacity(kept.len());
    for w in kept.split(' ').filter(|w| !w.is_empty()) {
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(w);
    }
    out
}

/// The tidy version of a name ("" if nothing would be left).
pub fn clean_name(name: &str) -> String {
    if name.is_empty() || name == "." || name == ".." {
        return name.to_string();
    }
    // Hidden things like ".hidden" keep their dot.
    if let Some(rest) = name.strip_prefix('.') {
        if !rest.contains('.') {
            let c = clean_part(rest);
            return if c.is_empty() { String::new() } else { format!(".{c}") };
        }
    }
    if let Some(i) = name.rfind('.') {
        let stem = clean_part(&name[..i]);
        let ext = clean_part(&name[i + 1..]);
        return match (stem.is_empty(), ext.is_empty()) {
            (false, false) => format!("{stem}.{ext}"),
            (false, true) => stem,
            (true, false) => ext,
            (true, true) => String::new(),
        };
    }
    clean_part(name)
}

pub fn run(ctx: &Ctx) -> Report {
    let mut r = Report::default();
    ctx.progress("Checking names", 0, 1);
    let todo: Vec<_> = Walk::library()
        .entries_deepest_first(&ctx.root)
        .into_iter()
        .map(|(p, _)| p)
        .filter(|p| {
            let n = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            clean_name(&n) != n
        })
        .collect();
    if todo.is_empty() {
        r.nothing = true;
        return r;
    }
    let total = todo.len();
    for (i, p) in todo.iter().enumerate() {
        if ctx.cancelled() {
            break;
        }
        let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        let clean = clean_name(&name);
        let target = p.with_file_name(&clean);
        if clean.is_empty() {
            r.fail(format!("{} (nothing would be left of the name)", rel(&ctx.root, p)));
        } else if target.exists() {
            r.fail(format!("{} (“{clean}” is already taken)", rel(&ctx.root, p)));
        } else if std::fs::rename(p, &target).is_ok() {
            r.add("renamed", 1);
        } else {
            r.fail(format!("{} (couldn’t rename it)", rel(&ctx.root, p)));
        }
        ctx.progress("Tidying names", i + 1, total);
    }
    r
}

#[cfg(test)]
mod tests {
    use super::clean_name;

    #[test]
    fn names() {
        assert_eq!(clean_name("Hello  World!!.JPG"), "Hello World.JPG");
        assert_eq!(clean_name("café (1).png"), "caf 1.png");
        assert_eq!(clean_name(".DS_Store"), ".DS_Store");
        assert_eq!(clean_name("  spaced  out  "), "spaced out");
        assert_eq!(clean_name("archive.tar.gz"), "archivetar.gz");
        assert_eq!(clean_name("!!!.jpg"), "jpg");
        assert_eq!(clean_name("ok_name-1"), "ok_name-1");
    }
}
