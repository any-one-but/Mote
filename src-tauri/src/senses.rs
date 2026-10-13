//! Runs `mote-senses` (desktop/senses/main.swift), the helper that watches for
//! visible media and the pointer, and passes what it reports on to Mote's
//! window, measured from the centre of that window.

use std::io::{BufRead, BufReader, Write};
use std::process::{ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

/// Centre and size of Mote's window, in screen points.
fn mote_frame(main: &WebviewWindow) -> Option<(f64, f64, f64, f64)> {
    let scale = main.scale_factor().ok()?;
    let pos = main.outer_position().ok()?.to_logical::<f64>(scale);
    let size = main.outer_size().ok()?.to_logical::<f64>(scale);
    Some((pos.x + size.width / 2.0, pos.y + size.height / 2.0, size.width, size.height))
}

/// The helper's input: what Mote tells it. It quits when this closes, which
/// happens when Mote quits.
static INPUT: Mutex<Option<ChildStdin>> = Mutex::new(None);
/// Whether Mote may listen to what's playing (kept in case the helper starts
/// after Mote's window says so).
static LISTEN: AtomicBool = AtomicBool::new(false);

fn tell(line: &str) {
    if let Ok(mut input) = INPUT.lock() {
        if let Some(stdin) = input.as_mut() {
            let _ = writeln!(stdin, "{line}").and_then(|_| stdin.flush());
        }
    }
}

/// Lets the helper listen to the music playing, or stops it. The first time
/// it listens, macOS asks whether Mote may hear audio from other apps.
#[tauri::command]
pub fn set_listening(on: bool) {
    LISTEN.store(on, Ordering::Relaxed);
    tell(if on { "listen 1" } else { "listen 0" });
}

/// Starts the helper. Returns false if it can't (then the simpler sound check
/// is used instead).
pub fn start(app: AppHandle) -> bool {
    let Ok(exe) = std::env::current_exe() else {
        return false;
    };
    let path = exe.with_file_name("mote-senses");
    if !path.exists() {
        return false;
    }
    let Ok(mut child) = Command::new(&path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    else {
        return false;
    };
    let Some(stdout) = child.stdout.take() else {
        return false;
    };
    if let Ok(mut input) = INPUT.lock() {
        *input = child.stdin.take();
    }
    set_listening(LISTEN.load(Ordering::Relaxed));

    std::thread::spawn(move || {
        let mut child = child;
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else { break };
            let Ok(report) = serde_json::from_str::<Value>(&line) else {
                continue;
            };
            let Some(main) = app.get_webview_window("main") else {
                continue;
            };
            let Some((cx, cy, w, h)) = mote_frame(&main) else {
                continue;
            };

            if let Some(media) = report.get("media") {
                let mut media = media.clone();
                if let Some(m) = media.as_object_mut() {
                    let x = m.get("x").and_then(Value::as_f64).unwrap_or(cx);
                    let y = m.get("y").and_then(Value::as_f64).unwrap_or(cy);
                    m.insert("dx".into(), (x - cx).into());
                    m.insert("dy".into(), (y - cy).into());
                }
                let permission = report.get("permission").cloned().unwrap_or(Value::Null);
                let _ = main.emit(
                    "senses",
                    serde_json::json!({ "media": media, "permission": permission }),
                );
            } else if let Some(p) = report.get("typing").and_then(Value::as_array) {
                let (Some(x), Some(y)) = (p.first().and_then(Value::as_f64), p.get(1).and_then(Value::as_f64))
                else {
                    continue;
                };
                let _ = main.emit("typing-elsewhere", serde_json::json!({ "dx": x - cx, "dy": y - cy }));
            } else if let Some(p) = report.get("pointer").and_then(Value::as_array) {
                let (Some(x), Some(y)) = (p.first().and_then(Value::as_f64), p.get(1).and_then(Value::as_f64))
                else {
                    continue;
                };
                let inside = (x - cx).abs() < w / 2.0 && (y - cy).abs() < h / 2.0;
                let _ = main.emit(
                    "pointer-elsewhere",
                    serde_json::json!({ "dx": x - cx, "dy": y - cy, "inside": inside }),
                );
            }
        }
        // The helper stopped (or was never allowed to run properly): fall back.
        let _ = child.kill();
        if let Ok(mut input) = INPUT.lock() {
            *input = None;
        }
        crate::watch_audio(app);
    });
    true
}
