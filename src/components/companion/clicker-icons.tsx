import type { Line } from "@/lib/clicker/game";

// Little drawn pictures for Mote Clicker's shop: one for each Mac thing, and
// one for each upgrade line. Chunky solid shapes in ink, with details in the
// card's tone, so they read in both light and dark (see STYLE.md: no
// outlines; strokes only for glyph marks, thick and round-capped).

const S = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 32 32" className="mc-ic" aria-hidden="true">
    {children}
  </svg>
);

/** The pictures, in the order of THINGS. */
const THING_ART: React.ReactNode[] = [
  // Magic Mouse
  <>
    <rect className="f" x="10" y="4" width="12" height="24" rx="6" />
    <path className="d-line" d="M16 7v5" />
  </>,
  // Stickies
  <>
    <path className="f" d="M7 9a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3v9l-8 8h-8a3 3 0 0 1-3-3z" />
    <path className="d" d="M26 18h-5a3 3 0 0 0-3 3v5z" />
  </>,
  // Calculator
  <>
    <rect className="f" x="8" y="4" width="16" height="24" rx="4" />
    <rect className="d" x="11" y="7" width="10" height="5" rx="1.5" />
    <circle className="d" cx="12.5" cy="17" r="1.6" />
    <circle className="d" cx="19.5" cy="17" r="1.6" />
    <circle className="d" cx="12.5" cy="23" r="1.6" />
    <circle className="d" cx="19.5" cy="23" r="1.6" />
  </>,
  // Magic Keyboard
  <>
    <rect className="f" x="3" y="10" width="26" height="13" rx="3.5" />
    {[7, 11.5, 16, 20.5, 25].map((x) => (
      <circle key={x} className="d" cx={x} cy="14.5" r="1.3" />
    ))}
    <rect className="d" x="9" y="18" width="14" height="2.4" rx="1.2" />
  </>,
  // TextEdit
  <>
    <path className="f" d="M8 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" />
    <path className="d-line" d="M12 10h8M12 15h8M12 20h5" />
  </>,
  // Photo Booth
  <>
    <rect className="f" x="4" y="9" width="24" height="17" rx="4" />
    <rect className="f" x="11" y="6" width="10" height="5" rx="2" />
    <circle className="d" cx="16" cy="17.5" r="5" />
    <circle className="f" cx="16" cy="17.5" r="2.2" />
  </>,
  // iMac G3
  <>
    <path className="f" d="M7 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3l2 18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" />
    <rect className="d" x="10" y="7" width="12" height="10" rx="2" />
    <rect className="d" x="12" y="21" width="8" height="2.4" rx="1.2" />
  </>,
  // Chess
  <>
    <circle className="f" cx="16" cy="8.5" r="4.5" />
    <path className="f" d="M12.5 13h7l2.5 10h-12z" />
    <rect className="f" x="7" y="22" width="18" height="6" rx="3" />
  </>,
  // GarageBand
  <>
    <circle className="f" cx="11" cy="23" r="5" />
    <rect className="f" x="13.5" y="6" width="3" height="17" rx="1.5" />
    <path className="f" d="M15 5c4 0 9 2 9 7-2-2-5-3-9-3z" />
  </>,
  // MacBook Air
  <>
    <rect className="f" x="6" y="6" width="20" height="15" rx="2.5" />
    <rect className="d" x="8.5" y="8.5" width="15" height="10" rx="1" />
    <path className="f" d="M2 22h28l-2 4H4z" />
  </>,
  // Terminal
  <>
    <rect className="f" x="4" y="6" width="24" height="20" rx="4" />
    <path className="d-line" d="M9 12l4 4-4 4M15.5 20.5h6" />
  </>,
  // Mac mini
  <>
    <rect className="f" x="4" y="12" width="24" height="10" rx="3.5" />
    <circle className="d" cx="23" cy="17" r="1.3" />
  </>,
  // Automator
  <>
    <rect className="f" x="7" y="9" width="18" height="16" rx="5" />
    <path className="f-line" d="M16 9V5" />
    <circle className="f" cx="16" cy="4.5" r="2" />
    <rect className="d" x="11" y="14" width="3" height="4" rx="1.5" />
    <rect className="d" x="18" y="14" width="3" height="4" rx="1.5" />
  </>,
  // Time Machine
  <>
    <circle className="f" cx="16" cy="16" r="12" />
    <path className="d-line" d="M16 9v7l4 3" />
  </>,
  // Mac Studio
  <>
    <rect className="f" x="6" y="10" width="20" height="16" rx="4" />
    <rect className="d" x="9.5" y="20" width="2.4" height="3" rx="1" />
    <rect className="d" x="13.5" y="20" width="2.4" height="3" rx="1" />
    <rect className="d" x="20" y="20.5" width="3" height="2" rx="1" />
  </>,
  // Spotlight
  <>
    <circle className="f" cx="13.5" cy="13.5" r="8.5" />
    <circle className="d" cx="13.5" cy="13.5" r="4.5" />
    <path className="f-line is-thick" d="M20 20l6 6" />
  </>,
  // Mac Pro
  <>
    <rect className="f" x="7" y="3" width="18" height="26" rx="4" />
    {[9, 14, 19, 24].flatMap((y) =>
      [12, 16, 20].map((x) => <circle key={`${x}-${y}`} className="d" cx={x} cy={y} r="1.4" />),
    )}
  </>,
  // Finder
  <>
    <rect className="f" x="4" y="4" width="24" height="24" rx="6" />
    <path className="d" d="M16 4h6a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6h-4c-1-4-2-8-2-12z" />
    <rect className="d" x="10" y="10" width="2.4" height="5" rx="1.2" />
    <rect className="f" x="20" y="10" width="2.4" height="5" rx="1.2" />
    <path className="mix-line" d="M10 21c4 3 8 3 12 0" />
  </>,
  // Xserve
  <>
    <rect className="f" x="3" y="5" width="26" height="6" rx="2" />
    <rect className="f" x="3" y="13" width="26" height="6" rx="2" />
    <rect className="f" x="3" y="21" width="26" height="6" rx="2" />
    <circle className="d" cx="24" cy="8" r="1.2" />
    <circle className="d" cx="24" cy="16" r="1.2" />
    <circle className="d" cx="24" cy="24" r="1.2" />
  </>,
  // Apple silicon
  <>
    <path className="f-line" d="M11 3v4M16 3v4M21 3v4M11 25v4M16 25v4M21 25v4M3 11h4M3 16h4M3 21h4M25 11h4M25 16h4M25 21h4" />
    <rect className="f" x="6" y="6" width="20" height="20" rx="4" />
    <rect className="d" x="11" y="11" width="10" height="10" rx="2.5" />
  </>,
];

export function ThingIcon({ i }: { i: number }) {
  return <S>{THING_ART[i] ?? THING_ART[0]}</S>;
}

/** The picture for an upgrade line (a thing's doubling uses the thing's). */
export function LineIcon({ line, thing }: { line: Line; thing?: number }) {
  if (line === "tier" && thing !== undefined) return <ThingIcon i={thing} />;
  if (line === "trackpad")
    return (
      <S>
        <rect className="f" x="3" y="7" width="26" height="18" rx="4" />
        <circle className="d" cx="16" cy="16" r="2.4" />
      </S>
    );
  if (line === "os")
    return (
      <S>
        <rect className="f" x="3" y="5" width="26" height="22" rx="5" />
        <path className="d" d="M3 21c5-6 9-7 13-3s8 3 13-2v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z" />
        <circle className="d" cx="22" cy="11" r="2.4" />
      </S>
    );
  if (line === "eco")
    return (
      <S>
        <circle className="f" cx="11.5" cy="16" r="7.5" />
        <circle className="f" cx="20.5" cy="16" r="7.5" />
        <path className="d" d="M16 10.3a7.5 7.5 0 0 1 0 11.4a7.5 7.5 0 0 1 0-11.4z" />
      </S>
    );
  return (
    <S>
      <circle className="gold" cx="16" cy="16" r="11" />
      <rect className="gold-eye" x="11.5" y="12" width="3" height="7" rx="1.5" />
      <rect className="gold-eye" x="17.5" y="12" width="3" height="7" rx="1.5" />
    </S>
  );
}
