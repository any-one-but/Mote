import type { Pose } from "@/components/companion/engine";
import { GEO } from "@/lib/companion/theme";

// Shapes for Mote's accessories, worked out from the current pose so they move
// with every expression. Both are drawn in ink, inside the body so they squash,
// stretch and lean with Mote.

const f = (n: number) => n.toFixed(2);

/* Cat-ear headphones */

// The band follows the top of the head, a little outside the face.
const BAND_RX = GEO.faceRx + 5;
const BAND_RY = GEO.faceRy + 5;
const BAND_END = (12 * Math.PI) / 180;
const EAR_AT = (58 * Math.PI) / 180;

const onBand = (angle: number) => ({
  x: GEO.cx + BAND_RX * Math.cos(angle),
  y: GEO.cy - BAND_RY * Math.sin(angle),
});

/** A soft, plump cat ear: base on the band, gently bowed sides, round tip. */
export const EAR_PATH = "M-16 3Q-12 -12 -3 -24Q0 -28 3 -24Q12 -12 16 3Z";

export const CUP = { w: 22, h: 50, y: 138, inset: 1 };

export type HeadphoneShape = {
  group: string;
  opacity: number;
  band: string;
  cupL: string;
  cupR: string;
  earL: string;
  earR: string;
};

/**
 * `presence` pops them on and off (0 → 1). `flop` is how far the ears lag
 * behind the body's movement, in degrees.
 */
export function headphoneShape(pose: Pose, presence: number, flop: number): HeadphoneShape {
  const a = onBand(Math.PI - BAND_END);
  const b = onBand(BAND_END);
  const band = `M${f(a.x)} ${f(a.y)}A${BAND_RX} ${BAND_RY} 0 0 1 ${f(b.x)} ${f(b.y)}`;

  const pulse = 1 + 0.07 * pose.cupPulse;
  const cup = (x: number) =>
    `translate(${f(x)} ${CUP.y}) scale(${f(pulse)}) translate(${-CUP.w / 2} ${-CUP.h / 2})`;

  const perk = pose.earPerk;
  const ear = (side: "l" | "r") => {
    const out = side === "l" ? -1 : 1;
    const at = onBand(side === "l" ? Math.PI - EAR_AT : EAR_AT);
    const tilt = side === "l" ? pose.earTiltL : pose.earTiltR;
    const angle = out * (28 + tilt + flop);
    const sx = 1 + 0.12 * perk;
    const sy = Math.max(0.35, 1 + 0.4 * perk);
    return `translate(${f(at.x)} ${f(at.y + 3)}) rotate(${f(angle)}) scale(${f(sx)} ${f(sy)})`;
  };

  const p = Math.max(0, presence);
  return {
    group: `translate(${GEO.cx} ${GEO.cy}) scale(${f(p)}) translate(${-GEO.cx} ${-GEO.cy})`,
    opacity: Math.min(1, p * 3),
    band,
    cupL: cup(GEO.cx - (BAND_RX - CUP.inset)),
    cupR: cup(GEO.cx + (BAND_RX - CUP.inset)),
    earL: ear("l"),
    earR: ear("r"),
  };
}

/* Bushy mustache */

// One side of the mustache as overlapping puffs, inner → outer. The left side is
// a mirror image; the soft filter melts them into a single bushy shape.
const PUFFS = [
  { x: 8, y: 0, r: 12 },
  { x: 19, y: 3, r: 12 },
  { x: 29, y: 5, r: 10.5 },
  { x: 37, y: 5, r: 8 },
  { x: 43, y: 2.5, r: 5.5 },
];
// Sits a little low so it never collides with the eyes, with a soft dip in
// the middle of its top edge.
const CENTER_PUFF = { x: 0, y: 4, r: 9 };
export const MUSTACHE_Y = 193;
export const MUSTACHE_PUFFS = 1 + PUFFS.length * 2;

export type Puff = { cx: number; cy: number; r: number };

/**
 * `t` (ms) drives the ruffle and flutter wobbles, `bounce` is how far the
 * mustache lags behind the body (viewBox units).
 */
export function mustacheShape(pose: Pose, presence: number, t: number, bounce: number) {
  const p = Math.max(0, presence);
  const puff = 1 + 0.16 * pose.mPuff;
  const spread = 1 + 0.05 * pose.mPuff;
  const out: Puff[] = [];

  const place = (x: number, y: number, r: number, side: number, s: number, i: number) => {
    let px = x * spread;
    let py = y;
    // Ends rise with a smile and droop with a frown; curl hooks the tips up.
    py -= pose.mLift * 5 * s * s;
    const hook = s * s * s * s;
    py -= pose.mCurl * 10 * hook;
    px -= pose.mCurl * 2.5 * hook;
    // A sideways twitch, like a nose wiggle, tips one side up.
    px += pose.mShift * 3.2 * side;
    py -= pose.mShift * 2.4 * s * side;
    // Ruffling and fluttering.
    const k = i * 1.7 + (side > 0 ? 0 : 3.1);
    px += pose.mRuffle * 1.7 * Math.sin(t * 0.031 + k);
    py += pose.mRuffle * 1.7 * Math.sin(t * 0.037 + k * 1.3);
    const rr = r * puff + pose.mRuffle * 1.1 * Math.sin(t * 0.043 + k);
    py -= pose.mFlutter * 5 * s * (0.5 + 0.5 * Math.sin(t * 0.028 + s * 3 + (side > 0 ? 0 : 1.6)));
    py += bounce * (0.5 + s);
    out.push({
      cx: GEO.cx + px * side * p,
      cy: MUSTACHE_Y + py * p,
      r: Math.max(0, rr * p),
    });
  };

  place(CENTER_PUFF.x, CENTER_PUFF.y, CENTER_PUFF.r, 1, 0, 0);
  for (const side of [1, -1]) {
    PUFFS.forEach((q, i) => place(q.x, q.y, q.r, side, (i + 1) / PUFFS.length, i + 1));
  }
  return out;
}
