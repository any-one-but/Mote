import { GEO } from "@/lib/companion/theme";

export type Mood =
  | "settle"
  | "glance"
  | "think"
  | "frustrate"
  | "cute"
  | "delight"
  | "doze"
  | "sleep"
  | "wake";

type Pose = {
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  lookX: number;
  lookY: number;
  lookMix: number;
  open: number;
  wide: number;
  brow: number;
  browTilt: number;
  browBias: number;
  cheek: number;
  glint: number;
  wink: number;
};

export type EngineHooks = {
  pokeAt: () => number;
  onMood: (label: string | null) => void;
};

const DUR: Record<Exclude<Mood, "settle" | "sleep">, number> = {
  glance: 1600,
  think: 3000,
  frustrate: 1800,
  cute: 2300,
  delight: 1100,
  doze: 2800,
  wake: 860,
};

const BAG: Mood[] = ["glance", "glance", "glance", "think", "think", "cute", "cute", "frustrate", "doze"];

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function damp(current: number, target: number, rate: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

function smooth(u: number) {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
}

function env(u: number) {
  return Math.sin(clamp(u, 0, 1) * Math.PI);
}

function rest(): Pose {
  return {
    x: 0,
    y: 0,
    rot: 0,
    sx: 1,
    sy: 1,
    lookX: 0,
    lookY: 0,
    lookMix: 0,
    open: 1,
    wide: 1,
    brow: 0.24,
    browTilt: 0,
    browBias: 0,
    cheek: 0.42,
    glint: 1,
    wink: 0,
  };
}

function poseFor(mood: Mood, u: number, seed: number): Pose {
  const t = rest();
  const dir = seed > 0.5 ? 1 : -1;

  if (mood === "glance") {
    const e = env(u);
    const up = seed > 0.78;
    const down = seed < 0.18;
    t.lookX = dir * (up ? 0.35 : 0.95) * e;
    t.lookY = (up ? -0.7 : down ? 0.42 : -0.06) * e;
    t.lookMix = e;
    t.rot = dir * 6 * e;
    t.open = 1 + (up ? 0.06 * e : 0);
  } else if (mood === "think") {
    const hold = smooth(Math.min(1, u / 0.22)) * (u < 0.74 ? 1 : 1 - (u - 0.74) / 0.26);
    t.lookX = dir * 0.42 * hold;
    t.lookY = -0.96 * hold;
    t.lookMix = hold;
    t.brow = 0.16 + 0.86 * hold;
    t.browTilt = 0.62 * hold;
    t.browBias = dir * 0.72 * hold;
    t.open = 1 - 0.3 * hold;
    t.wide = 1 - 0.08 * hold;
    t.cheek = 0.42 - 0.3 * hold;
    t.rot = dir * 8 * hold + Math.sin(u * Math.PI * 2) * 1.3 * hold;
    t.y = -3.5 * hold;
    t.glint = 1 - 0.15 * hold;
  } else if (mood === "frustrate") {
    const slam = smooth(Math.min(1, u / 0.16));
    const hold = u < 0.72 ? slam : slam * (1 - (u - 0.72) / 0.28);
    const shake = Math.sin(u * Math.PI * 7) * 3.2 * hold * (1 - u);
    t.brow = 0.2 + 0.85 * hold;
    t.browTilt = 1 * hold;
    t.browBias = 0.08 * hold;
    t.open = 1 - 0.34 * hold;
    t.wide = 1 - 0.04 * hold;
    t.cheek = 0.42 * (1 - hold);
    t.lookY = 0.28 * hold;
    t.lookMix = hold * 0.85;
    t.rot = shake;
    t.y = 2 * hold;
    t.sy = 1 + 0.035 * hold;
    t.sx = 1 - 0.03 * hold;
    t.glint = 1 - 0.45 * hold;
  } else if (mood === "cute") {
    const k = smooth(Math.min(1, u / 0.18)) * (u < 0.76 ? 1 : 1 - (u - 0.76) / 0.24);
    const hop = Math.sin(clamp(u / 0.42, 0, 1) * Math.PI);
    const land = u > 0.42 ? Math.sin(clamp((u - 0.42) / 0.28, 0, 1) * Math.PI) : 0;
    t.open = 1 + 0.2 * k;
    t.wide = 1 + 0.1 * k;
    t.cheek = 0.42 + 0.62 * k;
    t.brow = 0.24 * (1 - 0.75 * k);
    t.browTilt = -0.42 * k;
    t.glint = 1 + 0.4 * k;
    t.y = -9 * hop + 3.2 * land;
    t.sy = 1 - 0.055 * hop + 0.05 * land;
    t.sx = 1 + 0.05 * hop - 0.04 * land;
    t.rot = dir * 5 * k;
    t.lookY = -0.12 * k;
    t.lookMix = 0.4 * k;
    const wink = u > 0.36 && u < 0.66 ? Math.sin(((u - 0.36) / 0.3) * Math.PI) : 0;
    t.wink = dir * wink;
  } else if (mood === "delight") {
    const e = env(u);
    t.open = 1 + 0.12 * e;
    t.wide = 1 + 0.06 * e;
    t.cheek = 0.42 + 0.74 * e;
    t.brow = 0.1;
    t.browTilt = -0.2 * e;
    t.glint = 1 + 0.25 * e;
    t.y = -7 * e;
    t.sy = 1 - 0.06 * e;
    t.sx = 1 + 0.055 * e;
    t.lookY = -0.18 * e;
    t.lookMix = 0.45 * e;
  } else if (mood === "doze") {
    const d = smooth(Math.min(1, u / 0.72));
    t.open = 1 - 0.18 * d;
    t.cheek = 0.42 + 0.78 * d;
    t.brow = 0.2;
    t.y = 8 * d;
    t.rot = 5 * d;
    t.lookY = 0.35 * d;
    t.lookMix = d;
    t.glint = 1 - 0.7 * d;
    t.sy = 1 + 0.02 * d;
  } else if (mood === "sleep") {
    t.open = 0.58;
    t.cheek = 1.3;
    t.brow = 0.06;
    t.y = 7;
    t.rot = 5;
    t.lookY = 0.2;
    t.lookMix = 1;
    t.glint = 0;
    t.wide = 1.02;
  } else if (mood === "wake") {
    const snap = smooth(Math.min(1, u / 0.42));
    t.open = 0.58 + 0.55 * snap;
    t.cheek = 1.3 * (1 - snap) + 0.42 * snap;
    t.brow = 0.08 + 0.1 * snap;
    t.y = 7 * (1 - snap) - 5 * env(u);
    t.rot = 5 * (1 - snap);
    t.lookY = -0.2 * env(u);
    t.lookMix = 1 - snap;
    t.glint = snap;
    t.sy = 1 - 0.04 * env(u);
    t.sx = 1 + 0.04 * env(u);
  }

  return t;
}

function q<T extends Element>(svg: SVGSVGElement, name: string) {
  return svg.querySelector(`[data-part="${name}"]`) as T | null;
}

export function startFaceEngine(svg: SVGSVGElement, hooks: EngineHooks) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = mq.matches;
  const onMq = () => {
    reduced = mq.matches;
  };
  mq.addEventListener("change", onMq);

  const parts = {
    baseL: q<SVGRectElement>(svg, "base-l"),
    baseR: q<SVGRectElement>(svg, "base-r"),
    browL: q<SVGCircleElement>(svg, "brow-l"),
    browR: q<SVGCircleElement>(svg, "brow-r"),
    cheekL: q<SVGCircleElement>(svg, "cheek-l"),
    cheekR: q<SVGCircleElement>(svg, "cheek-r"),
    glintL: q<SVGCircleElement>(svg, "glint-l"),
    glintR: q<SVGCircleElement>(svg, "glint-r"),
  };

  const pointer = { x: 0, y: 0, at: 0, has: false };
  const onMove = (e: PointerEvent) => {
    const prevX = pointer.x;
    const prevY = pointer.y;
    const dist = pointer.has ? Math.hypot(e.clientX - prevX, e.clientY - prevY) : 0;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.at = performance.now();
    pointer.has = true;
    if (dist > 80) dartUntil = performance.now() + 140;
    if (mood === "sleep" && dist > 2) start("wake", performance.now());
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  let raf = 0;
  let running = true;
  let hidden = document.hidden;
  let last = performance.now();
  let view = rest();
  let lookLX = 0;
  let lookLY = 0;
  let lookRX = 0;
  let lookRY = 0;
  let mood: Mood = "settle";
  let moodStart = performance.now();
  let moodSeed = Math.random();
  let lastAct: Mood = "glance";
  let nextAct = performance.now() + 1400;
  let lastPoke = 0;
  let blinkStart = -1;
  let blinkDouble = false;
  let nextBlink = performance.now() + 900;
  let saccade = { x: 0, y: 0, until: 0, next: performance.now() + 900 };
  let dartUntil = 0;
  let twitchStart = -1;
  let nextTwitch = performance.now() + 4000;
  let announced: string | null = null;

  const announce = (label: string | null) => {
    if (label === announced) return;
    announced = label;
    hooks.onMood(label);
  };

  const start = (next: Mood, now: number) => {
    mood = next;
    moodStart = now;
    moodSeed = Math.random();
    if (next !== "settle" && next !== "sleep") lastAct = next;
    svg.dataset.mood = next;
    if (next === "sleep") announce("Mote is sleeping. Click to wake.");
    else if (next === "wake" || next === "delight") announce(null);
    else if (next === "think") announce("Mote is thinking.");
    else if (next === "frustrate") announce("Mote is frustrated.");
    else if (next === "cute") announce("Mote is feeling cute.");
    else if (next === "settle" || next === "glance" || next === "doze") announce(null);
  };

  const pick = (): Mood => {
    const opts = BAG.filter((m) => m !== lastAct);
    return opts[Math.floor(Math.random() * opts.length)] ?? "glance";
  };

  const onVis = () => {
    hidden = document.hidden;
    if (!hidden) {
      last = performance.now();
      pointer.at = performance.now();
      if (!raf) raf = requestAnimationFrame(loop);
    }
  };
  document.addEventListener("visibilitychange", onVis);

  const place = (
    side: "l" | "r",
    eyeX: number,
    lookX: number,
    lookY: number,
    openScale: number,
    pose: Pose,
  ) => {
    const inward = side === "l" ? 1 : -1;
    const bias = side === "l" ? pose.browBias : -pose.browBias;
    const browAmt = clamp(pose.brow + bias, 0, 1.45);
    const h = Math.max(0.8, GEO.eyeH * pose.open * openScale);
    const w = GEO.eyeW * pose.wide;
    const cx = eyeX + lookX * 12;
    const cy = GEO.eyeY + lookY * 9;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const rad = Math.min(w, h) * 0.48;

    const base = side === "l" ? parts.baseL : parts.baseR;
    base?.setAttribute("x", x.toFixed(2));
    base?.setAttribute("y", y.toFixed(2));
    base?.setAttribute("width", w.toFixed(2));
    base?.setAttribute("height", h.toFixed(2));
    base?.setAttribute("rx", rad.toFixed(2));

    const browR = w * 0.8;
    const bite = h * clamp(0.1 + browAmt * 0.48, 0, 0.8);
    const slide = inward * pose.browTilt * w * 0.36;
    const brow = side === "l" ? parts.browL : parts.browR;
    brow?.setAttribute("r", browR.toFixed(2));
    brow?.setAttribute("cx", (cx + slide).toFixed(2));
    brow?.setAttribute("cy", (y - browR + bite).toFixed(2));

    const cheekAmt = clamp(pose.cheek, 0, 1.4);
    const cheekR = w * 0.92;
    const lift = h * clamp(0.04 + cheekAmt * 0.5, 0, 0.76);
    const cheek = side === "l" ? parts.cheekL : parts.cheekR;
    cheek?.setAttribute("r", cheekR.toFixed(2));
    cheek?.setAttribute("cx", (cx - inward * cheekAmt * w * 0.14).toFixed(2));
    cheek?.setAttribute("cy", (y + h + cheekR - lift).toFixed(2));

    const alive = clamp((openScale * pose.open - 0.28) / 0.45, 0, 1);
    const crescent = cheekAmt > 0.72 ? clamp((1.02 - cheekAmt) / 0.3, 0, 1) : 1;
    const gr = Math.max(0, 5 * pose.glint * alive * crescent);
    const glint = side === "l" ? parts.glintL : parts.glintR;
    glint?.setAttribute("r", gr.toFixed(2));
    glint?.setAttribute("cx", (cx - w * 0.18 + lookX * w * 0.22).toFixed(2));
    glint?.setAttribute("cy", (cy - h * 0.22 + lookY * h * 0.16).toFixed(2));
  };

  const loop = (now: number) => {
    if (!running) return;
    if (hidden) {
      raf = 0;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const poke = hooks.pokeAt();
    if (poke !== lastPoke && poke > 0) {
      lastPoke = poke;
      if (mood === "sleep") start("wake", now);
      else start("delight", now);
      blinkStart = now;
      blinkDouble = false;
      nextBlink = now + 2600 + Math.random() * 2400;
    }

    if (mood !== "sleep" && mood !== "wake" && now >= nextBlink && blinkStart < 0) {
      blinkStart = now;
      blinkDouble = Math.random() < 0.18;
    }

    let blinkAmt = 0;
    if (blinkStart >= 0 && mood !== "sleep") {
      const elapsed = now - blinkStart;
      const one = (t: number) => {
        if (t < 0) return 0;
        if (t < 70) return smooth(t / 70);
        if (t < 110) return 1;
        if (t < 230) return 1 - smooth((t - 110) / 120);
        return 0;
      };
      blinkAmt = one(elapsed);
      if (blinkDouble) blinkAmt = Math.max(blinkAmt, one(elapsed - 250));
      const done = blinkDouble ? elapsed > 520 : elapsed > 240;
      if (done) {
        blinkStart = -1;
        nextBlink = now + 2200 + Math.random() * 3400;
      }
    }

    if (mood === "sleep") {
      if (twitchStart < 0 && now >= nextTwitch) twitchStart = now;
      if (twitchStart >= 0 && now - twitchStart > 800) {
        twitchStart = -1;
        nextTwitch = now + 4200 + Math.random() * 7000;
      }
    } else {
      twitchStart = -1;
    }

    const idleFor = pointer.has ? now - pointer.at : 0;
    if (mood === "settle" && pointer.has && idleFor > 32000) start("doze", now);

    if (mood !== "settle" && mood !== "sleep") {
      const dur = DUR[mood];
      if (now >= moodStart + dur) {
        if (mood === "doze" && pointer.has && idleFor > 8000) start("sleep", now);
        else {
          start("settle", now);
          nextAct = now + 4200 + Math.random() * 4800;
        }
      }
    }

    if (mood === "settle" && now >= nextAct) {
      start(pick(), now);
    }

    const u =
      mood === "settle" || mood === "sleep" ? 0 : clamp((now - moodStart) / DUR[mood as Exclude<Mood, "settle" | "sleep">], 0, 1);
    let target = poseFor(mood, u, moodSeed);

    if (mood === "sleep") {
      const twitch =
        twitchStart >= 0 ? env(clamp((now - twitchStart) / 700, 0, 1)) : 0;
      target.cheek += twitch * 0.12;
      target.open -= twitch * 0.12;
      if (!reduced) {
        const b = Math.sin(now / 1700);
        target.sy += b * 0.012;
        target.sx -= b * 0.01;
        target.y += b * 1.1;
      }
    } else if (!reduced && (mood === "settle" || mood === "doze" || mood === "think")) {
      const b = Math.sin(now / (mood === "think" ? 700 : 920));
      target.sy += b * 0.016;
      target.sx -= b * 0.012;
      target.y += b * 1.4;
    }

    const rect = svg.getBoundingClientRect();
    let px = 0;
    let py = 0;
    if (pointer.has && rect.width > 0) {
      px = clamp((pointer.x - (rect.left + rect.width * 0.5)) / (rect.width * 0.55), -1, 1);
      py = clamp((pointer.y - (rect.top + rect.height * 0.46)) / (rect.height * 0.55), -1, 1);
    }
    const attention = !pointer.has ? 0 : idleFor < 1500 ? 1 : Math.max(0, 1 - (idleFor - 1500) / 900);
    if (now > saccade.next && (mood === "settle" || mood === "think")) {
      const big = Math.random() < 0.28;
      saccade = {
        x: (Math.random() - 0.5) * (big ? 0.7 : 0.28),
        y: (Math.random() - 0.5) * (big ? 0.45 : 0.18),
        until: now + (big ? 680 : 200),
        next: now + 1600 + Math.random() * 2600,
      };
    }
    const sacOn = now < saccade.until ? saccade : { x: 0, y: 0 };
    const autoX = attention > 0.35 ? 0 : Math.sin(now / 2600) * 0.22;
    const autoY = attention > 0.35 ? 0 : Math.sin(now / 3400) * 0.1;
    const pointerW = attention * (1 - target.lookMix);
    const autoW = (1 - target.lookMix) * (attention > 0.5 ? 0.2 : 1);
    const lx =
      px * pointerW +
      (autoX + sacOn.x) * autoW +
      target.lookX * target.lookMix;
    const ly =
      py * pointerW +
      (autoY + sacOn.y) * autoW +
      target.lookY * target.lookMix;

    if (mood === "settle" && attention > 0.65 && Math.hypot(px, py) < 0.5) {
      target.open += 0.1;
      target.cheek += 0.16;
      target.glint += 0.12;
    }

    target.rot += lx * 3.2;
    target.x += lx * 2.2;
    target.y += ly * 1.4;

    if (reduced) {
      target.x *= 0.15;
      target.y *= 0.2;
      target.rot *= 0.2;
      target.sx = 1;
      target.sy = 1;
    }

    const lookRate = now < dartUntil ? 18 : 8;
    lookLX = damp(lookLX, lx, lookRate + 2, dt);
    lookLY = damp(lookLY, ly, lookRate + 2, dt);
    lookRX = damp(lookRX, lx, lookRate, dt);
    lookRY = damp(lookRY, ly, lookRate, dt);

    const ease = (key: keyof Pose, rate: number) => {
      view[key] = damp(view[key], target[key], rate, dt);
    };
    ease("x", 6);
    ease("y", 6);
    ease("rot", 6);
    ease("sx", 7);
    ease("sy", 7);
    ease("open", 12);
    ease("wide", 8);
    ease("brow", 8);
    ease("browTilt", 7);
    ease("browBias", 7);
    ease("cheek", 8);
    ease("glint", 8);
    ease("wink", 14);
    ease("lookX", 8);
    ease("lookY", 8);

    const shutL = Math.max(blinkAmt, view.wink > 0 ? view.wink : 0);
    const shutR = Math.max(blinkAmt, view.wink < 0 ? -view.wink : 0);
    const openL = 1 - 0.94 * shutL;
    const openR = 1 - 0.94 * shutR;
    const cheekLift = blinkAmt * (view.brow > 0.65 ? 0.08 : 0.42);
    const posed: Pose = { ...view, cheek: clamp(view.cheek + cheekLift, 0, 1.4) };

    place("l", GEO.eyeLX, lookLX, lookLY, openL, posed);
    place("r", GEO.eyeRX, lookRX, lookRY, openR, posed);

    const unit = rect.width > 0 ? rect.width / GEO.vbW : 1;
    svg.style.transform = `translate(${(view.x * unit).toFixed(2)}px, ${(view.y * unit).toFixed(2)}px) rotate(${view.rot.toFixed(3)}deg) scale(${view.sx.toFixed(4)}, ${view.sy.toFixed(4)})`;

    raf = requestAnimationFrame(loop);
  };

  svg.dataset.mood = "settle";
  raf = requestAnimationFrame(loop);

  return () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("visibilitychange", onVis);
    mq.removeEventListener("change", onMq);
  };
}
