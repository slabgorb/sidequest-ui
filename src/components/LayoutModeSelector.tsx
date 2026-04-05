import type { LayoutMode } from "@/hooks/useLayoutMode";

export interface LayoutModeSelectorProps {
  value: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}

const MODES: { value: LayoutMode; label: string }[] = [
  { value: "scroll", label: "Scroll" },
  { value: "focus", label: "Focus" },
  { value: "cards", label: "Cards" },
];

export function LayoutModeSelector({ value, onChange }: LayoutModeSelectorProps) {
  return (
    <div className="flex gap-1 rounded-md border border-border/50 p-0.5" role="group" aria-label="Layout mode">
      {MODES.map((mode) => {
        const isActive = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            role="button"
            aria-pressed={isActive ? "true" : "false"}
            onClick={() => {
              if (!isActive) onChange(mode.value);
            }}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
