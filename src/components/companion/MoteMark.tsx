import { GEO } from "@/lib/companion/theme";
import { lookOf, useSettings } from "@/lib/companion/settings";
import {
  LOOK_HAS_MOUTH,
  REST,
  eyeShape,
  lookBody,
  lookEye,
  lookMouth,
  lookPose,
  type Look,
} from "@/components/companion/engine";

// Mote in miniature, for game pieces and marks (a checker, a tic-tac-toe
// mark): their whole look, body, eyes and (if the look has one) mouth, drawn
// from the very shapes the real Mote is, just smaller. So a jack-o'-lantern's
// pieces are little jack-o'-lanterns, a ghost's are little ghosts, and any
// look added later reaches the pieces with no work here (see LOOK_HAS_MOUTH).

/** Mote's face at rest, worked out once per look. */
const faces = new Map<Look, { body: string | null; eyes: Array<{ x: number; y: number; d: string }>; mouth: string | null }>();

function faceOf(look: Look) {
  let face = faces.get(look);
  if (!face) {
    const pose = lookPose(look, REST);
    const eyes = (["l", "r"] as const).map((side) => {
      const { pill } = eyeShape(side, pose, 0, 0, 0);
      const d =
        lookEye(look, pill, side) ??
        `M${pill.x + pill.r} ${pill.y}h${pill.w - 2 * pill.r}a${pill.r} ${pill.r} 0 0 1 ${pill.r} ${pill.r}v${pill.h - 2 * pill.r}a${pill.r} ${pill.r} 0 0 1 ${-pill.r} ${pill.r}h${2 * pill.r - pill.w}a${pill.r} ${pill.r} 0 0 1 ${-pill.r} ${-pill.r}v${2 * pill.r - pill.h}a${pill.r} ${pill.r} 0 0 1 ${pill.r} ${-pill.r}Z`;
      return { x: pill.x + pill.w / 2, y: pill.y + pill.h / 2, d };
    });
    face = { body: lookBody(look), eyes, mouth: LOOK_HAS_MOUTH[look] ? lookMouth(look, REST, 0, 0) : null };
    faces.set(look, face);
  }
  return face;
}

export function MoteMark({
  look,
  cx,
  cy,
  r,
  drop,
  gaze = { x: 0, y: 0 },
  shut = false,
  blinkDelay = 0,
}: {
  look: Look;
  /** Where the middle goes, and how far it reaches either side (piece units). */
  cx: number;
  cy: number;
  r: number;
  /** How far below the rim sits: the piece's thickness, in a deeper tone. */
  drop: number;
  /** Where the eyes look (piece units). */
  gaze?: { x: number; y: number };
  /** Eyes closed (a piece that's been taken). */
  shut?: boolean;
  /** So each little Mote blinks at its own time (seconds). */
  blinkDelay?: number;
}) {
  const face = faceOf(look);
  const k = r / GEO.faceRx;
  const place = `translate(${cx} ${cy}) scale(${k}) translate(${-GEO.cx} ${-GEO.cy})`;
  const shape = face.body ? (
    <path d={face.body} />
  ) : (
    <ellipse cx={GEO.cx} cy={GEO.cy} rx={GEO.faceRx} ry={GEO.faceRy} />
  );
  // Eye positions in piece units, for closed eyes and for blinking about.
  const at = (p: { x: number; y: number }) => ({ x: cx + (p.x - GEO.cx) * k, y: cy + (p.y - GEO.cy) * k });
  const eyeY = at(face.eyes[0]).y;
  return (
    <g className="mote-mark">
      <g className="mm-rim" transform={`translate(0 ${drop}) ${place}`}>
        {shape}
      </g>
      <g className="mm-body" transform={place}>
        {shape}
      </g>
      <g className="mm-gaze" style={{ transform: `translate(${gaze.x}px, ${gaze.y}px)` }}>
        {shut ? (
          face.eyes.map((e) => {
            const p = at(e);
            return <path key={e.x} className="mm-shut" d={`M${p.x - r * 0.14} ${p.y}h${r * 0.28}`} />;
          })
        ) : (
          <g className="ck-eyes" style={{ animationDelay: `${blinkDelay}s`, transformOrigin: `${cx}px ${eyeY}px` }}>
            <g transform={place}>
              {face.eyes.map((e) => (
                <path key={e.x} className="mm-ink" d={e.d} />
              ))}
            </g>
          </g>
        )}
        {face.mouth ? (
          <g transform={place}>
            <path className={`mm-ink mm-mouth is-${look}`} d={face.mouth} />
          </g>
        ) : null}
      </g>
    </g>
  );
}

/** The look Mote has right now, for a game to hand to its pieces. */
export function useLook(): Look {
  const [settings] = useSettings();
  return lookOf(settings);
}

/**
 * Just one of Mote's eyes, in their look, centred on (x, y) and `h` tall: for
 * pieces with a shape of their own and Mote's eyes on it (chess pieces).
 */
export function MoteEye({ look, x, y, h, side = "l" }: { look: Look; x: number; y: number; h: number; side?: "l" | "r" }) {
  const face = faceOf(look);
  const e = face.eyes[side === "l" ? 0 : 1];
  const restH = GEO.eyeH;
  const k = h / restH;
  return <path className="mm-eye" transform={`translate(${x} ${y}) scale(${k}) translate(${-e.x} ${-e.y})`} d={e.d} />;
}
