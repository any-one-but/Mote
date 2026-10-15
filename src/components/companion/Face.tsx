import { useEffect, useRef } from "react";
import {
  REST,
  eyeShape,
  ghostSheet,
  snowBody,
  startFaceEngine,
  type EngineHooks,
  type FaceEngine,
} from "@/components/companion/engine";
import { GEO, INK } from "@/lib/companion/theme";

type FaceProps = EngineHooks & {
  onEngine: (engine: FaceEngine | null) => void;
};

export function Face({ onEngine, onMood, onEvent, onSpeech, onOpenLink, onSuggestPlay }: FaceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hooks = useRef({ onEngine, onMood, onEvent, onSpeech, onOpenLink, onSuggestPlay });
  hooks.current = { onEngine, onMood, onEvent, onSpeech, onOpenLink, onSuggestPlay };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const engine = startFaceEngine(svg, {
      onMood: (label) => hooks.current.onMood(label),
      onEvent: (text) => hooks.current.onEvent?.(text),
      onSpeech: (bubble) => hooks.current.onSpeech?.(bubble),
      onOpenLink: (url) => hooks.current.onOpenLink?.(url),
      onSuggestPlay: () => hooks.current.onSuggestPlay?.(),
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
          {/* The ink colour comes from the stylesheet, so dark mode can swap it. */}
          <feFlood className="ink-flood" floodColor={INK} />
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
        {/* Ghost mode's sheet, in place of the round body. */}
        <path data-part="sheet" className="skin" d={ghostSheet()} style={{ display: "none" }} />
        {/* Snowman mode's snowball, in place of the round body. */}
        <g data-part="snow" style={{ display: "none" }}>
          <SnowBody id="mote" />
        </g>

        <g data-part="eyes" filter="url(#mote-soft)">
          <g mask="url(#mote-eye-l)">
            <rect className="ink" x={GEO.eyeLX - 60} y={GEO.eyeY - 72} width={120} height={144} />
          </g>
          <g mask="url(#mote-eye-r)">
            <rect className="ink" x={GEO.eyeRX - 60} y={GEO.eyeY - 72} width={120} height={144} />
          </g>
          {/* Eyebrows (an experimental feature): soft strokes that follow the brow cuts. */}
          <g data-part="brows" style={{ display: "none" }}>
            <path data-part="brow-l" className="brow" />
            <path data-part="brow-r" className="brow" />
          </g>
          {/* The mouth (an experimental feature): reads the face like the brows do. */}
          <path data-part="mouth" className="mouth" style={{ display: "none" }} />
        </g>

        {/* Snowman mode's smile of coal, out of the soft filter so its lumps
            show, and carrot nose (both worked out by the engine). */}
        <path data-part="coal" className="coal" style={{ display: "none" }} />
        <path data-part="nose" className="nose" style={{ display: "none" }} />

        {/* Reflection dots (an experimental feature). Masked by the eyes, so
            lids and blinks cover them; placed and tinted by the engine. */}
        <g data-part="glints" style={{ display: "none" }}>
          <g mask="url(#mote-eye-l)">
            <circle data-part="glint-l" r={0} />
          </g>
          <g mask="url(#mote-eye-r)">
            <circle data-part="glint-r" r={0} />
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
      {/* The game controller, for games dropped on Mote. */}
      <g data-part="pad" style={{ display: "none" }}>
        <rect className="ink" x={-24} y={-10} width={48} height={20} rx={10} />
        <path className="prop-line" d="M-15 0 H-7 M-11 -4 V4" />
        <circle className="prop-dot" cx={9} cy={1.5} r={2.4} />
        <circle className="prop-dot" cx={15} cy={-3} r={2.4} />
      </g>
    </svg>
  );
}

const SNOW_BODY = snowBody();

/**
 * Snowman mode's snowball: snow white, with a soft blue-grey shade round its
 * lower right (the light comes from the top left, as the eyes' glints do),
 * so it reads round without any outline.
 */
export function SnowBody({ id }: { id: string }) {
  return (
    <>
      <clipPath id={`snow-${id}`}>
        <path d={SNOW_BODY} />
      </clipPath>
      <path className="snow-shade" d={SNOW_BODY} />
      <path className="skin" d={SNOW_BODY} transform="translate(-5 -10)" clipPath={`url(#snow-${id})`} />
    </>
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
      {/* A special look's own eye (a triangle, a lump of coal), in place of the pill. */}
      <path data-part={`own-${side}`} fill="white" style={{ display: "none" }} />
      <path data-part={`lid-${side}`} fill="black" d={shape.lid} />
      <path data-part={`cheek-${side}`} fill="black" d={shape.cheek} />
    </mask>
  );
}
