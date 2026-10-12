// Opening Mote when you log in: a small launch agent in your Library that
// opens the app once at login. Switched on means the file is there.

use std::path::{Path, PathBuf};

const LABEL: &str = "com.anyonebut.mote.login";

fn agent_path() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    Some(Path::new(&home).join("Library/LaunchAgents").join(format!("{LABEL}.plist")))
}

/// What to run at login: `open` on Mote.app when running from inside one,
/// otherwise the program itself.
fn launch_command() -> Option<Vec<String>> {
    let exe = std::env::current_exe().ok()?;
    let bundle = exe.ancestors().find(|p| p.extension().is_some_and(|e| e == "app"));
    Some(match bundle {
        Some(app) => vec!["/usr/bin/open".into(), app.to_string_lossy().into_owned()],
        None => vec![exe.to_string_lossy().into_owned()],
    })
}

fn write_agent(path: &Path) -> Result<(), String> {
    let args = launch_command().ok_or("Couldn't find where Mote is.")?;
    let mut dict = plist::Dictionary::new();
    dict.insert("Label".into(), LABEL.into());
    dict.insert(
        "ProgramArguments".into(),
        plist::Value::Array(args.into_iter().map(plist::Value::from).collect()),
    );
    dict.insert("RunAtLoad".into(), true.into());
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    plist::Value::Dictionary(dict).to_file_xml(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn login_item_enabled() -> bool {
    agent_path().is_some_and(|p| p.exists())
}

#[tauri::command]
pub fn set_login_item(on: bool) -> Result<(), String> {
    let path = agent_path().ok_or("Couldn't find your home folder.")?;
    if on {
        write_agent(&path)
    } else if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

/// If it's on, point it at this copy of Mote, in case the app has moved.
pub fn refresh() {
    if cfg!(debug_assertions) {
        return;
    }
    if let Some(path) = agent_path().filter(|p| p.exists()) {
        let _ = write_agent(&path);
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn switches_on_and_off() {
        let _turn = crate::HOME_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let real_home = std::env::var_os("HOME");
        let home = std::env::temp_dir().join("mote-login-test");
        let _ = std::fs::remove_dir_all(&home);
        std::env::set_var("HOME", &home);
        assert!(!super::login_item_enabled());
        super::set_login_item(true).unwrap();
        assert!(super::login_item_enabled());
        let text = std::fs::read_to_string(super::agent_path().unwrap()).unwrap();
        assert!(text.contains("RunAtLoad") && text.contains("com.anyonebut.mote.login"));
        super::set_login_item(false).unwrap();
        assert!(!super::login_item_enabled());
        if let Some(h) = real_home {
            std::env::set_var("HOME", h);
        }
    }
}
