// Local Gallery: a separate app (Electron) that Mote carries and opens. Mote
// doesn't run any of it; it only finds the app and asks macOS to open it,
// exactly as if you'd double-clicked it. Its code lives in ../local-gallery.

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const APP: &str = "Local Gallery.app";

/// Where the carried copy is: inside Mote.app's Resources when built, or the
/// copy built in the project folder while developing.
fn gallery_app(app: &AppHandle) -> Option<PathBuf> {
    let bundled = app.path().resource_dir().ok().map(|dir| dir.join(APP));
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../local-gallery/dist-electron/mac-arm64")
        .join(APP);
    bundled.into_iter().chain(std::iter::once(dev)).find(|p| p.exists())
}

#[tauri::command]
pub fn open_local_gallery(app: AppHandle) -> Result<(), String> {
    let path = gallery_app(&app).ok_or("Local Gallery isn't in this copy of Mote.")?;
    let status = std::process::Command::new("/usr/bin/open")
        .arg(&path)
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("Local Gallery wouldn't open.".into())
    }
}
