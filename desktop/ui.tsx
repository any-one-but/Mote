import { useId, type ReactNode } from "react";
import {
  CUP,
  EAR_PATH,
  headphoneShape,
  mustacheShape,
} from "@/components/companion/accessories";
import { REST } from "@/components/companion/engine";
import { GEO, INK } from "@/lib/companion/theme";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "./ui.css";

/** A whole window: a drag strip under the traffic lights, then scrolling content. */
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="page">
      <div className="page-drag" data-tauri-drag-region />
      <main className={wide ? "page-body is-wide" : "page-body"}>{children}</main>
    </div>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="section">
      {title ? <h2 className="section-title">{title}</h2> : null}
      <div className="card">{children}</div>
    </section>
  );
}

export function Row({
  label,
  hint,
  children,
  stacked = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? "row is-stacked" : "row"}>
      <div className="row-text">
        <div className="row-label">{label}</div>
        {hint ? <div className="row-hint">{hint}</div> : null}
      </div>
      <div className="row-control">{children}</div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-thumb" />
    </button>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div
      className="segmented"
      role="radiogroup"
      aria-label={label}
      style={{ ["--n" as string]: options.length, ["--i" as string]: index }}
    >
      <span className="segmented-thumb" aria-hidden="true">
        <span key={String(value)} className="segmented-squish" />
      </span>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="segmented-option"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  label,
  min,
  max,
  step = 0.01,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (next: number) => void;
}) {
  const id = useId();
  const p = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <label htmlFor={id} className="slider-label">
        <span>{label}</span>
        <span className="mono">{value.toFixed(2)}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ["--p" as string]: `${p}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Button({
  children,
  onClick,
  tone = "plain",
  active = false,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "plain" | "accent";
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn is-${tone}${active ? " is-active" : ""}`}
      aria-pressed={active || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const HP = headphoneShape(REST, 1, 0);
const PUFFS = mustacheShape(REST, 1, 0, 0);
// Maps Mote's full-size drawing onto the mini face.
const MINI = `translate(32 30) scale(${27 / GEO.faceRx}) translate(${-GEO.cx} ${-GEO.cy})`;

/**
 * A tiny Mote that blinks now and then, hops whenever `hop` changes, and wears
 * whatever accessories are switched on.
 */
export function MiniMote({
  hop,
  headphones = false,
  mustache = false,
}: {
  hop: number;
  headphones?: boolean;
  mustache?: boolean;
}) {
  return (
    <svg key={hop} className="mini-mote" viewBox="0 0 64 60" aria-hidden="true">
      <defs>
        <filter id="mini-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="blur" />
          <feComponentTransfer in="blur" result="shape">
            <feFuncA type="linear" slope="18" intercept="-7.1" />
          </feComponentTransfer>
          <feFlood floodColor={INK} />
          <feComposite in2="shape" operator="in" />
        </filter>
      </defs>
      <ellipse cx="32" cy="57" rx="17" ry="2.4" className="mini-shadow" />
      <g className="mini-body">
        <ellipse cx="32" cy="30" rx="27" ry="25" className="mini-skin" />
        {headphones ? (
          <g className="mini-pop">
            <g transform={MINI}>
              {[HP.earL, HP.earR].map((tf, i) => (
                <path key={i} transform={tf} d={EAR_PATH} className="mini-ear" />
              ))}
              <path d={HP.band} className="mini-band" />
              {[HP.cupL, HP.cupR].map((tf, i) => (
                <rect key={i} transform={tf} className="mini-ink" width={CUP.w} height={CUP.h} rx={CUP.w / 2} />
              ))}
            </g>
          </g>
        ) : null}
        <g className="mini-eyes">
          <rect x="20.5" y="23" width="9" height="14" rx="4.5" />
          <rect x="34.5" y="23" width="9" height="14" rx="4.5" />
        </g>
        {mustache ? (
          <g className="mini-pop">
            <g transform={MINI}>
              <g filter="url(#mini-soft)" className="mini-ink">
                {PUFFS.map((p, i) => (
                  <circle key={i} cx={p.cx} cy={p.cy} r={p.r} />
                ))}
              </g>
            </g>
          </g>
        ) : null}
      </g>
    </svg>
  );
}
