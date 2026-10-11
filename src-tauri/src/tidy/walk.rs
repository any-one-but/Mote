// Listing what's in a folder, the way the cleaner script's `find` calls did:
// regular files only (links aren't followed), with the quarantine folder
// (and the old VHS test folder) left out.

use std::path::{Path, PathBuf};

/// Where quarantined things go, inside the folder being cleaned.
pub const BUCKET: &str = "_quarantined_media";
/// A folder the old VHS step left behind; never treated as library media.
pub const VHS_TEST: &str = "_vhs_height_test";

pub struct Walk {
    /// Top-level folders to skip.
    pub prune_top: Vec<&'static str>,
    /// Skip any folder with this name, anywhere (`.git`).
    pub prune_any: Vec<&'static str>,
    /// Skip any folder whose name starts with this (archive staging).
    pub prune_prefix: Option<&'static str>,
}

impl Walk {
    /// The usual walk: everything except the quarantine and VHS test folders.
    pub fn library() -> Walk {
        Walk { prune_top: vec![BUCKET, VHS_TEST], prune_any: vec![], prune_prefix: None }
    }

    fn skip_dir(&self, root: &Path, dir: &Path) -> bool {
        let name = dir.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if dir.parent() == Some(root) && self.prune_top.iter().any(|p| *p == name) {
            return true;
        }
        if self.prune_any.iter().any(|p| *p == name) {
            return true;
        }
        matches!(self.prune_prefix, Some(pre) if name.starts_with(pre))
    }

    /// Every regular file under `root`.
    pub fn files(&self, root: &Path) -> Vec<PathBuf> {
        let mut out = Vec::new();
        self.visit(root, root, &mut |p, is_dir| {
            if !is_dir {
                out.push(p.to_path_buf());
            }
        });
        out
    }

    /// Every regular file under `root` whose extension (lowercase) is listed.
    pub fn files_with(&self, root: &Path, exts: &[&str]) -> Vec<PathBuf> {
        self.files(root).into_iter().filter(|p| exts.contains(&super::tools::ext_of(p).as_str())).collect()
    }

    /// Every file and folder under `root` (not `root` itself), children
    /// before the folder they're in.
    pub fn entries_deepest_first(&self, root: &Path) -> Vec<(PathBuf, bool)> {
        let mut out = Vec::new();
        self.visit_post(root, root, &mut out);
        out
    }

    fn visit(&self, root: &Path, dir: &Path, f: &mut dyn FnMut(&Path, bool)) {
        let Ok(rd) = std::fs::read_dir(dir) else { return };
        let mut entries: Vec<_> = rd.flatten().collect();
        entries.sort_by_key(|e| e.file_name());
        for e in entries {
            let p = e.path();
            let Ok(meta) = std::fs::symlink_metadata(&p) else { continue };
            if meta.is_dir() {
                if self.skip_dir(root, &p) {
                    continue;
                }
                f(&p, true);
                self.visit(root, &p, f);
            } else if meta.is_file() {
                f(&p, false);
            }
        }
    }

    fn visit_post(&self, root: &Path, dir: &Path, out: &mut Vec<(PathBuf, bool)>) {
        let Ok(rd) = std::fs::read_dir(dir) else { return };
        let mut entries: Vec<_> = rd.flatten().collect();
        entries.sort_by_key(|e| e.file_name());
        for e in entries {
            let p = e.path();
            let Ok(meta) = std::fs::symlink_metadata(&p) else { continue };
            if meta.is_dir() {
                if self.skip_dir(root, &p) {
                    continue;
                }
                self.visit_post(root, &p, out);
                out.push((p, true));
            } else if meta.is_file() {
                out.push((p, false));
            }
        }
    }
}

/// A path as shown to you: relative to the folder being worked on.
pub fn rel(root: &Path, p: &Path) -> String {
    p.strip_prefix(root).map(|r| r.to_string_lossy().to_string()).unwrap_or_else(|_| p.to_string_lossy().to_string())
}

/// Moves `src` into `root/BUCKET/sub/<its path relative to root>`, never
/// overwriting anything already there.
pub fn quarantine(root: &Path, src: &Path, sub: &str) -> bool {
    let rel = src.strip_prefix(root).unwrap_or(src);
    let target = root.join(BUCKET).join(sub).join(rel);
    if let Some(parent) = target.parent() {
        if std::fs::create_dir_all(parent).is_err() {
            return false;
        }
    }
    let target = super::tools::unique_target(&target);
    std::fs::rename(src, &target).is_ok()
}

pub const IMAGE_EXTS: &[&str] =
    &["jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff", "heic", "heif", "avif"];
pub const VIDEO_EXTS: &[&str] = &[
    "mp4", "m4v", "mov", "wmv", "flv", "avi", "webm", "mkv", "mpg", "mpeg", "3gp", "m2ts", "vob", "ogv",
    "gifv",
];

pub fn is_video(p: &Path) -> bool {
    VIDEO_EXTS.contains(&super::tools::ext_of(p).as_str())
}

pub fn is_image(p: &Path) -> bool {
    IMAGE_EXTS.contains(&super::tools::ext_of(p).as_str())
}
