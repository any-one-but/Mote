// Mote for Mac: native windows around the pages in ../desktop.
mod audio;
mod gallery;
mod links;
mod login;
mod senses;
mod tidy;

use std::time::Duration;

use tauri::{
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
    window::Color,
    AppHandle, Emitter, Manager, TitleBarStyle, WebviewUrl, WebviewWindowBuilder,
    WindowEvent,
};

const PAPER: Color = Color(0xf6, 0xef, 0xe5, 0xff);

#[derive(Clone, serde::Serialize)]
struct AudioElsewhere {
    playing: bool,
    /// Offset from the centre of Mote's window to the playing window, in points.
    dx: f64,
    dy: f64,
}

/// Every second and a half, tell Mote's window whether another visible window
/// is playing sound, and where it is.
pub(crate) fn watch_audio(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(1500));
        let Some(main) = app.get_webview_window("main") else {
            continue;
        };
        let mut report = AudioElsewhere { playing: false, dx: 0.0, dy: 0.0 };
        if let (Some((cx, cy)), Ok(pos), Ok(size), Ok(scale)) = (
            audio::playing_window_center(),
            main.outer_position(),
            main.outer_size(),
            main.scale_factor(),
        ) {
            let pos = pos.to_logical::<f64>(scale);
            let size = size.to_logical::<f64>(scale);
            report = AudioElsewhere {
                playing: true,
                dx: cx - (pos.x + size.width / 2.0),
                dy: cy - (pos.y + size.height / 2.0),
            };
        }
        let _ = main.emit("audio-elsewhere", report);
    });
}

fn open_settings_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("settings") {
        window.show()?;
        return window.set_focus();
    }
    WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings.html".into()))
        .title("Settings")
        .inner_size(420.0, 640.0)
        .min_inner_size(360.0, 420.0)
        .center()
        .title_bar_style(TitleBarStyle::Overlay)
        .hidden_title(true)
        .background_color(PAPER)
        .build()?;
    Ok(())
}

fn open_calories_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("calories") {
        window.show()?;
        return window.set_focus();
    }
    WebviewWindowBuilder::new(app, "calories", WebviewUrl::App("calories.html".into()))
        .title("Days")
        .inner_size(760.0, 840.0)
        .min_inner_size(520.0, 480.0)
        .center()
        .title_bar_style(TitleBarStyle::Overlay)
        .hidden_title(true)
        .background_color(PAPER)
        .build()?;
    Ok(())
}

fn open_debug_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("debug") {
        window.show()?;
        return window.set_focus();
    }
    WebviewWindowBuilder::new(app, "debug", WebviewUrl::App("debug.html".into()))
        .title("Mote Debug")
        .inner_size(600.0, 780.0)
        .min_inner_size(420.0, 420.0)
        .center()
        .title_bar_style(TitleBarStyle::Overlay)
        .hidden_title(true)
        .background_color(PAPER)
        .build()?;
    Ok(())
}

#[tauri::command]
fn open_settings(app: AppHandle) -> Result<(), String> {
    open_settings_window(&app).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_calories(app: AppHandle) -> Result<(), String> {
    open_calories_window(&app).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_debug_window(app: AppHandle, open: bool) -> Result<(), String> {
    if open {
        open_debug_window(&app).map_err(|e| e.to_string())
    } else if let Some(window) = app.get_webview_window("debug") {
        window.close().map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn set_float_on_top(app: AppHandle, on: bool) -> Result<(), String> {
    match app.get_webview_window("main") {
        Some(window) => window.set_always_on_top(on).map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

/// The window's size (and how far it was nudged up) before Mote grew it to
/// help with something, to put back afterwards.
static BEFORE_HELPING: std::sync::Mutex<Option<(f64, f64, f64)>> = std::sync::Mutex::new(None);

/// While Mote helps with files the window grows to fit the options (to at
/// least 380 × 600 points, or the size asked for, like the checkers board's),
/// moving up if it would go off the bottom of the screen. Afterwards it goes
/// back to how it was.
#[tauri::command]
fn set_helping_size(
    app: AppHandle,
    helping: bool,
    width: Option<f64>,
    height: Option<f64>,
) -> Result<(), String> {
    use tauri::{LogicalPosition, LogicalSize};
    let Some(window) = app.get_webview_window("main") else { return Ok(()) };
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    let pos = window.outer_position().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    let mut before = BEFORE_HELPING.lock().unwrap();
    if helping {
        let (w, h) = (size.width.max(width.unwrap_or(380.0)), size.height.max(height.unwrap_or(600.0)));
        if (w, h) == (size.width, size.height) {
            return Ok(());
        }
        if before.is_some() {
            // Already grown for something else: just grow a little more.
            return window.set_size(LogicalSize::new(w, h)).map_err(|e| e.to_string());
        }
        // Keep it on screen: if the bottom would hang off, move up.
        let mut lift = 0.0;
        if let Ok(Some(m)) = window.current_monitor() {
            let area = m.work_area();
            let top = area.position.to_logical::<f64>(scale).y;
            let bottom = top + area.size.to_logical::<f64>(scale).height;
            let outer = window.outer_size().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
            let chrome = outer.height - size.height;
            let new_bottom = pos.y + h + chrome;
            if new_bottom > bottom {
                lift = (new_bottom - bottom).min(pos.y - top).max(0.0);
            }
        }
        *before = Some((size.width, size.height, lift));
        window.set_size(LogicalSize::new(w, h)).map_err(|e| e.to_string())?;
        if lift > 0.0 {
            window.set_position(LogicalPosition::new(pos.x, pos.y - lift)).map_err(|e| e.to_string())?;
        }
    } else if let Some((w, h, lift)) = before.take() {
        window.set_size(LogicalSize::new(w, h)).map_err(|e| e.to_string())?;
        if lift > 0.0 {
            window.set_position(LogicalPosition::new(pos.x, pos.y + lift)).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, Some("CmdOrCtrl+,"))?;
    let about = AboutMetadata {
        name: Some("Mote".into()),
        ..Default::default()
    };
    let app_menu = Submenu::with_items(
        app,
        "Mote",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About Mote"), Some(about))?,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;
    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;
    Menu::with_items(app, &[&app_menu, &edit_menu, &window_menu])
}

fn main() {
    tauri::Builder::default()
        .manage(std::sync::Arc::new(tidy::WorkState::default()))
        .setup(|app| {
            let handle = app.handle();
            handle.set_menu(build_menu(handle)?)?;
            handle.on_menu_event(|app, event| {
                if event.id() == "settings" {
                    let _ = open_settings_window(app);
                }
            });
            // The full senses helper if it's there, otherwise the simple sound check.
            if !senses::start(handle.clone()) {
                watch_audio(handle.clone());
            }
            login::refresh();
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                match window.label() {
                    // Closing Mote himself quits the app, Settings and Debug included.
                    "main" => window.app_handle().exit(0),
                    "debug" => {
                        let _ = window.app_handle().emit("debug-window-closed", ());
                    }
                    _ => {}
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_settings,
            open_calories,
            set_debug_window,
            set_float_on_top,
            set_helping_size,
            gallery::open_local_gallery,
            gallery::gallery_status,
            gallery::gallery_check_passcode,
            gallery::gallery_set_passcode,
            gallery::gallery_turn_off_passcode,
            gallery::gallery_lock_now,
            gallery::gallery_set_hidden,
            gallery::gallery_library,
            login::login_item_enabled,
            login::set_login_item,
            links::read_dropped_link,
            links::open_link,
            tidy::work_inspect,
            tidy::work_start,
            tidy::work_cancel,
            tidy::work_preview_delete,
            tidy::work_missing,
            tidy::work_install
        ])
        .run(tauri::generate_context!())
        .expect("Mote could not start");
}
