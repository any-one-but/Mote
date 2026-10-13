// Apps dropped on Mote: Mote has opinions.
// Games get played (Chess and Minecraft have their own animations), and the
// apps that come with every Mac get a reaction of their own. Only the app's
// own description of itself (Info.plist) is read, plus, for a game
// launcher's shortcut, its tiny launch script; nothing is ever run.

use std::path::Path;

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

/// An app dropped on Mote: its name, its ID, and whether it's a game.
#[derive(serde::Serialize)]
pub struct Dropped {
    name: String,
    bundle: Option<String>,
    game: Option<&'static str>,
}

/// The first app among what was dropped on Mote, if there is one.
#[tauri::command]
pub fn app_dropped(paths: Vec<String>) -> Option<Dropped> {
    let app = paths.iter().map(Path::new).find(|p| {
        p.is_dir() && p.extension().is_some_and(|e| e.eq_ignore_ascii_case("app"))
    })?;
    let (name, bundle, game) = inspect(app);
    Some(Dropped { name, bundle, game })
}

/// The name you see in Finder (or the app's own display name), its ID, and
/// whether it's a game.
pub fn inspect(path: &Path) -> (String, Option<String>, Option<&'static str>) {
    let real = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let info = app_info(&real);
    let shown = path
        .file_stem()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "that".into());
    (info.name.unwrap_or(shown), info.bundle, info.game)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tells_apps_apart() {
        assert_eq!(inspect(Path::new("/System/Applications/Chess.app")).2, Some("chess"));
        let notes = inspect(Path::new("/System/Applications/Notes.app"));
        assert_eq!((notes.1.as_deref(), notes.2), (Some("com.apple.notes"), None));
        // A Steam shortcut: a tiny app with a script that opens steam://run/….
        let dir = std::env::temp_dir().join("mote-test-Shortcut Game.app/Contents/MacOS");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("run.sh"), "#!/bin/bash\nopen steam://run/123\n").unwrap();
        let app = dir.parent().unwrap().parent().unwrap();
        let shortcut = inspect(app);
        std::fs::remove_dir_all(app).unwrap();
        assert_eq!((shortcut.0.as_str(), shortcut.2), ("mote-test-Shortcut Game", Some("game")));
    }
}
