import { useState } from "react";
import { toRoman } from "@/lib/utils";

interface CreationChoice {
  label: string;
  description: string;
}

interface RolledStat {
  name: string;
  value: number;
}

export interface CreationScene {
  phase: string;
  scene_index?: number;
  total_scenes?: number;
  prompt?: string;
  summary?: string;
  message?: string;
  choices?: CreationChoice[];
  allows_freeform?: boolean;
  input_type?: string;
  loading_text?: string;
  character_preview?: Record<string, unknown>;
  rolled_stats?: RolledStat[];
  previous_choice?: number;
  previous_input?: string;
}

export interface CharacterCreationProps {
  scene: CreationScene | null;
  loading: boolean;
  onRespond: (payload: Record<string, unknown>) => void;
}

export function CharacterCreation({ scene, loading, onRespond }: CharacterCreationProps) {
  // React idiom: reset state during render when the identifying prop changes,
  // instead of useEffect → setState (which forces an extra render). When
  // `scene_index` or `phase` change, snap the local input/selection back to
  // whatever the scene was last given. See:
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const sceneKey = scene ? `${scene.scene_index}-${scene.phase}` : null;
  const [lastSceneKey, setLastSceneKey] = useState<string | null>(sceneKey);
  const [inputValue, setInputValue] = useState(scene?.previous_input ?? "");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    scene?.previous_choice ?? null,
  );
  if (sceneKey !== lastSceneKey) {
    setLastSceneKey(sceneKey);
    setInputValue(scene?.previous_input ?? "");
    setSelectedIndex(scene?.previous_choice ?? null);
  }

  if (loading) {
    return (
      <div data-testid="character-creation">
        <div data-testid="creation-loading" role="status"
             className="flex items-center justify-center min-h-[200px]">
          <p className="text-sm italic text-muted-foreground/50 animate-pulse">
            {scene?.loading_text ?? "Considering your words..."}
          </p>
        </div>
      </div>
    );
  }

  if (!scene) {
    return <div data-testid="character-creation" />;
  }

  const handleChoice = (index: number) => {
    setSelectedIndex(index);
    onRespond({ phase: "scene", choice: String(index + 1) });
  };

  const handleFreeform = () => {
    onRespond({ phase: "scene", choice: inputValue });
    setInputValue("");
  };

  const handleName = () => {
    onRespond({ phase: "scene", choice: inputValue });
    setInputValue("");
  };

  const handleConfirm = () => {
    onRespond({ phase: "confirmation", choice: "1" });
  };

  const handleContinue = () => {
    onRespond({ phase: "continue" });
  };

  const handleBack = () => {
    onRespond({ action: "back" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scene.input_type === "name") handleName();
    else handleFreeform();
  };

  if (scene.phase === "confirmation") {
    const previewEntries = scene.character_preview
      ? Object.entries(scene.character_preview)
      : [];

    return (
      <div data-testid="character-creation" className="flex flex-col items-center px-6 py-10 gap-6 max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold tracking-tight">Your Character</h2>
        <div data-testid="character-review" className="bg-card/80 border border-border/50 rounded-lg p-6 w-full max-w-lg space-y-3">
          <div className="text-xs tracking-widest uppercase text-muted-foreground/60 mb-4">Character Sheet</div>
          {previewEntries.length > 0 ? (
            previewEntries.map(([key, value], index) => (
              <div
                key={key}
                data-testid={`review-section-${key}`}
                className="flex items-center justify-between py-2 border-b border-border/20 last:border-0"
              >
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground/60">{key}</span>
                  <p className="text-sm text-card-foreground">{String(value)}</p>
                </div>
                <button
                  onClick={() => onRespond({ action: "edit", targetStep: index })}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
                  aria-label={`Edit ${key}`}
                >
                  Edit
                </button>
              </div>
            ))
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-card-foreground font-sans">{scene.summary}</div>
          )}
        </div>
        <p className="text-base italic text-foreground/80 max-w-prose">{scene.message}</p>
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            className="inline-flex items-center justify-center rounded-lg text-sm font-semibold h-11 px-8 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Create Character
          </button>
          <button
            onClick={handleBack}
            className="inline-flex items-center justify-center rounded-lg text-sm font-medium h-11 px-6 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const showBack = scene.scene_index != null && scene.scene_index > 0 && scene.input_type !== "confirm";

  return (
    <div data-testid="character-creation" className="flex flex-col items-center px-6 py-10 gap-6 max-w-2xl mx-auto relative">
      {scene.scene_index != null && scene.total_scenes != null && (
        <span className="absolute top-4 right-4 text-xs tracking-widest text-muted-foreground/40 font-light">
          {toRoman(scene.scene_index + 1)}
        </span>
      )}

      <div className="text-center mt-2 mb-4">
        <span className="text-muted-foreground/30 text-sm tracking-[0.5em]">
          ── ◇ ──
        </span>
      </div>

      <p className="text-lg leading-relaxed italic text-foreground/90 max-w-prose">{scene.prompt}</p>

      {scene.rolled_stats && scene.rolled_stats.length > 0 && (
        <div
          data-testid="creation-rolled-stats"
          className="grid grid-cols-3 gap-3 w-full max-w-md border-y border-border/40 py-4 my-2"
        >
          {scene.rolled_stats.map((stat) => (
            <div key={stat.name} className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
                {stat.name}
              </span>
              <span className="text-2xl font-bold text-[var(--primary)] tabular-nums">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {scene.choices && scene.choices.length > 0 && (
        <div className="flex flex-col gap-3 w-full max-w-prose">
          {scene.choices.map((choice, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              aria-selected={selectedIndex === i}
              data-selected={selectedIndex === i}
              onClick={() => handleChoice(i)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleChoice(i); }}
              className={`cursor-pointer rounded-lg border px-4 py-3
                         focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                         transition-all duration-150 ${
                           selectedIndex === i
                             ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/50 scale-[0.98]"
                             : "border-border/40 bg-card/50 text-foreground/70 hover:text-foreground hover:border-border hover:bg-card/80"
                         }`}
            >
              <span className="font-medium text-lg">{choice.label}</span>
              {choice.description && (
                <span className="block text-sm text-muted-foreground mt-0.5">{choice.description}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {(scene.allows_freeform || scene.input_type === "freeform" || scene.input_type === "name") && (
        <>
          {scene.choices && scene.choices.length > 0 && (
            <div className="flex items-center gap-3 w-full max-w-lg text-muted-foreground/40">
              <div className="flex-1 border-t border-border/30" />
              <span className="text-xs tracking-widest uppercase">or</span>
              <div className="flex-1 border-t border-border/30" />
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-lg">
            <input
            type="text"
            role="textbox"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Or describe it in your own words..."
            className="flex-1 rounded-md border border-input bg-background text-sm px-3 py-2 placeholder:italic placeholder:text-muted-foreground/50"
          />
            <button type="submit" className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/50">Submit</button>
          </form>
        </>
      )}

      {scene.input_type === "confirm" && (
        <div className="flex gap-3">
          <button onClick={handleConfirm} className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90">
            Confirm
          </button>
          <button
            onClick={handleBack}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            Go Back
          </button>
        </div>
      )}

      {scene.input_type === "continue" && (
        <button
          onClick={handleContinue}
          data-testid="creation-continue"
          className="inline-flex items-center justify-center rounded-lg text-sm font-semibold h-11 px-8 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Continue
        </button>
      )}

      {showBack && (
        <button
          onClick={handleBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
        >
          ← Back
        </button>
      )}
    </div>
  );
}
