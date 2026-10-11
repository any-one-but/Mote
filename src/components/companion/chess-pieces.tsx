import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK } from "@/lib/chess/rules";

// The chess pieces, drawn in a 100 × 100 box: soft, chunky shapes on a shared
// base. Yours are ink; Mote's are cream and have little eyes that look about.

const BASE = <rect x="22" y="76" width="56" height="12" rx="6" />;

const SHAPES: Record<number, React.ReactNode> = {
  [PAWN]: (
    <>
      <circle cx="50" cy="32" r="13" />
      <path d="M38 77 C38 63 43 53 46 46 L54 46 C57 53 62 63 62 77 Z" />
      <ellipse cx="50" cy="46" rx="11" ry="4" />
    </>
  ),
  [KNIGHT]: (
    <path d="M32 77 C32 65 38 58 45 54 C40 55 34 55 30 51 C27 48 27 43 31 40 L45 28 C47 22 52 17 58 15 L60 9 L65 16 C73 22 75 35 73 48 C71 61 67 69 67 77 Z" />
  ),
  [BISHOP]: (
    <>
      <circle cx="50" cy="14" r="5" />
      <path d="M50 19 C63 29 65 44 58 55 L42 55 C35 44 37 29 50 19 Z" />
      <path d="M41 77 C41 67 45 61 47 55 L53 55 C55 61 59 67 59 77 Z" />
      <ellipse cx="50" cy="55" rx="11" ry="3.5" />
    </>
  ),
  [ROOK]: (
    <>
      <path d="M31 77 L34 40 L66 40 L69 77 Z" />
      <path d="M28 41 L28 20 L37 20 L37 27 L45 27 L45 20 L55 20 L55 27 L63 27 L63 20 L72 20 L72 41 Z" />
    </>
  ),
  [QUEEN]: (
    <>
      <path d="M31 41 L25 21 L38 32 L44 15 L50 29 L56 15 L62 32 L75 21 L69 41 Z" />
      <circle cx="25" cy="20" r="4" />
      <circle cx="44" cy="14" r="4" />
      <circle cx="56" cy="14" r="4" />
      <circle cx="75" cy="20" r="4" />
      <path d="M35 77 C35 63 40 51 42 41 L58 41 C60 51 65 63 65 77 Z" />
      <ellipse cx="50" cy="41" rx="19" ry="4" />
    </>
  ),
  [KING]: (
    <>
      <rect x="46.5" y="5" width="7" height="20" rx="2" />
      <rect x="40" y="10" width="20" height="7" rx="2" />
      <path d="M35 41 C32 31 39 24 50 24 C61 24 68 31 65 41 Z" />
      <path d="M35 77 C35 63 40 51 42 41 L58 41 C60 51 65 63 65 77 Z" />
      <ellipse cx="50" cy="41" rx="17" ry="4" />
    </>
  ),
};

/** Where the eyes go on each of Mote's pieces (the knight, side-on, gets one). */
const EYES: Record<number, { y: number; x: number[] }> = {
  [PAWN]: { y: 26, x: [44.5, 55.5] },
  [KNIGHT]: { y: 23, x: [58] },
  [BISHOP]: { y: 35, x: [45, 55] },
  [ROOK]: { y: 48, x: [44.5, 55.5] },
  [QUEEN]: { y: 52, x: [44.5, 55.5] },
  [KING]: { y: 52, x: [44.5, 55.5] },
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
  return (
    <svg viewBox="0 0 100 100" className="cs-art" aria-hidden="true">
      <ellipse cx="50" cy="86" rx="30" ry="6" className="ck-shadow" />
      <g className="cs-body">
        {BASE}
        {SHAPES[type]}
      </g>
      {mote ? (
        <g className="ck-eyes cs-eyes" style={{ animationDelay: `${blinkDelay}s`, transformOrigin: `50% ${eyes.y + 6}px` }}>
          {eyes.x.map((x) =>
            shut ? (
              <path key={x} d={`M${x - 3.5} ${eyes.y + 6}h7`} className="ck-shut" />
            ) : (
              <rect key={x} x={x - 2.5 + look.x} y={eyes.y + look.y} width="5" height="11" rx="2.5" />
            ),
          )}
        </g>
      ) : type === KNIGHT ? (
        <circle cx="58" cy="28" r="3" className="cs-notch" />
      ) : null}
    </svg>
  );
}
