import { useCallback } from "react";
import type { NarratorVocabulary } from "@/types/protocol";

export interface VocabularySliderProps {
  value: NarratorVocabulary;
  onChange: (value: NarratorVocabulary) => void;
}

const VOCABULARY_OPTIONS: { value: NarratorVocabulary; label: string }[] = [
  { value: "accessible", label: "Accessible" },
  { value: "literary", label: "Literary" },
  { value: "epic", label: "Epic" },
];

/**
 * Three-position radio group for narrator vocabulary/complexity control.
 *
 * Story 14-4: Per-session vocabulary setting sent via SESSION_EVENT.
 */
export function VocabularySlider({ value, onChange }: VocabularySliderProps) {
  const handleChange = useCallback(
    (newValue: NarratorVocabulary) => {
      if (newValue !== value) {
        onChange(newValue);
      }
    },
    [value, onChange],
  );

  return (
    <fieldset
      role="radiogroup"
      aria-label="Narrator vocabulary"
      className="flex gap-2"
    >
      {VOCABULARY_OPTIONS.map((option) => (
        <label key={option.value} className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="narrator-vocabulary"
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
