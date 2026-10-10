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

export function Face({ onEngine, onMood, onEvent, onSpeech, onSleepSet }: FaceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hooks = useRef({ onEngine, onMood, onEvent, onSpeech, onSleepSet });
  hooks.current = { onEngine, onMood, onEvent, onSpeech, onSleepSet };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const engine = startFaceEngine(svg, {
      onMood: (label) => hooks.current.onMood(label),
      onEvent: (text) => hooks.current.onEvent?.(text),
      onSpeech: (bubble) => hooks.current.onSpeech?.(bubble),
      onSleepSet: (on) => hooks.current.onSleepSet?.(on),
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

        {/* Sleep set, as simple as Mote: a band over the eyes, two round muffs. */}
        <g data-part="sleepset" style={{ display: "none" }}>
          <path className="ss-band" d="M27 128 A93 89 0 0 1 213 128" />
          <circle className="ink" cx={cx - 95} cy={GEO.eyeY + 4} r={13} />
          <circle className="ink" cx={cx + 95} cy={GEO.eyeY + 4} r={13} />
          <rect className="ink" x={cx - 66} y={GEO.eyeY - 24} width={132} height={46} rx={23} />
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

      {/* Things you drop on Mote, drawn as simply as Mote: a file page and the
          bits flying off it, a chess pawn, a game controller. */}
      <g data-part="file" style={{ display: "none" }}>
        <path className="ink" d="M-11 -14 H3 L11 -6 V14 H-11 Z" />
        <path className="prop-cut" d="M3 -14 V-6 H11" />
        <path className="prop-line" d="M-6 -1 H6 M-6 5 H6" />
      </g>
      <g data-part="bits">
        {Array.from({ length: 12 }, (_, i) => (
          <text key={i} className="bit" textAnchor="middle" style={{ display: "none" }}>
            1
          </text>
        ))}
      </g>
      <g data-part="pawn" style={{ display: "none" }}>
        <rect className="ink" x={-10} y={-5} width={20} height={5} rx={2.5} />
        <path className="ink" d="M-7 -4 L-3.5 -17 H3.5 L7 -4 Z" />
        <circle className="ink" cy={-21} r={6} />
      </g>
      <g data-part="pad" style={{ display: "none" }}>
        <rect className="ink" x={-24} y={-10} width={48} height={20} rx={10} />
        <path className="prop-line" d="M-15 0 H-7 M-11 -4 V4" />
        <circle className="prop-dot" cx={9} cy={1.5} r={2.4} />
        <circle className="prop-dot" cx={15} cy={-3} r={2.4} />
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
