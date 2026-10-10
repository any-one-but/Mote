// Prints what Mote's sound watcher sees right now. Run: cargo run --example audio_probe
#[path = "../src/audio.rs"]
mod audio;

fn main() {
    println!("playing pids: {:?}", audio::pids_playing());
    println!("window centre: {:?}", audio::playing_window_center());
}
