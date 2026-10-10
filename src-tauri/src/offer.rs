// What's been dropped on Mote: a file to eat, or a game to play.
//
// This only ever *looks*. For a file or folder it asks for its name and size;
// for an app it also reads the app's own description of itself (Info.plist)
// to tell whether it's a game. Nothing is ever opened for its contents,
// changed, moved or deleted.

use std::path::{Component, Path};

use serde::Serialize;

#[derive(Serialize)]
pub struct Offering {
    name: String,
    size: u64,
    kind: &'static str,
    game: Option<&'static str>,
    important: bool,
}

/// Places that belong to macOS or to apps: nothing from here gets eaten.
const SYSTEM_PLACES: &[&str] = &[
    "/System", "/Library", "/usr", "/bin", "/sbin", "/private", "/etc", "/var", "/dev", "/opt",
    "/cores", "/Applications",
];

/// Kinds of file your computer (or you) can't do without.
const SYSTEM_KINDS: &[&str] = &[
    "kext", "dylib", "so", "a", "framework", "bundle", "plugin", "prefpane", "systemextension",
    "driver", "plist", "keychain", "keychain-db", "pem", "key", "p12", "pfx", "cer", "crt",
    "mobileprovision", "provisionprofile", "app", "sparsebundle", "photoslibrary",
];

const SECRET_NAMES: &[&str] = &["id_rsa", "id_ed25519", "id_ecdsa", "authorized_keys", "known_hosts"];

/// Scratch space for temporary files (a fresh screenshot lives here until
/// it's saved): fine to eat.
const SCRATCH_PLACES: &[&str] = &["/private/var/folders/", "/private/tmp/"];

fn is_important(path: &Path) -> bool {
    let text = path.to_string_lossy();
    let scratch = SCRATCH_PLACES.iter().any(|p| text.starts_with(p));
    if !scratch && SYSTEM_PLACES.iter().any(|p| text == *p || text.starts_with(&format!("{p}/"))) {
        return true;
    }
    if let Some(home) = std::env::var_os("HOME") {
        let home = Path::new(&home);
        if path.starts_with(home.join("Library")) || path == home {
            return true;
        }
    }
    // Hidden files and anything inside a hidden folder (settings, keys…),
    // and anything from inside an app or library bundle.
    let hidden = path.components().any(|c| match c {
        Component::Normal(n) => n.to_string_lossy().starts_with('.'),
        _ => false,
    });
    let in_bundle = path.ancestors().skip(1).any(|a| {
        a.extension()
            .map(|e| SYSTEM_KINDS.contains(&e.to_string_lossy().to_lowercase().as_str()))
            .unwrap_or(false)
    });
    let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    hidden || in_bundle || SYSTEM_KINDS.contains(&ext.as_str()) || SECRET_NAMES.contains(&name.as_str())
}

/// Reads an app's name and whether it's a game, from its Info.plist.
fn app_info(path: &Path) -> (Option<String>, Option<&'static str>) {
    let info = plist::Value::from_file(path.join("Contents/Info.plist")).ok();
    let dict = info.as_ref().and_then(|v| v.as_dictionary());
    let get = |key: &str| {
        dict.and_then(|d| d.get(key)).and_then(|v| v.as_string()).map(str::to_string)
    };
    let id = get("CFBundleIdentifier").unwrap_or_default().to_lowercase();
    let category = get("LSApplicationCategoryType").unwrap_or_default().to_lowercase();
    let name = get("CFBundleDisplayName").or_else(|| get("CFBundleName"));

    if id == "com.apple.chess" {
        return (name, Some("chess"));
    }
    // Games, game launchers, and anything installed by one.
    const LAUNCHER_IDS: &[&str] =
        &["valvesoftware", "com.gog.", "epicgames", "net.battle", "blizzard", "io.itch", "heroic"];
    const LAUNCHER_PLACES: &[&str] =
        &["steamapps", "epic games", "gog games", "gog galaxy", "battle.net", "blizzard", "heroic"];
    let place = path.to_string_lossy().to_lowercase();
    let game = category.contains("games")
        || LAUNCHER_IDS.iter().any(|l| id.contains(l))
        || LAUNCHER_PLACES.iter().any(|l| place.contains(l));
    (name, game.then_some("game"))
}

fn inspect(raw: &str) -> Option<Offering> {
    let given = Path::new(raw);
    let meta = std::fs::metadata(given).ok()?;
    // Where it really lives (following links), to judge whether it's important.
    let real = std::fs::canonicalize(given).unwrap_or_else(|_| given.to_path_buf());
    let important = is_important(&real);
    let file_name = given.file_name()?.to_string_lossy().to_string();
    let is_app = meta.is_dir()
        && given.extension().map(|e| e.eq_ignore_ascii_case("app")).unwrap_or(false);

    if is_app {
        let (name, game) = app_info(&real);
        let fallback = file_name.trim_end_matches(".app").to_string();
        return Some(Offering { name: name.unwrap_or(fallback), size: 0, kind: "app", game, important });
    }
    if meta.is_dir() {
        return Some(Offering { name: file_name, size: 0, kind: "folder", game: None, important });
    }
    Some(Offering { name: file_name, size: meta.len(), kind: "file", game: None, important })
}

/// Name, size and kind of each dropped path (ones that can't be read are skipped).
#[tauri::command]
pub fn inspect_drop(paths: Vec<String>) -> Vec<Offering> {
    paths.iter().take(8).filter_map(|p| inspect(p)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tells_things_apart() {
        let chess = inspect("/System/Applications/Chess.app").unwrap();
        assert_eq!((chess.kind, chess.game), ("app", Some("chess")));
        let notes = inspect("/System/Applications/Notes.app").unwrap();
        assert_eq!((notes.kind, notes.game), ("app", None));
        assert!(inspect("/etc/hosts").unwrap().important);
        assert!(inspect("/usr/lib/libSystem.B.dylib").map(|o| o.important).unwrap_or(true));
        let home = std::env::var("HOME").unwrap();
        assert!(inspect(&format!("{home}/.zshrc")).map(|o| o.important).unwrap_or(true));
        let tmp = std::env::temp_dir().join("mote-test-snack.txt");
        std::fs::write(&tmp, "crunchy bits").unwrap();
        let snack = inspect(tmp.to_str().unwrap()).unwrap();
        std::fs::remove_file(&tmp).unwrap();
        assert_eq!((snack.kind, snack.size, snack.name.as_str()), ("file", 12, "mote-test-snack.txt"));
        assert!(!snack.important);
    }
}
