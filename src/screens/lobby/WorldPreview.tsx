import { useState } from "react";
import type { GenreMeta, WorldMeta } from "@/types/genres";
import { getToneChips } from "./toneAxes";

export interface WorldPreviewProps {
  /** Pack-level metadata. Null when no genre is selected. */
  pack: GenreMeta | null;
  /** World-level metadata. Null when no world is selected. */
  world: WorldMeta | null;
}

/**
 * Right-panel preview card in the lobby picker.
 *
 * Renders hero image, title, era subtitle, full description, tone chips
 * derived from `axis_snapshot`, and the inspirations list. Handles four
 * states: empty (nothing selected), loading (data in flight — not used by
 * the current implementation because data is prop-driven), loaded (full
 * content), and image-failed (hero placeholder with literary copy).
 */
export function WorldPreview({ pack, world }: WorldPreviewProps) {
  // Track image-failed per world. Uses the React "adjust state during
  // render" pattern (preferred over useEffect for prop-derived resets,
  // see https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-when-a-prop-changes)
  // so eslint-plugin-react-hooks/set-state-in-effect doesn't fire.
  const [imageFailed, setImageFailed] = useState(false);
  const [trackedSlug, setTrackedSlug] = useState<string | null>(world?.slug ?? null);
  if ((world?.slug ?? null) !== trackedSlug) {
    setTrackedSlug(world?.slug ?? null);
    setImageFailed(false);
  }

  if (!pack || !world) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-6 min-h-[18rem]">
        <p className="text-base italic text-muted-foreground/50">
          Choose a genre to see what awaits.
        </p>
      </div>
    );
  }

  const toneChips = getToneChips(world.axis_snapshot);
  const showImage = world.hero_image && !imageFailed;

  return (
    <div className="flex-1 flex flex-col gap-4 px-6">
      {/* Hero image frame — fixed aspect ratio so layout doesn't jump. */}
      <div className="relative w-full aspect-video overflow-hidden rounded border border-muted-foreground/20 bg-muted/10">
        {showImage ? (
          <img
            src={world.hero_image!}
            alt={`${world.name} — ${world.setting ?? pack.name}`}
            className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
            onLoad={(e) => {
              (e.currentTarget as HTMLImageElement).style.opacity = "1";
            }}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-sm italic text-muted-foreground/40 tracking-wide">
              the page is faded…
            </p>
          </div>
        )}
      </div>

      {/* Title + era subtitle. */}
      <div>
        <h2 className="text-2xl text-foreground/90 tracking-wide">
          {world.name}
        </h2>
        {(world.setting || world.era) && (
          <p className="text-sm italic text-muted-foreground/70 mt-1">
            {world.setting}
            {world.setting && world.era && " · "}
            {world.era}
          </p>
        )}
      </div>

      {/* Tone chips — only rendered when axes are polarized enough. */}
      {toneChips.length > 0 && (
        <ul
          className="flex flex-wrap gap-2"
          aria-label={`Tone: ${toneChips.map((c) => c.label).join(", ")}`}
        >
          {toneChips.map((chip) => (
            <li
              key={chip.label}
              className="text-xs italic text-foreground/70
                         border border-muted-foreground/25 rounded-full
                         px-2.5 py-0.5"
            >
              <span aria-hidden="true" className="mr-1">
                {chip.glyph}
              </span>
              {chip.label}
            </li>
          ))}
        </ul>
      )}

      {/* Full description — no truncation. Adults read. */}
      <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
        {world.description}
      </p>

      {/* Inspirations list. */}
      {world.inspirations.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground/50 mb-1">
            Inspired by
          </p>
          <ul className="text-sm italic text-foreground/75 space-y-0.5">
            {world.inspirations.map((inspiration) => (
              <li key={inspiration}>· {inspiration}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
