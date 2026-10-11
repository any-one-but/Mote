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

export function Face({ onEngine, onMood, onEvent, onSpeech, onOpenLink }: FaceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hooks = useRef({ onEngine, onMood, onEvent, onSpeech, onOpenLink });
  hooks.current = { onEngine, onMood, onEvent, onSpeech, onOpenLink };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const engine = startFaceEngine(svg, {
      onMood: (label) => hooks.current.onMood(label),
      onEvent: (text) => hooks.current.onEvent?.(text),
      onSpeech: (bubble) => hooks.current.onSpeech?.(bubble),
      onOpenLink: (url) => hooks.current.onOpenLink?.(url),
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
        <ellipse data-part="skin" cx={cx} cy={cy} rx={faceRx} ry={faceRy} className="skin" />

        {/* Spinning very fast, each eye blurs into a band along the path it
            travels round the ball. */}
        <g clipPath="url(#mote-face-clip)">
          <path data-part="spin-blur-l" className="spin-blur" style={{ display: "none" }} />
          <path data-part="spin-blur-r" className="spin-blur" style={{ display: "none" }} />
        </g>

        <g data-part="eyes" filter="url(#mote-soft)">
          {/* Each eye in its own wrapper, so it can travel round the ball. */}
          <g data-part="eye-l">
            <g mask="url(#mote-eye-l)">
              <rect className="ink" x={GEO.eyeLX - 60} y={GEO.eyeY - 72} width={120} height={144} />
            </g>
          </g>
          <g data-part="eye-r">
            <g mask="url(#mote-eye-r)">
              <rect className="ink" x={GEO.eyeRX - 60} y={GEO.eyeY - 72} width={120} height={144} />
            </g>
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
      {/* Things for games dropped on Mote, drawn as simply as Mote: a chess pawn,
          a game controller, a Minecraft block (it cracks) and a creeper (it goes off). */}
      <g data-part="block" style={{ display: "none" }}>
        <rect className="ink" x={-12} y={-12} width={24} height={24} rx={2.5} />
        <path className="prop-line" d="M-7 -12 V-8 H-2 M4 -12 V-9" />
        <path className="prop-line crack" d="M-3 -3 L1 1 L-1 5" />
        <path className="prop-line crack" d="M1 1 L6 -2 M-3 -3 L-7 -1" />
        <path className="prop-line crack" d="M-1 5 L3 9 M6 -2 L8 3" />
      </g>
      <g data-part="creeper" style={{ display: "none" }}>
        <rect className="ink" x={-12} y={-12} width={24} height={24} rx={2} />
        <rect className="prop-dot" x={-8} y={-7} width={5} height={5} />
        <rect className="prop-dot" x={3} y={-7} width={5} height={5} />
        <path
          className="prop-dot"
          d="M-2.5 -2 H2.5 V2 H4.5 V8 H1.5 V5.5 H-1.5 V8 H-4.5 V2 H-2.5 Z"
        />
      </g>
      <g data-part="boom">
        {Array.from({ length: 10 }, (_, i) => (
          <rect
            key={i}
            className="ink"
            x={-3}
            y={-3}
            width={6}
            height={6}
            style={{ display: "none" }}
          />
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
