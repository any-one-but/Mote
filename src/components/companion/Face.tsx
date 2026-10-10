import { useEffect, useRef, type RefObject } from "react";
import { startFaceEngine } from "@/components/companion/engine";
import { GEO } from "@/lib/companion/theme";

type FaceProps = {
  pokeAt: RefObject<number>;
  onMood: (label: string | null) => void;
};

export function Face({ pokeAt, onMood }: FaceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    return startFaceEngine(svg, {
      pokeAt: () => pokeAt.current,
      onMood: (label) => onMoodRef.current(label),
    });
  }, [pokeAt]);

  const { vbW, vbH, cx, cy, faceRx, faceRy, eyeLX, eyeRX, eyeY, eyeW, eyeH } = GEO;
  const eye = (x: number) => ({
    x: x - eyeW / 2,
    y: eyeY - eyeH / 2,
  });
  const left = eye(eyeLX);
  const right = eye(eyeRX);

  return (
    <svg
      ref={svgRef}
      className="face"
      viewBox={`0 0 ${vbW} ${vbH}`}
      aria-hidden="true"
    >
      <defs>
        <EyeMask id="mote-eye-l" side="l" x={left.x} y={left.y} w={eyeW} h={eyeH} cx={eyeLX} cy={eyeY} />
        <EyeMask id="mote-eye-r" side="r" x={right.x} y={right.y} w={eyeW} h={eyeH} cx={eyeRX} cy={eyeY} />
      </defs>

      <ellipse cx={cx} cy={cy} rx={faceRx} ry={faceRy} className="skin" />

      <g mask="url(#mote-eye-l)">
        <rect className="ink" x={left.x - 16} y={left.y - 20} width={eyeW + 36} height={eyeH + 48} />
      </g>
      <g mask="url(#mote-eye-r)">
        <rect className="ink" x={right.x - 16} y={right.y - 20} width={eyeW + 36} height={eyeH + 48} />
      </g>
    </svg>
  );
}

function EyeMask({
  id,
  side,
  x,
  y,
  w,
  h,
  cx,
  cy,
}: {
  id: string;
  side: "l" | "r";
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}) {
  const inward = side === "l" ? 1 : -1;
  const browR = w * 0.8;
  const bite = h * (0.1 + 0.24 * 0.48);
  const cheekR = w * 0.92;
  const lift = h * (0.04 + 0.42 * 0.5);
  return (
    <mask id={id} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width={GEO.vbW} height={GEO.vbH}>
      <rect data-part={`base-${side}`} fill="white" x={x} y={y} width={w} height={h} rx={Math.min(w, h) * 0.48} />
      <circle data-part={`brow-${side}`} fill="black" r={browR} cx={cx} cy={y - browR + bite} />
      <circle
        data-part={`cheek-${side}`}
        fill="black"
        r={cheekR}
        cx={cx - inward * 0.42 * w * 0.14}
        cy={y + h + cheekR - lift}
      />
      <circle data-part={`glint-${side}`} fill="black" r="5" cx={cx - w * 0.18} cy={cy - h * 0.22} />
    </mask>
  );
}
