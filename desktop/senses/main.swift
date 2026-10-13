// mote-senses: what Mote can notice on the rest of the screen.
//
// A small helper the Mac app starts alongside Mote. It prints lines of JSON
// to stdout:
//
// - every half second, the window Mote could be watching: the most visible
//   window whose app is making sound, and how much of it you can see; and,
//   while Mote is allowed to listen, whether it's music, its tempo, when the
//   last beat landed and how loud and lively it is
// - the pointer's position on screen, as it moves
// - while you're typing in another app, where its window is
//
// It never captures the screen. To listen it uses a Core Audio process tap on
// just the app that's playing, which needs macOS's "audio from other apps"
// permission (asked the first time, attributed to Mote): each 10 ms of sound
// is boiled down to one loudness number and thrown away, nothing is kept.
// Without listening it still knows which apps are sending sound and where
// windows are; for typing, it only knows *when* keys are pressed, never which.
//
// Mote tells it on stdin whether it may listen ("listen 1" / "listen 0"; off
// until told). `mote-senses --selftest` runs made-up music and speech through
// the beat finder.
//
// It stays clear of AppKit: anything from there signs the helper in to macOS
// as an app of its own, sharing Mote.app's name and icon, and it turned up in
// the Dock as a second Mote that bounced and never opened.

import CoreAudio
import CoreGraphics
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

/// Processes sending sound right now: Core Audio's id for each, and its pid.
func soundProcesses() -> [(id: AudioObjectID, pid: pid_t)] {
  audioIDs(AudioObjectID(kAudioObjectSystemObject), kAudioHardwarePropertyProcessObjectList).compactMap { p in
    guard audioUInt32(p, kAudioProcessPropertyIsRunningOutput) == 1,
      let pid = audioUInt32(p, kAudioProcessPropertyPID)
    else { return nil }
    return (p, pid_t(pid))
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
  /** The app's name. */
  let owner: String
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
    return Win(
      id: id, pid: pid, owner: w[kCGWindowOwnerName as String] as? String ?? "?", layer: layer, bounds: rect,
      alpha: w[kCGWindowAlpha as String] as? Double ?? 1)
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

// MARK: - Listening to the app that's playing (a Core Audio process tap)

func audioString(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector) -> String? {
  var address = AudioObjectPropertyAddress(
    mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
  var value: Unmanaged<CFString>?
  var size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
  guard AudioObjectGetPropertyData(object, &address, 0, nil, &size, &value) == noErr, let value else { return nil }
  return value.takeRetainedValue() as String
}

/// Hears some processes' sound mixed together, as 10 ms loudness frames (in
/// dB), kept for the last 8 seconds.
final class Listener {
  private(set) var processes: Set<AudioObjectID> = []
  private(set) var started = Date.distantPast
  private(set) var failed = false
  private var tap = AudioObjectID(kAudioObjectUnknown)
  private var device = AudioObjectID(kAudioObjectUnknown)
  private var proc: AudioDeviceIOProcID?
  private let queue = DispatchQueue(label: "mote.senses.listen")
  private let lock = NSLock()
  private var energy: Float = 0
  private var count = 0
  private var hopSize = 480
  private var frames: [Float] = []
  private var lastFrameAt = Date.distantPast

  var listening: Bool { !processes.isEmpty && !failed }

  func listen(to ids: Set<AudioObjectID>) {
    stop()
    processes = ids
    started = Date()
    if !start(Array(ids)) {
      failed = true
      teardown()
    }
  }

  private func start(_ ids: [AudioObjectID]) -> Bool {
    let description = CATapDescription(stereoMixdownOfProcesses: ids)
    description.uuid = UUID()
    description.isPrivate = true
    description.muteBehavior = .unmuted
    guard AudioHardwareCreateProcessTap(description, &tap) == noErr, tap != kAudioObjectUnknown else { return false }

    var format = AudioStreamBasicDescription()
    var formatSize = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
    var formatAddress = AudioObjectPropertyAddress(
      mSelector: kAudioTapPropertyFormat, mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain)
    guard AudioObjectGetPropertyData(tap, &formatAddress, 0, nil, &formatSize, &format) == noErr,
      format.mFormatID == kAudioFormatLinearPCM, format.mFormatFlags & kAudioFormatFlagIsFloat != 0,
      format.mBitsPerChannel == 32, format.mSampleRate > 0
    else { return false }
    hopSize = max(1, Int(format.mSampleRate / 100))

    // A private device that hears the tap, clocked by the speakers.
    var settings: [String: Any] = [
      kAudioAggregateDeviceNameKey: "Mote listening",
      kAudioAggregateDeviceUIDKey: UUID().uuidString,
      kAudioAggregateDeviceIsPrivateKey: true,
      kAudioAggregateDeviceIsStackedKey: false,
      kAudioAggregateDeviceTapAutoStartKey: true,
      kAudioAggregateDeviceTapListKey: [
        [kAudioSubTapUIDKey: description.uuid.uuidString, kAudioSubTapDriftCompensationKey: true]
      ],
    ]
    if let output = audioIDs(AudioObjectID(kAudioObjectSystemObject), kAudioHardwarePropertyDefaultSystemOutputDevice)
      .first, let uid = audioString(output, kAudioDevicePropertyDeviceUID)
    {
      settings[kAudioAggregateDeviceMainSubDeviceKey] = uid
      settings[kAudioAggregateDeviceSubDeviceListKey] = [[kAudioSubDeviceUIDKey: uid]]
    }
    guard AudioHardwareCreateAggregateDevice(settings as CFDictionary, &device) == noErr else { return false }
    guard
      AudioDeviceCreateIOProcIDWithBlock(&proc, device, queue, { [weak self] _, input, _, _, _ in
        self?.hear(input)
      }) == noErr, let proc
    else { return false }
    return AudioDeviceStart(device, proc) == noErr
  }

  private func hear(_ input: UnsafePointer<AudioBufferList>) {
    let list = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: input))
    guard let buffer = list.first, let data = buffer.mData else { return }
    let channels = max(1, Int(buffer.mNumberChannels))
    let n = Int(buffer.mDataByteSize) / MemoryLayout<Float>.size
    let samples = data.assumingMemoryBound(to: Float.self)
    lock.lock()
    defer { lock.unlock() }
    var i = 0
    while i + channels <= n {
      var e: Float = 0
      for c in 0..<channels { e += samples[i + c] * samples[i + c] }
      energy += e / Float(channels)
      count += 1
      i += channels
      if count >= hopSize {
        frames.append(10 * log10(energy / Float(count) + 1e-10))
        energy = 0
        count = 0
      }
    }
    if frames.count > 800 { frames.removeFirst(frames.count - 800) }
    lastFrameAt = Date()
  }

  func stop() {
    teardown()
    processes = []
    failed = false
    lock.lock()
    frames = []
    energy = 0
    count = 0
    lock.unlock()
  }

  private func teardown() {
    if device != kAudioObjectUnknown {
      if let proc {
        AudioDeviceStop(device, proc)
        AudioDeviceDestroyIOProcID(device, proc)
      }
      AudioHardwareDestroyAggregateDevice(device)
    }
    if tap != kAudioObjectUnknown { AudioHardwareDestroyProcessTap(tap) }
    proc = nil
    device = AudioObjectID(kAudioObjectUnknown)
    tap = AudioObjectID(kAudioObjectUnknown)
  }

  /// The last 8 seconds of loudness, if sound is still coming in.
  func recent() -> [Float]? {
    lock.lock()
    defer { lock.unlock() }
    return Date().timeIntervalSince(lastFrameAt) < 1.5 ? frames : nil
  }
}

// MARK: - What it sounds like: loud or quiet, music or not, and the beat

/// The average loudness of some 10 ms frames, in dB (averaged as power, not dB).
func average(_ db: ArraySlice<Float>) -> Float {
  var power: Float = 0
  for d in db { power += powf(10, d / 10) }
  return 10 * log10f(power / Float(max(db.count, 1)) + 1e-12)
}

/// Loudness frames (10 ms each, in dB) in; what it sounded like out: level,
/// pauses, beat strength, tempo, when the last beat landed, and how lively.
func analyse(_ f: [Float]) -> [String: Any] {
  guard f.count >= 100 else { return ["level": -120.0] }
  let level = average(f.suffix(100))
  var out: [String: Any] = ["level": Double(level)]
  guard f.count >= 300, level > -60 else { return out }

  // Pauses: speech has lots of short quiet gaps; most music doesn't.
  let window = Array(f.suffix(600))
  let chunks = stride(from: 0, to: window.count - 9, by: 10).map { average(window[$0..<($0 + 10)]) }
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
  guard best.lag > 0 else { return out }
  // Fine-tune between whole steps.
  var exact = Double(best.lag)
  if best.lag > 1 && best.lag < 240 {
    let a = Double(r[best.lag - 1]), b = Double(r[best.lag]), c = Double(r[best.lag + 1])
    let bend = a - 2 * b + c
    if bend < 0 { exact += 0.5 * (a - c) / bend }
  }
  var bpm = 6000 / max(exact, 1)
  // Keep it in a comfortable dancing range: very fast songs get danced at
  // half time, very slow ones at double.
  while bpm < 70 { bpm *= 2 }
  while bpm > 145 { bpm /= 2 }
  let beat = Double(r[best.lag])

  // When the last beat landed: line a comb of beats up with the onsets.
  let lag = best.lag
  var phase = 0
  var phaseScore: Float = -1
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

  // How lively: loud, a strong beat, and louder now than a few seconds ago
  // (the chorus, the drop).
  let now = average(f.suffix(150))
  let lately = average(f.suffix(600))
  let loudness = max(0, min(1, (Double(now) + 42) / 30))
  let punch = max(0, min(1, (beat - 0.15) / 0.4))
  let lift = max(-1, min(1, Double(now - lately) / 6))
  out["pauses"] = pauses
  out["beat"] = beat
  out["bpm"] = bpm
  out["beatAgo"] = Double(phase) * 0.01
  out["intensity"] = max(0, min(1, 0.6 * loudness + 0.3 * punch + 0.15 * lift))
  return out
}

/// Music if there's a steady beat without many gaps.
func isMusic(_ heard: [String: Any]) -> Bool {
  let beat = heard["beat"] as? Double ?? 0
  let pauses = heard["pauses"] as? Double ?? 1
  return beat > 0.22 && pauses < 0.3
}

/// `mote-senses --selftest`: made-up music, speech and near-silence through
/// the same analysis, to check it tells them apart and finds the tempo.
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
  func music(_ bpm: Double, _ gain: Double = 1) -> (Double) -> Double {
    let beat = 60 / bpm
    return { t in
      let k = t.truncatingRemainder(dividingBy: beat)
      let kick = k < 0.15 ? sin(2 * .pi * 60 * t) * 0.8 * exp(-k * 25) : 0
      let h = t.truncatingRemainder(dividingBy: beat / 2)
      let hat = h < 0.03 ? (rnd() - 0.5) * 0.3 : 0
      let pad = 0.15 * sin(2 * .pi * 220 * t)
      return (kick + hat + pad) * gain
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
    ("quiet music 120 bpm", music(120, 0.1)),
    ("speech", speech),
    ("near silence", { _ in (rnd() - 0.5) * 0.0002 }),
  ]
  for (name, signal) in cases {
    var heard = analyse(frames(8, signal))
    heard["music"] = isMusic(heard)
    heard["case"] = name
    emit(heard)
  }
  exit(0)
}

// MARK: - Putting it together

if CommandLine.arguments.contains("--selftest") { selftest() }
let debugging = ProcessInfo.processInfo.environment["MOTE_SENSES_DEBUG"] != nil

let me = getpid()
let mote = getppid()
let listener = Listener()
/// Whether Mote may listen (they say so on stdin).
var mayListen = false
/// What's been heard lately: music until a few seconds after the beat goes,
/// and the tempo it's settled on (a new one has to be heard twice running).
var musicUntil = Date.distantPast
var settledBpm: Double?
var newBpm: Double?
var silentSince: Date?
var restartedAt = Date.distantPast

/// Listening to the app that owns `win`, if allowed: what it sounds like,
/// for the media report.
func listen(to win: Win, among sounding: [(id: AudioObjectID, pid: pid_t)]) -> [String: Any] {
  guard mayListen else {
    if listener.listening || listener.failed { listener.stop() }
    return [:]
  }
  let ids = Set(sounding.filter { owners(of: [$0.pid]).contains(win.pid) }.map(\.id))
  let now = Date()
  // A new app playing (or a new process of its own): listen to that. (One
  // that's gone quiet stays in, it just adds silence.)
  if !ids.isEmpty && !ids.isSubset(of: listener.processes) {
    listener.listen(to: ids)
    musicUntil = .distantPast
    settledBpm = nil
    newBpm = nil
    silentSince = nil
  }
  guard listener.listening, let frames = listener.recent() else {
    return ["listening": false]
  }
  let heard = analyse(frames)
  let level = heard["level"] as? Double ?? -120
  // Dead silence for a while from something that says it's playing: the tap
  // may have started before permission was given. Start it again, now and then.
  if level <= -99 {
    if silentSince == nil { silentSince = now }
    if now.timeIntervalSince(silentSince!) > 6 && now.timeIntervalSince(restartedAt) > 15 {
      restartedAt = now
      listener.listen(to: listener.processes)
      silentSince = nil
    }
  } else {
    silentSince = nil
  }
  var out: [String: Any] = ["listening": true, "level": level]
  if level > -55 && isMusic(heard) { musicUntil = now.addingTimeInterval(3) }
  guard now < musicUntil, level > -55, let bpm = heard["bpm"] as? Double else {
    out["music"] = false
    return out
  }
  if let settled = settledBpm, abs(bpm - settled) / settled < 0.04 {
    settledBpm = settled + (bpm - settled) * 0.3
    newBpm = nil
  } else if let maybe = newBpm, abs(bpm - maybe) / maybe < 0.04 || settledBpm == nil {
    settledBpm = bpm
    newBpm = nil
  } else {
    newBpm = bpm
  }
  out["music"] = true
  out["bpm"] = settledBpm ?? bpm
  out["beatAgo"] = heard["beatAgo"]
  out["beat"] = heard["beat"]
  out["intensity"] = heard["intensity"]
  return out
}

func tick() {
  let sounding = soundProcesses()
  let playing = owners(of: sounding.map(\.pid))
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
      emit(["candidate": c.owner, "visible": share])
    }
    if target == nil || share > target!.share + 0.05 { target = (c, share) }
  }

  // A covered-up window doesn't count: Mote can't see or hear it.
  guard let (win, share) = target, share >= 0.2 else {
    if listener.listening || listener.failed { listener.stop() }
    emit(["media": NSNull()])
    return
  }
  var media: [String: Any] = [
    "x": win.bounds.midX, "y": win.bounds.midY,
    "visible": share,
    "playing": true,
    "app": win.owner,
  ]
  for (k, v) in listen(to: win, among: sounding) { media[k] = v }
  emit(["media": media])
}

// The pointer, whenever it moves, a few times a second at most.
var lastPointer = CGPoint(x: -1, y: -1)
Timer.scheduledTimer(withTimeInterval: 1.0 / 15, repeats: true) { _ in
  // Measured from the top left of the main display, like windows are.
  guard let p = CGEvent(source: nil)?.location else { return }
  if hypot(p.x - lastPointer.x, p.y - lastPointer.y) >= 3 {
    lastPointer = p
    emit(["pointer": [p.x, p.y]])
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
    // The front window is the app you're typing in.
    let win = windowsFrontToBack().first(where: {
      $0.layer == 0 && $0.bounds.width >= 120 && $0.bounds.height >= 80
    }),
    win.pid != me, win.pid != mote
  else { return }
  lastTypingReport = now
  emit(["typing": [win.bounds.midX, win.bounds.midY]])
}

Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in tick() }

// What Mote says on stdin; and quit when Mote does (it closes).
DispatchQueue.global().async {
  while let line = readLine() {
    let words = line.split(separator: " ")
    if words.first == "listen" {
      let on = words.last == "1"
      DispatchQueue.main.async { mayListen = on }
    }
  }
  exit(0)
}

RunLoop.main.run()
