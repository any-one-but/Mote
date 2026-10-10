// Mote for Mac: a native window that shows the page in ../desktop.
fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Mote could not start");
}
