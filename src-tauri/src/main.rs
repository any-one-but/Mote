// Mote for Mac: native windows around the pages in ../desktop.
mod audio;

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
fn watch_audio(app: AppHandle) {
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
        .inner_size(420.0, 800.0)
        .min_inner_size(360.0, 420.0)
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
    let mut builder =
        WebviewWindowBuilder::new(app, "debug", WebviewUrl::App("debug.html".into()))
            .title("Mote Debug")
            .inner_size(600.0, 780.0)
            .min_inner_size(420.0, 420.0)
            .title_bar_style(TitleBarStyle::Overlay)
            .hidden_title(true)
            .background_color(PAPER);
    // Open beside Mote's window so both stay in view.
    if let Some(main) = app.get_webview_window("main") {
        if let (Ok(pos), Ok(size), Ok(scale)) =
            (main.outer_position(), main.outer_size(), main.scale_factor())
        {
            let pos = pos.to_logical::<f64>(scale);
            let size = size.to_logical::<f64>(scale);
            builder = builder.position(pos.x + size.width + 16.0, pos.y);
        }
    }
    builder.build()?;
    Ok(())
}

#[tauri::command]
fn open_settings(app: AppHandle) -> Result<(), String> {
    open_settings_window(&app).map_err(|e| e.to_string())
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
        .setup(|app| {
            let handle = app.handle();
            handle.set_menu(build_menu(handle)?)?;
            handle.on_menu_event(|app, event| {
                if event.id() == "settings" {
                    let _ = open_settings_window(app);
                }
            });
            watch_audio(handle.clone());
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
            set_debug_window,
            set_float_on_top
        ])
        .run(tauri::generate_context!())
        .expect("Mote could not start");
}
