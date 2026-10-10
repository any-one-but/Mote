// mote-senses: what Mote can notice on the rest of the screen.
//
// A small helper the Mac app starts alongside Mote. It prints lines of JSON
// to stdout:
//
// - every half second, the window Mote could be watching: the most visible
//   window whose app is making sound, and how much of it you can see
// - the pointer's position on screen, as it moves
// - while you're typing in another app, where its window is
//
// It needs no special permissions. It never captures the screen or sound: it
// only asks macOS which apps are sending sound and where windows are, and for
// typing, only *when* keys are pressed, never which.

import AppKit
import CoreAudio
import Foundation

setvbuf(stdout, nil, _IOLBF, 0)

func emit(_ object: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: object),
    let line = String(data: data, encoding: .utf8)
  else { return }
  print(line)
}

// MARK: - Which processes are making sound (Core Audio)

func audioIDs(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector) -> [AudioObjectID] {
  var address = AudioObjectPropertyAddress(
    mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
  var size: UInt32 = 0
  guard AudioObjectGetPropertyDataSize(object, &address, 0, nil, &size) == noErr else { return [] }
  var ids = [AudioObjectID](repeating: 0, count: Int(size) / MemoryLayout<AudioObjectID>.size)
  guard AudioObjectGetPropertyData(object, &address, 0, nil, &size, &ids) == noErr else { return [] }
  return ids
}

func audioUInt32(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector) -> UInt32? {
  var address = AudioObjectPropertyAddress(
    mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
  var value: UInt32 = 0
  var size = UInt32(MemoryLayout<UInt32>.size)
  guard AudioObjectGetPropertyData(object, &address, 0, nil, &size, &value) == noErr else { return nil }
  return value
}

func pidsSendingSound() -> [pid_t] {
  audioIDs(AudioObjectID(kAudioObjectSystemObject), kAudioHardwarePropertyProcessObjectList).compactMap { p in
    guard audioUInt32(p, kAudioProcessPropertyIsRunningOutput) == 1,
      let pid = audioUInt32(p, kAudioProcessPropertyPID)
    else { return nil }
    return pid_t(pid)
  }
}

// MARK: - Tracing helper processes back to the app that owns their windows

typealias ResponsibleLookup = @convention(c) (pid_t) -> pid_t
let responsibleLookup: ResponsibleLookup? = {
  guard let sym = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "responsibility_get_pid_responsible_for_pid")
  else { return nil }
  return unsafeBitCast(sym, to: ResponsibleLookup.self)
}()

func parent(of pid: pid_t) -> pid_t? {
  var info = kinfo_proc()
  var size = MemoryLayout<kinfo_proc>.size
  var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, pid]
  guard sysctl(&mib, 4, &info, &size, nil, 0) == 0, size > 0 else { return nil }
  let ppid = info.kp_eproc.e_ppid
  return ppid > 1 ? ppid : nil
}

func owners(of pids: [pid_t]) -> Set<pid_t> {
  var out = Set<pid_t>()
  for pid in pids {
    out.insert(pid)
    if let r = responsibleLookup?(pid), r > 0 { out.insert(r) }
    var cur = pid
    for _ in 0..<4 {
      guard let p = parent(of: cur) else { break }
      out.insert(p)
      cur = p
    }
  }
  return out
}

// MARK: - Windows on screen, and how much of each you can actually see

struct Win {
  let id: CGWindowID
  let pid: pid_t
  let layer: Int
  let bounds: CGRect
  let alpha: Double
}

func windowsFrontToBack() -> [Win] {
  guard
    let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
      as? [[String: Any]]
  else { return [] }
  return list.compactMap { w in
    guard let id = w[kCGWindowNumber as String] as? CGWindowID,
      let pid = w[kCGWindowOwnerPID as String] as? pid_t,
      let layer = w[kCGWindowLayer as String] as? Int,
      let b = w[kCGWindowBounds as String] as? [String: Any],
      let rect = CGRect(dictionaryRepresentation: b as CFDictionary)
    else { return nil }
    return Win(id: id, pid: pid, layer: layer, bounds: rect, alpha: w[kCGWindowAlpha as String] as? Double ?? 1)
  }
}

let displays: () -> [CGRect] = {
  var ids = [CGDirectDisplayID](repeating: 0, count: 16)
  var count: UInt32 = 0
  CGGetActiveDisplayList(16, &ids, &count)
  return ids.prefix(Int(count)).map { CGDisplayBounds($0) }
}

/// The share of a window you can see: not covered by windows in front of it
/// (other than Mote's own) and not off the edge of every display.
func visibleShare(of target: Win, among windows: [Win], ignoring ignored: Set<pid_t>) -> Double {
  let screens = displays()
  let infront = windows.prefix { $0.id != target.id }.filter {
    !ignored.contains($0.pid) && $0.alpha > 0.1 && $0.layer < 1000 && $0.bounds.width > 40 && $0.bounds.height > 40
  }
  let cols = 16, rows = 10
  var seen = 0
  for r in 0..<rows {
    for c in 0..<cols {
      let p = CGPoint(
        x: target.bounds.minX + (CGFloat(c) + 0.5) / CGFloat(cols) * target.bounds.width,
        y: target.bounds.minY + (CGFloat(r) + 0.5) / CGFloat(rows) * target.bounds.height)
      guard screens.contains(where: { $0.contains(p) }) else { continue }
      if !infront.contains(where: { $0.bounds.contains(p) }) { seen += 1 }
    }
  }
  return Double(seen) / Double(cols * rows)
}

// MARK: - Putting it together

let debugging = ProcessInfo.processInfo.environment["MOTE_SENSES_DEBUG"] != nil

/// Music apps, known by name: Mote sways along when one of these is playing.
let musicApps: Set<String> = ["com.apple.Music", "com.spotify.client"]

let me = getpid()
let mote = getppid()

func tick() {
  let playing = owners(of: pidsSendingSound())
  let mine: Set<pid_t> = [me, mote]
  let windows = windowsFrontToBack()
  let candidates = windows.filter {
    playing.contains($0.pid) && !mine.contains($0.pid) && $0.layer == 0 && $0.bounds.width >= 120
      && $0.bounds.height >= 80
  }
  // The most visible one; ties go to the frontmost.
  var target: (win: Win, share: Double)?
  for c in candidates {
    let share = visibleShare(of: c, among: windows, ignoring: mine)
    if debugging {
      let app = NSRunningApplication(processIdentifier: c.pid)?.localizedName ?? "?"
      emit(["candidate": app, "visible": share])
    }
    if target == nil || share > target!.share + 0.05 { target = (c, share) }
  }

  // A covered-up window doesn't count: Mote can't see or hear it.
  guard let (win, share) = target, share >= 0.2 else {
    emit(["media": NSNull()])
    return
  }
  let app = NSRunningApplication(processIdentifier: win.pid)
  emit([
    "media": [
      "x": win.bounds.midX, "y": win.bounds.midY,
      "visible": share,
      "playing": true,
      "app": (app?.localizedName as Any?) ?? NSNull(),
      "kind": musicApps.contains(app?.bundleIdentifier ?? "") ? "music" : "other",
    ]
  ])
}

// The pointer, whenever it moves, a few times a second at most.
var lastPointer = CGPoint(x: -1, y: -1)
let primaryHeight = NSScreen.screens.first?.frame.height ?? 0
Timer.scheduledTimer(withTimeInterval: 1.0 / 15, repeats: true) { _ in
  let p = NSEvent.mouseLocation
  let flipped = CGPoint(x: p.x, y: primaryHeight - p.y)
  if hypot(flipped.x - lastPointer.x, flipped.y - lastPointer.y) >= 3 {
    lastPointer = flipped
    emit(["pointer": [flipped.x, flipped.y]])
  }
}

// Typing: noticed from *when* keys are pressed, never which ones. macOS keeps a
// "seconds since the last key press" count for things like idle timers; each
// time it drops back toward zero, a key was pressed. While you're typing
// steadily, report where the front window is, so Mote can look over at it.
var lastKeyGap = Double.infinity
var keyTimes: [Date] = []
var lastTypingReport = Date.distantPast
Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { _ in
  let gap = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: .keyDown)
  let now = Date()
  if gap < lastKeyGap - 0.01 { keyTimes.append(now) }
  lastKeyGap = gap
  keyTimes.removeAll { now.timeIntervalSince($0) > 4 }
  guard keyTimes.count >= 4, now.timeIntervalSince(lastTypingReport) > 0.5,
    let front = NSWorkspace.shared.frontmostApplication?.processIdentifier,
    front != me, front != mote,
    let win = windowsFrontToBack().first(where: {
      $0.pid == front && $0.layer == 0 && $0.bounds.width >= 120 && $0.bounds.height >= 80
    })
  else { return }
  lastTypingReport = now
  emit(["typing": [win.bounds.midX, win.bounds.midY]])
}

Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in tick() }

// Quit when Mote does.
DispatchQueue.global().async {
  while FileHandle.standardInput.availableData.count > 0 {}
  exit(0)
}

RunLoop.main.run()
