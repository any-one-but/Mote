import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Want } from "@/components/companion/engine";
import { SNACKS } from "@/components/companion/mind";

// The little row of buttons along the bottom of Mote's window: a toy chest
// of games (unless it's switched off), a carrot for calorie tracking (when the diet tracker is
// unlocked), a snack bowl to feed Mote (when "Mote eats too" is), and a bed
// to tuck them in (when "Goodnight Mote" is). With Local Gallery on, a
// picture frame opens it. A soft glow on a button means Mote would like that.

type Props = {
  /** The toy chest is switched on: show it. */
  games: boolean;
  /** The diet tracker is unlocked and on: show the carrot. */
  diet: boolean;
  /** Mote eats too: show the snack bowl. */
  hunger: boolean;
  /** Goodnight Mote: show the bed. */
  sleepNeed: boolean;
  /** Local Gallery: show its button. */
  gallery: boolean;
  onGallery: () => void;
  asleep: boolean;
  wants: Want | null;
  onGame: (game: "checkers" | "chess" | "tictactoe" | "liarsdice") => void;
  onLogCalories: () => void;
  onDays: () => void;
  onFeed: (snack: string) => void;
  onBed: () => void;
};

type MenuId = "toys" | "carrot" | "snack";

export function Toolbar({
  games,
  diet,
  hunger,
  sleepNeed,
  gallery,
  onGallery,
  asleep,
  wants,
  onGame,
  onLogCalories,
  onDays,
  onFeed,
  onBed,
}: Props) {
  const [open, setOpen] = useState<MenuId | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (e.target instanceof Node && root.current?.contains(e.target)) return;
      setOpen(null);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  const choose = (fn: () => void) => () => {
    setOpen(null);
    fn();
  };

  const toggle = (id: MenuId) => setOpen((o) => (o === id ? null : id));

  return (
    <div className={`toolbar${open ? " is-open" : ""}`} ref={root}>
      {games ? (
        <ToolButton
          label="Games"
          open={open === "toys"}
          glow={wants === "play"}
          onClick={() => toggle("toys")}
          icon={<ChestIcon />}
        >
          <MenuItem onClick={choose(() => onGame("checkers"))}>Checkers</MenuItem>
          <MenuItem onClick={choose(() => onGame("chess"))}>Chess</MenuItem>
          <MenuItem onClick={choose(() => onGame("tictactoe"))}>Tic-tac-toe</MenuItem>
          <MenuItem onClick={choose(() => onGame("liarsdice"))}>Liar’s Dice</MenuItem>
        </ToolButton>
      ) : null}
      {diet ? (
        <ToolButton
          label="Calories"
          open={open === "carrot"}
          onClick={() => toggle("carrot")}
          icon={<CarrotIcon />}
        >
          <MenuItem onClick={choose(onLogCalories)}>Log calories</MenuItem>
          <MenuItem onClick={choose(onDays)}>See the days</MenuItem>
        </ToolButton>
      ) : null}
      {hunger ? (
        <ToolButton
          label={asleep ? "Mote is asleep" : "Give Mote a snack"}
          open={open === "snack"}
          glow={wants === "food"}
          disabled={asleep}
          onClick={() => toggle("snack")}
          icon={<BowlIcon />}
        >
          {SNACKS.map((s) => (
            <MenuItem key={s.id} onClick={choose(() => onFeed(s.id))}>
              {s.name}
            </MenuItem>
          ))}
        </ToolButton>
      ) : null}
      {gallery ? (
        <ToolButton
          label="Open Local Gallery"
          onClick={() => {
            setOpen(null);
            onGallery();
          }}
          icon={<FrameIcon />}
        />
      ) : null}
      {sleepNeed ? (
        <ToolButton
          label={asleep ? "Wake Mote" : "Tuck Mote in"}
          glow={wants === "sleep"}
          onClick={() => {
            setOpen(null);
            onBed();
          }}
          icon={asleep ? <SunIcon /> : <MoonIcon />}
        />
      ) : null}
    </div>
  );
}

function ToolButton({
  label,
  icon,
  open = false,
  glow = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  icon: ReactNode;
  open?: boolean;
  glow?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="tool">
      <button
        type="button"
        className={`tool-btn${open ? " is-open" : ""}${glow ? " is-wanted" : ""}`}
        aria-label={label}
        title={label}
        aria-haspopup={children ? "menu" : undefined}
        aria-expanded={children ? open : undefined}
        disabled={disabled}
        onClick={onClick}
      >
        {icon}
      </button>
      {open && children ? (
        <div className="tool-menu" role="menu">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick}>
      {children}
    </button>
  );
}

// Icons, drawn on a 24 × 24 grid in Mote's ink with a touch of colour.

function ChestIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tool-icon">
      <path d="M4 11h16v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5Z" className="i-fill-warm" />
      <path d="M4 11c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6Z" className="i-fill-warm-deep" />
      <path d="M4 11h16v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5ZM4 11c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6" className="i-line" />
      <rect x="10.5" y="10" width="3" height="4" rx="1" className="i-fill-ink" />
    </svg>
  );
}

function CarrotIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tool-icon">
      <path d="M15.5 8.5c-1.6-1.6-4-1.4-5.5.1L4.3 18.9c-.6 1 .5 2.1 1.5 1.5l10.3-5.7c1.5-1.5 1.7-3.9.1-5.5Z" className="i-fill-carrot" />
      <path d="M15.5 8.5c-1.6-1.6-4-1.4-5.5.1L4.3 18.9c-.6 1 .5 2.1 1.5 1.5l10.3-5.7c1.5-1.5 1.7-3.9.1-5.5ZM9 12l1.6 1.6M7.4 15l1.3 1.3" className="i-line" />
      <path d="M15.5 8.5 19 5M15.5 8.5c.4-1.8 1.6-3.6 3.5-4.5M15.5 8.5c1.8-.4 3.6-1.6 4.5-3.5" className="i-leaf" />
    </svg>
  );
}

function BowlIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tool-icon">
      <circle cx="9.5" cy="9" r="2.2" className="i-fill-berry" />
      <circle cx="13.8" cy="8.2" r="2.2" className="i-fill-berry" />
      <circle cx="12" cy="10.6" r="2.2" className="i-fill-berry" />
      <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0Z" className="i-fill-warm" />
      <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0ZM9 20h6" className="i-line" />
    </svg>
  );
}

function FrameIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tool-icon">
      <rect x="3.5" y="5" width="17" height="14" rx="2" className="i-fill-sky" />
      <path d="M3.5 16.5 9 11.5l4 3.5 2.5-2 5 4" className="i-fill-hill" />
      <circle cx="15.5" cy="9.5" r="1.6" className="i-fill-sun" />
      <rect x="3.5" y="5" width="17" height="14" rx="2" className="i-line" />
    </svg>
  );
}


function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tool-icon">
      <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" className="i-fill-moon" />
      <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" className="i-line" />
      <path d="M16 4.5h3l-3 3.5h3" className="i-line i-thin" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tool-icon">
      <circle cx="12" cy="12" r="4.2" className="i-fill-sun" />
      <circle cx="12" cy="12" r="4.2" className="i-line" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" className="i-line" />
    </svg>
  );
}
