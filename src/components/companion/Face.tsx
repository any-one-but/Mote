import { useEffect, useRef } from "react";
import {
  REST,
  eyeShape,
  startFaceEngine,
  type EngineHooks,
  type FaceEngine,
} from "@/components/companion/engine";
import { GEO, INK } from "@/lib/companion/theme";

type FaceProps = EngineHooks & {
  onEngine: (engine: FaceEngine | null) => void;
};

export function Face({ onEngine, onMood, onEvent }: FaceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hooks = useRef({ onEngine, onMood, onEvent });
  hooks.current = { onEngine, onMood, onEvent };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const engine = startFaceEngine(svg, {
      onMood: (label) => hooks.current.onMood(label),
      onEvent: (text) => hooks.current.onEvent?.(text),
    });
    hooks.current.onEngine(engine);
    return () => {
      hooks.current.onEngine(null);
      engine.destroy();
    };
  }, []);

  const { vbW, vbH, cx, cy, faceRx, faceRy } = GEO;

  return (
    <svg ref={svgRef} className="face" viewBox={`0 0 ${vbW} ${vbH}`} aria-hidden="true">
      <defs>
        {/* Rounds every corner where a cut meets the pill, so shapes stay soft. */}
        <filter
          id="mote-soft"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="blur" />
          <feComponentTransfer in="blur" result="shape">
            <feFuncA type="linear" slope="18" intercept="-7.1" />
          </feComponentTransfer>
          <feFlood floodColor={INK} />
          <feComposite in2="shape" operator="in" />
        </filter>
        <clipPath id="mote-face-clip">
          <ellipse cx={cx} cy={cy} rx={faceRx} ry={faceRy} />
        </clipPath>
        <Eye side="l" />
        <Eye side="r" />
      </defs>

      <ellipse
        data-part="shadow"
        className="shadow"
        cx={cx}
        cy={GEO.shadowY}
        rx={GEO.shadowRx}
        ry={GEO.shadowRy}
      />

      <g data-part="body">
        <ellipse cx={cx} cy={cy} rx={faceRx} ry={faceRy} className="skin" />
        <g data-part="eyes" filter="url(#mote-soft)">
          <g mask="url(#mote-eye-l)">
            <rect className="ink" x={GEO.eyeLX - 60} y={GEO.eyeY - 72} width={120} height={144} />
          </g>
          <g mask="url(#mote-eye-r)">
            <rect className="ink" x={GEO.eyeRX - 60} y={GEO.eyeY - 72} width={120} height={144} />
          </g>
        </g>

        {/* Debug only: outlines of the pills and the brow / cheek cuts. */}
        <g data-part="guides" className="guides" clipPath="url(#mote-face-clip)">
          {(["l", "r"] as const).map((side) => (
            <g key={side}>
              <path data-part={`guide-lid-${side}`} className="guide-lid" />
              <path data-part={`guide-cheek-${side}`} className="guide-cheek" />
              <rect data-part={`guide-pill-${side}`} className="guide-pill" />
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}

function Eye({ side }: { side: "l" | "r" }) {
  const shape = eyeShape(side, REST, 0, 0, 0);
  const { pill } = shape;
  return (
    <mask
      id={`mote-eye-${side}`}
      maskUnits="userSpaceOnUse"
      maskContentUnits="userSpaceOnUse"
      x="0"
      y="0"
      width={GEO.vbW}
      height={GEO.vbH}
    >
      <rect
        data-part={`pill-${side}`}
        fill="white"
        x={pill.x}
        y={pill.y}
        width={pill.w}
        height={pill.h}
        rx={pill.r}
      />
      <path data-part={`lid-${side}`} fill="black" d={shape.lid} />
      <path data-part={`cheek-${side}`} fill="black" d={shape.cheek} />
    </mask>
  );
}
