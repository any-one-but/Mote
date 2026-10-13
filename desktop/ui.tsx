import { useId, type ReactNode } from "react";
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
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      disabled={disabled}
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

/** A tiny Mote that blinks now and then and hops whenever `hop` changes. */
export function MiniMote({ hop }: { hop: number }) {
  return (
    <svg key={hop} className="mini-mote" viewBox="0 0 64 60" aria-hidden="true">
      <ellipse cx="32" cy="57" rx="17" ry="2.4" className="mini-shadow" />
      <g className="mini-body">
        <ellipse cx="32" cy="30" rx="27" ry="25" className="mini-skin" />
        <g className="mini-eyes">
          <rect x="20.5" y="23" width="9" height="14" rx="4.5" />
          <rect x="34.5" y="23" width="9" height="14" rx="4.5" />
        </g>
      </g>
    </svg>
  );
}
