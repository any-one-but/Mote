import type { ReactNode } from "react";
import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK } from "@/lib/chess/rules";

// The chess pieces, drawn in a 100 × 100 box as solid, chunky silhouettes.
// Each piece is a few overlapping shapes drawn twice, with no outlines (see
// STYLE.md): first a little lower in a deeper tone, for the piece's
// thickness, then in its own colour on top. The collars and steps are bands
// of a nearby tone. You're white, so yours are cream; Mote's are ink and have
// little cream eyes that look about.

const BASE = (
  <>
    <rect x="24" y="79" width="52" height="10" rx="5" />
    <rect x="30" y="72" width="40" height="10" rx="4" />
  </>
);

const SHAPES: Record<number, ReactNode> = {
  [PAWN]: (
    <>
      <circle cx="50" cy="30" r="13" />
      <ellipse cx="50" cy="45" rx="13" ry="4.5" />
      <path d="M35 75 C37 61 42 53 44 46 L56 46 C58 53 63 61 65 75 Z" />
    </>
  ),
  [ROOK]: (
    <>
      <path d="M32 75 L35 43 L65 43 L68 75 Z" />
      <path d="M29 45 V20 H38 V28 H45.5 V20 H54.5 V28 H62 V20 H71 V45 Z" />
    </>
  ),
  [KNIGHT]: (
    <path d="M33 75 C33 63 39 57 45 52 C39 54 32 54 28 50 C25 47 26 41 30 38 L43 26 C45 20 50 15 56 14 L59 7 L64 14 C73 19 76 33 74 47 C73 59 68 67 68 75 Z" />
  ),
  [BISHOP]: (
    <>
      <circle cx="50" cy="13" r="5.5" />
      <path d="M50 17 C64 27 66 44 59 57 L41 57 C34 44 36 27 50 17 Z" />
      <ellipse cx="50" cy="58" rx="13" ry="4.5" />
      <path d="M38 75 C40 67 44 62 45 58 L55 58 C56 62 60 67 62 75 Z" />
    </>
  ),
  [QUEEN]: (
    <>
      <path d="M31 46 L24 22 L37 33 L43 15 L50 29 L57 15 L63 33 L76 22 L69 46 Z" />
      <circle cx="24" cy="20" r="4.5" />
      <circle cx="43" cy="13" r="4.5" />
      <circle cx="57" cy="13" r="4.5" />
      <circle cx="76" cy="20" r="4.5" />
      <ellipse cx="50" cy="46" rx="20" ry="5" />
      <path d="M33 75 C34 63 39 53 41 46 L59 46 C61 53 66 63 67 75 Z" />
    </>
  ),
  [KING]: (
    <>
      <rect x="46" y="4" width="8" height="21" rx="2.5" />
      <rect x="39" y="9" width="22" height="8" rx="2.5" />
      <path d="M33 45 C30 33 38 24 50 24 C62 24 70 33 67 45 Z" />
      <ellipse cx="50" cy="46" rx="19" ry="5" />
      <path d="M33 75 C34 63 39 53 41 46 L59 46 C61 53 66 63 67 75 Z" />
    </>
  ),
};

/** Lines drawn over the filled piece: collars, the bishop's notch, the base's step. */
const DETAILS: Record<number, string> = {
  [PAWN]: "M38 45 H62 M31 79 H69",
  [ROOK]: "M33 45 H67 M31 79 H69",
  [KNIGHT]: "M31 79 H69",
  [BISHOP]: "M56 22 L50 30 M38 58 H62 M31 79 H69",
  [QUEEN]: "M31 46 H69 M31 79 H69",
  [KING]: "M33 46 H67 M31 79 H69",
};

/** Where the eyes go on each of Mote's pieces (the knight, side-on, gets one). */
const EYES: Record<number, { y: number; x: number[] }> = {
  [PAWN]: { y: 25, x: [44.5, 55.5] },
  [KNIGHT]: { y: 22, x: [58] },
  [BISHOP]: { y: 33, x: [45.5, 54.5] },
  [ROOK]: { y: 53, x: [44.5, 55.5] },
  [QUEEN]: { y: 55, x: [45, 55] },
  [KING]: { y: 55, x: [45, 55] },
};

export function ChessPieceArt({
  piece,
  look = { x: 0, y: 0 },
  shut = false,
  blinkDelay = 0,
}: {
  /** Positive is yours, negative Mote's. */
  piece: number;
  look?: { x: number; y: number };
  shut?: boolean;
  blinkDelay?: number;
}) {
  const type = Math.abs(piece);
  const mote = piece < 0;
  const eyes = EYES[type];
  const shape = (
    <>
      {BASE}
      {SHAPES[type]}
    </>
  );
  return (
    <svg viewBox="0 0 100 100" className={`cs-art ${mote ? "is-ink" : "is-cream"}`} aria-hidden="true">
      <ellipse cx="50" cy="90" rx="30" ry="5" className="ck-shadow" />
      <g className="cs-rim" transform="translate(0 4)">
        {shape}
      </g>
      <g className="cs-fill">{shape}</g>
      <path d={DETAILS[type]} className="cs-detail" />
      {mote ? (
        <g className="ck-eyes cs-eyes" style={{ animationDelay: `${blinkDelay}s`, transformOrigin: `50% ${eyes.y + 5}px` }}>
          {eyes.x.map((x) =>
            shut ? (
              <path key={x} d={`M${x - 3.5} ${eyes.y + 5}h7`} className="ck-shut" />
            ) : (
              <rect key={x} x={x - 2.5 + look.x} y={eyes.y + look.y} width="5" height="10" rx="2.5" />
            ),
          )}
        </g>
      ) : type === KNIGHT ? (
        <circle cx="58" cy="25" r="2.8" className="cs-notch" />
      ) : null}
    </svg>
  );
}
