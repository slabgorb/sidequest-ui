import { useCallback } from "react";
import type { NarratorVerbosity } from "@/types/protocol";

export interface VerbositySliderProps {
  value: NarratorVerbosity;
  onChange: (value: NarratorVerbosity) => void;
}

const VERBOSITY_OPTIONS: { value: NarratorVerbosity; label: string }[] = [
  { value: "concise", label: "Concise" },
  { value: "standard", label: "Standard" },
  { value: "verbose", label: "Verbose" },
];

/**
 * Three-position radio group for narrator verbosity control.
 *
 * Story 14-3: Per-session verbosity setting sent via SESSION_EVENT.
 */
export function VerbositySlider({ value, onChange }: VerbositySliderProps) {
  const handleChange = useCallback(
    (newValue: NarratorVerbosity) => {
      if (newValue !== value) {
        onChange(newValue);
      }
    },
    [value, onChange],
  );

  return (
    <fieldset
      role="radiogroup"
      aria-label="Narrator verbosity"
      className="flex gap-2"
    >
      {VERBOSITY_OPTIONS.map((option) => (
        <label key={option.value} className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="narrator-verbosity"
            value={option.value}
            checked={value === option.value}
            onChange={() => handleChange(option.value)}
            aria-label={option.label}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
