import { useMemo, useState, useEffect } from "react";
import { buildSegments, groupPortraitSegments } from "@/lib/narrativeSegments";
import type { GameMessage } from "@/types/protocol";
import { renderSegment } from "./narrativeRenderers";
import { ThinkingIndicator } from "./NarrationShared";

export interface NarrationFocusProps {
  messages: GameMessage[];
  thinking?: boolean;
}

export function NarrationFocus({ messages, thinking }: NarrationFocusProps) {
  const segments = useMemo(
    () => groupPortraitSegments(buildSegments(messages)).filter((s) => s.kind !== "separator"),
    [messages],
  );

  const [index, setIndex] = useState(0);

  // Default to last segment when segments change
  useEffect(() => {
    if (segments.length > 0) {
      setIndex(segments.length - 1);
    }
  }, [segments.length]);

  const isFirst = index <= 0;
  const isLast = index >= segments.length - 1;

  return (
    <div data-testid="narration-focus" className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        {segments.length > 0 && (
          <div className="max-w-[85ch] w-full">
            {renderSegment(segments[index], index, { maxTextWidth: "max-w-[85ch]" })}
          </div>
        )}
      </div>

      {thinking && <ThinkingIndicator />}

      <div className="flex items-center justify-center gap-4 py-4 border-t border-border/30">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={isFirst}
          aria-label="Prev"
          className="px-3 py-1.5 text-sm rounded border border-border/50 hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>
        <span className="text-xs text-muted-foreground/50">
          {segments.length > 0 ? `${index + 1} / ${segments.length}` : "—"}
        </span>
        <button
          onClick={() => setIndex((i) => Math.min(segments.length - 1, i + 1))}
          disabled={isLast}
          aria-label="Next"
          className="px-3 py-1.5 text-sm rounded border border-border/50 hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
