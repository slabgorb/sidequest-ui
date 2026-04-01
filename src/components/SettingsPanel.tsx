import { VerbositySlider } from "./VerbositySlider";
import { VocabularySlider } from "./VocabularySlider";
import type { NarratorVerbosity, NarratorVocabulary } from "@/types/protocol";

export interface SettingsPanelProps {
  verbosity: NarratorVerbosity;
  vocabulary: NarratorVocabulary;
  imageCooldown: number;
  onVerbosityChange: (value: NarratorVerbosity) => void;
  onVocabularyChange: (value: NarratorVocabulary) => void;
  onImageCooldownChange: (value: number) => void;
}

export function SettingsPanel({
  verbosity,
  vocabulary,
  imageCooldown,
  onVerbosityChange,
  onVocabularyChange,
  onImageCooldownChange,
}: SettingsPanelProps) {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">Settings</h2>

      <div className="space-y-2">
        <label className="text-sm font-medium block">Narrator Length</label>
        <VerbositySlider value={verbosity} onChange={onVerbosityChange} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium block">Narrator Vocabulary</label>
        <VocabularySlider value={vocabulary} onChange={onVocabularyChange} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium block" htmlFor="image-cooldown">
          Image Cooldown (seconds)
        </label>
        <input
          id="image-cooldown"
          type="number"
          min={0}
          max={120}
          value={imageCooldown}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 0 && v <= 120) {
              onImageCooldownChange(v);
            }
          }}
          className="w-20 border rounded px-2 py-1 text-sm bg-background"
        />
      </div>
    </div>
  );
}
