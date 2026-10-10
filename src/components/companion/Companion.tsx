import { useRef } from "react";
import { Face } from "@/components/companion/Face";

export function Companion() {
  const pokeAt = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="window"
      aria-label="Mote"
      onPointerDown={() => {
        pokeAt.current = performance.now();
      }}
    >
      <Face
        pokeAt={pokeAt}
        onMood={(label) => {
          const button = buttonRef.current;
          if (!button) return;
          const next = label ?? "Mote";
          if (button.getAttribute("aria-label") !== next) button.setAttribute("aria-label", next);
        }}
      />
    </button>
  );
}
