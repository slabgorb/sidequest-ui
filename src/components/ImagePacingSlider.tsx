import { useCallback } from "react";

export interface ImagePacingSliderProps {
  value: number;
  onChange: (value: number) => void;
}

/**
 * Range slider for image generation cooldown (seconds).
 *
 * Story 14-6: Per-session image pacing throttle sent via SESSION_EVENT.
 * Range: 0 (off) to 120s, step 5.
 */
export function ImagePacingSlider({ value, onChange }: ImagePacingSliderProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange],
  );

  const displayValue = value === 0 ? "Off" : `${value}s`;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="image-pacing-slider" className="sr-only">
        Image pacing cooldown
      </label>
      <input
        id="image-pacing-slider"
        type="range"
        role="slider"
        aria-label="Image pacing cooldown"
        min={0}
        max={120}
        step={5}
        value={value}
        onChange={handleChange}
      />
      <span aria-live="polite">{displayValue}</span>
    </div>
  );
}
