// mote-senses: Mote's eyes and ears on the rest of the screen.
//
// A small helper the Mac app starts alongside Mote. Every half second it
// prints one line of JSON to stdout describing:
//
// - the media Mote could be paying attention to: the frontmost visible window
//   whose app is actually making sound, how much of it you can see, whether it
//   is music, speech or video, the music's tempo and loudness, and its title
// - where the pointer is on screen (separately, as it moves)
//
// To hear the sound and tell video from audio it uses ScreenCaptureKit on that
// one window, at a tiny 96×54 size. Nothing is recorded or saved: each frame
// and sound buffer is measured and thrown away. Without the Screen Recording
// permission it still reports which visible window is producing sound, just
// without loudness, kind, tempo or title.

import AppKit
import CoreAudio
import CoreMedia
import Foundation
import ScreenCaptureKit

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

// MARK: - Listening and watching one window

/// Measures the sound and picture of the window being watched.
final class Watcher: NSObject, SCStreamOutput, SCStreamDelegate {
  private var stream: SCStream?
  private(set) var windowID: CGWindowID = 0
  private let queue = DispatchQueue(label: "mote.senses.capture")
  private let lock = NSLock()

  // Sound: 10 ms loudness frames, kept for the last 8 seconds.
  private var hop: [Float] = []
  private var hopSize = 480
  private var frames: [Float] = []
  private var lastFrameAt = Date.distantPast
  // Picture: how much each tiny frame differs from the last.
  private var previous: [UInt8] = []
  private var motion: [Double] = []
  private(set) var started = Date.distantPast
  private(set) var failed = false

  func watch(_ window: SCWindow) {
    stop()
    windowID = window.windowID
    started = Date()
    failed = false
    let filter = SCContentFilter(desktopIndependentWindow: window)
    let config = SCStreamConfiguration()
    config.width = 96
    config.height = 54
    config.minimumFrameInterval = CMTime(value: 1, timescale: 4)
    config.queueDepth = 3
    config.showsCursor = false
    config.capturesAudio = true
    config.excludesCurrentProcessAudio = true
    config.sampleRate = 48_000
    config.channelCount = 1
    hopSize = 480
    let s = SCStream(filter: filter, configuration: config, delegate: self)
    do {
      try s.addStreamOutput(self, type: .screen, sampleHandlerQueue: queue)
      try s.addStreamOutput(self, type: .audio, sampleHandlerQueue: queue)
    } catch {
      failed = true
      return
    }
    stream = s
    s.startCapture { [weak self] error in
      if error != nil { self?.failed = true }
    }
  }

  func stop() {
    stream?.stopCapture(completionHandler: nil)
    stream = nil
    windowID = 0
    lock.lock()
    hop = []
    frames = []
    previous = []
    motion = []
    lock.unlock()
  }

  func stream(_ stream: SCStream, didStopWithError error: Error) {
    failed = true
  }

  func stream(_ stream: SCStream, didOutputSampleBuffer buffer: CMSampleBuffer, of type: SCStreamOutputType) {
    guard buffer.isValid else { return }
    if type == .audio { hear(buffer) } else if type == .screen { see(buffer) }
  }

  private func hear(_ buffer: CMSampleBuffer) {
    var blockBuffer: CMBlockBuffer?
    var list = AudioBufferList()
    let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
      buffer, bufferListSizeNeededOut: nil, bufferListOut: &list,
      bufferListSize: MemoryLayout<AudioBufferList>.size, blockBufferAllocator: nil,
      blockBufferMemoryAllocator: nil, flags: kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment,
      blockBufferOut: &blockBuffer)
    guard status == noErr, let data = list.mBuffers.mData else { return }
    let count = Int(list.mBuffers.mDataByteSize) / MemoryLayout<Float>.size
    let samples = UnsafeBufferPointer(start: data.assumingMemoryBound(to: Float.self), count: count)
    lock.lock()
    defer { lock.unlock() }
    for x in samples {
      hop.append(x)
      if hop.count >= hopSize {
        var energy: Float = 0
        for v in hop { energy += v * v }
        frames.append(10 * log10(energy / Float(hop.count) + 1e-10))
        hop.removeAll(keepingCapacity: true)
      }
    }
    if frames.count > 800 { frames.removeFirst(frames.count - 800) }
    lastFrameAt = Date()
  }

  private func see(_ buffer: CMSampleBuffer) {
    guard let image = CMSampleBufferGetImageBuffer(buffer) else { return }
    CVPixelBufferLockBaseAddress(image, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(image, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(image) else { return }
    let w = CVPixelBufferGetWidth(image), h = CVPixelBufferGetHeight(image)
    let row = CVPixelBufferGetBytesPerRow(image)
    let px = base.assumingMemoryBound(to: UInt8.self)
    var grey = [UInt8](repeating: 0, count: (w / 2) * (h / 2))
    for y in 0..<(h / 2) {
      for x in 0..<(w / 2) {
        let o = (y * 2) * row + (x * 2) * 4
        grey[y * (w / 2) + x] = UInt8((Int(px[o]) + Int(px[o + 1]) * 2 + Int(px[o + 2])) / 4)
      }
    }
    lock.lock()
    defer { lock.unlock() }
    if previous.count == grey.count {
      var diff = 0
      for i in 0..<grey.count { diff += abs(Int(grey[i]) - Int(previous[i])) }
      motion.append(Double(diff) / Double(grey.count) / 255)
      if motion.count > 24 { motion.removeFirst() }
    }
    previous = grey
  }

  /// What the last few seconds sounded and looked like.
  func read() -> [String: Any] {
    lock.lock()
    let f = frames
    let m = motion
    let fresh = Date().timeIntervalSince(lastFrameAt) < 1.5
    lock.unlock()
    return analyse(frames: f, motion: m, fresh: fresh)
  }
}

/// Loudness frames (10 ms each, in dB) and picture-change scores in; what it
/// sounded and looked like out: level, pauses, beat strength, tempo, last beat.
func analyse(frames f: [Float], motion m: [Double], fresh: Bool) -> [String: Any] {
  var out: [String: Any] = [:]

  // Moving picture: a good share of recent frames changing noticeably.
  if m.count >= 8 {
    let moving = Double(m.filter { $0 > 0.012 }.count) / Double(m.count)
    out["motion"] = moving
  }

  guard fresh, f.count >= 100 else {
    out["level"] = -120
    return out
  }
  let level = average(Array(f.suffix(100)))
  out["level"] = Double(level)
  guard f.count >= 300, level > -60 else { return out }

  // Pauses: speech has lots of short quiet gaps; most music doesn't.
  let window = Array(f.suffix(600))
  let chunks = stride(from: 0, to: window.count - 9, by: 10).map { i -> Float in
    average(Array(window[i..<(i + 10)]))
  }
  let sorted = chunks.sorted()
  let loud = sorted[Int(Double(sorted.count) * 0.8)]
  let pauses = Double(chunks.filter { $0 < loud - 18 }.count) / Double(chunks.count)

  // Beat: how regularly the loudness jumps, and how fast.
  var onset = [Float](repeating: 0, count: window.count)
  for i in 1..<window.count { onset[i] = max(0, window[i] - window[i - 1]) }
  // Soften each jump over a few frames, so beats that fall between 10 ms
  // steps still line up with each other.
  var soft = [Float](repeating: 0, count: onset.count)
  let kernel: [Float] = [1, 4, 6, 4, 1]
  for i in 2..<(onset.count - 2) {
    var sum: Float = 0
    for k in 0..<5 { sum += onset[i + k - 2] * kernel[k] }
    soft[i] = sum / 16
  }
  let mean = soft.reduce(0, +) / Float(soft.count)
  let o = soft.map { $0 - mean }
  let r0 = o.reduce(0) { $0 + $1 * $1 } + 1e-6
  // Self-similarity at each delay (in 10 ms steps), up to 2.4 s.
  var r = [Float](repeating: 0, count: 241)
  for lag in 1...240 where lag < o.count {
    var sum: Float = 0
    for i in lag..<o.count { sum += o[i] * o[i - lag] }
    r[lag] = sum / r0
  }
  // A real beat repeats: also reward a delay whose double lines up, which
  // stops a stray echo at 3/4 of the beat from winning.
  var best: (lag: Int, score: Float) = (0, 0)
  for lag in 30...120 {  // 200 → 50 beats per minute
    let score = r[lag] + 0.5 * r[min(240, lag * 2)]
    if score > best.score { best = (lag, score) }
  }
  // Fine-tune between whole steps.
  var exact = Double(best.lag)
  if best.lag > 1 && best.lag < 240 {
    let a = Double(r[best.lag - 1]), b = Double(r[best.lag]), c = Double(r[best.lag + 1])
    let bend = a - 2 * b + c
    if bend < 0 { exact += 0.5 * (a - c) / bend }
  }
  best.score = r[best.lag]
  var bpm = 6000 / max(exact, 1)
  // Keep it in a comfortable dancing range: very fast songs get danced at
  // half time, very slow ones at double.
  while bpm < 70 { bpm *= 2 }
  while bpm > 145 { bpm /= 2 }
  let beat = Double(best.score)

  // When the last beat landed: line a comb of beats up with the onsets.
  let lag = best.lag
  var phase = 0
  var phaseScore: Float = -1
  if lag > 0 {
    for p in 0..<lag {
      var s: Float = 0
      var t = onset.count - 1 - p
      while t >= 0 {
        s += onset[t]
        t -= lag
      }
      if s > phaseScore {
        phaseScore = s
        phase = p
      }
    }
  }

  out["pauses"] = pauses
  out["beat"] = beat
  out["bpm"] = bpm
  out["beatAgo"] = Double(phase) * 0.01
  out["intensity"] = Double(max(0, min(1, (level + 45) / 35)))
  return out
}

/// Video if the picture keeps moving; otherwise music if there's a steady beat
/// without many gaps, speech if it's full of short pauses.
func classify(_ heard: [String: Any]) -> String {
  let motion = heard["motion"] as? Double ?? 0
  let beat = heard["beat"] as? Double ?? 0
  let pauses = heard["pauses"] as? Double ?? 1
  if motion > 0.35 { return "video" }
  if beat > 0.22 && pauses < 0.3 { return "music" }
  if pauses >= 0.2 { return "speech" }
  return "unknown"
}

/// `mote-senses --selftest`: made-up music, speech and near-silence through
/// the same analysis, to check it tells them apart.
func selftest() {
  let rate = 48_000.0
  func frames(_ seconds: Double, _ sample: (Double) -> Double) -> [Float] {
    var out: [Float] = []
    var energy = 0.0
    let n = Int(seconds * rate)
    for i in 0..<n {
      let x = sample(Double(i) / rate)
      energy += x * x
      if (i + 1) % 480 == 0 {
        out.append(Float(10 * log10(energy / 480 + 1e-10)))
        energy = 0
      }
    }
    return out
  }
  var seed: UInt64 = 42
  func rnd() -> Double {
    seed = seed &* 6364136223846793005 &+ 1442695040888963407
    return Double(seed >> 33) / Double(1 << 31)
  }
  func music(_ bpm: Double) -> (Double) -> Double {
    let beat = 60 / bpm
    return { t in
      let k = t.truncatingRemainder(dividingBy: beat)
      let kick = k < 0.15 ? sin(2 * .pi * 60 * t) * 0.8 * exp(-k * 25) : 0
      let h = t.truncatingRemainder(dividingBy: beat / 2)
      let hat = h < 0.03 ? (rnd() - 0.5) * 0.3 : 0
      let pad = 0.15 * sin(2 * .pi * 220 * t)
      return kick + hat + pad
    }
  }
  // Speech-ish: syllables of varying length with short gaps and longer pauses.
  var plan: [(start: Double, end: Double)] = []
  var t = 0.0
  while t < 8 {
    let words = 3 + Int(rnd() * 5)
    for _ in 0..<words {
      let len = 0.12 + rnd() * 0.15
      plan.append((t, t + len))
      t += len + 0.04 + rnd() * 0.12
    }
    t += 0.35 + rnd() * 0.4
  }
  let speech: (Double) -> Double = { t in
    guard plan.contains(where: { t >= $0.start && t < $0.end }) else { return (rnd() - 0.5) * 0.001 }
    return sin(2 * .pi * (140 + 30 * sin(t * 7)) * t) * 0.3 * (0.6 + 0.4 * sin(t * 40))
  }
  let cases: [(String, (Double) -> Double)] = [
    ("music 120 bpm", music(120)),
    ("music 92 bpm", music(92)),
    ("music 140 bpm", music(140)),
    ("music 75 bpm", music(75)),
    ("speech", speech),
    ("near silence", { _ in (rnd() - 0.5) * 0.0002 }),
  ]
  for (name, signal) in cases {
    var heard = analyse(frames: frames(8, signal), motion: [], fresh: true)
    heard["kind"] = (heard["level"] as? Double ?? -120) > -55 ? classify(heard) : "silent"
    heard["case"] = name
    emit(heard)
  }
  exit(0)
}

/// The average loudness of some 10 ms frames, in dB (averaged as power, not dB).
func average(_ db: [Float]) -> Float {
  var power: Float = 0
  for d in db { power += powf(10, d / 10) }
  return 10 * log10f(power / Float(max(db.count, 1)) + 1e-12)
}

// MARK: - Putting it together

if CommandLine.arguments.contains("--selftest") { selftest() }
let debugging = ProcessInfo.processInfo.environment["MOTE_SENSES_DEBUG"] != nil

/// Apps that stop sending sound as soon as they're paused, and what they play.
let trustedPlayers: [String: String] = [
  "com.apple.Music": "music",
  "com.spotify.client": "music",
  "com.apple.podcasts": "speech",
  "com.apple.TV": "video",
]
let me = getpid()
let mote = getppid()
let watcher = Watcher()
var allowed = CGPreflightScreenCaptureAccess()
if !allowed { allowed = CGRequestScreenCaptureAccess() }
var shareable: SCShareableContent?
var shareableAt = Date.distantPast
var titles: [CGWindowID: String] = [:]

func refreshShareable() {
  guard allowed, Date().timeIntervalSince(shareableAt) > 2 else { return }
  shareableAt = Date()
  SCShareableContent.getExcludingDesktopWindows(true, onScreenWindowsOnly: true) { content, _ in
    DispatchQueue.main.async {
      shareable = content
      titles = [:]
      for w in content?.windows ?? [] { if let t = w.title, !t.isEmpty { titles[w.windowID] = t } }
    }
  }
}

func tick() {
  refreshShareable()
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
      emit(["candidate": app, "visible": share, "bounds": [c.bounds.minX, c.bounds.minY, c.bounds.width, c.bounds.height]])
    }
    if target == nil || share > target!.share + 0.05 { target = (c, share) }
  }

  guard let (win, share) = target, share >= 0.2 else {
    if watcher.windowID != 0 { watcher.stop() }
    emit(["media": NSNull(), "permission": allowed])
    return
  }

  if allowed, watcher.windowID != win.id || watcher.failed,
    let sc = shareable?.windows.first(where: { $0.windowID == win.id })
  {
    watcher.watch(sc)
  }

  var media: [String: Any] = [
    "x": win.bounds.midX, "y": win.bounds.midY,
    "w": win.bounds.width, "h": win.bounds.height,
    "visible": share,
    "app": NSRunningApplication(processIdentifier: win.pid)?.localizedName ?? NSNull(),
    "title": titles[win.id] ?? NSNull(),
  ]
  // Players that only send sound while actually playing. Their sound is
  // often copy-protected, which screen capture hears as silence, so for these
  // "sending sound" is trusted to mean "playing".
  let bundle = NSRunningApplication(processIdentifier: win.pid)?.bundleIdentifier ?? ""
  let trusted = trustedPlayers[bundle]
  if allowed && watcher.windowID == win.id && !watcher.failed {
    let heard = watcher.read()
    let level = heard["level"] as? Double ?? -120
    let audible = level > -55
    let settling = Date().timeIntervalSince(watcher.started) < 3
    if audible {
      for (k, v) in heard { media[k] = v }
    } else {
      media["level"] = level
      if let motion = heard["motion"] { media["motion"] = motion }
    }
    // Open but silent (a paused player) doesn't count as playing.
    media["playing"] = settling || audible || trusted != nil
    let heardKind = audible && !settling ? classify(heard) : "unknown"
    media["kind"] = heardKind != "unknown" ? heardKind : (trusted ?? "unknown")
    media["protected"] = !audible && trusted != nil
  } else {
    media["playing"] = true
    media["kind"] = trusted ?? "unknown"
  }
  emit(["media": media, "permission": allowed])
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
