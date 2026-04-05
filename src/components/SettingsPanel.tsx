import { VerbositySlider } from "./VerbositySlider";
import { VocabularySlider } from "./VocabularySlider";
import { ImagePacingSlider } from "./ImagePacingSlider";
import { LayoutModeSelector } from "./LayoutModeSelector";
import type { NarratorVerbosity, NarratorVocabulary } from "@/types/protocol";
import type { LayoutMode } from "@/hooks/useLayoutMode";

export interface SettingsPanelProps {
  verbosity: NarratorVerbosity;
  vocabulary: NarratorVocabulary;
  imageCooldown: number;
  onVerbosityChange: (value: NarratorVerbosity) => void;
  onVocabularyChange: (value: NarratorVocabulary) => void;
  onImageCooldownChange: (value: number) => void;
  layoutMode?: LayoutMode;
  onLayoutModeChange?: (mode: LayoutMode) => void;
}

export function SettingsPanel({
  verbosity,
  vocabulary,
  imageCooldown,
  onVerbosityChange,
  onVocabularyChange,
  onImageCooldownChange,
  layoutMode,
  onLayoutModeChange,
}: SettingsPanelProps) {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">Settings</h2>

      {layoutMode != null && onLayoutModeChange && (
        <div className="space-y-2">
          <label className="text-sm font-medium block">Narrative Layout</label>
          <LayoutModeSelector value={layoutMode} onChange={onLayoutModeChange} />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium block">Narrator Length</label>
        <VerbositySlider value={verbosity} onChange={onVerbosityChange} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium block">Narrator Vocabulary</label>
        <VocabularySlider value={vocabulary} onChange={onVocabularyChange} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium block">Image Cooldown</label>
        <ImagePacingSlider value={imageCooldown} onChange={onImageCooldownChange} />
      </div>
    </div>
  );
}
