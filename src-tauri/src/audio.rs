//! Finds another visible window that's playing sound, so Mote can stay awake
//! and glance at it, as if watching or listening along.
//!
//! Core Audio lists the processes currently sending sound to the speakers.
//! Sound often comes from a helper process (a browser tab, a web view), so each
//! one is traced back to the app it belongs to, and then to that app's
//! frontmost window that's actually on screen (not minimised or hidden).

use std::collections::HashSet;
use std::ffi::c_void;

use core_foundation::base::{CFType, TCFType};
use core_foundation::dictionary::{CFDictionary, CFDictionaryRef};
use core_foundation::number::CFNumber;
use core_foundation::string::CFString;
use core_graphics::window::{
    copy_window_info, kCGNullWindowID, kCGWindowBounds, kCGWindowLayer,
    kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly, kCGWindowOwnerPID,
};

#[repr(C)]
struct Address {
    selector: u32,
    scope: u32,
    element: u32,
}

#[link(name = "CoreAudio", kind = "framework")]
extern "C" {
    fn AudioObjectGetPropertyDataSize(
        object: u32,
        address: *const Address,
        qualifier_size: u32,
        qualifier: *const c_void,
        out_size: *mut u32,
    ) -> i32;
    fn AudioObjectGetPropertyData(
        object: u32,
        address: *const Address,
        qualifier_size: u32,
        qualifier: *const c_void,
        io_size: *mut u32,
        out: *mut c_void,
    ) -> i32;
}

const fn code(s: &[u8; 4]) -> u32 {
    ((s[0] as u32) << 24) | ((s[1] as u32) << 16) | ((s[2] as u32) << 8) | s[3] as u32
}

const SYSTEM_OBJECT: u32 = 1;
const SCOPE_GLOBAL: u32 = code(b"glob");
const PROCESS_LIST: u32 = code(b"prs#");
const PROCESS_PID: u32 = code(b"ppid");
const PROCESS_RUNNING_OUTPUT: u32 = code(b"piro");

fn address(selector: u32) -> Address {
    Address { selector, scope: SCOPE_GLOBAL, element: 0 }
}

fn audio_objects(object: u32, selector: u32) -> Vec<u32> {
    let addr = address(selector);
    let mut size = 0u32;
    unsafe {
        if AudioObjectGetPropertyDataSize(object, &addr, 0, std::ptr::null(), &mut size) != 0 {
            return Vec::new();
        }
        let mut out = vec![0u32; size as usize / 4];
        if AudioObjectGetPropertyData(
            object,
            &addr,
            0,
            std::ptr::null(),
            &mut size,
            out.as_mut_ptr() as *mut c_void,
        ) != 0
        {
            return Vec::new();
        }
        out.truncate(size as usize / 4);
        out
    }
}

fn audio_u32(object: u32, selector: u32) -> Option<u32> {
    let addr = address(selector);
    let mut value = 0u32;
    let mut size = 4u32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            object,
            &addr,
            0,
            std::ptr::null(),
            &mut size,
            &mut value as *mut u32 as *mut c_void,
        )
    };
    (status == 0).then_some(value)
}

/// Processes sending sound to the speakers right now.
pub fn pids_playing() -> Vec<i32> {
    audio_objects(SYSTEM_OBJECT, PROCESS_LIST)
        .into_iter()
        .filter(|&p| audio_u32(p, PROCESS_RUNNING_OUTPUT).unwrap_or(0) != 0)
        .filter_map(|p| audio_u32(p, PROCESS_PID).map(|pid| pid as i32))
        .collect()
}

/// The app that "owns" a helper process (e.g. Safari for its web content).
fn responsible_for(pid: i32) -> Option<i32> {
    type Lookup = unsafe extern "C" fn(libc::pid_t) -> libc::pid_t;
    const DEFAULT: *mut c_void = -2isize as *mut c_void;
    unsafe {
        let sym = libc::dlsym(DEFAULT, c"responsibility_get_pid_responsible_for_pid".as_ptr());
        if sym.is_null() {
            return None;
        }
        let lookup: Lookup = std::mem::transmute(sym);
        let owner = lookup(pid);
        (owner > 0).then_some(owner)
    }
}

fn parent_of(pid: i32) -> Option<i32> {
    let mut info: libc::proc_bsdinfo = unsafe { std::mem::zeroed() };
    let size = std::mem::size_of::<libc::proc_bsdinfo>() as i32;
    let got = unsafe {
        libc::proc_pidinfo(
            pid,
            libc::PROC_PIDTBSDINFO,
            0,
            &mut info as *mut _ as *mut c_void,
            size,
        )
    };
    (got == size && info.pbi_ppid > 1).then_some(info.pbi_ppid as i32)
}

fn number(dict: &CFDictionary<CFString, CFType>, key: &CFString) -> Option<f64> {
    dict.find(key)?.downcast::<CFNumber>()?.to_f64()
}

/// Centre (in screen points) of the frontmost on-screen window that belongs
/// to something playing sound, ignoring Mote's own windows.
pub fn playing_window_center() -> Option<(f64, f64)> {
    let me = std::process::id() as i32;
    let mut owners = HashSet::new();
    for pid in pids_playing() {
        owners.insert(pid);
        if let Some(owner) = responsible_for(pid) {
            owners.insert(owner);
        }
        let mut cur = pid;
        for _ in 0..4 {
            match parent_of(cur) {
                Some(parent) => {
                    owners.insert(parent);
                    cur = parent;
                }
                None => break,
            }
        }
    }
    owners.remove(&me);
    if owners.is_empty() {
        return None;
    }

    let windows = copy_window_info(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID,
    )?;
    let (k_pid, k_layer, k_bounds) = unsafe {
        (
            CFString::wrap_under_get_rule(kCGWindowOwnerPID),
            CFString::wrap_under_get_rule(kCGWindowLayer),
            CFString::wrap_under_get_rule(kCGWindowBounds),
        )
    };
    let (kx, ky, kw, kh) = (
        CFString::from_static_string("X"),
        CFString::from_static_string("Y"),
        CFString::from_static_string("Width"),
        CFString::from_static_string("Height"),
    );

    // The list runs front to back, so the first match is the one in view.
    for item in windows.iter() {
        let dict: CFDictionary<CFString, CFType> =
            unsafe { CFDictionary::wrap_under_get_rule(*item as CFDictionaryRef) };
        let pid = number(&dict, &k_pid).unwrap_or(-1.0) as i32;
        if !owners.contains(&pid) || number(&dict, &k_layer).unwrap_or(1.0) != 0.0 {
            continue;
        }
        let Some(bounds) = dict.find(&k_bounds) else { continue };
        let bounds: CFDictionary<CFString, CFType> =
            unsafe { CFDictionary::wrap_under_get_rule(bounds.as_CFTypeRef() as CFDictionaryRef) };
        let (Some(x), Some(y), Some(w), Some(h)) = (
            number(&bounds, &kx),
            number(&bounds, &ky),
            number(&bounds, &kw),
            number(&bounds, &kh),
        ) else {
            continue;
        };
        if w < 120.0 || h < 80.0 {
            continue;
        }
        return Some((x + w / 2.0, y + h / 2.0));
    }
    None
}
