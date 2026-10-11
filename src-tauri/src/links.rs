// Links you drag onto Mote, to be suggested back to you some day. A link
// dragged from a browser isn't a file, so it never shows up in the window's
// drop event; instead it's read straight off the drag's pasteboard (with its
// title, which browsers include). Link files (.webloc) dragged from Finder
// work too. Opening one only ever hands a web address to your browser.

use std::path::Path;

use objc2_app_kit::{NSPasteboard, NSPasteboardNameDrag};
use objc2_foundation::NSString;
use serde::Serialize;

#[derive(Serialize)]
pub struct Link {
    url: String,
    title: Option<String>,
}

fn is_web(url: &str) -> bool {
    let lower = url.trim().to_lowercase();
    (lower.starts_with("https://") || lower.starts_with("http://")) && !lower.contains(char::is_whitespace)
}

/// The link in the drag that just ended, if it was one.
fn from_drag() -> Option<Link> {
    unsafe {
        let pb = NSPasteboard::pasteboardWithName(NSPasteboardNameDrag);
        let get = |kind: &str| pb.stringForType(&NSString::from_str(kind)).map(|s| s.to_string());
        let url = get("public.url")
            .or_else(|| get("public.utf8-plain-text").map(|t| t.trim().to_string()))
            .filter(|u| is_web(u))?;
        let title = get("public.url-name").map(|t| t.trim().to_string()).filter(|t| !t.is_empty() && *t != url);
        Some(Link { url: url.trim().to_string(), title })
    }
}

/// A Finder link file (.webloc / .inetloc).
fn from_file(path: &Path) -> Option<Link> {
    let ext = path.extension()?.to_string_lossy().to_lowercase();
    if ext != "webloc" && ext != "inetloc" {
        return None;
    }
    let v = plist::Value::from_file(path).ok()?;
    let url = v.as_dictionary()?.get("URL")?.as_string()?.to_string();
    let title = path.file_stem().map(|s| s.to_string_lossy().to_string());
    is_web(&url).then_some(Link { url, title })
}

/// The link that was just dropped on Mote: from the drag itself when no
/// files came with it, or from a single link file.
#[tauri::command]
pub fn read_dropped_link(paths: Vec<String>) -> Option<Link> {
    match paths.as_slice() {
        [] => from_drag(),
        [one] => from_file(Path::new(one)),
        _ => None,
    }
}

/// Opens a saved link in your browser (web addresses only).
#[tauri::command]
pub fn open_link(url: String) -> Result<(), String> {
    if !is_web(&url) {
        return Err("That isn’t a web address.".into());
    }
    std::process::Command::new("/usr/bin/open")
        .arg(url.trim())
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn web_only() {
        assert!(is_web("https://www.youtube.com/watch?v=abc"));
        assert!(!is_web("file:///etc/hosts"));
        assert!(!is_web("javascript:alert(1)"));
        assert!(!is_web("https://a b"));
    }

    #[test]
    fn webloc() {
        let p = std::env::temp_dir().join("mote-test-link.webloc");
        let mut d = plist::Dictionary::new();
        d.insert("URL".into(), "https://example.com/".into());
        plist::Value::Dictionary(d).to_file_xml(&p).unwrap();
        let l = from_file(&p).unwrap();
        std::fs::remove_file(&p).unwrap();
        assert_eq!((l.url.as_str(), l.title.as_deref()), ("https://example.com/", Some("mote-test-link")));
    }
}
