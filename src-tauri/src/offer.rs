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
    /// For apps: their ID (like `com.apple.safari`), so Mote can recognise
    /// the ones that come with your Mac.
    bundle: Option<String>,
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

struct AppInfo {
    name: Option<String>,
    bundle: Option<String>,
    game: Option<&'static str>,
}

/// Game stores and launchers: their app IDs, the folders they install into,
/// the web links their shortcuts open (`steam://run/…`), and their own names.
const LAUNCHER_IDS: &[&str] = &[
    "valvesoftware", "com.gog.", "epicgames", "net.battle", "blizzard", "io.itch", "heroic",
    "com.ea.", "ubisoft", "com.apple.games",
];
const LAUNCHER_PLACES: &[&str] = &[
    "steam", "epic games", "gog games", "gog galaxy", "battle.net", "blizzard", "heroic", "/games/",
];
const LAUNCHER_LINKS: &[&str] = &[
    "steam://", "com.epicgames.launcher://", "heroic://", "goggalaxy://", "battlenet://",
    "blizzard://", "itch://", "origin://", "origin2://", "eadm://", "uplay://", "ubisoft://",
];
const LAUNCHER_NAMES: &[&str] = &[
    "steam", "gog galaxy", "epic games launcher", "battle.net", "heroic", "itch", "ea", "ea app",
    "ubisoft connect",
];
/// Minecraft itself, and the popular launchers for it.
const MINECRAFT_IDS: &[&str] = &["mojang", "minecraft", "prismlauncher", "multimc", "moonsworth"];

/// Parts that only games have: game engines (Unity, Unreal, Godot, GameMaker,
/// Ren'Py, FNA, LÖVE) and the game-store kits games build in (Steam, Epic,
/// GOG). Only checked for being there; none of them is opened.
const GAME_PARTS: &[&str] = &[
    "Contents/Frameworks/UnityPlayer.dylib",
    "Contents/Resources/Data/globalgamemanagers",
    "Contents/Resources/Data/data.unity3d",
    "Contents/UE4",
    "Contents/UE",
    "Contents/Resources/game.ios",
    "Contents/Resources/autorun/renpy",
    "Contents/MacOS/FNA.dll",
    "Contents/Resources/FNA.dll",
    "Contents/Frameworks/libsteam_api.dylib",
    "Contents/MacOS/libsteam_api.dylib",
    "Contents/Plugins/steam_api.bundle",
    "Contents/Resources/Data/Plugins/steam_api.bundle",
    "Contents/Resources/Data/Plugins/libsteam_api.bundle",
    "Contents/MacOS/steam_appid.txt",
    "Contents/Resources/steam_appid.txt",
    "Contents/Frameworks/libEOSSDK-Mac-Shipping.dylib",
    "Contents/Frameworks/libGalaxy.dylib",
];
/// File endings of game data packs (Godot, LÖVE, Unreal) in an app's Resources.
const GAME_PACKS: &[&str] = &["pck", "love", "pak"];

fn has_game_parts(app: &Path) -> bool {
    if GAME_PARTS.iter().any(|p| app.join(p).exists()) {
        return true;
    }
    std::fs::read_dir(app.join("Contents/Resources"))
        .map(|dir| {
            dir.flatten().any(|e| {
                let n = e.file_name().to_string_lossy().to_lowercase();
                GAME_PACKS.iter().any(|ext| n.ends_with(&format!(".{ext}")))
            })
        })
        .unwrap_or(false)
}

/// A shortcut app made by a game launcher is just a tiny script that opens a
/// link like `steam://run/1086940`. Peek at the script (only if it's small,
/// and only read: it's never run) for one of those links. Steam writes these
/// apps' Info.plist slightly wrong, so when it can't be read, look at what's
/// in the app's MacOS folder instead.
fn opens_launcher_link(app: &Path, executable: Option<&str>) -> bool {
    let macos = app.join("Contents/MacOS");
    let candidates: Vec<std::path::PathBuf> = match executable {
        Some(exe) => vec![macos.join(exe)],
        None => std::fs::read_dir(&macos)
            .map(|d| d.flatten().take(4).map(|e| e.path()).collect())
            .unwrap_or_default(),
    };
    candidates.iter().any(|path| {
        let small =
            std::fs::metadata(path).map(|m| m.is_file() && m.len() <= 16_384).unwrap_or(false);
        let Ok(bytes) = (if small { std::fs::read(path) } else { Err(std::io::ErrorKind::Other.into()) })
        else {
            return false;
        };
        let text = String::from_utf8_lossy(&bytes).to_lowercase();
        bytes.starts_with(b"#!") && LAUNCHER_LINKS.iter().any(|l| text.contains(l))
    })
}

/// Reads an app's name and ID from its Info.plist, and works out whether it's
/// a game.
fn app_info(path: &Path) -> AppInfo {
    let info = plist::Value::from_file(path.join("Contents/Info.plist")).ok();
    let dict = info.as_ref().and_then(|v| v.as_dictionary());
    let get = |key: &str| {
        dict.and_then(|d| d.get(key)).and_then(|v| v.as_string()).map(str::to_string)
    };
    let id = get("CFBundleIdentifier").unwrap_or_default().to_lowercase();
    let category = get("LSApplicationCategoryType").unwrap_or_default().to_lowercase();
    let name = get("CFBundleDisplayName");
    let stem = path.file_stem().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
    let place = path.to_string_lossy().to_lowercase();

    let game = if id == "com.apple.chess" {
        Some("chess")
    } else if MINECRAFT_IDS.iter().any(|m| id.contains(m)) || stem.contains("minecraft") {
        Some("minecraft")
    } else if category.contains("games")
        || LAUNCHER_IDS.iter().any(|l| id.contains(l))
        || LAUNCHER_NAMES.contains(&stem.as_str())
        || LAUNCHER_PLACES.iter().any(|l| place.contains(l))
        || opens_launcher_link(path, get("CFBundleExecutable").as_deref())
        || has_game_parts(path)
    {
        Some("game")
    } else {
        None
    };
    AppInfo { name, bundle: (!id.is_empty()).then_some(id), game }
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
        let info = app_info(&real);
        // The name you see in Finder, unless the app has a nicer one to show.
        let shown = file_name.trim_end_matches(".app").to_string();
        return Some(Offering {
            name: info.name.unwrap_or(shown),
            size: 0,
            kind: "app",
            game: info.game,
            important,
            bundle: info.bundle,
        });
    }
    let kind = if meta.is_dir() { "folder" } else { "file" };
    let size = if meta.is_dir() { 0 } else { meta.len() };
    Some(Offering { name: file_name, size, kind, game: None, important, bundle: None })
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
        assert_eq!((notes.kind, notes.game, notes.bundle.as_deref()), ("app", None, Some("com.apple.notes")));
        assert_eq!(inspect("/Applications/Safari.app").unwrap().game, None);
        // A Steam shortcut: a tiny app with a script that opens steam://run/….
        let dir = std::env::temp_dir().join("mote-test-Shortcut Game.app/Contents/MacOS");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("run.sh"), "#!/bin/bash\nopen steam://run/123\n").unwrap();
        let app = dir.parent().unwrap().parent().unwrap();
        let shortcut = inspect(app.to_str().unwrap()).unwrap();
        std::fs::remove_dir_all(app).unwrap();
        assert_eq!((shortcut.name.as_str(), shortcut.game), ("mote-test-Shortcut Game", Some("game")));
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

#[cfg(test)]
mod games_here {
    use super::*;

    /// Prints what Mote makes of every app on this Mac (run with --nocapture).
    #[test]
    fn every_app() {
        let home = std::env::var("HOME").unwrap();
        let dirs = [
            "/Applications".to_string(),
            "/System/Applications".to_string(),
            format!("{home}/Applications"),
            format!("{home}/Applications/CrossOver/Steam"),
        ];
        for dir in dirs {
            for e in std::fs::read_dir(&dir).into_iter().flatten().flatten() {
                if let Some(o) = inspect(&e.path().to_string_lossy()) {
                    if o.kind == "app" {
                        println!("{:<10} {:<40} {}", o.game.unwrap_or("-"), o.name, o.bundle.unwrap_or_default());
                    }
                }
            }
        }
    }
}
